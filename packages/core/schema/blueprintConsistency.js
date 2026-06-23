/**
 * Blueprint ↔ Schema consistency utilities.
 *
 * Usage:
 *   import { getMissingFromSchema, getExtraInSchema } from './blueprintConsistency.js';
 *   const missing = getMissingFromSchema();   // keys in blueprint but not in RootSchema
 *   const extra   = getExtraInSchema();       // keys in RootSchema but not in blueprint
 *
 * Run ad-hoc:
 *   npx tsx packages/core/schema/blueprintConsistency.ts
 */
import { RootSchema, BLUEPRINT_KEYS } from './index.js';
/** Returns the set of top-level keys currently in RootSchema. */
export function getSchemaTopKeys() {
    return new Set(Object.keys(RootSchema.shape));
}
/** Returns the authoritative blueprint key list. */
export function getBlueprintKeys() {
    return new Set(BLUEPRINT_KEYS);
}
/** Keys declared in blueprint 4.0 but absent from RootSchema. */
export function getMissingFromSchema() {
    const schema = getSchemaTopKeys();
    return [...getBlueprintKeys()].filter(k => !schema.has(k));
}
/** Keys present in RootSchema but not listed in blueprint 4.0. */
export function getExtraInSchema() {
    const bp = getBlueprintKeys();
    return [...getSchemaTopKeys()].filter(k => !bp.has(k));
}
// ── CLI entry ─────────────────────────────────────────────────────────────────
// Run via: npx tsx packages/core/schema/blueprintConsistency.ts
if (process.argv[1]?.endsWith('blueprintConsistency.ts') || process.argv[1]?.endsWith('blueprintConsistency.js')) {
    const missing = getMissingFromSchema();
    const extra = getExtraInSchema();
    if (missing.length === 0 && extra.length === 0) {
        console.log('✅ blueprint ↔ schema: perfect match — no diff');
    }
    else {
        if (missing.length > 0) {
            console.log(`❌ In blueprint but MISSING from schema (${missing.length}):`);
            missing.forEach(k => console.log(`   − ${k}`));
        }
        if (extra.length > 0) {
            console.log(`⚠️  In schema but NOT in blueprint (${extra.length}):`);
            extra.forEach(k => console.log(`   + ${k}`));
        }
        process.exit(1);
    }
}
