import { NextResponse } from "next/server";
import { authorizeReminderRequest } from "@/lib/notifications/scheduler-auth";
import { runReminderBatch } from "@/lib/notifications/reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const authorization = authorizeReminderRequest(new URL(request.url).searchParams, request.headers.get("authorization"), process.env.CRON_SECRET);
  if (authorization === "invalid_parameters") return NextResponse.json({ error: "Query parameters are not accepted." }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
  if (authorization === "missing_secret") return NextResponse.json({ error: "Scheduler is not configured." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  if (authorization !== "authorized") return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  try {
    const result = await runReminderBatch(new Date(), 50);
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Study reminder scheduler batch failed.", { failure: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: "Study reminders could not be processed." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
