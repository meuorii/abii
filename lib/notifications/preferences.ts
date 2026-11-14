import "server-only";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";
import { NotificationInputError } from "./errors";
import { NOTIFICATION_TYPES, isValidStudyTime, normalizeNotificationPreferences, type NotificationPreferences, type NotificationType } from "./contracts";

export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  await connectToDatabase();
  const user = await User.findById(userId).select("settings.notifications settings.dailyStudyTime").lean();
  if (!user) throw new Error("Authenticated account no longer exists.");
  return normalizeNotificationPreferences({ ...(user.settings?.notifications ?? {}), dailyStudyTime: user.settings?.dailyStudyTime });
}

export async function updateNotificationPreferences(userId: string, patch: { notifications?: Partial<Record<NotificationType, boolean>>; dailyStudyTime?: string | null }): Promise<NotificationPreferences> {
  const updates: Record<string, boolean | string | null> = {};
  if (patch.notifications) {
    for (const type of NOTIFICATION_TYPES) {
      const value = patch.notifications[type];
      if (value !== undefined) {
        if (type === "account_security" && value !== true) throw new NotificationInputError("Account security notifications are mandatory.");
        updates[`settings.notifications.${type}`] = value;
      }
    }
  }
  if (patch.dailyStudyTime !== undefined) {
    if (patch.dailyStudyTime !== null && !isValidStudyTime(patch.dailyStudyTime)) throw new NotificationInputError("Preferred study time must use HH:mm format.");
    updates["settings.dailyStudyTime"] = patch.dailyStudyTime;
  }
  if (Object.keys(updates).length === 0) throw new NotificationInputError("Provide at least one notification preference to update.");
  await connectToDatabase();
  const user = await User.findOneAndUpdate({ _id: userId }, { $set: updates }, { new: true, runValidators: true }).select("settings.notifications settings.dailyStudyTime").lean();
  if (!user) throw new Error("Authenticated account no longer exists.");
  return normalizeNotificationPreferences({ ...(user.settings?.notifications ?? {}), dailyStudyTime: user.settings?.dailyStudyTime });
}
