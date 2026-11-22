import { ordinaryUserExists, readUserDetail } from "@/lib/admin/users";
import { type AccountChange, type AccountChangeResult, accountReason, reasonMax, reasonMin, validUserId } from "@/lib/admin/users-contract";
import { openUsersToken } from "@/lib/admin/users-tokens";
import { privateJson, trustedAdminOrigin } from "@/lib/auth/admin-http";
import { AdminAccessError, requireAdmin } from "@/lib/auth/admin-session";
import { checkAuthRateLimit } from "@/lib/auth/rate-limit";
import { setUserSuspended } from "@/lib/auth/suspension";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
const maxBodyBytes = 4096;

function result(status: number, message: string, code?: AccountChangeResult["code"]) {
  return privateJson({ message, code } satisfies AccountChangeResult, status);
}

function failure(error: unknown, mutation = false) {
  if (error instanceof AdminAccessError && error.status !== 503) {
    return result(error.status, mutation ? "Sign in again with Google Authenticator to change account access." : "Sign in with your administrator account to view these details.", "reauthenticate");
  }
  return mutation
    ? result(503, "Abii could not confirm this change. Check the current account status before submitting again.", "unconfirmed")
    : result(503, "Account details are temporarily unavailable.");
}

async function boundedJson(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > maxBodyBytes) throw new RangeError();
  const reader = request.body?.getReader();
  if (!reader) throw new SyntaxError();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0;
  let text = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return JSON.parse(text + decoder.decode()) as unknown;
      size += value.byteLength;
      if (size > maxBodyBytes) {
        void reader.cancel().catch(() => {});
        throw new RangeError();
      }
      text += decoder.decode(value, { stream: true });
    }
  } finally { reader.releaseLock(); }
}

export async function GET(_request: Request, { params }: Context) {
  if (process.env.ABII_ADMIN_UI_ENABLED !== "true") return result(404, "Not found.");
  try {
    const actor = await requireAdmin();
    const { id } = await params;
    if (!validUserId(id)) return result(400, "Invalid account ID.");
    if (!await checkAuthRateLimit("admin-user-detail", actor.adminId, 120, 60_000)) return result(429, "Too many requests. Wait a minute and try again.");
    const detail = await readUserDetail(id);
    return detail ? privateJson(detail) : result(404, "This account is no longer available.");
  } catch (error) { return failure(error); }
}

export async function PATCH(request: Request, { params }: Context) {
  if (process.env.ABII_ADMIN_UI_ENABLED !== "true") return result(404, "Not found.");
  if (!trustedAdminOrigin(request)) return result(403, "Invalid request origin.");
  if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") return result(415, "Use a JSON request.");
  try {
    const actor = await requireAdmin({ fresh: true });
    const { id } = await params;
    if (!validUserId(id)) return result(400, "Invalid account ID.");
    if (!await checkAuthRateLimit("admin-user-transition", actor.adminId, 12, 60_000)) return result(429, "Too many account changes. Wait a minute and try again.");
    let body: unknown;
    try { body = await boundedJson(request); }
    catch (error) { return error instanceof RangeError ? result(413, "Request is too large.") : result(400, "Invalid request."); }
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(key => !["action", "reason", "revision"].includes(key))) {
      return result(400, "Invalid account change.");
    }
    const input = body as Partial<Record<keyof AccountChange, unknown>>;
    if ((input.action !== "suspend" && input.action !== "reactivate") || typeof input.revision !== "string") return result(400, "Invalid account change.");
    const reason = accountReason(input.reason);
    if (!reason) return result(400, `Enter a reason between ${reasonMin} and ${reasonMax} characters.`);
    const revision = openUsersToken(input.revision, `account:${id}`) as { version?: unknown; action?: unknown } | null;
    if (!revision || revision.action !== input.action || typeof revision.version !== "number" ||
        !Number.isSafeInteger(revision.version) || revision.version < 0) {
      return result(409, "This account view has expired. Reload its details to continue.", "stale");
    }
    const suspended = input.action === "suspend";
    if (await setUserSuspended(id, suspended, reason, undefined, revision.version)) {
      return result(200, suspended ? "Account suspended successfully." : "Account reactivated successfully.");
    }
    return await ordinaryUserExists(id)
      ? result(409, "This account changed since you opened it. Review its current status before continuing.", "stale")
      : result(404, "This account is no longer available.", "stale");
  } catch (error) { return failure(error, true); }
}
