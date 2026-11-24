export const ADMIN_SETTINGS_ID = "primary" as const;
export const sessionWarningLeads = [2, 5, 10] as const;

export type SettingsSection = "preferences" | "monitoring" | "platform";
export type SettingsPatch = { section: SettingsSection; revision: number; values: Record<string, unknown> };

export class SettingsInputError extends Error { constructor(message: string) { super(message); this.name = "SettingsInputError"; } }
export class SettingsConflict extends Error { constructor() { super("This settings section was changed elsewhere. Reload and try again."); this.name = "SettingsConflict"; } }
export class SettingsRateLimitError extends Error { constructor() { super("Too many password attempts. Please try again later."); this.name = "SettingsRateLimitError"; } }

const preferenceKeys = ["sessionWarningEnabled", "sessionWarningLeadMinutes", "operationalWarnings"] as const;
const monitoringKeys = ["serverErrorPercent", "latencyMs", "reminderWarnings", "monitoringNotices"] as const;
const platformKeys = ["publicSupportNoticeEnabled", "publicSupportNoticeText"] as const;

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new SettingsInputError("Invalid settings request.");
  return value as Record<string, unknown>;
}
function exact(record: Record<string, unknown>, keys: readonly string[]) {
  if (Object.keys(record).some(key => !keys.includes(key))) throw new SettingsInputError("Settings contain unsupported fields.");
}
function bool(value: unknown, label: string) { if (typeof value !== "boolean") throw new SettingsInputError(`${label} must be enabled or disabled.`); return value; }
function integer(value: unknown, label: string, values: readonly number[]) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || !values.includes(value)) throw new SettingsInputError(`${label} must be one of ${values.join(", ")}.`);
  return value;
}

export function validateSettingsPatch(input: unknown): SettingsPatch {
  const record = object(input);
  exact(record, ["section", "revision", "values"]);
  if (record.section !== "preferences" && record.section !== "monitoring" && record.section !== "platform") throw new SettingsInputError("Unsupported settings section.");
  if (typeof record.revision !== "number" || !Number.isSafeInteger(record.revision) || record.revision < 0) throw new SettingsInputError("Invalid settings revision.");
  const values = object(record.values);
  if (record.section === "preferences") {
    exact(values, preferenceKeys);
    return { section: record.section, revision: record.revision, values: {
      sessionWarningEnabled: bool(values.sessionWarningEnabled, "Session warning"),
      sessionWarningLeadMinutes: integer(values.sessionWarningLeadMinutes, "Warning lead time", sessionWarningLeads),
      operationalWarnings: bool(values.operationalWarnings, "Operational warnings"),
    } };
  }
  if (record.section === "monitoring") {
    exact(values, monitoringKeys);
    const serverErrorPercent = values.serverErrorPercent;
    const latencyMs = values.latencyMs;
    if (typeof serverErrorPercent !== "number" || !Number.isInteger(serverErrorPercent) || serverErrorPercent < 1 || serverErrorPercent > 20) throw new SettingsInputError("Server error threshold must be between 1 and 20.");
    if (typeof latencyMs !== "number" || !Number.isInteger(latencyMs) || latencyMs < 250 || latencyMs > 5000) throw new SettingsInputError("Latency threshold must be between 250 and 5000 ms.");
    return { section: record.section, revision: record.revision, values: { serverErrorPercent, latencyMs, reminderWarnings: bool(values.reminderWarnings, "Reminder warnings"), monitoringNotices: bool(values.monitoringNotices, "Monitoring notices") } };
  }
  exact(values, platformKeys);
  const publicSupportNoticeEnabled = bool(values.publicSupportNoticeEnabled, "Public support notice");
  if (typeof values.publicSupportNoticeText !== "string" || values.publicSupportNoticeText.trim().length > 500) throw new SettingsInputError("Support notice must be 500 characters or fewer.");
  const publicSupportNoticeText = values.publicSupportNoticeText.trim();
  if (publicSupportNoticeEnabled && !publicSupportNoticeText) throw new SettingsInputError("Support notice text is required when the notice is enabled.");
  return { section: record.section, revision: record.revision, values: { publicSupportNoticeEnabled, publicSupportNoticeText } };
}

type Evidence = { apiCoverage: string; jobCoverage: string; totals: { latency: { count: number }; serverErrors: number }; p95?: number | null; incidents: { component: string; evidence: string }[] };
export function evaluateMonitoringAlerts({ preferences, report }: { preferences: { monitoringNotices: boolean; serverErrorPercent: number; latencyMs: number; reminderWarnings: boolean }; report: Evidence }) {
  if (!preferences.monitoringNotices) return { state: "disabled" as const, alerts: [] as { metric: string; threshold: string; evidence: string }[] };
  if (report.apiCoverage === "read-failed" || report.jobCoverage === "read-failed") return { state: "unavailable" as const, alerts: [] as { metric: string; threshold: string; evidence: string }[] };
  if (report.apiCoverage !== "observed" || report.totals.latency.count < 20) return { state: "unknown" as const, alerts: [] as { metric: string; threshold: string; evidence: string }[] };
  const alerts: { metric: string; threshold: string; evidence: string }[] = [];
  const rate = report.totals.serverErrors / report.totals.latency.count * 100;
  if (rate >= preferences.serverErrorPercent) alerts.push({ metric: "Server errors", threshold: `${preferences.serverErrorPercent}%`, evidence: `${rate.toFixed(1)}% of ${report.totals.latency.count} observed requests` });
  if (typeof report.p95 === "number" && report.p95 >= preferences.latencyMs) alerts.push({ metric: "API latency p95", threshold: `${preferences.latencyMs} ms`, evidence: `${Math.round(report.p95)} ms across sufficient telemetry` });
  if (preferences.reminderWarnings) for (const incident of report.incidents.filter(item => item.component === "Reminder scheduler")) alerts.push({ metric: "Reminder scheduler", threshold: "No failed or overdue runs", evidence: incident.evidence });
  return { state: alerts.length ? "warning" as const : "healthy" as const, alerts };
}
