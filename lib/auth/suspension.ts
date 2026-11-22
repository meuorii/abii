import "server-only";
import { ordinaryRoleFilter, User } from "@/models/User";
import { accountReason, validUserId } from "@/lib/admin/users-contract";
import { auditAdmin } from "./admin-audit";
import { withFreshAdminMutation } from "./admin-session-state";

/** Repeated transitions are harmless. Re-activation cannot restore a revoked JWT. */
export async function setUserSuspended(targetId: string, suspended: boolean, reason: string, rawAdminCookie?: string, expectedVersion?: number): Promise<boolean> {
  const validatedReason = accountReason(reason);
  if (!validatedReason) throw new Error("A reason between 3 and 500 characters is required.");
  const credential = rawAdminCookie ?? await (await import("./admin-session")).adminCookieOrDeny();
  return withFreshAdminMutation(credential, async (actorId, session) => {
    if (!validUserId(targetId)) return false;
    const changed = await User.updateOne({
      _id: targetId,
      ...ordinaryRoleFilter,
      suspendedAt: suspended ? null : { $type: "date" },
      ...(expectedVersion === undefined ? {} : expectedVersion === 0
        ? { $or: [{ sessionVersion: 0 }, { sessionVersion: { $exists: false } }] }
        : { sessionVersion: expectedVersion }),
    }, {
      $set: { suspendedAt: suspended ? new Date() : null },
      $inc: { sessionVersion: 1 },
    }, { session });
    if (!changed.modifiedCount) return false;
    await auditAdmin(suspended ? "user.suspend" : "user.restore", actorId, targetId, session, validatedReason);
    return true;
  });
}
