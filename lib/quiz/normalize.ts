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
