import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { after } from "next/server.js";
import { reminderCompletion, retentionMs, type ReminderResult, type ReminderRun, type ReminderSource } from "./monitoring";
import { telemetryDrop, telemetryEnabled, writeReminderRun } from "./storage";

export async function withReminderPerformance<T extends ReminderResult>(
  source: ReminderSource,
  execute: () => Promise<T>,
): Promise<T> {
  if (!telemetryEnabled()) return execute();

  let startWrite: Promise<void> | undefined;
  let completion: ReminderRun["completion"];
  let finishedAt: Date | undefined;
  try {
    const startedAt = new Date();
    const started: ReminderRun = {
      _id: randomUUID(), source: source.kind, startedAt, expiresAt: new Date(+startedAt + retentionMs),
      ...(source.kind === "scheduled" ? {
        scheduledAt: source.scheduledAt,
        dispatchId: createHash("sha256").update(source.id).digest("hex"),
      } : {}),
    };
    after(async () => {
      await startWrite;
      if (completion) await writeReminderRun({ ...started, finishedAt, completion });
    });
    startWrite = writeReminderRun(started);
  } catch {
    telemetryDrop();
  }

  try {
    const result = await execute();
    if (startWrite) {
      try { completion = reminderCompletion(result); } catch { telemetryDrop(); }
    }
    return result;
  } catch (error) {
    completion = { outcome: "failed" };
    throw error;
  } finally {
    finishedAt = new Date();
  }
}
