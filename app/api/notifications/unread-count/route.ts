import { getCurrentUser } from "@/lib/auth/session";
import { notificationFailure, notificationJson } from "@/lib/notifications/http";
import { countUnreadNotifications } from "@/lib/notifications/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return notificationJson({ error: "Please log in to view notifications." }, 401);
  try { return notificationJson({ unreadCount: await countUnreadNotifications(String(user._id)) }); }
  catch (error) { return notificationFailure(error, "Unread notifications could not be counted."); }
}
