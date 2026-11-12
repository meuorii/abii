/** Claim a single visual celebration only for the server-confirmed active-to-completed transition. */
export function claimCompletionCelebration(sessionId, transitioned, celebratedSessions) {
  if (typeof sessionId !== "string" || !sessionId || transitioned !== true || celebratedSessions.has(sessionId)) return false;
  celebratedSessions.add(sessionId);
  return true;
}
