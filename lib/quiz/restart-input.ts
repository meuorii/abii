import type { PublicSession, ReviewFilter, ReviewScope } from "./types";

type RestartableSession = Pick<PublicSession, "subjectId" | "topicId" | "type"> & {
  scope?: ReviewScope;
  reviewFilter?: ReviewFilter;
};

export function reviewAgainInput(session: RestartableSession) {
  const scope = session.scope ?? (session.topicId ? "topic" : session.subjectId ? "subject" : "all");
  return {
    scope,
    ...(scope !== "all" && session.subjectId ? { subjectId: session.subjectId } : {}),
    ...(scope === "topic" && session.topicId ? { topicId: session.topicId } : {}),
    type: session.type,
    reviewFilter: session.reviewFilter === "due" ? "due" : "all",
  };
}
