// B1·K1 Step 3a+3b — modWhitelist unit tests
// Full-set merge whitelist derivation: static RootSchema ∪ per-mod contributions.
// Step 3b: runDryRun promoted to standing CI guard consuming deriveModAwareWhitelist.
// Self-contained; no expectTypeOf / @ts-expect-error per project test paradigm.
import { describe, it, expect } from 'vitest';
import { computeLoadOrder, type ModRegistry } from '../loader/modGraph.js';
import { deriveModAwareWhitelist, type DerivedEntry } from '../loader/modWhitelist.js';
import { resolvePackId } from '../loader/resolvePackId.js';
import { deriveWritableWhitelist, runDryRun } from '../schema/whitelistDryRun.js';

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

// ─── Step 3b: runDryRun promoted to standing CI guard ────────────────────────
//
// Guards that deriveModAwareWhitelist(emptyRegistry) passes the same three
// checks as the original static derivation. This is the CI anchor proving the
// new function is a valid superset replacement for deriveWritableWhitelist().

describe('Step 3b · runDryRun(modAware) — CI guard with empty registry', () => {
  const emptyLor = computeLoadOrder({});
  const modAwareEntries = deriveModAwareWhitelist(emptyLor, {});

  it('check A passes: layer classification correct', () => {
    const report = runDryRun(modAwareEntries);
    expect(report.checkA.pass).toBe(true);
    expect(report.checkA.misclassified).toEqual([]);
  });

  it('check B passes: open-string vs enum distinguishable', () => {
    const report = runDryRun(modAwareEntries);
    expect(report.checkB.pass).toBe(true);
    expect(report.checkB.distinguishable).toBe(true);
  });

  it('check C passes: all 20 verb target probes covered', () => {
    const report = runDryRun(modAwareEntries);
    expect(report.checkC.pass).toBe(true);
    expect(report.checkC.missing).toEqual([]);
  });
});

describe('Step 3b · backward compat: runDryRun() == runDryRun(modAware)', () => {
  it('no-arg default produces identical result to mod-aware with empty registry', () => {
    const emptyLor = computeLoadOrder({});
    const modAwareEntries = deriveModAwareWhitelist(emptyLor, {});
    const defaultReport = runDryRun();
    const modAwareReport = runDryRun(modAwareEntries);
    // Structural deep-equal via JSON: same entries → same check results.
    expect(JSON.stringify(defaultReport)).toBe(JSON.stringify(modAwareReport));
  });
});

describe('Step 3b · determinism: runDryRun(modAware) double-run', () => {
  it('two runs produce identical report JSON', () => {
    const lor = computeLoadOrder({ a: mod(['b']), b: mod([]) });
    const entries = deriveModAwareWhitelist(lor, { a: mod(['b']), b: mod([]) });
    expect(JSON.stringify(runDryRun(entries))).toBe(JSON.stringify(runDryRun(entries)));
  });
});

// ─── B2·S5 resolvePackId — K6④ pure lookup ───────────────────────────────────

describe('resolvePackId — B2·K6④ effectiveId lookup', () => {
  it('返回 pack_id（存在时）', () => {
    const reg: ModRegistry = { my_mod: { 依赖: [], pack_id: 'my_mod' } };
    expect(resolvePackId(reg, 'my_mod')).toBe('my_mod');
  });

  it('返回 recordKey（pack_id 缺失时·effectiveId = pack_id ?? recordKey）', () => {
    const reg: ModRegistry = { legacy: { 依赖: [] } };
    expect(resolvePackId(reg, 'legacy')).toBe('legacy');
  });

  it('未知 key → undefined', () => {
    const reg: ModRegistry = { a: { 依赖: [] } };
    expect(resolvePackId(reg, 'not_exist')).toBeUndefined();
  });

  it('空注册表 → undefined', () => {
    expect(resolvePackId({}, 'any')).toBeUndefined();
  });
});

// ─── B2·S5 可写键 contribution — 白名单扩展 ──────────────────────────────────

describe('可写键 contribution — whitelist extension', () => {
  it('mod 携带 可写键 → 路径被纳入白名单', () => {
    const reg: ModRegistry = {
      hero: { 依赖: [], pack_id: 'hero', 可写键: ['货币系统.hero_wallet.余额'] },
    };
    const lor = computeLoadOrder(reg);
    const wl = deriveModAwareWhitelist(lor, reg);
    const paths = wl.map(e => e.path);
    expect(paths).toContain('货币系统.hero_wallet.余额');
  });

  it('无 可写键 的 mod → 白名单长度等于静态派生', () => {
    const reg: ModRegistry = { m: { 依赖: [], pack_id: 'm' } };
    const lor = computeLoadOrder(reg);
    const result = deriveModAwareWhitelist(lor, reg);
    expect(result.length).toBe(deriveWritableWhitelist().length);
  });

  it('被拒 mod（自环）携带 可写键 → 路径不进入白名单', () => {
    const reg: ModRegistry = {
      bad: { 依赖: ['bad'], pack_id: 'bad', 可写键: ['危险路径.not_allowed'] },
    };
    const lor = computeLoadOrder(reg);
    expect(lor.rejected).toContain('bad');
    const wl = deriveModAwareWhitelist(lor, reg);
    const paths = wl.map(e => e.path);
    expect(paths).not.toContain('危险路径.not_allowed');
  });

  it('多 mod 可写键合并去重 → 重复路径只出现一次', () => {
    const sharedPath = '共享字段.some_key';
    const reg: ModRegistry = {
      alpha: { 依赖: [], pack_id: 'alpha', 可写键: [sharedPath] },
      beta:  { 依赖: [], pack_id: 'beta',  可写键: [sharedPath] },
    };
    const lor = computeLoadOrder(reg);
    const wl = deriveModAwareWhitelist(lor, reg);
    const count = wl.filter(e => e.path === sharedPath).length;
    expect(count).toBe(1);
  });
});
