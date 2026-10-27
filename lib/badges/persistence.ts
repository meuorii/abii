import "server-only";
import mongoose, { type ClientSession } from "mongoose";
import { AchievementEvent } from "@/models/AchievementEvent";
import { UserBadge } from "@/models/UserBadge";
import { BadgeReconciliation } from "@/models/BadgeReconciliation";

/** Explicit history/material erasure clears durable activity but retains verified permanent awards. */
export async function clearAchievementActivity(userId: string, session?: ClientSession): Promise<void> {
  if (!mongoose.isValidObjectId(userId)) throw new TypeError("A valid authenticated user ID is required.");
  await AchievementEvent.deleteMany({ userId: new mongoose.Types.ObjectId(userId) }, session ? { session } : undefined);
  await UserBadge.updateMany({ userId: new mongoose.Types.ObjectId(userId) }, { $unset: { minimalEvidence: "" } }, session ? { session } : undefined);
  await BadgeReconciliation.deleteOne({ userId: new mongoose.Types.ObjectId(userId) }, session ? { session } : undefined);
}
