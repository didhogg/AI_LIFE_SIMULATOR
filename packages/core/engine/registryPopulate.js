// packages/core/engine/registryPopulate.ts
// G-b: populate 受治理键空间注册表 from mod注册表 (D1 mixed: explicit + auto-enroll)
// G-c: cross-package arbitration (explicit 优先级 + modId 字典序 deterministic tiebreaker)
// IM3 D-1: each enabled mod's pack_id auto-enrolled in 'mod包' namespace
// A4 determinism: all iteration in codepoint 字典序, no random sources
//
// Constraints (红线):
//   Zero: rng.ts / fingerprintManifest / gate.ts function bodies — not imported here.
//   additive-only for schema: 命名空间键声明 is an optional array field.
//   schemaKeys stays 52 (no new top-level keys).
// ─── G-b + G-c + IM3-D1: populate registry from mod entries ──────────────────
//
// Rules:
//   1. Existing state entries (hand-crafted) are highest priority — never overwritten.
//   2. Explicit 命名空间键声明 from mods are merged next.
//   3. pack_id auto-enroll into 'mod包' namespace (IM3 D-1) fills after explicit.
//   4. Conflict between mods for same (规范键, 命名空间):
//      higher 优先级 wins; equal → lower pack_id (codepoint asc) wins (G-c D3).
//   5. Output is deterministic: derived entries sorted by 命名空间 then 规范键 asc.
//   6. Disabled mods (启用===false) are excluded.
//
// Returns the same reference if nothing was added (fast path for empty registries).
export function populateGoverneKeyRegistry(modRegistry, existingRegistry) {
    const existing = existingRegistry.键条目 ?? [];
    // Set of "规范键|命名空间" keys already in hand-crafted entries (highest priority)
    const existingSet = new Set(existing.map(e => `${e.规范键}|${e.命名空间}`));
    // Sort mods: higher 优先级 first; equal 优先级 → codepoint asc of pack_id
    // (G-c D3: deterministic tiebreaker = modId 字典序)
    const sortedMods = Object.values(modRegistry)
        .filter(m => m.启用 !== false)
        .sort((a, b) => {
        const pd = (b.优先级 ?? 0) - (a.优先级 ?? 0);
        if (pd !== 0)
            return pd;
        return a.pack_id < b.pack_id ? -1 : a.pack_id > b.pack_id ? 1 : 0;
    });
    // Map: dedup key → winning entry (first-writer-wins in priority-then-字典序 order)
    const derived = new Map();
    for (const mod of sortedMods) {
        // IM3 D-1: auto-enroll pack_id in 'mod包' namespace
        const pkgKey = `${mod.pack_id}|mod包`;
        if (!existingSet.has(pkgKey) && !derived.has(pkgKey)) {
            derived.set(pkgKey, {
                规范键: mod.pack_id,
                命名空间: 'mod包',
                来源包: mod.pack_id,
            });
        }
        // Explicit 命名空间键声明 (D1: author priority over auto-enumerate)
        for (const decl of mod.命名空间键声明 ?? []) {
            const key = `${decl.规范键}|${decl.命名空间}`;
            if (existingSet.has(key) || derived.has(key))
                continue; // already claimed by higher/earlier
            derived.set(key, {
                ...decl,
                来源包: decl.来源包 ?? mod.pack_id,
            });
        }
    }
    if (derived.size === 0)
        return existingRegistry;
    // Sort derived entries deterministically: 命名空间 asc, then 规范键 asc
    const sortedDerived = [...derived.values()].sort((a, b) => {
        const ns = a.命名空间 < b.命名空间 ? -1 : a.命名空间 > b.命名空间 ? 1 : 0;
        if (ns !== 0)
            return ns;
        return a.规范键 < b.规范键 ? -1 : a.规范键 > b.规范键 ? 1 : 0;
    });
    return {
        ...existingRegistry,
        键条目: [...existing, ...sortedDerived],
    };
}
