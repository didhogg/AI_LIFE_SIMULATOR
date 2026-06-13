/**
 * Deterministic JSON serialization with recursively sorted keys.
 * Fingerprint and hash inputs must go through this function — bare JSON.stringify
 * produces insertion-order output which drifts across refactors.
 *
 * THIS FILE IS THE SOLE WHITELIST for ESLint rule 禁⑤ canonical-serialize-only.
 * All other engine files must call canonicalize() instead of JSON.stringify().
 */

function sortedReplacer(_key: string, value: unknown): unknown {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[k] = (value as Record<string, unknown>)[k];
    }
    return sorted;
  }
  return value;
}

/** JSON.stringify with recursively sorted object keys — stable for fingerprints. */
export function canonicalize(value: unknown): string {
  return JSON.stringify(value, sortedReplacer as (key: string, value: unknown) => unknown);
}
