import "server-only";
import mongoose from "mongoose";
import { connectToDatabase } from "../lib/mongodb";
import { User } from "../models/User";
import { reconcileUserBadges } from "../lib/badges/reconcile";

function readArgs(args: string[]) {
  const apply = args.includes("--apply");
  const batchArg = args.find((arg) => arg.startsWith("--batch-size="));
  const batchSize = batchArg ? Number(batchArg.slice("--batch-size=".length)) : 100;
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 500) throw new Error("--batch-size must be an integer from 1 to 500.");
  return { apply, batchSize };
}

async function main() {
  const { apply, batchSize } = readArgs(process.argv.slice(2));
  await connectToDatabase();
  let after: mongoose.Types.ObjectId | undefined;
  let processed = 0;
  let failures = 0;
  for (;;) {
    const query = after ? { _id: { $gt: after } } : {};
    const users = await User.find(query).select("_id").sort({ _id: 1 }).limit(batchSize).lean();
    if (!users.length) break;
    for (const user of users) {
      after = user._id;
      try {
        const result = await reconcileUserBadges(String(user._id), { dryRun: !apply, force: true });
        const unlocks = result.results.filter((badge) => badge.unlocked).map((badge) => badge.badgeId);
        console.log(JSON.stringify({ userId: String(user._id), mode: apply ? "apply" : "dry-run", qualifyingBadges: unlocks, newAwards: result.results.filter((badge) => badge.unlocked && !badge.alreadyEarned).length }));
      } catch (error) {
        failures += 1;
        console.error(JSON.stringify({ userId: String(user._id), error: error instanceof Error ? error.message : String(error) }));
      }
      processed += 1;
    }
  }
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", processed, failures }));
  if (failures) process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await mongoose.disconnect(); });
