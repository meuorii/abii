import { NextResponse } from "next/server";
import { NotificationInputError } from "./errors";

export function notificationJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

export function notificationFailure(error: unknown, fallback: string): NextResponse {
  if (error instanceof NotificationInputError) return notificationJson({ error: error.message }, 400);
  console.error(fallback, error);
  return notificationJson({ error: fallback }, 503);
}
