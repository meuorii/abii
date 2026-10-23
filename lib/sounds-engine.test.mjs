import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as core from "./sounds-core.mjs";

// Exercise the actual engine without a device. Record the Web Audio graph so a
// disconnected oscillator cannot pass merely because its scheduling succeeded.
const source = ts.transpileModule(readFileSync(new URL("./sounds.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

function harness({ state = "running", blocked = false } = {}) {
  const contexts = [];
  const listeners = {};
  const storage = new Map([["abii-sounds-volume", "70"]]);
  function param() {
    return {
      value: 0, events: [],
      setValueAtTime(value, time) { this.value = value; this.events.push([value, time]); },
      exponentialRampToValueAtTime(value, time) { this.events.push([value, time]); },
      setTargetAtTime(value, time) { this.events.push([value, time]); },
      cancelScheduledValues() {},
    };
  }
  function node(kind) {
    return { kind, outputs: [], connect(target) { this.outputs.push(target); }, disconnect() { this.outputs = []; } };
  }
  class AudioContext {
    constructor() {
      this.state = state;
      this.currentTime = 1;
      this.destination = node("destination");
      this.oscillators = [];
      this.gains = [];
      this.resumeCalls = 0;
      contexts.push(this);
    }
    resume() {
      this.resumeCalls += 1;
      if (blocked) return Promise.reject(new Error("Audio permission denied"));
      this.state = "running";
      return Promise.resolve();
    }
    createGain() { const gain = { ...node("gain"), gain: param() }; this.gains.push(gain); return gain; }
    createBiquadFilter() { return { ...node("filter"), frequency: param(), Q: param() }; }
    createOscillator() {
      const oscillator = { ...node("oscillator"), frequency: param(), detune: param(),
        start(time) { this.startTime = time; }, stop(time) { this.stopTime = time; } };
      this.oscillators.push(oscillator);
      return oscillator;
    }
  }
  const document = { visibilityState: "visible", addEventListener(name, callback) { listeners[name] = callback; } };
  const exports = {};
  runInNewContext(source, {
    exports, require: () => core, process: { env: { NODE_ENV: "production" } }, console,
    window: { AudioContext, localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) } },
    document,
  });
  return { engine: exports, contexts, document, listeners };
}

function reaches(node, target, seen = new Set()) {
  if (node === target) return true;
  if (seen.has(node)) return false;
  seen.add(node);
  return node.outputs.some((next) => reaches(next, target, seen));
}

for (const kind of ["correct", "wrong", "complete"]) {
  test(`${kind}: every scheduled oscillator reaches the audible destination`, () => {
    const { engine, contexts } = harness();
    engine.playAbiiSound(kind);
    const audio = contexts[0];
    assert.ok(audio.oscillators.length > 0);
    assert.equal(audio.gains[0].gain.value, 0.7);
    for (const oscillator of audio.oscillators) {
      assert.ok(reaches(oscillator, audio.destination), `${kind} has a disconnected oscillator`);
      assert.ok(oscillator.startTime >= audio.currentTime);
      assert.ok(oscillator.stopTime > oscillator.startTime);
      const envelope = oscillator.outputs[0];
      assert.ok(envelope.gain.events.some(([value]) => value > 0.001));
      oscillator.onended();
      assert.equal(oscillator.outputs.length, 0);
      assert.equal(envelope.outputs.length, 0);
    }
  });
}

test("completion replaces old voices without canceling its new notes and reuses context", () => {
  const { engine, contexts } = harness();
  engine.playAbiiSound("correct");
  const audio = contexts[0];
  const oldCount = audio.oscillators.length;
  engine.playAbiiSound("complete");
  assert.equal(contexts.length, 1);
  assert.ok(audio.oscillators.slice(0, oldCount).every((voice) => voice.stopTime < 1.1));
  assert.ok(audio.oscillators.slice(oldCount).every((voice) => voice.stopTime > 1.1));
});

test("muting and zero volume block previews; re-enabling restores scheduling", () => {
  const { engine, contexts } = harness();
  engine.setAbiiSoundEnabled(false);
  engine.playAbiiSound("correct");
  assert.equal(contexts.length, 0);
  engine.setAbiiSoundEnabled(true);
  engine.setAbiiSoundVolume(0);
  engine.playAbiiSound("wrong");
  assert.equal(contexts.length, 0);
  engine.setAbiiSoundVolume(70);
  engine.playAbiiSound("complete");
  assert.ok(contexts[0].oscillators.length > 0);
});

test("suspended previews resume before scheduling; rejected resume stays non-blocking", async () => {
  const allowed = harness({ state: "suspended" });
  allowed.engine.playAbiiSound("correct");
  assert.equal(allowed.contexts[0].oscillators.length, 0);
  await new Promise(setImmediate);
  assert.equal(allowed.contexts[0].resumeCalls, 1);
  assert.ok(allowed.contexts[0].oscillators.length > 0);
  const denied = harness({ state: "suspended", blocked: true });
  denied.engine.playAbiiSound("correct");
  await new Promise(setImmediate);
  assert.equal(denied.contexts[0].oscillators.length, 0);
});

test("hiding the tab cancels pending playback", async () => {
  const { engine, contexts, document, listeners } = harness({ state: "suspended" });
  engine.playAbiiSound("correct");
  document.visibilityState = "hidden";
  listeners.visibilitychange();
  await new Promise(setImmediate);
  assert.equal(contexts[0].oscillators.length, 0);
});
