import { after } from "next/server";
import { adminCookieOrDeny, AdminAccessError, requireAdmin } from "@/lib/auth/admin-session";
import { privateJson, trustedAdminOrigin } from "@/lib/auth/admin-http";
import { announcementContent, AnnouncementInputError } from "@/lib/admin/announcement-contract";
import { AnnouncementConflict, AnnouncementDeliveryUnavailable, mutateAnnouncement, parseAnnouncementCommand, previewAnnouncement } from "@/lib/admin/announcements";
import { runDueAnnouncements } from "@/lib/notifications/announcement-worker";

export const runtime = "nodejs";
export const maxDuration = 60;
const bodyLimit = 8192;

async function bodyRecord(request: Request) {
  const reader = request.body?.getReader();
  if (!reader || Number(request.headers.get("content-length")) > bodyLimit) throw new AnnouncementInputError("Announcement request exceeds the allowed size.");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  try {
    let length = 0;
    let payload = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > bodyLimit) {
        void reader.cancel().catch(() => {});
        throw new Error();
      }
      payload += decoder.decode(value, { stream: true });
    }
    const data: unknown = JSON.parse(payload + decoder.decode());
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error();
    return data as Record<string, unknown>;
  } catch {
    throw new AnnouncementInputError("Invalid announcement request.");
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request: Request) {
  if (process.env.ABII_ADMIN_UI_ENABLED !== "true") return privateJson({ message: "Not found." }, 404);
  if (!trustedAdminOrigin(request)) return privateJson({ message: "Invalid request origin." }, 403);
  if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") {
    return privateJson({ message: "Use a JSON request." }, 415);
  }

  try {
    const rawCookie = await adminCookieOrDeny();
    await requireAdmin();
    const body = await bodyRecord(request);
    if (body.action === "preview") {
      if (Object.keys(body).some(key => !["action", "title", "message", "target"].includes(key))) throw new AnnouncementInputError("Invalid preview request.");
      return privateJson(await previewAnnouncement(announcementContent(body)));
    }
    const command = parseAnnouncementCommand(body);
    const announcement = await mutateAnnouncement(rawCookie, command);
    if (announcement.state === "queued") {
      try {
        after(async () => {
          try { await runDueAnnouncements({ id: announcement.id }); }
          catch { console.warn("abii.announcements.delivery_deferred"); }
        });
      } catch { /* The recurring scheduler will pick up the durable queue. */ }
    }
    return privateJson({ announcement });
  } catch (error) {
    if (error instanceof AnnouncementInputError) return privateJson({ message: error.message }, 400);
    if (error instanceof AnnouncementConflict) return privateJson({ message: error.message }, 409);
    if (error instanceof AnnouncementDeliveryUnavailable) return privateJson({ message: error.message }, 503);
    if (error instanceof AdminAccessError && error.status !== 503) {
      return privateJson({ message: "Sign in again with Google Authenticator to continue." }, error.status);
    }
    return privateJson({ message: "Abii could not confirm this change. Reload the announcement before trying again." }, 503);
  }
}
