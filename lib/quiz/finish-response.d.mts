import type { PublicSession } from "./types";

export function isQuizSummary(value: unknown): value is NonNullable<PublicSession["summary"]>;
export function isPublicSessionForId(value: unknown, expectedId: string): value is PublicSession;
export function classifyFinishResponse(
  value: unknown,
  expectedId: string,
):
  | { kind: "retry"; session: PublicSession & { status: "active"; summary: null } }
  | { kind: "complete"; session: PublicSession & { status: "completed"; summary: NonNullable<PublicSession["summary"]> } }
  | { kind: "invalid" };
