/**
 * Deterministic Unicode text normalization.
 * Unicode version pinned so behavior is stable regardless of platform ICU updates.
 *
 * THIS FILE IS THE SOLE WHITELIST for ESLint rule 禁⑥ no-platform-normalize.
 * All other engine files must call these helpers instead of str.normalize() directly.
 *
 * P0-5 stub: version constant + NFC/NFKC helpers.
 * P0-6 / S3: full normalization pipeline (NFKC + case-fold + sort-key).
 */

/** Unicode version targeted by this normalization layer (matches Chrome 119 / V8 12.0). */
export const UNICODE_VERSION = '15.1.0' as const;

/** NFC-normalize a string. Use this instead of str.normalize('NFC') directly. */
export function normalizeNFC(s: string): string {
  return s.normalize('NFC');
}

/** NFKC-normalize a string. Stub — full pipeline wired in P0-6. */
export function normalizeNFKC(s: string): string {
  return s.normalize('NFKC');
}
