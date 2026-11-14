import { handleSchedule } from "@vercel/schedules";
import { runReminderBatch } from "@/lib/notifications/reminders";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Private Vercel Schedules target; manual or public access is rejected by the SDK dispatch parser. */
export const POST = handleSchedule(async (metadata) => {
  const startedAt = Date.now();
  const result = await runReminderBatch(new Date(), 50, { executionBudgetMs: 240_000 });
  const outcome = result.busy ? "lease_busy" : result.errors > 0 ? "partial" : result.hasMore ? "partial_batch" : "completed";
  console.info("Notification reminder schedule run finished.", {
    schedule: metadata.name,
    executionId: metadata.executionId,
    scheduledAt: metadata.scheduledAt.toISOString(),
    startedAt: new Date(startedAt).toISOString(),
    durationMs: Date.now() - startedAt,
    outcome,
    examined: result.examined,
    batches: result.batches,
    created: result.created,
    existing: result.existing,
    suppressed: result.suppressed,
    errors: result.errors,
    hasMore: result.hasMore,
  });
});
