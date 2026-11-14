import { getCurrentUser } from "@/lib/auth/session";
import { validOrigin } from "@/lib/auth/http";
import { notificationFailure, notificationJson } from "@/lib/notifications/http";
import { markNotificationRead } from "@/lib/notifications/service";

export const runtime = "nodejs";
export async function PATCH(request: Request, context: { params: Promise<{ notificationId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return notificationJson({ error: "Please log in to update notifications." }, 401);
  if (!validOrigin(request)) return notificationJson({ error: "This request could not be verified." }, 403);
  const { notificationId } = await context.params;
  try {
    const updated = await markNotificationRead(String(user._id), notificationId);
    return updated ? notificationJson({ message: "Notification marked as read." }) : notificationJson({ error: "Notification not found." }, 404);
  } catch (error) { return notificationFailure(error, "Notification could not be updated."); }
}
