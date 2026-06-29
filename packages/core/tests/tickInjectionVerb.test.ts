// tickInjectionVerb — 变量驱动 verbDelta 单测（R9 重做）
// 覆盖：T1 転移 守恒 · T2 双宿主逐位恒等 · T3 违闸拒零写账
//       T4 无 injectedEnvelope 回归 · T5 无数值槽 no-op
//       T6 调整 · T7 披露 · T8 施加 · T9a-e 缔结/解除/剥夺/移动/植入
//       T10 非数值路径 no-op · Treg 赋予守恒回归
//
// 设计：目标引用 = 全状态路径·关联实体 = 对手方全路径·数值槽 带符号（正→add·负→sub）
// 守恒：写 货币系统.账户.* → tick.ts Phase9 assertConservation 自动校验

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

// ── 共用路径常量（全状态路径·禁硬编码到非路径字段）─────────────────────────

const PATH_LI   = '货币系统.账户.npc_li.持有.文';
const PATH_WANG = '货币系统.账户.npc_wang.持有.文';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BASE_STATE: RootState = RootSchema.parse({
  货币系统: {
    基准币种: '文',
    账户: {
      npc_li:   { 持有: { 文: 200 } },
      npc_wang: { 持有: { 文: 100 } },
    },
  },
  _状态机: { 双时钟: { 世界钟: 100 } },
  _席位表: {},
  全局: {},
});

// 転移信封：npc_li 付 → npc_wang 收 50 文
// 目标引用 = 收方路径（add）·关联实体[0] = 付方路径（sub）·数值槽 = +50
const ENVELOPE_転移 = 指令信封Schema.parse({
  提案: {
    动作类别: '転移',
    目标引用: PATH_WANG,
    数值槽: 50,
    关联实体: [PATH_LI],
  },
});

// 赋予信封：npc_li → npc_wang 收 30 文（同底座·语义不同）
const ENVELOPE_赋予 = 指令信封Schema.parse({
  提案: {
    动作类别: '赋予',
    目标引用: PATH_WANG,
    数值槽: 30,
    关联实体: [PATH_LI],
  },
});

// ── 较大额度 state（T6-T10 共用）─────────────────────────────────────────────

const BASE_STATE_V: RootState = RootSchema.parse({
  货币系统: {
    基准币种: '文',
    账户: {
      npc_li:   { 持有: { 文: 1000 } },
      npc_wang: { 持有: { 文: 1000 } },
    },
  },
  _状态机: { 双时钟: { 世界钟: 100 } },
  _席位表: {},
  全局: {},
});

// ── T1: 転移-支 · 落账成功 + 守恒 ───────────────────────────────────────────

describe('T1 · 転移-支 · deriveVerbDelta 落账守恒', () => {
  const result = runTick(BASE_STATE, {
    tickId: 'verb-t1',
    injectedEnvelope: ENVELOPE_転移,
    injectedSeatId: 'npc_li',
  });

  it('Phase 提案落账 出现在 settledPhases', () => {
    expect(result.settledPhases).toContain('提案落账');
  });

  it('proposalGateResult.ok === true', () => {
    expect(result.proposalGateResult?.ok).toBe(true);
  });

  it('收方 npc_wang 持有.文 从 100 升至 150（add 50）', () => {
    expect(getHolding(result.state, 'npc_wang')).toBe(150);
  });

  it('付方 npc_li 持有.文 从 200 降至 150（sub 50）', () => {
    expect(getHolding(result.state, 'npc_li')).toBe(150);
  });

  it('Σ净值守恒：preNet=300 = postNet=300', () => {
    expect(getHolding(result.state, 'npc_li') + getHolding(result.state, 'npc_wang')).toBe(300);
  });

  it('原始 BASE_STATE 未被写回（深拷隔离）', () => {
    expect(getHolding(BASE_STATE, 'npc_li')).toBe(200);
    expect(getHolding(BASE_STATE, 'npc_wang')).toBe(100);
  });
});

// ── T2: 双宿主逐位恒等 ────────────────────────────────────────────────────────

describe('T2 · 双宿主逐位恒等', () => {
  const INPUT = {
    tickId: 'verb-t2',
    injectedEnvelope: ENVELOPE_転移,
    injectedSeatId: 'npc_li',
  };

  it('两次调用 state JSON 逐位恒等', () => {
    const r1 = runTick(BASE_STATE, INPUT);
    const r2 = runTick(BASE_STATE, INPUT);
    expect(JSON.stringify(r1.state)).toBe(JSON.stringify(r2.state));
  });

  it('两次调用 proposalGateResult.ok 均为 true', () => {
    const r1 = runTick(BASE_STATE, INPUT);
    const r2 = runTick(BASE_STATE, INPUT);
    expect(r1.proposalGateResult?.ok).toBe(true);
    expect(r2.proposalGateResult?.ok).toBe(true);
  });
});

// ── T3: 违闸 pack → Gate④ 拒绝 + 零写账 ─────────────────────────────────────

describe('T3 · 违闸 pack → Gate④ 拒绝 + 零写账', () => {
  const result = runTick(BASE_STATE, {
    tickId: 'verb-t3',
    injectedEnvelope: ENVELOPE_転移,
    injectedSeatId: 'npc_li',
    injectedPacks: [[{ path: '非法路径.xxx', op: 'add', value: 1 }]],
  });

  it('proposalGateResult.ok === false', () => {
    expect(result.proposalGateResult?.ok).toBe(false);
  });

  it('npc_li 持有.文 未变（零写账）', () => {
    expect(getHolding(result.state, 'npc_li')).toBe(200);
  });

  it('npc_wang 持有.文 未变（零写账）', () => {
    expect(getHolding(result.state, 'npc_wang')).toBe(100);
  });
});

// ── T4: 无 injectedEnvelope → 行为逐位恒等（回归）────────────────────────────

describe('T4 · 无 injectedEnvelope → 现有 runTick 逐位恒等', () => {
  const r1 = runTick(BASE_STATE, { tickId: 'verb-t4' });
  const r2 = runTick(BASE_STATE, { tickId: 'verb-t4' });

  it('proposalGateResult 不出现', () => {
    expect(r1.proposalGateResult).toBeUndefined();
  });

  it('两次调用 state JSON 逐位恒等', () => {
    expect(JSON.stringify(r1.state)).toBe(JSON.stringify(r2.state));
  });

  it('npc_li 和 npc_wang 持有.文 均未变', () => {
    expect(getHolding(r1.state, 'npc_li')).toBe(200);
    expect(getHolding(r1.state, 'npc_wang')).toBe(100);
  });
});

// ── T5: 无数值槽 → no-op（路径存在但无数值参数）──────────────────────────────

describe('T5 · 无数值槽 → no-op', () => {
  const result = runTick(BASE_STATE, {
    tickId: 'verb-t5',
    injectedEnvelope: 指令信封Schema.parse({
      提案: {
        动作类别: '転移',
        目标引用: PATH_WANG,
        // 无 数值槽 → verbDelta 返回 []·gate 通过但零写账
      },
    }),
    injectedSeatId: 'npc_li',
  });

  it('proposalGateResult 存在（提案落账 phase 执行）', () => {
    expect(result.proposalGateResult).toBeDefined();
  });

  it('npc_wang 持有.文 未变（no-op）', () => {
    expect(getHolding(result.state, 'npc_wang')).toBe(100);
  });

  it('npc_li 持有.文 未变（no-op）', () => {
    expect(getHolding(result.state, 'npc_li')).toBe(200);
  });
});

// ── T6-T9: 8 动词最小落账用例（全路径·守恒对·Σ=0）──────────────────────────
// 目标引用 = 收方全路径·关联实体[0] = 付方全路径·数值槽 = 正值（add→add·取反→sub）

describe('T6 · 调整 · 双路径守恒', () => {
  // 目标=npc_li（add 50）·对手=npc_wang（sub 50）
  const result = runTick(BASE_STATE_V, {
    tickId: 'verb-t6',
    injectedEnvelope: 指令信封Schema.parse({
      提案: { 动作类别: '调整', 目标引用: PATH_LI, 数值槽: 50, 关联实体: [PATH_WANG] },
    }),
    injectedSeatId: 'npc_li',
  });

  it('proposalGateResult.ok === true', () => { expect(result.proposalGateResult?.ok).toBe(true); });
  it('npc_li 持有.文 1050（add 50）', () => { expect(getHolding(result.state, 'npc_li')).toBe(1050); });
  it('npc_wang 持有.文 950（sub 50）', () => { expect(getHolding(result.state, 'npc_wang')).toBe(950); });
  it('Σ守恒 2000', () => { expect(getHolding(result.state, 'npc_li') + getHolding(result.state, 'npc_wang')).toBe(2000); });
});

describe('T7 · 披露 · 双路径守恒', () => {
  // 目标=npc_wang（add 10）·对手=npc_li（sub 10）
  const result = runTick(BASE_STATE_V, {
    tickId: 'verb-t7',
    injectedEnvelope: 指令信封Schema.parse({
      提案: { 动作类别: '披露', 目标引用: PATH_WANG, 数值槽: 10, 关联实体: [PATH_LI] },
    }),
    injectedSeatId: 'npc_li',
  });

  it('proposalGateResult.ok === true', () => { expect(result.proposalGateResult?.ok).toBe(true); });
  it('npc_wang 持有.文 1010（add 10）', () => { expect(getHolding(result.state, 'npc_wang')).toBe(1010); });
  it('npc_li 持有.文 990（sub 10）', () => { expect(getHolding(result.state, 'npc_li')).toBe(990); });
  it('Σ守恒 2000', () => { expect(getHolding(result.state, 'npc_li') + getHolding(result.state, 'npc_wang')).toBe(2000); });
});

describe('T8 · 施加 · 双路径守恒', () => {
  // 目标=npc_li（add 15）·对手=npc_wang（sub 15）
  const result = runTick(BASE_STATE_V, {
    tickId: 'verb-t8',
    injectedEnvelope: 指令信封Schema.parse({
      提案: { 动作类别: '施加', 目标引用: PATH_LI, 数值槽: 15, 关联实体: [PATH_WANG] },
    }),
    injectedSeatId: 'npc_li',
  });

  it('proposalGateResult.ok === true', () => { expect(result.proposalGateResult?.ok).toBe(true); });
  it('npc_li 持有.文 1015（add 15）', () => { expect(getHolding(result.state, 'npc_li')).toBe(1015); });
  it('npc_wang 持有.文 985（sub 15）', () => { expect(getHolding(result.state, 'npc_wang')).toBe(985); });
  it('Σ守恒 2000', () => { expect(getHolding(result.state, 'npc_li') + getHolding(result.state, 'npc_wang')).toBe(2000); });
});

describe('T9a · 缔结 · 双路径守恒', () => {
  const result = runTick(BASE_STATE_V, {
    tickId: 'verb-t9a',
    injectedEnvelope: 指令信封Schema.parse({
      提案: { 动作类别: '缔结', 目标引用: PATH_WANG, 数值槽: 20, 关联实体: [PATH_LI] },
    }),
    injectedSeatId: 'npc_li',
  });

  it('proposalGateResult.ok === true', () => { expect(result.proposalGateResult?.ok).toBe(true); });
  it('npc_wang 持有.文 1020（add 20）', () => { expect(getHolding(result.state, 'npc_wang')).toBe(1020); });
  it('npc_li 持有.文 980（sub 20）', () => { expect(getHolding(result.state, 'npc_li')).toBe(980); });
  it('Σ守恒 2000', () => { expect(getHolding(result.state, 'npc_li') + getHolding(result.state, 'npc_wang')).toBe(2000); });
});

describe('T9b · 解除 · 双路径守恒', () => {
  const result = runTick(BASE_STATE_V, {
    tickId: 'verb-t9b',
    injectedEnvelope: 指令信封Schema.parse({
      提案: { 动作类别: '解除', 目标引用: PATH_LI, 数值槽: 5, 关联实体: [PATH_WANG] },
    }),
    injectedSeatId: 'npc_li',
  });

  it('proposalGateResult.ok === true', () => { expect(result.proposalGateResult?.ok).toBe(true); });
  it('npc_li 持有.文 1005（add 5）', () => { expect(getHolding(result.state, 'npc_li')).toBe(1005); });
  it('npc_wang 持有.文 995（sub 5）', () => { expect(getHolding(result.state, 'npc_wang')).toBe(995); });
  it('Σ守恒 2000', () => { expect(getHolding(result.state, 'npc_li') + getHolding(result.state, 'npc_wang')).toBe(2000); });
});

describe('T9c · 剥夺 · 双路径守恒', () => {
  const result = runTick(BASE_STATE_V, {
    tickId: 'verb-t9c',
    injectedEnvelope: 指令信封Schema.parse({
      提案: { 动作类别: '剥夺', 目标引用: PATH_WANG, 数值槽: 40, 关联实体: [PATH_LI] },
    }),
    injectedSeatId: 'npc_li',
  });

  it('proposalGateResult.ok === true', () => { expect(result.proposalGateResult?.ok).toBe(true); });
  it('npc_wang 持有.文 1040（add 40）', () => { expect(getHolding(result.state, 'npc_wang')).toBe(1040); });
  it('npc_li 持有.文 960（sub 40）', () => { expect(getHolding(result.state, 'npc_li')).toBe(960); });
  it('Σ守恒 2000', () => { expect(getHolding(result.state, 'npc_li') + getHolding(result.state, 'npc_wang')).toBe(2000); });
});

describe('T9d · 移动 · 双路径守恒（seatId=npc_wang·对手方=npc_wang）', () => {
  // 目标=npc_li（add 100）·对手=npc_wang（sub 100）
  const result = runTick(BASE_STATE_V, {
    tickId: 'verb-t9d',
    injectedEnvelope: 指令信封Schema.parse({
      提案: { 动作类别: '移动', 目标引用: PATH_LI, 数值槽: 100, 关联实体: [PATH_WANG] },
    }),
    injectedSeatId: 'npc_wang',
  });

  it('proposalGateResult.ok === true', () => { expect(result.proposalGateResult?.ok).toBe(true); });
  it('npc_li 持有.文 1100（add 100）', () => { expect(getHolding(result.state, 'npc_li')).toBe(1100); });
  it('npc_wang 持有.文 900（sub 100）', () => { expect(getHolding(result.state, 'npc_wang')).toBe(900); });
  it('Σ守恒 2000', () => { expect(getHolding(result.state, 'npc_li') + getHolding(result.state, 'npc_wang')).toBe(2000); });
});

describe('T9e · 植入 · 双路径守恒', () => {
  const result = runTick(BASE_STATE_V, {
    tickId: 'verb-t9e',
    injectedEnvelope: 指令信封Schema.parse({
      提案: { 动作类别: '植入', 目标引用: PATH_WANG, 数值槽: 25, 关联实体: [PATH_LI] },
    }),
    injectedSeatId: 'npc_li',
  });

  it('proposalGateResult.ok === true', () => { expect(result.proposalGateResult?.ok).toBe(true); });
  it('npc_wang 持有.文 1025（add 25）', () => { expect(getHolding(result.state, 'npc_wang')).toBe(1025); });
  it('npc_li 持有.文 975（sub 25）', () => { expect(getHolding(result.state, 'npc_li')).toBe(975); });
  it('Σ守恒 2000', () => { expect(getHolding(result.state, 'npc_li') + getHolding(result.state, 'npc_wang')).toBe(2000); });
});

// ── T10: 非数值路径 → 可观测 no-op（防乱写）──────────────────────────────────

describe('T10 · 非数值路径 → 可观测 no-op', () => {
  const result = runTick(BASE_STATE_V, {
    tickId: 'verb-t10',
    injectedEnvelope: 指令信封Schema.parse({
      提案: {
        动作类别: 'UNKNOWN_VERB',
        目标引用: 'NONEXISTENT_PATH.xyz',  // 不存在于 state → getAtPath undefined → no-op
        数值槽: 999,
      },
    }),
    injectedSeatId: 'npc_li',
  });

  it('gateResult 存在（提案落账 phase 执行）', () => {
    expect(result.proposalGateResult).toBeDefined();
  });

  it('npc_li 持有.文 未变（no-op）', () => {
    expect(getHolding(result.state, 'npc_li')).toBe(1000);
  });

  it('npc_wang 持有.文 未变（no-op）', () => {
    expect(getHolding(result.state, 'npc_wang')).toBe(1000);
  });
});

// ── Treg: 赋予守恒回归（転移/赋予 同底座·Σ=0）────────────────────────────────

describe('Treg · 赋予守恒回归·同底座不破', () => {
  const result = runTick(BASE_STATE, {
    tickId: 'verb-treg',
    injectedEnvelope: ENVELOPE_赋予,
    injectedSeatId: 'npc_li',
  });

  it('proposalGateResult.ok === true', () => {
    expect(result.proposalGateResult?.ok).toBe(true);
  });

  it('npc_wang 持有.文 从 100 升至 130（add 30）', () => {
    expect(getHolding(result.state, 'npc_wang')).toBe(130);
  });

  it('npc_li 持有.文 从 200 降至 170（sub 30）', () => {
    expect(getHolding(result.state, 'npc_li')).toBe(170);
  });

  it('Σ净值守恒：preNet=300 = postNet=300', () => {
    expect(getHolding(result.state, 'npc_li') + getHolding(result.state, 'npc_wang')).toBe(300);
  });
});
