import { cookies } from "next/headers";
import { ADMIN_COOKIE, requireAdmin } from "@/lib/auth/admin-session";
import { AdminAccessError } from "@/lib/auth/admin-session-state";
import { privateJson, trustedAdminOrigin } from "@/lib/auth/admin-http";
import { changeAdminPassword, readSettingsSnapshot, saveAdminProfile, saveSettings } from "@/lib/admin/settings";
import { SettingsConflict, SettingsInputError, SettingsRateLimitError } from "@/lib/admin/settings-contract";
import { SESSION_COOKIE_OPTIONS } from "@/lib/auth/constants";

export const runtime = "nodejs";
const limit = 8_192;
async function body(request: Request) {
  const size = Number(request.headers.get("content-length"));
  if (Number.isFinite(size) && size > limit) throw Object.assign(new SettingsInputError("Settings request is too large."), { status: 413 });
  const reader = request.body?.getReader(); if (!reader) throw new SettingsInputError("Invalid settings request.");
  let bytes = 0, text = ""; const decoder = new TextDecoder("utf-8", { fatal: true });
  try { for (;;) { const part = await reader.read(); if (part.done) break; bytes += part.value.byteLength; if (bytes > limit) { void reader.cancel(); throw Object.assign(new SettingsInputError("Settings request is too large."), { status: 413 }); } text += decoder.decode(part.value, { stream: true }); }
    const value: unknown = JSON.parse(text + decoder.decode()); if (!value || typeof value !== "object" || Array.isArray(value)) throw new SettingsInputError("Invalid settings request."); return value as Record<string, unknown>;
  } catch (error) { if (error instanceof SettingsInputError) throw error; throw new SettingsInputError("Invalid settings request."); } finally { reader.releaseLock(); }
}
function failure(error: unknown) {
  if (error instanceof AdminAccessError) return privateJson({ message: error.message }, error.status);
  if (error instanceof SettingsConflict) return privateJson({ message: error.message }, 409);
  if (error instanceof SettingsRateLimitError) return privateJson({ message: error.message }, 429);
  if (error instanceof SettingsInputError) return privateJson({ message: error.message }, (error as Error & { status?: number }).status ?? 400);
  return privateJson({ message: "Settings service is unavailable. Please retry." }, 503);
}
export async function GET() {
  if (process.env.ABII_ADMIN_UI_ENABLED !== "true") return privateJson({ message: "Not found." }, 404);
  try { const access = await requireAdmin(); return privateJson(await readSettingsSnapshot(access.authenticatedAt)); } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  if (process.env.ABII_ADMIN_UI_ENABLED !== "true") return privateJson({ message: "Not found." }, 404);
  if (!trustedAdminOrigin(request)) return privateJson({ message: "Invalid request origin." }, 403);
  if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") return privateJson({ message: "Use a JSON request." }, 415);
  try {
    const rawCookie = (await cookies()).get(ADMIN_COOKIE)?.value; if (!rawCookie) throw new AdminAccessError(401);
    const access = await requireAdmin();
    const data = await body(request);
    if (data.action !== "profile" && data.action !== "settings" && data.action !== "password") throw new SettingsInputError("Unsupported settings action.");
    const allowed = data.action === "profile" ? ["action", "name", "revision"] : data.action === "settings" ? ["action", "section", "revision", "values"] : ["action", "currentPassword", "newPassword", "confirmPassword", "confirmed"];
    if (Object.keys(data).some(key => !allowed.includes(key))) throw new SettingsInputError("Settings request contains unsupported fields.");
    if (data.action === "profile") { await saveAdminProfile(rawCookie, { name: data.name, revision: data.revision }); return privateJson({ ok: true, snapshot: await readSettingsSnapshot(access.authenticatedAt) }); }
    if (data.action === "password") { await changeAdminPassword(rawCookie, { currentPassword: data.currentPassword, newPassword: data.newPassword, confirmPassword: data.confirmPassword, confirmed: data.confirmed }); (await cookies()).set(ADMIN_COOKIE, "", { ...SESSION_COOKIE_OPTIONS, maxAge: 0 }); return privateJson({ ok: true, signedOut: true }); }
    await saveSettings(rawCookie, { section: data.section, revision: data.revision, values: data.values });
    return privateJson({ ok: true, snapshot: await readSettingsSnapshot(access.authenticatedAt) });
  } catch (error) { return failure(error); }
}
