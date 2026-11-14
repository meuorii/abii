import { getCurrentUser } from "@/lib/auth/session";
import { validOrigin } from "@/lib/auth/http";
import { notificationFailure, notificationJson } from "@/lib/notifications/http";
import { markAllNotificationsRead } from "@/lib/notifications/service";

export const runtime = "nodejs";
export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return notificationJson({ error: "Please log in to update notifications." }, 401);
  if (!validOrigin(request)) return notificationJson({ error: "This request could not be verified." }, 403);
  try { return notificationJson({ modifiedCount: await markAllNotificationsRead(String(user._id)) }); }
  catch (error) { return notificationFailure(error, "Notifications could not be updated."); }
}
