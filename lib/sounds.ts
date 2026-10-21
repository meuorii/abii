const SOUND_KEY = "abii-sounds-enabled";

function isSoundEnabled() {
  try { return window.localStorage.getItem(SOUND_KEY) !== "false"; }
  catch { return true; }
}

/** Short, synthesized UI sounds: no external audio files or dependencies required. */
export function playAbiiSound(kind: "correct" | "wrong" | "complete") {
  if (typeof window === "undefined" || !isSoundEnabled()) return;
  const AudioContextConstructor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) return;

  try {
    const context = new AudioContextConstructor();
    const notes: Record<typeof kind, Array<{ frequency: number; at: number; duration: number; type: OscillatorType }>> = {
      correct: [
        { frequency: 660, at: 0, duration: 0.11, type: "sine" },
        { frequency: 880, at: 0.1, duration: 0.16, type: "sine" },
      ],
      wrong: [
        { frequency: 310, at: 0, duration: 0.13, type: "triangle" },
        { frequency: 230, at: 0.12, duration: 0.2, type: "triangle" },
      ],
      complete: [
        { frequency: 523.25, at: 0, duration: 0.13, type: "sine" },
        { frequency: 659.25, at: 0.12, duration: 0.13, type: "sine" },
        { frequency: 783.99, at: 0.24, duration: 0.13, type: "sine" },
        { frequency: 1046.5, at: 0.36, duration: 0.28, type: "sine" },
      ],
    };
    const now = context.currentTime;
    notes[kind].forEach(({ frequency, at, duration, type }) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, now + at);
      gain.gain.setValueAtTime(0.0001, now + at);
      gain.gain.exponentialRampToValueAtTime(kind === "wrong" ? 0.07 : 0.09, now + at + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now + at);
      oscillator.stop(now + at + duration + 0.02);
    });
    window.setTimeout(() => { void context.close().catch(() => undefined); }, 1200);
  } catch {
    // Sound is decorative; never interrupt a quiz if the browser blocks audio.
  }
}
