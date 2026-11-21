import "server-only";
import { Types } from "mongoose";
import { ordinaryRoleFilter, User } from "@/models/User";
import { auditAdmin } from "./admin-audit";
import { withFreshAdminMutation } from "./admin-session-state";

/** Repeated transitions are harmless. Re-activation cannot restore a revoked JWT. */
export async function setUserSuspended(targetId: string, suspended: boolean, rawAdminCookie?: string): Promise<boolean> {
  const credential = rawAdminCookie ?? await (await import("./admin-session")).adminCookieOrDeny();
  return withFreshAdminMutation(credential, async (actorId, session) => {
    if (!Types.ObjectId.isValid(targetId)) return false;
    const changed = await User.updateOne({
      _id: targetId,
      ...ordinaryRoleFilter,
      suspendedAt: suspended ? null : { $type: "date" },
    }, {
      $set: { suspendedAt: suspended ? new Date() : null },
      $inc: { sessionVersion: 1 },
    }, { session });
    if (!changed.modifiedCount) return false;
    await auditAdmin(suspended ? "user.suspend" : "user.restore", actorId, targetId, session);
    return true;
  });
}
