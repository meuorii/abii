import "server-only";
import mongoose from "mongoose";
import { publishWhatsNewAnnouncement } from "../lib/notifications/announcements";

function readArgs(args: string[]) {
  const values = new Map<string, string>();
  let apply = false;
  for (const arg of args) {
    if (arg === "--apply") { apply = true; continue; }
    const match = /^--(id|title|message|target|batch-size)=(.*)$/.exec(arg);
    if (!match || values.has(match[1])) throw new Error(`Unsupported or duplicate argument: ${arg.split("=")[0]}`);
    values.set(match[1], match[2]);
  }
  for (const required of ["id", "title", "message"]) if (!values.has(required)) throw new Error(`Missing required --${required}= value.`);
  const batchSize = Number(values.get("batch-size") ?? 100);
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 500) throw new Error("--batch-size must be an integer from 1 to 500.");
  const announcement = {
    id: values.get("id")!, title: values.get("title")!, message: values.get("message")!,
    ...(values.has("target") ? { target: values.get("target")! } : {}),
  };
  return { announcement, apply, batchSize };
}

async function main() {
  const options = readArgs(process.argv.slice(2));
  const result = await publishWhatsNewAnnouncement(options);
  console.log(JSON.stringify(result));
  if (result.mode === "published" && result.failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Announcement publication failed.");
  process.exitCode = 1;
}).finally(async () => { await mongoose.disconnect(); });
