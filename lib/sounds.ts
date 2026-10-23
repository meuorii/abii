import { canPlayAbiiSound, resolveAbiiSoundVolume, resumeAbiiAudioContext } from "@/lib/sounds-core.mjs";

const SOUND_KEY = "abii-sounds-enabled";
const VOLUME_KEY = "abii-sounds-volume";
const DEFAULT_VOLUME = 42;
const MIN_GAIN = 0.0001;

type SoundKind = "correct" | "wrong" | "complete";
type AudioContextWithWebkit = typeof window & { webkitAudioContext?: typeof AudioContext };
type Voice = { oscillator: OscillatorNode; gain: GainNode; nodes: AudioNode[] };

let context: AudioContext | null = null;
let master: GainNode | null = null;
let voices: Voice[] = [];
let playbackToken = 0;
let enabledOverride: boolean | null = null;
let volumeOverride: number | null = null;

function audioDebug(message: string, details?: unknown) {
  if (process.env.NODE_ENV === "development") console.debug(`[Abii audio] ${message}`, details);
}

function audioFailure(message: string, error: unknown) {
  if (process.env.NODE_ENV === "development") console.warn(`[Abii audio] ${message}`, error);
}

function readStorage(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}

export function isAbiiSoundEnabled(): boolean {
  if (enabledOverride !== null) return enabledOverride;
  return readStorage(SOUND_KEY) !== "false";
}

export function getAbiiSoundVolume(): number {
  if (volumeOverride !== null) return volumeOverride;
  return resolveAbiiSoundVolume(readStorage(VOLUME_KEY), DEFAULT_VOLUME);
}

export function setAbiiSoundEnabled(enabled: boolean): void {
  enabledOverride = enabled;
  try { window.localStorage.setItem(SOUND_KEY, String(enabled)); } catch { /* browser storage is optional */ }
  if (!enabled) stopAbiiSound();
}

export function setAbiiSoundVolume(volume: number): void {
  const normalized = Math.round(Math.max(0, Math.min(100, volume)));
  volumeOverride = normalized;
  try { window.localStorage.setItem(VOLUME_KEY, String(normalized)); } catch { /* browser storage is optional */ }
  if (context && master) {
    const now = context.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setTargetAtTime(normalized / 100, now, 0.025);
  }
}

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (context && context.state !== "closed") return context;
  const AudioContextConstructor = window.AudioContext || (window as AudioContextWithWebkit).webkitAudioContext;
  if (!AudioContextConstructor) {
    audioDebug("Web Audio is unavailable");
    return null;
  }

  try {
    context = new AudioContextConstructor();
    master = context.createGain();
    master.gain.value = getAbiiSoundVolume() / 100;
    master.connect(context.destination);
    document.addEventListener("visibilitychange", onVisibilityChange);
    audioDebug("Context initialized", { state: context.state, masterGain: master.gain.value });
    return context;
  } catch (error) {
    audioFailure("Context initialization failed", error);
    context = null;
    master = null;
    return null;
  }
}

function onVisibilityChange() {
  if (document.visibilityState === "hidden") stopAbiiSound();
}

/** Call directly from a user gesture before starting asynchronous work. */
export function unlockAbiiAudio(): void {
  if (!canPlayAbiiSound(isAbiiSoundEnabled(), getAbiiSoundVolume())) return;
  const audio = getAudioContext();
  if (!audio || audio.state !== "suspended") return;
  try {
    void resumeAbiiAudioContext(audio)
      .then(() => audioDebug("Gesture resume finished", { state: audio.state }))
      .catch((error) => audioFailure("Gesture resume failed", error));
  } catch (error) { audioFailure("Gesture resume failed", error); }
}

export function stopAbiiSound(): void {
  playbackToken += 1;
  audioDebug("Playback canceled", { token: playbackToken, voices: voices.length });
  const audio = context;
  if (!audio) return;
  const now = audio.currentTime;
  for (const voice of voices) {
    try {
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setTargetAtTime(MIN_GAIN, now, 0.018);
      voice.oscillator.stop(now + 0.075);
    } catch { /* voice already ended */ }
  }
}

function addTone(
  audio: AudioContext,
  frequency: number,
  start: number,
  duration: number,
  amplitude: number,
  wave: OscillatorType,
  filterFrequency?: number,
  detune = 0,
) {
  if (!master) return;
  const oscillator = audio.createOscillator();
  const envelope = audio.createGain();
  const nodes: AudioNode[] = [oscillator, envelope];
  oscillator.type = wave;
  oscillator.frequency.setValueAtTime(frequency, start);
  if (detune) oscillator.detune.setValueAtTime(detune, start);
  oscillator.connect(envelope);

  let output: AudioNode = envelope;
  if (filterFrequency) {
    const filter = audio.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(filterFrequency, start);
    filter.Q.value = 0.55;
    envelope.connect(filter);
    output = filter;
    nodes.push(filter);
  }
  output.connect(master);
  const attack = Math.min(0.026, duration * 0.2);
  envelope.gain.setValueAtTime(MIN_GAIN, start);
  envelope.gain.exponentialRampToValueAtTime(Math.max(amplitude, MIN_GAIN * 2), start + attack);
  envelope.gain.setTargetAtTime(MIN_GAIN, start + attack, Math.max(0.035, (duration - attack) / 3.5));

  const voice: Voice = { oscillator, gain: envelope, nodes };
  voices.push(voice);
  oscillator.onended = () => {
    for (const node of nodes) {
      try { node.disconnect(); } catch { /* already disconnected */ }
    }
    voices = voices.filter((active) => active !== voice);
  };
  oscillator.start(start);
  oscillator.stop(start + duration + 0.055);
}

function scheduleSound(audio: AudioContext, kind: SoundKind) {
  const start = audio.currentTime + 0.015;
  if (kind === "correct") {
    // A plucky, pentatonic bubble pop with a light octave shimmer.
    const notes = [
      { at: 0, f: 659.25, d: 0.16 },
      { at: 0.125, f: 783.99, d: 0.18 },
      { at: 0.255, f: 987.77, d: 0.25 },
    ];
    for (const note of notes) {
      addTone(audio, note.f, start + note.at, note.d, 0.115, "sine");
      addTone(audio, note.f * 2, start + note.at + 0.006, note.d * 0.58, 0.018, "sine");
      addTone(audio, note.f, start + note.at, note.d * 0.72, 0.023, "triangle", 2400, -3);
    }
    return;
  }

  if (kind === "wrong") {
    // A warm descending pair, softened by a low-pass filter.
    addTone(audio, 392, start, 0.24, 0.09, "sine", 1250);
    addTone(audio, 392, start, 0.19, 0.026, "triangle", 1250, -4);
    addTone(audio, 329.63, start + 0.19, 0.3, 0.095, "sine", 1150);
    addTone(audio, 329.63, start + 0.19, 0.24, 0.025, "triangle", 1150, 5);
    return;
  }

  // A short original C major pentatonic flourish, resolved in a soft final chord.
  const melody = [523.25, 659.25, 783.99, 659.25, 880];
  melody.forEach((frequency, index) => {
    const at = index * 0.145;
    addTone(audio, frequency, start + at, 0.26, 0.075, "sine");
    addTone(audio, frequency * 2, start + at + 0.008, 0.16, 0.014, "sine");
    addTone(audio, frequency, start + at, 0.2, 0.018, "triangle", 2600, index % 2 ? 3 : -3);
  });
  const chordAt = start + 0.79;
  [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
    const amplitude = index === 3 ? 0.026 : 0.038;
    addTone(audio, frequency, chordAt, 0.48, amplitude, "sine");
    addTone(audio, frequency * 2, chordAt + 0.012, 0.32, 0.008, "sine");
  });
}

/** Plays one synthesized, optional quiz sound using the shared browser audio context. */
export function playAbiiSound(kind: SoundKind): void {
  if (typeof window === "undefined") return;
  const enabled = isAbiiSoundEnabled();
  const volume = getAbiiSoundVolume();
  audioDebug("Playback requested", { kind, enabled, volume, visibility: document.visibilityState });
  if (document.visibilityState === "hidden" || !canPlayAbiiSound(enabled, volume)) {
    audioDebug("Playback skipped by preference or visibility", { kind });
    return;
  }

  const audio = getAudioContext();
  if (!audio || !master) return;
  const token = ++playbackToken;
  stopCurrentVoicesForReplacement();
  const play = () => {
    if (token !== playbackToken || document.visibilityState === "hidden") {
      audioDebug("Pending playback canceled", { kind, token, latestToken: playbackToken });
      return;
    }
    if (!canPlayAbiiSound(isAbiiSoundEnabled(), getAbiiSoundVolume())) {
      audioDebug("Pending playback muted", { kind });
      return;
    }
    if (audio.state !== "running") {
      audioDebug("Context is not running; playback skipped", { kind, state: audio.state });
      return;
    }
    try {
      const now = audio.currentTime;
      master?.gain.setTargetAtTime(getAbiiSoundVolume() / 100, now, 0.02);
      const previousVoices = voices.length;
      scheduleSound(audio, kind);
      audioDebug("Notes scheduled", { kind, state: audio.state, token, voices: voices.length - previousVoices, volume: getAbiiSoundVolume() });
    } catch (error) {
      audioFailure(`Failed to schedule ${kind}`, error);
      stopAbiiSound();
    }
  };
  if (audio.state === "suspended") {
    try {
      void resumeAbiiAudioContext(audio).then(() => {
        audioDebug("Preview resume finished", { kind, state: audio.state });
        play();
      }).catch((error) => audioFailure(`Resume failed for ${kind}`, error));
    } catch (error) { audioFailure(`Resume failed for ${kind}`, error); }
  } else {
    play();
  }
}

function stopCurrentVoicesForReplacement() {
  const audio = context;
  if (!audio) return;
  const now = audio.currentTime;
  for (const voice of voices) {
    try {
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setTargetAtTime(MIN_GAIN, now, 0.014);
      voice.oscillator.stop(now + 0.055);
    } catch { /* voice already ended */ }
  }
}
