export type AnswerSound = "correct" | "wrong";
export function getAnswerSound(result: { correct: boolean } | null | undefined, duplicate?: boolean): AnswerSound | null;
export function resolveAbiiSoundVolume(stored: string | null, defaultVolume?: number): number;
export function canPlayAbiiSound(enabled: boolean, volume: number): boolean;
export function resumeAbiiAudioContext(audioContext: { state: string; resume(): Promise<void> }): Promise<boolean>;
export function shouldPlayCompletionSound(sessionId: string, playedSessions: Set<string>): boolean;
