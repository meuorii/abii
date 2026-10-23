/** Selects answer feedback only from an authoritative graded result. */
export function getAnswerSound(result, duplicate = false) {
  if (duplicate) return null;
  if (!result || typeof result.correct !== "boolean") return null;
  return result.correct ? "correct" : "wrong";
}

/** Resolves the browser preference while distinguishing missing data from intentional zero. */
export function resolveAbiiSoundVolume(stored, defaultVolume = 42) {
  if (typeof stored !== "string" || stored.trim() === "") return defaultVolume;
  const value = Number(stored);
  if (!Number.isFinite(value)) return defaultVolume;
  return Math.max(0, Math.min(100, value));
}

export function canPlayAbiiSound(enabled, volume) {
  return enabled === true && Number.isFinite(volume) && volume > 0;
}

/** Calls resume immediately, preserving the browser's user-activation window. */
export function resumeAbiiAudioContext(audioContext) {
  if (audioContext.state !== "suspended") return Promise.resolve(false);
  return audioContext.resume().then(() => true);
}

/** Guards interactive completion transitions against duplicate callbacks. */
export function shouldPlayCompletionSound(sessionId, playedSessions) {
  if (typeof sessionId !== "string" || !sessionId || playedSessions.has(sessionId)) return false;
  playedSessions.add(sessionId);
  return true;
}
