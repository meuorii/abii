import { getCurrentUser } from "@/lib/auth/session";
import { isNotificationType, NOTIFICATION_GROUPS, type NotificationGroup } from "@/lib/notifications/contracts";
import { notificationFailure, notificationJson } from "@/lib/notifications/http";
import { listNotifications } from "@/lib/notifications/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return notificationJson({ error: "Please log in to view notifications." }, 401);
  const params = new URL(request.url).searchParams;
  for (const key of params.keys()) if (!["limit", "cursor", "unread", "type", "group"].includes(key)) return notificationJson({ error: "Notification filters are invalid." }, 400);
  const limitValue = params.get("limit");
  const limit = limitValue === null ? 20 : /^\d+$/.test(limitValue) ? Number(limitValue) : NaN;
  const unreadValue = params.get("unread");
  const typeValue = params.get("type");
  const groupValue = params.get("group");
  if (!Number.isInteger(limit) || limit < 1) return notificationJson({ error: "Notification page size is invalid." }, 400);
  if (unreadValue !== null && unreadValue !== "true" && unreadValue !== "false") return notificationJson({ error: "Unread filter is invalid." }, 400);
  if (typeValue !== null && !isNotificationType(typeValue)) return notificationJson({ error: "Notification type is invalid." }, 400);
  if (groupValue !== null && !Object.hasOwn(NOTIFICATION_GROUPS, groupValue)) return notificationJson({ error: "Notification group is invalid." }, 400);
  try {
    return notificationJson(await listNotifications(String(user._id), { limit: Math.min(limit, 50), ...(params.has("cursor") ? { cursor: params.get("cursor") ?? "" } : {}), ...(unreadValue === "true" ? { unreadOnly: true } : {}), ...(typeValue ? { type: typeValue } : {}), ...(groupValue ? { group: groupValue as NotificationGroup } : {}) }));
  } catch (error) { return notificationFailure(error, "Notifications could not be loaded."); }
}
