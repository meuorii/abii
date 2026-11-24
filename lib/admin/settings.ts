import "server-only";
import bcrypt from "bcryptjs";
import { Admin, ADMIN_ID, ADMIN_SUBJECT } from "@/models/Admin";
import { AdminSettings } from "@/models/AdminSettings";
import { connectToDatabase } from "@/lib/mongodb";
import { auditAdmin } from "@/lib/auth/admin-audit";
import { checkAuthRateLimit } from "@/lib/auth/rate-limit";
import { withFreshAdminMutation } from "@/lib/auth/admin-session-state";
import { readActiveAdmin } from "@/lib/auth/admin-identity";
import { ADMIN_LIFETIME } from "@/lib/auth/admin-factor";
import { evaluateMonitoringAlerts, ADMIN_SETTINGS_ID, SettingsConflict, SettingsInputError, SettingsRateLimitError, validateSettingsPatch } from "./settings-contract";
import { readPerformance } from "./performance";

const defaults = {
  revision: 0,
  preferences: { sessionWarningEnabled: true, sessionWarningLeadMinutes: 5, operationalWarnings: true },
  monitoring: { serverErrorPercent: 5, latencyMs: 1000, reminderWarnings: true, monitoringNotices: true },
  platform: { publicSupportNoticeEnabled: false, publicSupportNoticeText: "" },
};
type SettingsRow = { revision?: number; preferences?: Partial<typeof defaults.preferences> | null; monitoring?: Partial<typeof defaults.monitoring> | null; platform?: Partial<typeof defaults.platform> | null };
function cleanSettings(row: SettingsRow | null) {
  if (!row) return defaults;
  return {
    revision: typeof row.revision === "number" && Number.isSafeInteger(row.revision) && row.revision >= 0 ? row.revision : 0,
    preferences: { ...defaults.preferences, ...(row.preferences ?? {}) },
    monitoring: { ...defaults.monitoring, ...(row.monitoring ?? {}) },
    platform: { ...defaults.platform, ...(row.platform ?? {}) },
  };
}
function validName(value: unknown) {
  if (typeof value !== "string") throw new SettingsInputError("Enter an administrator name.");
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80 || /[\u0000-\u001f]/.test(name)) throw new SettingsInputError("Use a name between 2 and 80 characters.");
  return name;
}

export async function readPublicSupportNotice() {
  try {
    await connectToDatabase();
    const row = await AdminSettings.findById(ADMIN_SETTINGS_ID).select("platform").lean();
    return row?.platform?.publicSupportNoticeEnabled && row.platform.publicSupportNoticeText ? row.platform.publicSupportNoticeText : null;
  } catch { return null; }
}

export async function readSettingsSnapshot(authenticatedAt: number) {
  await connectToDatabase();
  const [admin, row] = await Promise.all([
    Admin.findById(ADMIN_ID).select("name email status lastLoginAt mutationVersion").lean(),
    AdminSettings.findById(ADMIN_SETTINGS_ID).lean(),
  ]);
  if (!admin || admin.status !== "active") throw new SettingsInputError("Administrator account is unavailable.");
  const settings = cleanSettings(row);
  let monitoring: ReturnType<typeof evaluateMonitoringAlerts> = { state: "unknown", alerts: [] };
  try {
    const report = await readPerformance("1h", new Date());
    const p95 = report.totals.latency.count ? (await import("@/lib/performance/monitoring")).percentiles(report.totals.latency).p95 : null;
    monitoring = evaluateMonitoringAlerts({ preferences: settings.monitoring, report: { apiCoverage: report.apiCoverage, jobCoverage: report.jobCoverage, totals: report.totals, p95, incidents: report.incidents } });
  } catch { monitoring = { state: "unavailable", alerts: [] }; }
  return {
    profile: { name: admin.name, email: admin.email, status: admin.status, lastLoginAt: admin.lastLoginAt?.toISOString() ?? null, revision: admin.mutationVersion ?? 0 },
    settings, monitoring, session: { expiresAt: new Date((authenticatedAt + ADMIN_LIFETIME) * 1000).toISOString(), lifetimeMinutes: ADMIN_LIFETIME / 60 },
  };
}

export async function saveSettings(rawCookie: string, input: unknown) {
  const patch = validateSettingsPatch(input);
  return withFreshAdminMutation(rawCookie, async (actor, session) => {
    const row = await AdminSettings.findById(ADMIN_SETTINGS_ID).session(session).lean();
    const current = cleanSettings(row);
    if (current.revision !== patch.revision) throw new SettingsConflict();
    const values = patch.values;
    const update = patch.section === "preferences" ? { preferences: values } : patch.section === "monitoring" ? { monitoring: values } : { platform: values };
    if (!row) {
      if (patch.revision !== 0) throw new SettingsConflict();
      await AdminSettings.create([{ _id: ADMIN_SETTINGS_ID, ...defaults, ...update, revision: 1 }], { session });
    } else {
      const changed = await AdminSettings.updateOne({ _id: ADMIN_SETTINGS_ID, revision: patch.revision }, { $set: update, $inc: { revision: 1 } }, { session, runValidators: true });
      if (!changed.modifiedCount) throw new SettingsConflict();
    }
    await auditAdmin(`settings.${patch.section}` as "settings.preferences", actor, ADMIN_SUBJECT, session);
    const [saved, admin] = await Promise.all([
      AdminSettings.findById(ADMIN_SETTINGS_ID).session(session).lean(),
      Admin.findById(ADMIN_ID).select("mutationVersion").session(session).lean(),
    ]);
    return { settings: cleanSettings(saved), profileRevision: admin?.mutationVersion ?? 0 };
  });
}

export async function saveAdminProfile(rawCookie: string, input: unknown) {
  const record = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : null;
  if (!record || Object.keys(record).some(key => key !== "name" && key !== "revision") || typeof record.revision !== "number" || !Number.isSafeInteger(record.revision) || record.revision < 0) throw new SettingsInputError("Invalid profile request.");
  const name = validName(record.name);
  const revision = record.revision as number;
  return withFreshAdminMutation(rawCookie, async (actor, session) => {
    const changed = await Admin.updateOne({ _id: ADMIN_ID, status: "active", mutationVersion: revision + 1 }, { $set: { name } }, { session, runValidators: true });
    if (!changed.modifiedCount) throw new SettingsConflict();
    await auditAdmin("settings.profile", actor, ADMIN_SUBJECT, session);
    const saved = await Admin.findById(ADMIN_ID).select("name mutationVersion").session(session).lean();
    return { name: saved!.name, revision: saved!.mutationVersion ?? revision + 1 };
  });
}

export async function changeAdminPassword(rawCookie: string, input: unknown) {
  const record = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : null;
  if (!record || Object.keys(record).some(key => !["currentPassword", "newPassword", "confirmPassword", "confirmed"].includes(key)) || typeof record.currentPassword !== "string" || typeof record.newPassword !== "string" || typeof record.confirmPassword !== "string" || record.confirmed !== true) throw new SettingsInputError("Confirm this password change before continuing.");
  const currentPassword = record.currentPassword as string, newPassword = record.newPassword as string, confirmPassword = record.confirmPassword as string;
  if (newPassword !== confirmPassword || newPassword.length < 12 || Buffer.byteLength(newPassword, "utf8") > 72 || newPassword.includes("\0")) throw new SettingsInputError("Use a matching password between 12 and 72 bytes.");
  if (!await checkAuthRateLimit("admin-password-change", ADMIN_SUBJECT, 5, 5 * 60_000)) throw new SettingsRateLimitError();
  return withFreshAdminMutation(rawCookie, async (actor, session) => {
    const admin = await readActiveAdmin(session);
    if (!admin || !await bcrypt.compare(currentPassword, admin.passwordHash)) throw new SettingsInputError("Current password is incorrect.");
    if (await bcrypt.compare(newPassword, admin.passwordHash)) throw new SettingsInputError("Your new password must be different.");
    const passwordHash = await bcrypt.hash(newPassword, 12);
    const changed = await Admin.updateOne({ _id: ADMIN_ID, status: "active", sessionVersion: admin.sessionVersion, passwordHash: admin.passwordHash }, { $set: { passwordHash }, $inc: { sessionVersion: 1 } }, { session, runValidators: true });
    if (!changed.modifiedCount) throw new SettingsConflict();
    await auditAdmin("settings.password", actor, ADMIN_SUBJECT, session);
    return { changed: true };
  });
}
