// packages/core/tests/registryPopulate.test.ts
// 梯队A DoD: G-b populate + S6 check (mod生态路径II fire 层)
//
// 验收门:
//   A1 mod entry 导入期 enumerate → 填充 governedKeySpace registry
//   A2/A3 S6 未注册串 = 降级非拒收 (warn log · 非 throw)
//   A4 确定性: 同输入 → 同输出 (逐位恒等)
//   IM3-D1 pack_id auto-enrolled in 'mod包' namespace
//   G-c conflict: higher 优先级 wins; codepoint 字典序 tiebreaker

import { describe, it, expect } from 'vitest';
import { populateGoverneKeyRegistry } from '../engine/registryPopulate.js';
import {
  checkS6UnregisteredHandlerRefs,
  checkGoverneRegistryMembership,
  checkMotifRegistration,
  checkDisabledRuleKeyRefs,
  checkPackIdAliases,
  type MigLog,
} from '../migration/migrate.js';
// Note: backfillSeedSourcePkgName tests live in migration.test.ts (follows backfillPackId pattern)
import { RootSchema } from '../schema/index.js';

// ─── helpers ──────────────────────────────────────────────────────────────────

function emptyRegistry() {
  return { 键条目: [] } as { 键条目: { 规范键: string; 命名空间: string; 来源包?: string; 显示名?: string; 别名?: string[]; 停用?: boolean; 不可变?: boolean }[] };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeMod(pack_id: string, opts?: {
  优先级?: number;
  启用?: boolean;
  命名空间键声明?: { 规范键: string; 命名空间: string; 来源包?: string }[];
}): any {
  return {
    pack_id,
    启用: opts?.启用 ?? true,
    优先级: opts?.优先级 ?? 0,
    命名空间键声明: opts?.命名空间键声明,
  };
}

// ─── G-b populate: basic cases ────────────────────────────────────────────────

describe('populateGoverneKeyRegistry — G-b populate', () => {
  it('A1: empty mod registry → existing registry unchanged (same ref)', () => {
    const reg = emptyRegistry();
    const result = populateGoverneKeyRegistry({}, reg as any);
    expect(result).toBe(reg); // same reference = fast path
  });

  it('IM3-D1: enabled mod pack_id auto-enrolled in mod包 namespace', () => {
    const result = populateGoverneKeyRegistry(
      { my_mod: makeMod('my_mod') },
      emptyRegistry() as any,
    );
    const entry = result.键条目?.find(e => e.规范键 === 'my_mod' && e.命名空间 === 'mod包');
    expect(entry).toBeDefined();
    expect(entry!.来源包).toBe('my_mod');
  });

  it('IM3-D1: disabled mod NOT enrolled', () => {
    const result = populateGoverneKeyRegistry(
      { off_mod: makeMod('off_mod', { 启用: false }) },
      emptyRegistry() as any,
    );
    expect(result.键条目 ?? []).toHaveLength(0);
  });

  it('A1: mod with explicit 命名空间键声明 → entries added', () => {
    const result = populateGoverneKeyRegistry(
      {
        econ_mod: makeMod('econ_mod', {
          命名空间键声明: [
            { 规范键: 'gold', 命名空间: '币种' as const },
            { 规范键: 'silver', 命名空间: '币种' as const },
          ],
        }),
      },
      emptyRegistry() as any,
    );
    const entries = result.键条目 ?? [];
    expect(entries.some(e => e.规范键 === 'gold' && e.命名空间 === '币种')).toBe(true);
    expect(entries.some(e => e.规范键 === 'silver' && e.命名空间 === '币种')).toBe(true);
    // pack_id also enrolled in mod包
    expect(entries.some(e => e.规范键 === 'econ_mod' && e.命名空间 === 'mod包')).toBe(true);
    expect(entries).toHaveLength(3);
  });

  it('A1: explicit 来源包 in 命名空间键声明 preserved', () => {
    const result = populateGoverneKeyRegistry(
      {
        my_mod: makeMod('my_mod', {
          命名空间键声明: [
            { 规范键: 'coin_x', 命名空间: '币种' as const, 来源包: 'other_mod' },
          ],
        }),
      },
      emptyRegistry() as any,
    );
    const entry = result.键条目?.find(e => e.规范键 === 'coin_x');
    expect(entry?.来源包).toBe('other_mod'); // explicit 来源包 preserved
  });

  it('A1: no explicit 来源包 → defaults to pack_id', () => {
    const result = populateGoverneKeyRegistry(
      {
        my_mod: makeMod('my_mod', {
          命名空间键声明: [
            { 规范键: 'gem', 命名空间: '币种' as const },
          ],
        }),
      },
      emptyRegistry() as any,
    );
    const entry = result.键条目?.find(e => e.规范键 === 'gem');
    expect(entry?.来源包).toBe('my_mod');
  });

  it('existing hand-crafted entries take priority over mod-derived (same key)', () => {
    const existing = {
      键条目: [{
        规范键: 'gold',
        命名空间: '币种' as const,
        来源包: 'author',
        不可变: true,
      }],
    };
    const result = populateGoverneKeyRegistry(
      {
        mod_a: makeMod('mod_a', {
          命名空间键声明: [{ 规范键: 'gold', 命名空间: '币种' as const, 来源包: 'mod_a' }],
        }),
      },
      existing as any,
    );
    const entries = result.键条目 ?? [];
    // only one 'gold|币种' entry, from hand-crafted author
    const goldEntries = entries.filter(e => e.规范键 === 'gold' && e.命名空间 === '币种');
    expect(goldEntries).toHaveLength(1);
    expect(goldEntries[0]!.来源包).toBe('author');
    expect(goldEntries[0]!['不可变' as keyof typeof goldEntries[0]]).toBe(true);
  });
});

// ─── G-c conflict resolution ──────────────────────────────────────────────────

describe('populateGoverneKeyRegistry — G-c conflict resolution', () => {
  it('higher 优先级 wins when same 规范键+命名空间 claimed by two mods', () => {
    const result = populateGoverneKeyRegistry(
      {
        low_prio: makeMod('low_prio', {
          优先级: 0,
          命名空间键声明: [{ 规范键: 'rare_gem', 命名空间: '稀有度' as const, 来源包: 'low_prio' }],
        }),
        high_prio: makeMod('high_prio', {
          优先级: 10,
          命名空间键声明: [{ 规范键: 'rare_gem', 命名空间: '稀有度' as const, 来源包: 'high_prio' }],
        }),
      },
      emptyRegistry() as any,
    );
    const entry = result.键条目?.find(e => e.规范键 === 'rare_gem' && e.命名空间 === '稀有度');
    expect(entry?.来源包).toBe('high_prio');
  });

  it('equal 优先级 → lower pack_id (codepoint asc) wins', () => {
    const result = populateGoverneKeyRegistry(
      {
        mod_b: makeMod('mod_b', {
          优先级: 5,
          命名空间键声明: [{ 规范键: 'thing', 命名空间: '特质子类' as const, 来源包: 'mod_b' }],
        }),
        mod_a: makeMod('mod_a', {
          优先级: 5,
          命名空间键声明: [{ 规范键: 'thing', 命名空间: '特质子类' as const, 来源包: 'mod_a' }],
        }),
      },
      emptyRegistry() as any,
    );
    const entry = result.键条目?.find(e => e.规范键 === 'thing' && e.命名空间 === '特质子类');
    // 'mod_a' < 'mod_b' codepoint → mod_a wins
    expect(entry?.来源包).toBe('mod_a');
  });
});

// ─── A4 determinism ────────────────────────────────────────────────────────────

describe('populateGoverneKeyRegistry — A4 determinism', () => {
  it('same input → same output (bit-identical)', () => {
    const mods = {
      bravo: makeMod('bravo', {
        命名空间键声明: [{ 规范键: 'item_b', 命名空间: '特质子类' as const }],
      }),
      alpha: makeMod('alpha', {
        命名空间键声明: [{ 规范键: 'item_a', 命名空间: '特质子类' as const }],
      }),
    };
    const r1 = populateGoverneKeyRegistry(mods, emptyRegistry() as any);
    const r2 = populateGoverneKeyRegistry(mods, emptyRegistry() as any);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it('derived entries are sorted deterministically: 命名空间 asc then 规范键 asc', () => {
    const result = populateGoverneKeyRegistry(
      {
        z_mod: makeMod('z_mod', {
          命名空间键声明: [
            { 规范键: 'zzz', 命名空间: '币种' as const },
            { 规范键: 'aaa', 命名空间: '币种' as const },
          ],
        }),
        a_mod: makeMod('a_mod', {
          命名空间键声明: [
            { 规范键: 'mid', 命名空间: '稀有度' as const },
          ],
        }),
      },
      emptyRegistry() as any,
    );
    const derived = (result.键条目 ?? []).filter(e => e.命名空间 !== 'mod包');
    // Should be: 币种/aaa, 币种/zzz, 稀有度/mid (sort by 命名空间 then 规范键)
    expect(derived[0]?.命名空间).toBe('币种');
    expect(derived[0]?.规范键).toBe('aaa');
    expect(derived[1]?.规范键).toBe('zzz');
    expect(derived[2]?.命名空间).toBe('稀有度');
    expect(derived[2]?.规范键).toBe('mid');
  });
});

// ─── Shared state factory (used by S6 + G-d tests) ───────────────────────────

function makeState(overrides: Record<string, unknown> = {}) {
  const base = RootSchema.parse({});
  return { ...base, ...overrides } as ReturnType<typeof RootSchema.parse>;
}

// ─── S6 checkS6UnregisteredHandlerRefs ────────────────────────────────────────

describe('checkS6UnregisteredHandlerRefs — S6 fail-open', () => {

  it('A3: empty registry → no logs (fail-open fast exit)', () => {
    const state = makeState();
    const log: MigLog[] = [];
    checkS6UnregisteredHandlerRefs(state, log);
    expect(log).toHaveLength(0);
  });

  it('A3: registry has sideEffect句柄 but state has no lore → no logs', () => {
    const state = makeState({
      受治理键空间注册表: {
        键条目: [{ 规范键: 'combat_start', 命名空间: 'sideEffect句柄' as const }],
      },
    });
    const log: MigLog[] = [];
    checkS6UnregisteredHandlerRefs(state, log);
    expect(log).toHaveLength(0);
  });

  it('A3: unregistered side_effects handler in lore → warn log', () => {
    const state = makeState({
      受治理键空间注册表: {
        键条目: [{ 规范键: 'known_handler', 命名空间: 'sideEffect句柄' as const }],
      },
      // inject lore-like structure with an unknown handler
      _lore知识库: {
        entry1: {
          side_effects: ['known_handler', 'unknown_handler'],
        },
      },
    });
    const log: MigLog[] = [];
    checkS6UnregisteredHandlerRefs(state, log);
    const warns = log.filter(l => l.level === 'warn' && l.msg.includes('unknown_handler'));
    expect(warns).toHaveLength(1);
    expect(warns[0]!.msg).toContain('S6未注册');
    expect(warns[0]!.msg).toContain('降级非拒收');
  });

  it('A3: registered handler → no warn', () => {
    const state = makeState({
      受治理键空间注册表: {
        键条目: [{ 规范键: 'known_handler', 命名空间: 'sideEffect句柄' as const }],
      },
      _lore知识库: {
        entry1: { side_effects: ['known_handler'] },
      },
    });
    const log: MigLog[] = [];
    checkS6UnregisteredHandlerRefs(state, log);
    expect(log).toHaveLength(0);
  });

  it('A3: unregistered cascade_on_change handler → warn log', () => {
    const state = makeState({
      受治理键空间注册表: {
        键条目: [{ 规范键: 'known_cascade', 命名空间: 'cascade句柄' as const }],
      },
      _lore知识库: {
        entry1: { cascade_on_change: ['known_cascade', 'missing_cascade'] },
      },
    });
    const log: MigLog[] = [];
    checkS6UnregisteredHandlerRefs(state, log);
    const warns = log.filter(l => l.msg.includes('missing_cascade'));
    expect(warns).toHaveLength(1);
    expect(warns[0]!.msg).toContain('cascade句柄');
  });

  it('A3: unregistered 解除通道 handler → warn log', () => {
    const state = makeState({
      受治理键空间注册表: {
        键条目: [{ 规范键: 'legit_interceptor', 命名空间: '拦截器句柄' as const }],
      },
      _lore知识库: {
        entry1: { 解除通道: 'rogue_interceptor' },
      },
    });
    const log: MigLog[] = [];
    checkS6UnregisteredHandlerRefs(state, log);
    const warns = log.filter(l => l.msg.includes('rogue_interceptor'));
    expect(warns).toHaveLength(1);
    expect(warns[0]!.msg).toContain('拦截器句柄');
  });

  it('A3: 停用 registry entry counts as absent → unregistered warn for that key', () => {
    const state = makeState({
      受治理键空间注册表: {
        键条目: [
          { 规范键: 'disabled_h', 命名空间: 'sideEffect句柄' as const, 停用: true },
          { 规范键: 'active_h', 命名空间: 'sideEffect句柄' as const },
        ],
      },
      _lore知识库: {
        entry1: { side_effects: ['disabled_h', 'active_h'] },
      },
    });
    const log: MigLog[] = [];
    checkS6UnregisteredHandlerRefs(state, log);
    // disabled_h is treated as not registered → warn
    const warns = log.filter(l => l.msg.includes('disabled_h'));
    expect(warns).toHaveLength(1);
    // active_h is registered → no warn
    const activeWarns = log.filter(l => l.msg.includes('active_h'));
    expect(activeWarns).toHaveLength(0);
  });

  it('A3: nested lore structure → recursively scanned', () => {
    const state = makeState({
      受治理键空间注册表: {
        键条目: [{ 规范键: 'known_h', 命名空间: 'sideEffect句柄' as const }],
      },
      _lore知识库: {
        entry1: {
          nested: {
            deeper: {
              side_effects: ['unknown_deep'],
            },
          },
        },
      },
    });
    const log: MigLog[] = [];
    checkS6UnregisteredHandlerRefs(state, log);
    expect(log.some(l => l.msg.includes('unknown_deep'))).toBe(true);
  });

  it('A3: fail-open = never throws even if state has unexpected structure', () => {
    const state = makeState({
      受治理键空间注册表: {
        键条目: [{ 规范键: 'h', 命名空间: 'sideEffect句柄' as const }],
      },
      _lore知识库: null, // unusual but must not throw
    });
    const log: MigLog[] = [];
    expect(() => checkS6UnregisteredHandlerRefs(state, log)).not.toThrow();
  });

  it('A3: S6 check is deterministic: same input → same log output', () => {
    const state = makeState({
      受治理键空间注册表: {
        键条目: [{ 规范键: 'h1', 命名空间: 'sideEffect句柄' as const }],
      },
      _lore知识库: {
        zz: { side_effects: ['unknown_z'] },
        aa: { side_effects: ['unknown_a'] },
      },
    });
    const log1: MigLog[] = [];
    checkS6UnregisteredHandlerRefs(state, log1);
    const log2: MigLog[] = [];
    checkS6UnregisteredHandlerRefs(state, log2);
    expect(JSON.stringify(log1)).toBe(JSON.stringify(log2));
  });
});

// ─── G-d-registry: checkGoverneRegistryMembership ────────────────────────────

describe('checkGoverneRegistryMembership — G-d-registry B1', () => {
  it('B1: registry empty → fast exit, no logs', () => {
    const state = makeState({});
    const log: MigLog[] = [];
    checkGoverneRegistryMembership(state, log);
    expect(log).toHaveLength(0);
  });

  it('B1: registry has only mod包 entries (pack_id auto-enroll) → fast exit, no logs', () => {
    const state = makeState({
      受治理键空间注册表: {
        键条目: [{ 规范键: 'my_mod', 命名空间: 'mod包' as const }],
      },
    });
    const log: MigLog[] = [];
    checkGoverneRegistryMembership(state, log);
    expect(log).toHaveLength(0);
  });

  it('B1: registry has governed entries + mod has 可写键 with registered active leaf → no warn', () => {
    const state = makeState({
      受治理键空间注册表: {
        键条目: [{ 规范键: 'gold', 命名空间: '币种' as const }],
      },
      mod注册表: {
        econ_mod: {
          pack_id: 'econ_mod',
          版本: '1.0.0',
          启用: true,
          优先级: 0,
          依赖: [],
          冲突: [],
          命名空间: '',
          作者: '',
          轨道: 'gameplay' as const,
          可写键: ['货币系统.账户.main.持有.gold'],
        },
      },
    });
    const log: MigLog[] = [];
    checkGoverneRegistryMembership(state, log);
    expect(log).toHaveLength(0);
  });

  it('B1: leaf segment disabled in registry → warn G-d停用键', () => {
    const state = makeState({
      受治理键空间注册表: {
        键条目: [
          { 规范键: 'old_coin', 命名空间: '币种' as const, 停用: true },
          { 规范键: 'gold', 命名空间: '币种' as const },
        ],
      },
      mod注册表: {
        legacy_mod: {
          pack_id: 'legacy_mod',
          版本: '1.0.0',
          启用: true,
          优先级: 0,
          依赖: [],
          冲突: [],
          命名空间: '',
          作者: '',
          轨道: 'gameplay' as const,
          可写键: ['货币系统.账户.main.持有.old_coin'],
        },
      },
    });
    const log: MigLog[] = [];
    checkGoverneRegistryMembership(state, log);
    const warns = log.filter(l => l.msg.includes('G-d停用键'));
    expect(warns).toHaveLength(1);
    expect(warns[0]!.msg).toContain('old_coin');
    expect(warns[0]!.msg).toContain('降级非拒收');
  });

  it('B1: leaf segment not in registry (but registry has governed entries) → warn G-d未注册', () => {
    const state = makeState({
      受治理键空间注册表: {
        键条目: [{ 规范键: 'gold', 命名空间: '币种' as const }],
      },
      mod注册表: {
        trait_mod: {
          pack_id: 'trait_mod',
          版本: '1.0.0',
          启用: true,
          优先级: 0,
          依赖: [],
          冲突: [],
          命名空间: '',
          作者: '',
          轨道: 'gameplay' as const,
          可写键: ['角色.特质.brave'],
        },
      },
    });
    const log: MigLog[] = [];
    checkGoverneRegistryMembership(state, log);
    const warns = log.filter(l => l.msg.includes('G-d未注册'));
    expect(warns).toHaveLength(1);
    expect(warns[0]!.msg).toContain('brave');
    expect(warns[0]!.msg).toContain('降级非拒收');
  });

  it('B1: disabled mod → paths NOT checked', () => {
    const state = makeState({
      受治理键空间注册表: {
        键条目: [{ 规范键: 'gold', 命名空间: '币种' as const }],
      },
      mod注册表: {
        off_mod: {
          pack_id: 'off_mod',
          版本: '1.0.0',
          启用: false,
          优先级: 0,
          依赖: [],
          冲突: [],
          命名空间: '',
          作者: '',
          轨道: 'gameplay' as const,
          可写键: ['角色.特质.unregistered_trait'],
        },
      },
    });
    const log: MigLog[] = [];
    checkGoverneRegistryMembership(state, log);
    expect(log).toHaveLength(0);
  });

  it('B1: no 可写键 on mod → no logs', () => {
    const state = makeState({
      受治理键空间注册表: {
        键条目: [{ 规范键: 'gold', 命名空间: '币种' as const }],
      },
      mod注册表: {
        bare_mod: {
          pack_id: 'bare_mod',
          版本: '1.0.0',
          启用: true,
          优先级: 0,
          依赖: [],
          冲突: [],
          命名空间: '',
          作者: '',
          轨道: 'gameplay' as const,
        },
      },
    });
    const log: MigLog[] = [];
    checkGoverneRegistryMembership(state, log);
    expect(log).toHaveLength(0);
  });

  it('B1: multiple mods, mixed valid/unregistered → warns sorted deterministically', () => {
    const state = makeState({
      受治理键空间注册表: {
        键条目: [{ 规范键: 'gold', 命名空间: '币种' as const }],
      },
      mod注册表: {
        z_mod: {
          pack_id: 'z_mod',
          版本: '1.0.0',
          启用: true,
          优先级: 0,
          依赖: [],
          冲突: [],
          命名空间: '',
          作者: '',
          轨道: 'gameplay' as const,
          可写键: ['货币系统.持有.silver', '货币系统.持有.gold'],
        },
        a_mod: {
          pack_id: 'a_mod',
          版本: '1.0.0',
          启用: true,
          优先级: 0,
          依赖: [],
          冲突: [],
          命名空间: '',
          作者: '',
          轨道: 'gameplay' as const,
          可写键: ['货币系统.持有.bronze'],
        },
      },
    });
    const log1: MigLog[] = [];
    checkGoverneRegistryMembership(state, log1);
    const log2: MigLog[] = [];
    checkGoverneRegistryMembership(state, log2);
    // Deterministic: same input → same output
    expect(JSON.stringify(log1)).toBe(JSON.stringify(log2));
    // a_mod (bronze) before z_mod (silver) because of codepoint sort on modKey
    const paths = log1.map(l => l.path);
    const firstAMod = paths.findIndex(p => p.includes('a_mod'));
    const firstZMod = paths.findIndex(p => p.includes('z_mod'));
    expect(firstAMod).toBeLessThan(firstZMod);
    // gold is registered → no warn for gold in z_mod
    expect(log1.some(l => l.msg.includes('gold'))).toBe(false);
    // silver and bronze are unregistered → warn
    expect(log1.some(l => l.msg.includes('silver'))).toBe(true);
    expect(log1.some(l => l.msg.includes('bronze'))).toBe(true);
  });

  it('B1: fail-open = never throws even with unexpected state structure', () => {
    const state = makeState({
      受治理键空间注册表: {
        键条目: [{ 规范键: 'gold', 命名空间: '币种' as const }],
      },
      mod注册表: null, // unusual but must not throw
    });
    const log: MigLog[] = [];
    expect(() => checkGoverneRegistryMembership(state, log)).not.toThrow();
  });
});

// ─── integration: migrate() wires G-b + S6 ───────────────────────────────────

describe('migrate() integration — G-b populate via migrate()', () => {
  it('empty mod注册表 → 受治理键空间注册表.键条目 unchanged (no mod entries added)', async () => {
    const { migrate } = await import('../migration/migrate.js');
    const { state } = migrate({});
    // Empty mod registry → only hand-crafted entries (none in default state)
    const entries = state.受治理键空间注册表?.键条目 ?? [];
    expect(entries).toHaveLength(0);
  });

  it('mod with pack_id in state → pack_id enrolled in mod包 namespace after migrate', async () => {
    const { migrate } = await import('../migration/migrate.js');
    // Must include _系统版本: '4.1' to enter V4.1 fast path (not V3.1 migration)
    const input = {
      _系统版本: '4.1',
      mod注册表: {
        test_pkg: {
          pack_id: 'test_pkg',
          版本: '1.0.0',
          启用: true,
          优先级: 0,
          依赖: [],
          冲突: [],
          命名空间: '',
          作者: '',
          轨道: 'gameplay' as const,
        },
      },
    };
    const { state } = migrate(input);
    const pkgEntry = (state.受治理键空间注册表?.键条目 ?? [])
      .find(e => e.规范键 === 'test_pkg' && e.命名空间 === 'mod包');
    expect(pkgEntry).toBeDefined();
    expect(pkgEntry!.来源包).toBe('test_pkg');
  });
});

// ─── C1: G-c 跨包仲裁冲突日志 ───────────────────────────────────────────────

describe('populateGoverneKeyRegistry — C1 G-c conflict logging', () => {
  it('C1: no conflict → onConflict never called', () => {
    const conflicts: { key: string; ns: string; winner: string; loser: string }[] = [];
    populateGoverneKeyRegistry(
      {
        a_mod: makeMod('a_mod', {
          命名空间键声明: [{ 规范键: 'gold', 命名空间: '币种' as const }],
        }),
        b_mod: makeMod('b_mod', {
          命名空间键声明: [{ 规范键: 'silver', 命名空间: '币种' as const }],
        }),
      },
      emptyRegistry() as any,
      (key, ns, winner, loser) => conflicts.push({ key, ns, winner, loser }),
    );
    expect(conflicts).toHaveLength(0);
  });

  it('C1: same key+ns claimed by two mods → onConflict called for loser', () => {
    const conflicts: { key: string; ns: string; winner: string; loser: string }[] = [];
    populateGoverneKeyRegistry(
      {
        // a_mod has lower 优先级 so b_mod wins (higher prio), a_mod loses
        a_mod: makeMod('a_mod', {
          优先级: 0,
          命名空间键声明: [{ 规范键: 'gold', 命名空间: '币种' as const, 来源包: 'a_mod' }],
        }),
        b_mod: makeMod('b_mod', {
          优先级: 10,
          命名空间键声明: [{ 规范键: 'gold', 命名空间: '币种' as const, 来源包: 'b_mod' }],
        }),
      },
      emptyRegistry() as any,
      (key, ns, winner, loser) => conflicts.push({ key, ns, winner, loser }),
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.key).toBe('gold');
    expect(conflicts[0]!.ns).toBe('币种');
    expect(conflicts[0]!.winner).toBe('b_mod'); // higher 优先级 wins
    expect(conflicts[0]!.loser).toBe('a_mod');
  });

  it('C1: equal 优先级 tiebreaker → codepoint lower pack_id wins', () => {
    const conflicts: { key: string; ns: string; winner: string; loser: string }[] = [];
    populateGoverneKeyRegistry(
      {
        z_mod: makeMod('z_mod', {
          优先级: 5,
          命名空间键声明: [{ 规范键: 'gem', 命名空间: '稀有度' as const, 来源包: 'z_mod' }],
        }),
        a_mod: makeMod('a_mod', {
          优先级: 5,
          命名空间键声明: [{ 规范键: 'gem', 命名空间: '稀有度' as const, 来源包: 'a_mod' }],
        }),
      },
      emptyRegistry() as any,
      (key, ns, winner, loser) => conflicts.push({ key, ns, winner, loser }),
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.winner).toBe('a_mod'); // 'a_mod' < 'z_mod' codepoint
    expect(conflicts[0]!.loser).toBe('z_mod');
  });

  it('C1: hand-crafted entry wins silently (no conflict log for hand-crafted wins)', () => {
    const conflicts: { key: string; ns: string; winner: string; loser: string }[] = [];
    const existing = {
      键条目: [{ 规范键: 'gold', 命名空间: '币种' as const, 来源包: 'author' }],
    };
    populateGoverneKeyRegistry(
      {
        mod_a: makeMod('mod_a', {
          命名空间键声明: [{ 规范键: 'gold', 命名空间: '币种' as const }],
        }),
      },
      existing as any,
      (key, ns, winner, loser) => conflicts.push({ key, ns, winner, loser }),
    );
    // No conflict log: hand-crafted entries win silently (no loser mod)
    expect(conflicts).toHaveLength(0);
  });

  it('C1: conflict log is deterministic (same input → same conflicts)', () => {
    const mods = {
      z_mod: makeMod('z_mod', {
        优先级: 0,
        命名空间键声明: [{ 规范键: 'coin', 命名空间: '币种' as const, 来源包: 'z_mod' }],
      }),
      a_mod: makeMod('a_mod', {
        优先级: 0,
        命名空间键声明: [{ 规范键: 'coin', 命名空间: '币种' as const, 来源包: 'a_mod' }],
      }),
    };
    const c1: { key: string; ns: string; winner: string; loser: string }[] = [];
    populateGoverneKeyRegistry(mods, emptyRegistry() as any, (k, n, w, l) => c1.push({ key: k, ns: n, winner: w, loser: l }));
    const c2: { key: string; ns: string; winner: string; loser: string }[] = [];
    populateGoverneKeyRegistry(mods, emptyRegistry() as any, (k, n, w, l) => c2.push({ key: k, ns: n, winner: w, loser: l }));
    expect(JSON.stringify(c1)).toBe(JSON.stringify(c2));
  });
});

// ─── C2: G-c 母题写入口注册闸 ────────────────────────────────────────────────

describe('checkMotifRegistration — C2 G-c', () => {
  it('C2: no 母题 entries in registry → fast exit, no logs', () => {
    const state = makeState({
      受治理键空间注册表: {
        键条目: [{ 规范键: 'gold', 命名空间: '币种' as const }],
      },
    });
    const log: MigLog[] = [];
    checkMotifRegistration(state, log);
    expect(log).toHaveLength(0);
  });

  it('C2: 母题 in registry + _叙事设置.母题权重 has registered key → no warn', () => {
    const state = makeState({
      受治理键空间注册表: {
        键条目: [{ 规范键: 'adventure', 命名空间: '母题' as const }],
      },
      _叙事设置: { 母题权重: { adventure: 1.5 } },
    });
    const log: MigLog[] = [];
    checkMotifRegistration(state, log);
    expect(log).toHaveLength(0);
  });

  it('C2: 母题 in 母题权重 but unregistered → warn', () => {
    const state = makeState({
      受治理键空间注册表: {
        键条目: [{ 规范键: 'adventure', 命名空间: '母题' as const }],
      },
      _叙事设置: { 母题权重: { adventure: 1.5, unknown_theme: 2.0 } },
    });
    const log: MigLog[] = [];
    checkMotifRegistration(state, log);
    const warns = log.filter(l => l.msg.includes('unknown_theme'));
    expect(warns).toHaveLength(1);
    expect(warns[0]!.msg).toContain('G-c母题未注册');
    expect(warns[0]!.msg).toContain('降级非拒收');
  });

  it('C2: 全局.母题 unregistered → warn', () => {
    const state = makeState({
      受治理键空间注册表: {
        键条目: [{ 规范键: 'adventure', 命名空间: '母题' as const }],
      },
      全局: { 母题: 'mystery_quest' },
    });
    const log: MigLog[] = [];
    checkMotifRegistration(state, log);
    expect(log.some(l => l.msg.includes('mystery_quest'))).toBe(true);
  });

  it('C2: lore entry with 母题 field unregistered → warn', () => {
    const state = makeState({
      受治理键空间注册表: {
        键条目: [{ 规范键: 'adventure', 命名空间: '母题' as const }],
      },
      _lore知识库: {
        event1: { 母题: 'dark_secret' },
      },
    });
    const log: MigLog[] = [];
    checkMotifRegistration(state, log);
    expect(log.some(l => l.msg.includes('dark_secret'))).toBe(true);
  });

  it('C2: lore entry with 母题标签 array → warns for unregistered entries', () => {
    const state = makeState({
      受治理键空间注册表: {
        键条目: [{ 规范键: 'adventure', 命名空间: '母题' as const }],
      },
      _lore知识库: {
        event1: { 母题标签: ['adventure', 'unknown_tag'] },
      },
    });
    const log: MigLog[] = [];
    checkMotifRegistration(state, log);
    // 'adventure' registered → no warn; 'unknown_tag' not registered → warn
    expect(log.some(l => l.msg.includes('adventure'))).toBe(false);
    expect(log.some(l => l.msg.includes('unknown_tag'))).toBe(true);
  });

  it('C2: fail-open = never throws', () => {
    const state = makeState({
      受治理键空间注册表: {
        键条目: [{ 规范键: 'theme', 命名空间: '母题' as const }],
      },
      _叙事设置: null,
      全局: null,
      _lore知识库: null,
    });
    const log: MigLog[] = [];
    expect(() => checkMotifRegistration(state, log)).not.toThrow();
  });

  it('C2: deterministic: same input → same log output', () => {
    const state = makeState({
      受治理键空间注册表: {
        键条目: [{ 规范键: 'theme', 命名空间: '母题' as const }],
      },
      _叙事设置: { 母题权重: { zzz_theme: 2.0, aaa_theme: 1.0 } },
    });
    const log1: MigLog[] = [];
    checkMotifRegistration(state, log1);
    const log2: MigLog[] = [];
    checkMotifRegistration(state, log2);
    expect(JSON.stringify(log1)).toBe(JSON.stringify(log2));
    // sorted order: aaa_theme before zzz_theme
    expect(log1[0]!.msg).toContain('aaa_theme');
    expect(log1[1]!.msg).toContain('zzz_theme');
  });
});

// ─── C3/C4: G-e S5 规则引用完整性扫描扩维 ───────────────────────────────────

describe('checkDisabledRuleKeyRefs — C3/C4 G-e', () => {
  it('C3: no disabled non-handler registry entries → fast exit, no logs', () => {
    const state = makeState({
      受治理键空间注册表: {
        键条目: [{ 规范键: 'gold', 命名空间: '币种' as const }], // active, not disabled
      },
    });
    const log: MigLog[] = [];
    checkDisabledRuleKeyRefs(state, log);
    expect(log).toHaveLength(0);
  });

  it('C3: disabled key NOT referenced in lore → no warn', () => {
    const state = makeState({
      受治理键空间注册表: {
        键条目: [{ 规范键: 'old_coin', 命名空间: '币种' as const, 停用: true }],
      },
      _lore知识库: {
        entry1: { description: 'no reference here' },
      },
    });
    const log: MigLog[] = [];
    checkDisabledRuleKeyRefs(state, log);
    expect(log).toHaveLength(0);
  });

  it('C3: disabled key referenced as string value in lore → warn', () => {
    const state = makeState({
      受治理键空间注册表: {
        键条目: [{ 规范键: 'old_status', 命名空间: '状态子类' as const, 停用: true }],
      },
      _lore知识库: {
        rule1: { target: 'old_status' },
      },
    });
    const log: MigLog[] = [];
    checkDisabledRuleKeyRefs(state, log);
    const warns = log.filter(l => l.msg.includes('old_status'));
    expect(warns).toHaveLength(1);
    expect(warns[0]!.msg).toContain('G-e停用键被规则引用');
    expect(warns[0]!.msg).toContain('降级非拒收');
  });

  it('C3: handler namespace (sideEffect句柄/cascade句柄/拦截器句柄) disabled → NOT scanned by G-e (S6 handles)', () => {
    const state = makeState({
      受治理键空间注册表: {
        键条目: [{ 规范键: 'old_handler', 命名空间: 'sideEffect句柄' as const, 停用: true }],
      },
      _lore知识库: {
        rule1: { ref: 'old_handler' },
      },
    });
    const log: MigLog[] = [];
    checkDisabledRuleKeyRefs(state, log);
    // G-e does NOT check handler namespaces (handled by S6)
    expect(log).toHaveLength(0);
  });

  it('C3: disabled key in array in lore → warn for each occurrence', () => {
    const state = makeState({
      受治理键空间注册表: {
        键条目: [{ 规范键: 'deprecated_trait', 命名空间: '特质子类' as const, 停用: true }],
      },
      _lore知识库: {
        rule1: { traits: ['brave', 'deprecated_trait', 'kind'] },
      },
    });
    const log: MigLog[] = [];
    checkDisabledRuleKeyRefs(state, log);
    expect(log.some(l => l.msg.includes('deprecated_trait'))).toBe(true);
    // 'brave' and 'kind' not disabled → no warn
    expect(log.some(l => l.msg.includes('brave'))).toBe(false);
    expect(log.some(l => l.msg.includes('kind'))).toBe(false);
  });

  it('C4: deterministic: same input → same log output', () => {
    const state = makeState({
      受治理键空间注册表: {
        键条目: [
          { 规范键: 'a_dep', 命名空间: '状态子类' as const, 停用: true },
          { 规范键: 'z_dep', 命名空间: '状态子类' as const, 停用: true },
        ],
      },
      _lore知识库: {
        rule_z: { ref: 'z_dep' },
        rule_a: { ref: 'a_dep' },
      },
    });
    const log1: MigLog[] = [];
    checkDisabledRuleKeyRefs(state, log1);
    const log2: MigLog[] = [];
    checkDisabledRuleKeyRefs(state, log2);
    expect(JSON.stringify(log1)).toBe(JSON.stringify(log2));
    // sorted: rule_a before rule_z
    expect(log1[0]!.msg).toContain('a_dep');
    expect(log1[1]!.msg).toContain('z_dep');
  });

  it('C4: fail-open = never throws', () => {
    const state = makeState({
      受治理键空间注册表: {
        键条目: [{ 规范键: 'dep_key', 命名空间: '稀有度' as const, 停用: true }],
      },
      _lore知识库: null,
    });
    const log: MigLog[] = [];
    expect(() => checkDisabledRuleKeyRefs(state, log)).not.toThrow();
  });
});

// ─── D-2: 散落别名归一·mod包命名空间观测 ─────────────────────────────────────

describe('checkPackIdAliases — D-2 散落别名', () => {
  it('D-2: no mod包 registry entries → fast exit, no logs', () => {
    const state = makeState({
      受治理键空间注册表: { 键条目: [{ 规范键: 'gold', 命名空间: '币种' as const }] },
      $隐藏记忆库: { 延时种子: { s1: { 来源: { 包id: 'unknown_mod' } } } },
      行动卡库: { card1: { _来源包: 'unknown_mod' } },
    });
    const log: MigLog[] = [];
    checkPackIdAliases(state, log);
    expect(log).toHaveLength(0);
  });

  it('D-2: 延时种子.来源.包id 空串哨兵 → skip, no warn', () => {
    const state = makeState({
      受治理键空间注册表: { 键条目: [{ 规范键: 'my_mod', 命名空间: 'mod包' as const }] },
      $隐藏记忆库: { 延时种子: { s1: { 来源: { 包id: '' } } } },
    });
    const log: MigLog[] = [];
    checkPackIdAliases(state, log);
    expect(log).toHaveLength(0);
  });

  it('D-2: 延时种子.来源.包id 已注册 → no warn', () => {
    const state = makeState({
      受治理键空间注册表: { 键条目: [{ 规范键: 'my_mod', 命名空间: 'mod包' as const }] },
      $隐藏记忆库: { 延时种子: { s1: { 来源: { 包id: 'my_mod' } } } },
    });
    const log: MigLog[] = [];
    checkPackIdAliases(state, log);
    expect(log).toHaveLength(0);
  });

  it('D-2: 延时种子.来源.包id 未注册 → warn with correct path', () => {
    const state = makeState({
      受治理键空间注册表: { 键条目: [{ 规范键: 'my_mod', 命名空间: 'mod包' as const }] },
      $隐藏记忆库: { 延时种子: { seed_x: { 来源: { 包id: 'ghost_mod' } } } },
    });
    const log: MigLog[] = [];
    checkPackIdAliases(state, log);
    expect(log).toHaveLength(1);
    expect(log[0]!.level).toBe('warn');
    expect(log[0]!.path).toBe('$隐藏记忆库.延时种子.seed_x.来源.包id');
    expect(log[0]!.msg).toContain('ghost_mod');
    expect(log[0]!.msg).toContain('D-2散落别名');
  });

  it('D-2: 行动卡库._来源包 空串哨兵 → skip, no warn', () => {
    const state = makeState({
      受治理键空间注册表: { 键条目: [{ 规范键: 'my_mod', 命名空间: 'mod包' as const }] },
      行动卡库: { card1: { _来源包: '' } },
    });
    const log: MigLog[] = [];
    checkPackIdAliases(state, log);
    expect(log).toHaveLength(0);
  });

  it('D-2: 行动卡库._来源包 已注册 → no warn', () => {
    const state = makeState({
      受治理键空间注册表: { 键条目: [{ 规范键: 'core_base', 命名空间: 'mod包' as const }] },
      行动卡库: { card1: { _来源包: 'core_base' } },
    });
    const log: MigLog[] = [];
    checkPackIdAliases(state, log);
    expect(log).toHaveLength(0);
  });

  it('D-2: 行动卡库._来源包 未注册 → warn with correct path', () => {
    const state = makeState({
      受治理键空间注册表: { 键条目: [{ 规范键: 'core_base', 命名空间: 'mod包' as const }] },
      行动卡库: { action_a: { _来源包: 'orphan_mod' } },
    });
    const log: MigLog[] = [];
    checkPackIdAliases(state, log);
    expect(log).toHaveLength(1);
    expect(log[0]!.level).toBe('warn');
    expect(log[0]!.path).toBe('行动卡库.action_a._来源包');
    expect(log[0]!.msg).toContain('orphan_mod');
    expect(log[0]!.msg).toContain('D-2散落别名');
  });

  it('D-2: deterministic — sorted key order, same input → same log', () => {
    const state = makeState({
      受治理键空间注册表: { 键条目: [{ 规范键: 'known', 命名空间: 'mod包' as const }] },
      $隐藏记忆库: {
        延时种子: {
          z_seed: { 来源: { 包id: 'z_ghost' } },
          a_seed: { 来源: { 包id: 'a_ghost' } },
        },
      },
    });
    const log1: MigLog[] = [];
    checkPackIdAliases(state, log1);
    const log2: MigLog[] = [];
    checkPackIdAliases(state, log2);
    expect(JSON.stringify(log1)).toBe(JSON.stringify(log2));
    // sorted: a_seed before z_seed
    expect(log1[0]!.path).toContain('a_seed');
    expect(log1[1]!.path).toContain('z_seed');
  });

  it('D-2: fail-open = never throws (null state fields)', () => {
    const state = makeState({
      受治理键空间注册表: { 键条目: [{ 规范键: 'pkg', 命名空间: 'mod包' as const }] },
      $隐藏记忆库: null,
      行动卡库: null,
    });
    const log: MigLog[] = [];
    expect(() => checkPackIdAliases(state, log)).not.toThrow();
  });

  // ── D-3双轨: 来源包（新）优先扫描·包id（旧）回退 ─────────────────────────────────

  it('D-2/D-3双轨: 来源.来源包 非空·未注册 → warn·用来源包路径', () => {
    const state = makeState({
      受治理键空间注册表: { 键条目: [{ 规范键: 'known', 命名空间: 'mod包' as const }] },
      $隐藏记忆库: { 延时种子: { s1: { 来源: { 包id: '', 来源包: 'ghost_mod' } } } },
    });
    const log: MigLog[] = [];
    checkPackIdAliases(state, log);
    expect(log).toHaveLength(1);
    expect(log[0]!.level).toBe('warn');
    expect(log[0]!.path).toBe('$隐藏记忆库.延时种子.s1.来源.来源包');
    expect(log[0]!.msg).toContain('ghost_mod');
  });

  it('D-2/D-3双轨: 来源.来源包 已注册 → no warn', () => {
    const state = makeState({
      受治理键空间注册表: { 键条目: [{ 规范键: 'known', 命名空间: 'mod包' as const }] },
      $隐藏记忆库: { 延时种子: { s1: { 来源: { 包id: '', 来源包: 'known' } } } },
    });
    const log: MigLog[] = [];
    checkPackIdAliases(state, log);
    expect(log).toHaveLength(0);
  });

  it('D-2/D-3双轨: 来源包+包id 均非空 → 优先用来源包路径·不双报', () => {
    const state = makeState({
      受治理键空间注册表: { 键条目: [{ 规范键: 'known', 命名空间: 'mod包' as const }] },
      $隐藏记忆库: { 延时种子: { s1: { 来源: { 包id: 'ghost', 来源包: 'ghost' } } } },
    });
    const log: MigLog[] = [];
    checkPackIdAliases(state, log);
    expect(log).toHaveLength(1);                             // 不双报
    expect(log[0]!.path).toBe('$隐藏记忆库.延时种子.s1.来源.来源包'); // 用新路径
  });

  it('D-2/D-3双轨: 来源包空·包id 非空 → 回退用包id路径（过渡期兼容）', () => {
    const state = makeState({
      受治理键空间注册表: { 键条目: [{ 规范键: 'known', 命名空间: 'mod包' as const }] },
      $隐藏记忆库: { 延时种子: { s1: { 来源: { 包id: 'legacy_mod', 来源包: '' } } } },
    });
    const log: MigLog[] = [];
    checkPackIdAliases(state, log);
    expect(log).toHaveLength(1);
    expect(log[0]!.path).toBe('$隐藏记忆库.延时种子.s1.来源.包id'); // 回退旧路径
  });
});
