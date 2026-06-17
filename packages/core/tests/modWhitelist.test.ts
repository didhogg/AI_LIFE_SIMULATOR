// B1·K1 Step 3a — modWhitelist unit tests
// Full-set merge whitelist derivation: static RootSchema ∪ per-mod contributions.
// Self-contained; no expectTypeOf / @ts-expect-error per project test paradigm.
import { describe, it, expect } from 'vitest';
import { computeLoadOrder, type ModRegistry } from '../loader/modGraph.js';
import { deriveModAwareWhitelist, type DerivedEntry } from '../loader/modWhitelist.js';
import { deriveWritableWhitelist } from '../schema/whitelistDryRun.js';

// ─── Type-level helpers ───────────────────────────────────────────────────────

type _Expect<T extends true> = T;
type _IsSubsetOf<A, B> = Exclude<A, B> extends never ? true : false;

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function mod(
  deps: string[] = [],
  opts: { 启用?: boolean; pack_id?: string } = {},
) {
  return { 依赖: deps, ...opts };
}

// ─── 1. Return type shape ─────────────────────────────────────────────────────

describe('deriveModAwareWhitelist — return type', () => {
  it('returns DerivedEntry[] (has path, layer, kind)', () => {
    type Assert = _Expect<
      _IsSubsetOf<'path' | 'layer' | 'kind', keyof DerivedEntry>
    >;
    const _check: Assert = true;
    void _check;

    const lor = computeLoadOrder({});
    const result = deriveModAwareWhitelist(lor, {});
    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      expect(result[0]).toHaveProperty('path');
      expect(result[0]).toHaveProperty('layer');
      expect(result[0]).toHaveProperty('kind');
    }
  });
});

// ─── 2. Empty registry == static derivation (regression anchor) ───────────────

describe('empty registry → identical to static deriveWritableWhitelist()', () => {
  it('JSON-deep-equal to static output', () => {
    const lor = computeLoadOrder({});
    const modAware = deriveModAwareWhitelist(lor, {});
    const staticOnly = deriveWritableWhitelist();
    expect(JSON.stringify(modAware)).toBe(JSON.stringify(staticOnly));
  });
});

// ─── 3. Non-empty registry (no contribution fields) → backward compatible ─────

describe('non-empty registry without contribution fields → same as static', () => {
  it('mods with only 依赖/启用/pack_id do not extend whitelist', () => {
    const reg: ModRegistry = {
      alpha: mod(['beta']),
      beta:  mod([]),
      gamma: mod([], { 启用: false }),
    };
    const lor = computeLoadOrder(reg);
    const result = deriveModAwareWhitelist(lor, reg);
    const staticOnly = deriveWritableWhitelist();
    expect(JSON.stringify(result)).toBe(JSON.stringify(staticOnly));
  });
});

// ─── 4. Key insertion order invariance (order-independent union) ──────────────
//
//  "并集对加载顺序无关（不增量·避免顺序依赖）"
//  Even though flattenedLoadOrder differs between registries with different key
//  insertion order, the union result must be identical.

describe('order-independent: key insertion order invariance', () => {
  it('same mods different key order → identical whitelist', () => {
    const regABC: ModRegistry = {
      a: mod(['b']),
      b: mod(['c']),
      c: mod([]),
    };
    const regCBA: ModRegistry = {
      c: mod([]),
      b: mod(['c']),
      a: mod(['b']),
    };
    const wlABC = deriveModAwareWhitelist(computeLoadOrder(regABC), regABC);
    const wlCBA = deriveModAwareWhitelist(computeLoadOrder(regCBA), regCBA);
    expect(JSON.stringify(wlABC)).toBe(JSON.stringify(wlCBA));
  });

  it('two independent mods — reversing load order does not change union', () => {
    const regXY: ModRegistry = { x: mod([]), y: mod([]) };
    const regYX: ModRegistry = { y: mod([]), x: mod([]) };
    const wlXY = deriveModAwareWhitelist(computeLoadOrder(regXY), regXY);
    const wlYX = deriveModAwareWhitelist(computeLoadOrder(regYX), regYX);
    expect(JSON.stringify(wlXY)).toBe(JSON.stringify(wlYX));
  });
});

// ─── 5. Rejected nodes (self-loop) excluded from merge ────────────────────────
//
//  Rejected mods are absent from flattenedLoadOrder (Step 1/2).
//  Their (currently empty) contributions must not appear in the result.

describe('rejected nodes excluded from merge', () => {
  it('self-loop mod: result still equals static derivation', () => {
    const reg: ModRegistry = {
      loop: mod(['loop']),  // self-loop → rejected
      safe: mod([]),
    };
    const lor = computeLoadOrder(reg);
    expect(lor.rejected).toContain('loop');
    const result = deriveModAwareWhitelist(lor, reg);
    const staticOnly = deriveWritableWhitelist();
    expect(JSON.stringify(result)).toBe(JSON.stringify(staticOnly));
  });

  it('cascade-rejected mod: result still equals static derivation', () => {
    const reg: ModRegistry = {
      loop:   mod(['loop']),
      victim: mod(['loop']),  // depends on rejected → cascade-rejected
    };
    const lor = computeLoadOrder(reg);
    expect(lor.rejected).toContain('victim');
    const result = deriveModAwareWhitelist(lor, reg);
    const staticOnly = deriveWritableWhitelist();
    expect(JSON.stringify(result)).toBe(JSON.stringify(staticOnly));
  });
});

// ─── 6. Disabled nodes excluded from merge ────────────────────────────────────

describe('disabled nodes excluded from merge', () => {
  it('disabled (启用=false) mod: result still equals static derivation', () => {
    const reg: ModRegistry = {
      off: mod([], { 启用: false }),
      on:  mod([]),
    };
    const lor = computeLoadOrder(reg);
    expect(lor.disabled).toContain('off');
    const result = deriveModAwareWhitelist(lor, reg);
    const staticOnly = deriveWritableWhitelist();
    expect(JSON.stringify(result)).toBe(JSON.stringify(staticOnly));
  });
});

// ─── 7. Determinism: same input → same output ────────────────────────────────

describe('determinism', () => {
  it('two runs produce identical JSON', () => {
    const reg: ModRegistry = {
      a: mod(['b', 'c']),
      b: mod(['d'], { pack_id: 'mod_b' }),
      c: mod(['d']),
      d: mod([]),
      e: mod(['e']),  // self-loop
      f: mod([], { 启用: false }),
    };
    const lor = computeLoadOrder(reg);
    const r1 = deriveModAwareWhitelist(lor, reg);
    const r2 = deriveModAwareWhitelist(lor, reg);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });
});

// ─── 8. mod contribution is empty → structurally equal to static (B2 note) ───

describe('B2 forward compatibility: zero contributions == static (semantic anchor)', () => {
  it('result length equals static derivation length', () => {
    const reg: ModRegistry = { m1: mod([]), m2: mod(['m1']), m3: mod(['m1', 'm2']) };
    const lor = computeLoadOrder(reg);
    const result = deriveModAwareWhitelist(lor, reg);
    const staticOnly = deriveWritableWhitelist();
    expect(result.length).toBe(staticOnly.length);
    // Semantic anchor: when B2 adds contribution fields and any mod contributes
    // at least one new path, this length check will detect the change.
  });
});

// ─── 9. 六禁 — no .localeCompare( in modWhitelist.ts ─────────────────────────

describe('六禁 — no localeCompare method call in modWhitelist', () => {
  it('modWhitelist.ts must not call .localeCompare()', async () => {
    const fs = await import('node:fs/promises');
    const src = await fs.readFile(
      new URL('../loader/modWhitelist.ts', import.meta.url),
      'utf8',
    );
    expect(src).not.toContain('.localeCompare(');
  });
});
