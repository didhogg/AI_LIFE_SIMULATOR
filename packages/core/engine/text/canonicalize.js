/**
 * Deterministic JSON serialization with recursively sorted keys.
 * Fingerprint and hash inputs must go through this function — bare JSON.stringify
 * produces insertion-order output which drifts across refactors.
 *
 * THIS FILE IS THE SOLE WHITELIST for ESLint rule 禁⑤ canonical-serialize-only.
 * All other engine files must call canonicalize() instead of JSON.stringify().
 */
function sortedReplacer(_key, value) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        const sorted = {};
        for (const k of Object.keys(value).sort()) {
            sorted[k] = value[k];
        }
        return sorted;
    }
    return value;
}
/** JSON.stringify with recursively sorted object keys — stable for fingerprints. */
export function canonicalize(value) {
    return JSON.stringify(value, sortedReplacer);
}
