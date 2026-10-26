import { connectToDatabase } from "../lib/mongodb";
import { QuizSession } from "../models/QuizSession";
import { ACTIVE_SESSION_INACTIVITY_DAYS } from "../lib/quiz/config";
import mongoose from "mongoose";

async function main() {
  await connectToDatabase();
  const now = new Date();
  const retentionMs = ACTIVE_SESSION_INACTIVITY_DAYS * 86_400_000;
  const activityExpiry = { $add: [{ $ifNull: ["$lastActivityAt", "$updatedAt"] }, retentionMs] };
  const filter = { status: "active", expiresAt: { $gt: now }, $expr: { $and: [{ $gt: [activityExpiry, now] }, { $lt: ["$expiresAt", activityExpiry] }] } };
  const affected = await QuizSession.countDocuments(filter);
  console.log(JSON.stringify({ dryRun: !process.argv.includes("--apply"), eligibleActiveSessions: affected, cutoff: now.toISOString(), retentionDays: ACTIVE_SESSION_INACTIVITY_DAYS }, null, 2));
  if (process.argv.includes("--apply")) {
    const result = await QuizSession.updateMany(filter, [{ $set: { expiresAt: { $max: ["$expiresAt", activityExpiry] }, lastActivityAt: { $ifNull: ["$lastActivityAt", "$updatedAt"] } } }]);
    console.log(JSON.stringify({ modified: result.modifiedCount }, null, 2));
  }
  await mongoose.disconnect();
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
