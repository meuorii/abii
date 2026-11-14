import { getCurrentUser } from "@/lib/auth/session";
import { validOrigin } from "@/lib/auth/http";
import { NOTIFICATION_TYPES, isValidStudyTime, type NotificationType } from "@/lib/notifications/contracts";
import { notificationFailure, notificationJson } from "@/lib/notifications/http";
import { getNotificationPreferences, updateNotificationPreferences } from "@/lib/notifications/preferences";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return notificationJson({ error: "Please log in to view notification preferences." }, 401);
  try { return notificationJson({ preferences: await getNotificationPreferences(String(user._id)) }); }
  catch (error) { return notificationFailure(error, "Notification preferences could not be loaded."); }
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return notificationJson({ error: "Please log in to update notification preferences." }, 401);
  if (!validOrigin(request)) return notificationJson({ error: "This request could not be verified." }, 403);
  let body: unknown;
  try { body = await request.json(); } catch { return notificationJson({ error: "Notification preferences are invalid." }, 400); }
  if (typeof body !== "object" || body === null || Array.isArray(body)) return notificationJson({ error: "Notification preferences are invalid." }, 400);
  const record = body as Record<string, unknown>;
  if (Object.keys(record).some((key) => key !== "notifications" && key !== "dailyStudyTime")) return notificationJson({ error: "Notification preferences contain unsupported fields." }, 400);
  const patch: { notifications?: Partial<Record<NotificationType, boolean>>; dailyStudyTime?: string | null } = {};
  if (record.notifications !== undefined) {
    if (typeof record.notifications !== "object" || record.notifications === null || Array.isArray(record.notifications)) return notificationJson({ error: "Notification preferences are invalid." }, 400);
    const values = record.notifications as Record<string, unknown>;
    if (Object.keys(values).some((key) => !(NOTIFICATION_TYPES as readonly string[]).includes(key)) || Object.values(values).some((value) => typeof value !== "boolean")) return notificationJson({ error: "Notification preferences are invalid." }, 400);
    patch.notifications = values as Partial<Record<NotificationType, boolean>>;
  }
  if (record.dailyStudyTime !== undefined) {
    if (record.dailyStudyTime !== null && (typeof record.dailyStudyTime !== "string" || !isValidStudyTime(record.dailyStudyTime))) return notificationJson({ error: "Preferred study time must use HH:mm format." }, 400);
    patch.dailyStudyTime = record.dailyStudyTime as string | null;
  }
  try { return notificationJson({ preferences: await updateNotificationPreferences(String(user._id), patch) }); }
  catch (error) { return notificationFailure(error, "Notification preferences could not be updated."); }
}
