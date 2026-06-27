// P7-7.c · effectPacks 触发管线单测
// 覆盖：no-op 回归 / trigger 真/假/空串 / string value eval / gate 拒 / M3 前缀 / scope / 守恒
// 守恒纪律：货币 delta 必须成对平衡（add + sub = 0）；非货币路径（NPC.属性）天然守恒中性。
import { describe, it, expect } from 'vitest';
import { runTick } from '../engine/tick.js';
import { RootSchema } from '../schema/index.js';
import type { RootState } from '../schema/index.js';
import type { intervention_pack_v1Type } from '../schema/memory.js';

// ── helpers ──────────────────────────────────────────────────────────────────

function getAttr(s: RootState, npcKey: string, axis: string): number {
  const npc = (s.NPC as Record<string, { 属性: Record<string, number> }>)[npcKey];
  return npc?.属性[axis] ?? -1;
}

// ── BASE_STATE ────────────────────────────────────────────────────────────────

const BASE: RootState = RootSchema.parse({
  NPC: {
    npc_hero: {
      属性: { 体质: 60, 智慧: 40, 感知: 50, 魅力: 30, 心理: 70 },
      技能: { 格斗: { 等级: 5 } },
    },
  },
  货币系统: {
    账户: {
      npc_hero:   { 持有: { 文: 300 } },
      npc_mirror: { 持有: { 文: 300 } }, // 守恒配对账户（总净值=600）
    },
  },
  _tick: { 拍计数: 10 },
  世界: { 纪元分钟: 1440 },
  _状态机: { 双时钟: { 世界钟: 100 } },
  _席位表: {},
  全局: {},
});

const TICK_ID = (suffix: string) => `ep-test-${suffix}`;

// 守恒平衡货币包：hero +N, mirror -N（净变化=0）
function balancedMoneyPack(id: string, n: number): intervention_pack_v1Type {
  return {
    pack_id: id,
    deltas:  [
      { path: '货币系统.账户.npc_hero.持有.文',   op: 'add', value: n },
      { path: '货币系统.账户.npc_mirror.持有.文', op: 'sub', value: n },
    ],
  };
}

// ── P7.c-1 · 黄金向量回归守卫：effectPacks undefined → 精确 no-op ────────────

describe('P7.c-1 · effectPacks undefined → no-op（金向量回归守卫）', () => {
  const r1 = runTick(BASE, { tickId: TICK_ID('noop-a') });
  const r2 = runTick(BASE, { tickId: TICK_ID('noop-b'), effectPacks: undefined });
  const r3 = runTick(BASE, { tickId: TICK_ID('noop-c'), effectPacks: [] });

  it('无 effectPacks 货币未变', () => {
    const 账户 = r1.state.货币系统?.账户 as Record<string, { 持有: Record<string, number> }>;
    expect(账户['npc_hero']?.持有['文']).toBe(300);
  });

  it('effectPacks=undefined → 阈值触发已完成（settledPhases 含阈值触发）', () => {
    expect(r2.settledPhases).toContain('阈值触发');
  });

  it('effectPacks=[] → 阈值触发完成·货币未变', () => {
    const 账户 = r3.state.货币系统?.账户 as Record<string, { 持有: Record<string, number> }>;
    expect(账户['npc_hero']?.持有['文']).toBe(300);
  });
});

// ── P7.c-2 · trigger 为真 → deltas 落账（非货币路径·守恒中性）────────────────

describe('P7.c-2 · trigger 真 → NPC 属性 delta 落账', () => {
  // 属性.体质 路径：NPC.npc_hero.属性.体质（守恒不检 NPC 属性）
  const pack: intervention_pack_v1Type = {
    pack_id: 'ep_trigger_true',
    trigger: '属性.体质 >= 60',          // 体质=60，条件为真
    scope:   { entityKey: 'npc_hero' },
    deltas:  [{ path: 'NPC.npc_hero.属性.体质', op: 'add', value: 5 }],
  };
  const r = runTick(BASE, { tickId: TICK_ID('trig-t'), effectPacks: [pack] });

  it('体质 从 60 升至 65', () => {
    expect(getAttr(r.state, 'npc_hero', '体质')).toBe(65);
  });
});

// ── P7.c-3 · trigger 为假 → no-op ────────────────────────────────────────────

describe('P7.c-3 · trigger 假 → no-op', () => {
  const pack: intervention_pack_v1Type = {
    pack_id: 'ep_trigger_false',
    trigger: '属性.体质 >= 100',          // 体质=60，条件为假
    scope:   { entityKey: 'npc_hero' },
    deltas:  [{ path: 'NPC.npc_hero.属性.体质', op: 'add', value: 99 }],
  };
  const r = runTick(BASE, { tickId: TICK_ID('trig-f'), effectPacks: [pack] });

  it('体质 仍为 60（未触发）', () => {
    expect(getAttr(r.state, 'npc_hero', '体质')).toBe(60);
  });
});

// ── P7.c-4 · trigger 为空串 → 恒执行（无闸）──────────────────────────────────

describe('P7.c-4 · trigger 空串 → 恒执行', () => {
  const pack: intervention_pack_v1Type = {
    pack_id: 'ep_empty_trigger',
    trigger: '',                           // 空串 = 无 trigger gate
    deltas:  [{ path: 'NPC.npc_hero.属性.体质', op: 'add', value: 3 }],
  };
  const r = runTick(BASE, { tickId: TICK_ID('empty-trig'), effectPacks: [pack] });

  it('体质 从 60 升至 63', () => {
    expect(getAttr(r.state, 'npc_hero', '体质')).toBe(63);
  });
});

// ── P7.c-5 · trigger 缺省（undefined） → 恒执行 ──────────────────────────────

describe('P7.c-5 · trigger undefined → 恒执行', () => {
  const pack: intervention_pack_v1Type = {
    pack_id: 'ep_no_trigger',
    // trigger 字段不设
    deltas:  [{ path: 'NPC.npc_hero.属性.体质', op: 'sub', value: 5 }],
  };
  const r = runTick(BASE, { tickId: TICK_ID('no-trig'), effectPacks: [pack] });

  it('体质 从 60 降至 55', () => {
    expect(getAttr(r.state, 'npc_hero', '体质')).toBe(55);
  });
});

// ── P7.c-6 · string value DSL 表达式 → 求值后落账 ────────────────────────────

describe('P7.c-6 · string value DSL 求值', () => {
  const pack: intervention_pack_v1Type = {
    pack_id: 'ep_str_value',
    scope:   { entityKey: 'npc_hero' },
    // value = '属性.体质'（=60）→ 加到体质上（60+60=120，但 schema max=100，computeDelta 会截？）
    // 用 智慧 而非体质：初始40，value = '属性.感知'(50) → add 50 → 90（不超 max·但 computeDelta 不 clamp）
    deltas:  [{ path: 'NPC.npc_hero.属性.智慧', op: 'add', value: '属性.感知' }],
  };
  const r = runTick(BASE, { tickId: TICK_ID('str-val'), effectPacks: [pack] });

  it('智慧 = 40 + 感知(50) = 90', () => {
    expect(getAttr(r.state, 'npc_hero', '智慧')).toBe(90);
  });
});

// ── P7.c-7 · string value 解析失败 → 整包跳（fail-closed）───────────────────

describe('P7.c-7 · string value 解析失败 → 整包跳', () => {
  const pack: intervention_pack_v1Type = {
    pack_id: 'ep_bad_expr',
    deltas:  [{ path: 'NPC.npc_hero.属性.体质', op: 'add', value: '!!! invalid' }],
  };
  const r = runTick(BASE, { tickId: TICK_ID('bad-expr'), effectPacks: [pack] });

  it('体质 仍为 60（整包被跳过）', () => {
    expect(getAttr(r.state, 'npc_hero', '体质')).toBe(60);
  });
});

// ── P7.c-8 · effectGate 拒（_前缀）→ 整包跳 ─────────────────────────────────

describe('P7.c-8 · effectGate 拒 (_前缀) → 整包跳', () => {
  const pack: intervention_pack_v1Type = {
    pack_id: 'ep_prefix_reject',
    // _前缀 → effectGate Gate③ 拒
    deltas:  [{ path: '_tick.拍计数', op: 'add', value: 99 }],
  };
  // 防止守恒误报：不改货币，runTick 应不抛
  const r = runTick(BASE, { tickId: TICK_ID('prefix-rej'), effectPacks: [pack] });

  it('runTick 不抛·阈值触发正常完成', () => {
    expect(r.settledPhases).toContain('阈值触发');
  });
});

// ── P7.c-9 · M3 硬排除前缀治理闸（$前缀）────────────────────────────────────

describe('P7.c-9 · M3 治理闸 ($前缀) → 整包跳', () => {
  const pack: intervention_pack_v1Type = {
    pack_id: 'ep_dollar_prefix',
    deltas:  [{ path: '$隐藏记忆库.test', op: 'set', value: 1 }],
  };
  const r = runTick(BASE, { tickId: TICK_ID('dollar-rej'), effectPacks: [pack] });

  it('$-前缀路径被 M3 治理闸拦截·runTick 不抛', () => {
    expect(r.settledPhases).toContain('阈值触发');
  });
});

// ── P7.c-10 · scope.entityKey 精确定向 ──────────────────────────────────────

describe('P7.c-10 · scope.entityKey 精确定向', () => {
  const packHero: intervention_pack_v1Type = {
    pack_id: 'ep_scope_hero',
    scope:   { entityKey: 'npc_hero' },
    trigger: '属性.体质 >= 60',   // npc_hero.体质=60 → true
    deltas:  [{ path: 'NPC.npc_hero.属性.体质', op: 'add', value: 1 }],
  };
  const packMiss: intervention_pack_v1Type = {
    pack_id: 'ep_scope_missing',
    scope:   { entityKey: 'npc_nonexistent' },
    trigger: '属性.体质 >= 1',    // 不存在NPC → 空ctx → 0 >= 1 → false
    deltas:  [{ path: 'NPC.npc_hero.属性.体质', op: 'add', value: 999 }],
  };
  const r = runTick(BASE, { tickId: TICK_ID('scope'), effectPacks: [packHero, packMiss] });

  it('hero 触发 +1 → 61；missing entity 谓词 false → no-op', () => {
    expect(getAttr(r.state, 'npc_hero', '体质')).toBe(61);
  });
});

// ── P7.c-11 · 多包顺序执行 ─────────────────────────────────────────────────

describe('P7.c-11 · 多包顺序执行', () => {
  const packs: intervention_pack_v1Type[] = [
    {
      pack_id: 'ep_seq_a',
      deltas:  [{ path: 'NPC.npc_hero.属性.体质', op: 'add', value: 3 }],
    },
    {
      pack_id: 'ep_seq_b',
      deltas:  [{ path: 'NPC.npc_hero.属性.体质', op: 'add', value: 7 }],
    },
  ];
  const r = runTick(BASE, { tickId: TICK_ID('multi'), effectPacks: packs });

  it('体质 = 60 + 3 + 7 = 70', () => {
    expect(getAttr(r.state, 'npc_hero', '体质')).toBe(70);
  });
});

// ── P7.c-12 · 幂等：同 tickId 第二次调用 → 不重复执行 ────────────────────────

describe('P7.c-12 · 幂等门控', () => {
  const pack: intervention_pack_v1Type = {
    pack_id: 'ep_idem',
    deltas:  [{ path: 'NPC.npc_hero.属性.体质', op: 'add', value: 5 }],
  };
  const id = TICK_ID('idem');
  const r1 = runTick(BASE, { tickId: id, effectPacks: [pack] });
  const r2 = runTick(r1.state, { tickId: id, effectPacks: [pack] });

  it('r1 体质 = 65', () => {
    expect(getAttr(r1.state, 'npc_hero', '体质')).toBe(65);
  });

  it('r2 体质 仍 = 65（幂等·不重算）', () => {
    expect(getAttr(r2.state, 'npc_hero', '体质')).toBe(65);
  });
});

// ── P7.c-13 · 守恒：balanced 货币包不破守恒 ─────────────────────────────────

describe('P7.c-13 · 守恒：balanced 货币包维持 Σ净值', () => {
  const pack = balancedMoneyPack('ep_balance', 50);
  const r = runTick(BASE, { tickId: TICK_ID('conservation'), effectPacks: [pack] });

  it('runTick 不抛 ConservationError（守恒通过）', () => {
    expect(r.settledPhases).toContain('原子提交');
  });

  it('hero +50 → 350', () => {
    const 账户 = r.state.货币系统?.账户 as Record<string, { 持有: Record<string, number> }>;
    expect(账户['npc_hero']?.持有['文']).toBe(350);
  });

  it('mirror -50 → 250', () => {
    const 账户 = r.state.货币系统?.账户 as Record<string, { 持有: Record<string, number> }>;
    expect(账户['npc_mirror']?.持有['文']).toBe(250);
  });
});
