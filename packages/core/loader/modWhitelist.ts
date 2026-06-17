// packages/core/loader/modWhitelist.ts — B1·K1 Step 3a
// Full-set merge whitelist derivation: static RootSchema paths ∪ per-mod contributions.
//
// Design decisions (钉死·注释+测试固定):
//   A. UNION IS ORDER-INDEPENDENT: collect all mod path contributions into a shared
//      Set first, then merge with the base in one step ("全集合并后一次性派生").
//      Load order is used only for deterministic enumeration order, not to alter
//      the union result itself (no incremental accumulation).
//   B. Per-mod writable-key contribution fields do not exist yet.
//      B2 will add them to mod条目 (e.g. a 可写键: string[] field).
//      Until B2, every mod contributes ∅ → result == deriveWritableWhitelist() (base).
//   C. Same-key override / 取严 semantics are deferred to B5.
//      This step is pure set-union with deduplication; base paths take priority
//      (only base paths matter now; mod paths will be de-duped against base in B2+).
//   D. Rejected and disabled mods are already absent from flattenedLoadOrder
//      (Step 1/2 semantics). No additional filtering needed here.
//   E. No Math.random, no Date, no .normalize, no Intl.Collator;
//      any sort uses codepoint comparator (五禁④).

import { deriveWritableWhitelist, type DerivedEntry } from '../schema/whitelistDryRun.js';
import type { LoadOrderResult, ModRegistry } from './modGraph.js';

export type { DerivedEntry };

/**
 * Full-set merge whitelist derivation (B1·K1 Step 3a).
 *
 * Returns the union of:
 *   1. Static RootSchema-derived writable paths (deriveWritableWhitelist()).
 *   2. Per-mod writable-key contributions from all enabled, non-rejected mods
 *      in loadOrder.flattenedLoadOrder.
 *      Currently every mod contributes ∅ (B2 extension point below).
 *
 * The union is order-independent: all mod contributions go into a shared Set
 * before merging with the base (not incremental/sequential accumulation).
 */
export function deriveModAwareWhitelist(
  loadOrder: LoadOrderResult,
  registry: ModRegistry,
): DerivedEntry[] {
  // Step 1: static base — existing deterministic derivation from RootSchema.
  const base = deriveWritableWhitelist();

  // Step 2: collect ALL mod writable-key contributions into a shared Set (one pass).
  //   This is the "全集合并" — order of iteration does not affect the Set result.
  //
  //   B2 extension point: when mod条目 gains a contribution field, add here:
  //     for (const path of modEntry.可写键 ?? []) modPaths.add(path);
  //
  //   Rejected/disabled mods already absent from flattenedLoadOrder (Step 1/2).
  //   Same-key override/取严 留 B5 — only union/dedup here.
  const modPaths = new Set<string>();
  for (const key of loadOrder.flattenedLoadOrder) {
    const modEntry = registry[key];
    if (modEntry === undefined) continue;
    // No writable-key contribution fields yet (B2). Loop preserved as extension point.
  }

  // Step 3: merge base ∪ modPaths (dedup by path).
  //   Until B2, modPaths is empty → short-circuit returns base unchanged.
  if (modPaths.size === 0) return base;

  const seenPaths = new Set(base.map(e => e.path));
  const extra: DerivedEntry[] = [];
  for (const path of modPaths) {
    if (!seenPaths.has(path)) {
      // Layer/kind for mod-contributed paths will be specified by B2 schema.
      extra.push({ path, layer: 'writable', kind: 'open-string' });
    }
  }
  return [...base, ...extra];
}

// ─── Runtime consumption anchor (B6 / first consumer) ────────────────────────
//
// When the import-gate fires (B6), the canonical call sequence is:
//   1. Parse mod注册表 (RootSchema.parse or migrate()).
//   2. const lor = computeLoadOrder(parsedModRegistry);
//   3. const whitelist = deriveModAwareWhitelist(lor, parsedModRegistry);
//   4. runDryRun(whitelist)  →  assert all checks pass before consuming mod content.
//
// Until B6: no hosts/ variable; whitelist is derived and verified in CI only.
// Do NOT add any dead-code variable to server.ts / index.ts before step (4) has
// a live consumer.
//
// B2 extension: when mod条目 gains contribution fields (e.g. 可写键: string[]),
// fill the extension point in the for-loop above — no other changes needed.
