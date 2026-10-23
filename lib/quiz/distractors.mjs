import { randomInt } from "node:crypto";

const normalize = (value) => value.normalize("NFC").replace(/\s+/g, " ").trim().toLocaleLowerCase();
const shuffle = (values) => {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i -= 1) { const j = randomInt(i + 1); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
};
const keyFor = (items) => items.map(normalize).sort().join("\u0000");

/** Build unique, exact-length wrong enumeration lists using foreign items only. */
export function buildEnumerationWrongLists(correctItems, preferredCandidates, fallbackCandidates, count) {
  const own = new Set(correctItems.map(normalize));
  const clean = (values) => {
    const seen = new Set(own);
    return values.filter((value) => { const key = normalize(value); if (!key || seen.has(key)) return false; seen.add(key); return true; });
  };
  const preferred = clean(preferredCandidates);
  const fallback = clean(fallbackCandidates).filter((value) => !preferred.some((item) => normalize(item) === normalize(value)));
  if (!preferred.length && !fallback.length) return [];
  const taken = new Set([keyFor(correctItems)]); const result = [];
  for (let attempt = 0; attempt < 320 && result.length < count; attempt += 1) {
    const source = preferred.length ? preferred : fallback;
    const required = source[randomInt(source.length)];
    const pool = shuffle([...correctItems, ...preferred, ...fallback]);
    const candidate = [required];
    for (const item of pool) {
      if (candidate.length >= correctItems.length) break;
      if (!candidate.some((used) => normalize(used) === normalize(item))) candidate.push(item);
    }
    if (candidate.length !== correctItems.length) continue;
    const key = keyFor(candidate);
    if (taken.has(key)) continue;
    taken.add(key); result.push(shuffle(candidate));
  }
  return result;
}
