/**
 * Normalized comparison used for answers and distractor de-duplication.
 * Trims, collapses repeated whitespace and ignores case. Punctuation and
 * symbols are kept so "2+3" and "23" never match.
 */
export function normalizeText(value: string): string {
  return value.normalize("NFC").replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

/** Remove control characters from user-typed input before it is stored. */
export function sanitizeTyped(value: string, maxLength: number): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001F\u007F]/g, " ").slice(0, maxLength);
}


/**
 * Splits a flashcard answer into enumeration items. Items are separated by newlines or ";"
 * (or "," when neither is present). Leading bullets/numbers are removed and duplicates dropped.
 */
export function parseEnumeration(answer: string): string[] {
  const clean = (part: string) => part.replace(/^\s*(?:[-*•–]|\d{1,2}[.)])\s+/, "").replace(/\s+/g, " ").trim();
  let parts = answer.split(/[\n\r;]+/).map(clean).filter(Boolean);
  if (parts.length < 2) parts = answer.split(",").map(clean).filter(Boolean);
  const seen = new Set<string>();
  const items: string[] = [];
  for (const item of parts) {
    const key = normalizeText(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    items.push(item);
  }
  return items;
}
