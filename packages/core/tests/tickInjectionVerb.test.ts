// tickInjectionVerb — E-2 底座·verbDelta 变量驱动·真实变量域单测（R9 第三轮）
//
// 覆盖：
//   T1  転移  : 货币 2-entry 守恒 Σ=0
//   T2  赋予  : 货币 2-entry 守恒 Σ=0
//   T3  三方  : 货币 3-entry [+50, -30, -20] Σ=0
//   T4  双宿主: 逐位恒等
//   T5  无数値槽: no-op
//   T6  调整  : NPC.*.属性.魅力 +10（真实变量域·非货币）
//   T7  披露  : 认知档案.*.*.了解度 +5（真实变量域）
//   T8  施加  : NPC.*.属性.体质 -10（负值→sub·真实变量域）
//   T9a 缔结  : 组织关系网.*.关系値 +20（真实变量域）
//   T9b 解除  : 组织关系网.*.关系值 -15（真实变量域）
//   T9c 剥夺  : NPC.*.属性.心理 -10（真实变量域）
//   T9d 移动  : 全局.秘密库.*.暴露度 +5（真实变量域）
//   T9e 植入  : [{NPC.wang.魅力,+8},{NPC.li.魅力,+8}]（同向·证明位置反向已死）
//   T10 非存在路径 → no-op
//   Treg 赋予守恒回归
//
// 闸验证：Gate②(whitelist)·Gate④(conservation for 货币域·非货币域放行)
// 守恒：tick.ts Phase9 assertConservation 只扫 货币系统.账户.*，非货币域不检查 Σ=0。

import { describe, it, expect } from 'vitest';
import { runTick } from '../engine/tick.js';
import { RootSchema } from '../schema/index.js';
import type { RootState } from '../schema/index.js';
import { 指令信封Schema } from '../schema/proposal.js';

// ── 工具函数 ──────────────────────────────────────────────────────────────────

function getHolding(state: RootState, entity: string, ccy = '文'): number {
  const accts = state.货币系统?.账户 as Record<string, { 持有: Record<string, number> }> | undefined;
  return accts?.[entity]?.持有[ccy] ?? 0;
}

function getAtDeep(state: RootState, ...keys: string[]): unknown {
  let cur: unknown = state;
  for (const k of keys) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}

// ── 路径常量（货币域·全状态路径）─────────────────────────────────────────────

const PATH_LI    = '货币系统.账户.npc_li.持有.文';
const PATH_WANG  = '货币系统.账户.npc_wang.持有.文';
const PATH_THIRD = '货币系统.账户.npc_third.持有.文';

// ── 路径常量（非货币域·真实变量路径·证明非货币域测试非伪造）────────────────

const PATH_WANG_CHARM  = 'NPC.npc_wang.属性.魅力';
const PATH_LI_CHARM    = 'NPC.npc_li.属性.魅力';
const PATH_LI_PHYS     = 'NPC.npc_li.属性.体质';
const PATH_WANG_PSYCH  = 'NPC.npc_wang.属性.心理';
const PATH_KNOW        = '认知档案.npc_wang.npc_li.了解度';
const PATH_REL         = '组织关系网.guild_1.关系值';
const PATH_EXPOSE      = '全局.秘密库.secret_1.暴露度';

// ── RICH_STATE：货币+全部真实变量域 ──────────────────────────────────────────

const RICH_STATE: RootState = RootSchema.parse({
  货币系统: {
    基准币种: '文',
    账户: {
      npc_li:    { 持有: { 文: 200 } },
      npc_wang:  { 持有: { 文: 100 } },
      npc_third: { 持有: { 文: 150 } },
    },
  },
  NPC: {
    npc_wang: { 属性: { 魅力: 50, 体质: 60, 心理: 70, 感知: 55, 智慧: 65 } },
    npc_li:   { 属性: { 魅力: 60, 体质: 80, 心理: 75, 感知: 50, 智慧: 70 } },
  },
  认知档案: {
    npc_wang: { npc_li: { 了解度: 30 } },
  },
  组织关系网: {
    guild_1: { 关系值: 50 },
  },
  全局: {
    秘密库: {
      secret_1: { 暴露度: 10 },
    },
  },
  _状态机: { 双时钟: { 世界钟: 100 } },
  _席位表: {},
});

// 货币转移信封（E-2·2条目·主路径+对手方路径）
const ENV_転移 = 指令信封Schema.parse({
  提案批: [
    { 动作类别: '転移', 目标引用: PATH_WANG, 数值槽: 50 },   // 收方 +50
    { 动作类别: '転移', 目标引用: PATH_LI,   数值槽: -50 },  // 付方 -50
  ],
});

// 赋予信封（语义不同·底座同·E-2）
const ENV_赋予 = 指令信封Schema.parse({
  提案批: [
    { 动作类别: '赋予', 目标引用: PATH_WANG, 数值槽: 30 },
    { 动作类别: '赋予', 目标引用: PATH_LI,   数值槽: -30 },
  ],
});

// ── T1: 転移·货币守恒·E-2·2条目 ─────────────────────────────────────────────

describe('T1 · 転移·2-entry·Gate④ Σ=0', () => {
  const result = runTick(RICH_STATE, {
    tickId: 'verb-t1',
    injectedEnvelope: ENV_転移,
    injectedSeatId: 'npc_li',
  });

  it('Phase 提案落账 出现在 settledPhases', () => {
    expect(result.settledPhases).toContain('提案落账');
  });
  it('proposalGateResult.ok === true', () => {
    expect(result.proposalGateResult?.ok).toBe(true);
  });
  it('npc_wang 持有.文 = 100 + 50 = 150', () => {
    expect(getHolding(result.state, 'npc_wang')).toBe(150);
  });
  it('npc_li 持有.文 = 200 - 50 = 150', () => {
    expect(getHolding(result.state, 'npc_li')).toBe(150);
  });
  it('Σ守恒：150+150 = 300（preNet=300）', () => {
    expect(getHolding(result.state, 'npc_wang') + getHolding(result.state, 'npc_li')).toBe(300);
  });
  it('原始 RICH_STATE 未被写回（深拷隔离）', () => {
    expect(getHolding(RICH_STATE, 'npc_wang')).toBe(100);
  });
});

// ── T2: 赋予·货币守恒·E-2 ────────────────────────────────────────────────────

describe('T2 · 赋予·2-entry·Gate④ Σ=0', () => {
  const result = runTick(RICH_STATE, {
    tickId: 'verb-t2',
    injectedEnvelope: ENV_赋予,
    injectedSeatId: 'npc_li',
  });

  it('proposalGateResult.ok === true', () => {
    expect(result.proposalGateResult?.ok).toBe(true);
  });
  it('npc_wang 持有.文 = 100 + 30 = 130', () => {
    expect(getHolding(result.state, 'npc_wang')).toBe(130);
  });
  it('npc_li 持有.文 = 200 - 30 = 170', () => {
    expect(getHolding(result.state, 'npc_li')).toBe(170);
  });
  it('Σ守恒：130+170 = 300', () => {
    expect(getHolding(result.state, 'npc_wang') + getHolding(result.state, 'npc_li')).toBe(300);
  });
});

// ── T3: 三方転账·3-entry·[+50, -30, -20]·Σ=0 ────────────────────────────────

describe('T3 · 三方転账·3-entry·Gate④ Σ=0', () => {
  const env3 = 指令信封Schema.parse({
    提案批: [
      { 动作类别: '転移', 目标引用: PATH_WANG,  数值槽: 50 },   // 收 +50
      { 动作类别: '転移', 目标引用: PATH_LI,    数值槽: -30 },  // 付 -30
      { 动作类别: '転移', 目标引用: PATH_THIRD, 数值槽: -20 },  // 付 -20
    ],
  });
  const result = runTick(RICH_STATE, {
    tickId: 'verb-t3',
    injectedEnvelope: env3,
    injectedSeatId: 'npc_li',
  });

  it('proposalGateResult.ok === true', () => {
    expect(result.proposalGateResult?.ok).toBe(true);
  });
  it('npc_wang 持有.文 = 100 + 50 = 150', () => {
    expect(getHolding(result.state, 'npc_wang')).toBe(150);
  });
  it('npc_li 持有.文 = 200 - 30 = 170', () => {
    expect(getHolding(result.state, 'npc_li')).toBe(170);
  });
  it('npc_third 持有.文 = 150 - 20 = 130', () => {
    expect(getHolding(result.state, 'npc_third')).toBe(130);
  });
  it('Σ守恒：150+170+130 = 450（preNet=450）', () => {
    const sum = getHolding(result.state, 'npc_wang')
              + getHolding(result.state, 'npc_li')
              + getHolding(result.state, 'npc_third');
    expect(sum).toBe(450);
  });
});

// ── T4: 双宿主逐位恒等（転移路径） ──────────────────────────────────────────

describe('T4 · 双宿主逐位恒等', () => {
  const INPUT = {
    tickId: 'verb-t4',
    injectedEnvelope: ENV_転移,
    injectedSeatId: 'npc_li',
  };

  it('两次调用 state JSON 逐位恒等', () => {
    const r1 = runTick(RICH_STATE, INPUT);
    const r2 = runTick(RICH_STATE, INPUT);
    expect(JSON.stringify(r1.state)).toBe(JSON.stringify(r2.state));
  });
  it('两次调用 proposalGateResult.ok 均为 true', () => {
    const r1 = runTick(RICH_STATE, INPUT);
    const r2 = runTick(RICH_STATE, INPUT);
    expect(r1.proposalGateResult?.ok).toBe(true);
    expect(r2.proposalGateResult?.ok).toBe(true);
  });
});

// ── T5: 无数值槽 → no-op ──────────────────────────────────────────────────────

describe('T5 · 无数值槽 → no-op', () => {
  const result = runTick(RICH_STATE, {
    tickId: 'verb-t5',
    injectedEnvelope: 指令信封Schema.parse({
      提案批: [{ 动作类别: '転移', 目标引用: PATH_WANG }],  // 无 数值槽
    }),
    injectedSeatId: 'npc_li',
  });

  it('gateResult 存在（提案落账 phase 执行）', () => {
    expect(result.proposalGateResult).toBeDefined();
  });
  it('npc_wang 持有.文 未变（no-op）', () => {
    expect(getHolding(result.state, 'npc_wang')).toBe(100);
  });
  it('npc_li 持有.文 未变（no-op）', () => {
    expect(getHolding(result.state, 'npc_li')).toBe(200);
  });
});

// ── T6: 调整·NPC.npc_wang.属性.魅力 +10（真实变量域·非货币·无 Σ=0 检查）────

describe('T6 · 调整·NPC属性.魅力·真实变量域', () => {
  const result = runTick(RICH_STATE, {
    tickId: 'verb-t6',
    injectedEnvelope: 指令信封Schema.parse({
      提案批: [{ 动作类别: '调整', 目标引用: PATH_WANG_CHARM, 数值槽: 10 }],
    }),
    injectedSeatId: 'npc_li',
  });

  it('proposalGateResult.ok === true', () => {
    expect(result.proposalGateResult?.ok).toBe(true);
  });
  it('npc_wang.属性.魅力 = 50 + 10 = 60', () => {
    expect(getAtDeep(result.state, 'NPC', 'npc_wang', '属性', '魅力')).toBe(60);
  });
  it('货币域未动（非货币 verb 不影响货币账户）', () => {
    expect(getHolding(result.state, 'npc_wang')).toBe(100);
  });
});

// ── T7: 披露·认知档案.npc_wang.npc_li.了解度 +5 ─────────────────────────────

describe('T7 · 披露·认知档案.了解度·真实变量域', () => {
  const result = runTick(RICH_STATE, {
    tickId: 'verb-t7',
    injectedEnvelope: 指令信封Schema.parse({
      提案批: [{ 动作类别: '披露', 目标引用: PATH_KNOW, 数值槽: 5 }],
    }),
    injectedSeatId: 'npc_li',
  });

  it('proposalGateResult.ok === true', () => {
    expect(result.proposalGateResult?.ok).toBe(true);
  });
  it('认知档案.npc_wang.npc_li.了解度 = 30 + 5 = 35', () => {
    expect(getAtDeep(result.state, '认知档案', 'npc_wang', 'npc_li', '了解度')).toBe(35);
  });
});

// ── T8: 施加·NPC.npc_li.属性.体质 -10（负数值槽→sub） ───────────────────────

describe('T8 · 施加·NPC属性.体质·负数值槽→sub', () => {
  const result = runTick(RICH_STATE, {
    tickId: 'verb-t8',
    injectedEnvelope: 指令信封Schema.parse({
      提案批: [{ 动作类别: '施加', 目标引用: PATH_LI_PHYS, 数值槽: -10 }],
    }),
    injectedSeatId: 'npc_wang',
  });

  it('proposalGateResult.ok === true', () => {
    expect(result.proposalGateResult?.ok).toBe(true);
  });
  it('npc_li.属性.体质 = 80 - 10 = 70（负数值槽→sub 正确）', () => {
    expect(getAtDeep(result.state, 'NPC', 'npc_li', '属性', '体质')).toBe(70);
  });
  it('货币域未动', () => {
    expect(getHolding(result.state, 'npc_li')).toBe(200);
  });
});

// ── T9a: 缔结·组织关系网.guild_1.关系值 +20 ──────────────────────────────────

describe('T9a · 缔结·组织关系网.关系值 +20', () => {
  const result = runTick(RICH_STATE, {
    tickId: 'verb-t9a',
    injectedEnvelope: 指令信封Schema.parse({
      提案批: [{ 动作类别: '缔结', 目标引用: PATH_REL, 数值槽: 20 }],
    }),
    injectedSeatId: 'npc_li',
  });

  it('proposalGateResult.ok === true', () => {
    expect(result.proposalGateResult?.ok).toBe(true);
  });
  it('guild_1.关系值 = 50 + 20 = 70', () => {
    expect(getAtDeep(result.state, '组织关系网', 'guild_1', '关系值')).toBe(70);
  });
});

// ── T9b: 解除·组织关系网.guild_1.关系值 -15 ──────────────────────────────────

describe('T9b · 解除·组织关系网.关系值 -15', () => {
  const result = runTick(RICH_STATE, {
    tickId: 'verb-t9b',
    injectedEnvelope: 指令信封Schema.parse({
      提案批: [{ 动作类别: '解除', 目标引用: PATH_REL, 数值槽: -15 }],
    }),
    injectedSeatId: 'npc_li',
  });

  it('proposalGateResult.ok === true', () => {
    expect(result.proposalGateResult?.ok).toBe(true);
  });
  it('guild_1.关系值 = 50 - 15 = 35（负数值槽→sub）', () => {
    expect(getAtDeep(result.state, '组织关系网', 'guild_1', '关系值')).toBe(35);
  });
});

// ── T9c: 剥夺·NPC.npc_wang.属性.心理 -10 ────────────────────────────────────

describe('T9c · 剥夺·NPC属性.心理 -10', () => {
  const result = runTick(RICH_STATE, {
    tickId: 'verb-t9c',
    injectedEnvelope: 指令信封Schema.parse({
      提案批: [{ 动作类别: '剥夺', 目标引用: PATH_WANG_PSYCH, 数值槽: -10 }],
    }),
    injectedSeatId: 'npc_li',
  });

  it('proposalGateResult.ok === true', () => {
    expect(result.proposalGateResult?.ok).toBe(true);
  });
  it('npc_wang.属性.心理 = 70 - 10 = 60', () => {
    expect(getAtDeep(result.state, 'NPC', 'npc_wang', '属性', '心理')).toBe(60);
  });
});

// ── T9d: 移动·全局.秘密库.secret_1.暴露度 +5 ─────────────────────────────────

describe('T9d · 移动·全局.秘密库.暴露度 +5', () => {
  const result = runTick(RICH_STATE, {
    tickId: 'verb-t9d',
    injectedEnvelope: 指令信封Schema.parse({
      提案批: [{ 动作类别: '移动', 目标引用: PATH_EXPOSE, 数值槽: 5 }],
    }),
    injectedSeatId: 'npc_li',
  });

  it('proposalGateResult.ok === true', () => {
    expect(result.proposalGateResult?.ok).toBe(true);
  });
  it('secret_1.暴露度 = 10 + 5 = 15', () => {
    expect(getAtDeep(result.state, '全局', '秘密库', 'secret_1', '暴露度')).toBe(15);
  });
});

// ── T9e: 植入·同向双变量·[{wang.魅力,+8},{li.魅力,+8}]（证明位置反向已死）──

describe('T9e · 植入·同向多变量·证明位置反向已死', () => {
  const result = runTick(RICH_STATE, {
    tickId: 'verb-t9e',
    injectedEnvelope: 指令信封Schema.parse({
      提案批: [
        { 动作类别: '植入', 目标引用: PATH_WANG_CHARM, 数值槽: 8 },  // +8
        { 动作类别: '植入', 目标引用: PATH_LI_CHARM,   数值槽: 8 },  // +8（同号·非反向）
      ],
    }),
    injectedSeatId: 'npc_li',
  });

  it('proposalGateResult.ok === true', () => {
    expect(result.proposalGateResult?.ok).toBe(true);
  });
  it('npc_wang.属性.魅力 = 50 + 8 = 58（add·正确）', () => {
    expect(getAtDeep(result.state, 'NPC', 'npc_wang', '属性', '魅力')).toBe(58);
  });
  it('npc_li.属性.魅力 = 60 + 8 = 68（同向 add·非反向·证明位置反向已死）', () => {
    expect(getAtDeep(result.state, 'NPC', 'npc_li', '属性', '魅力')).toBe(68);
  });
});

// ── T10: 非存在路径 → no-op（防乱写）──────────────────────────────────────────

describe('T10 · 非存在路径 → no-op', () => {
  const result = runTick(RICH_STATE, {
    tickId: 'verb-t10',
    injectedEnvelope: 指令信封Schema.parse({
      提案批: [{ 动作类别: '転移', 目标引用: 'NONEXISTENT.path.xyz', 数值槽: 999 }],
    }),
    injectedSeatId: 'npc_li',
  });

  it('gateResult 存在（提案落账 phase 执行）', () => {
    expect(result.proposalGateResult).toBeDefined();
  });
  it('npc_wang 持有.文 未变（no-op）', () => {
    expect(getHolding(result.state, 'npc_wang')).toBe(100);
  });
  it('npc_li 持有.文 未变（no-op）', () => {
    expect(getHolding(result.state, 'npc_li')).toBe(200);
  });
});

// ── Treg: 赋予守恒回归（同底座・転移/赋予·Σ=0）──────────────────────────────

describe('Treg · 赋予守恒回归', () => {
  const result = runTick(RICH_STATE, {
    tickId: 'verb-treg',
    injectedEnvelope: ENV_赋予,
    injectedSeatId: 'npc_li',
  });

  it('proposalGateResult.ok === true', () => {
    expect(result.proposalGateResult?.ok).toBe(true);
  });
  it('npc_wang 持有.文 = 100 + 30 = 130', () => {
    expect(getHolding(result.state, 'npc_wang')).toBe(130);
  });
  it('npc_li 持有.文 = 200 - 30 = 170', () => {
    expect(getHolding(result.state, 'npc_li')).toBe(170);
  });
  it('Σ净值守恒：130+170 = 300', () => {
    expect(getHolding(result.state, 'npc_wang') + getHolding(result.state, 'npc_li')).toBe(300);
  });
});
