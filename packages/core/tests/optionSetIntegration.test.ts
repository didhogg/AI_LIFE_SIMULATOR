// optionSetIntegration — 阶段1 机测 · option-set 接入 runTick 主流 + 落账守恒
//
// 验收项（对应任务机测四项）：
//  ① 转账 option → 付方 −N / 收方 +N · 守恒 Σ=0 · gateOk=true
//  ② 同参数双宿主 diff=0 逐位恒等
//  ③ 越界 option_id → matched=false + downgrade=true · 不写账 · state 不变
//  ④ 赋予 option(SINK→player·显式 world_sink) → 守恒 Σ=0 · gateOk=true
//
// 设计约束：
//  - runTick 零 RNG 改动（optionSetInput 路径不引入新 RNG 通道）
//  - 黄金向量不受影响（optionSetInput 未接入涟漪/衰减路径）
//  - schemaKeys=52 / manifest=86 守恒（G2-2 +媒介传播面 → BUNDLE21）
//  - SINK 使用 world_sink（无 _ 前缀·computeDelta Gate③ 兼容）

import { describe, it, expect } from 'vitest';
import { runTick } from '../engine/tick.js';
import { sampleOptionSet } from '../engine/optionSet.js';
import { RootSchema } from '../schema/index.js';
import type { RootState } from '../schema/index.js';
import type { 动词选项条目Type } from '../schema/preset.js';
import { 动词选项条目Schema } from '../schema/preset.js';
import { getNetAsset } from '../engine/netAsset.js';

// ── 工具函数 ──────────────────────────────────────────────────────────────────

function getHolding(state: RootState, entity: string, ccy = '文'): number {
  const 账户 = state.货币系统?.账户 as Record<string, { 持有: Record<string, number> }>;
  return 账户?.[entity]?.持有?.[ccy] ?? 0;
}

function calcNetAsset(state: RootState): number {
  const 账户 = state.货币系统?.账户 as Record<string, { 持有: Record<string, number>; 储蓄: Record<string, number>; 资产: unknown[] }>;
  if (!账户) return 0;
  return Object.values(账户).reduce((sum, acct) => sum + getNetAsset(acct as Parameters<typeof getNetAsset>[0]), 0);
}

// ── Fixture: 双账户封闭经济（转账测试）──────────────────────────────────────────

const STATE_TRANSFER: RootState = RootSchema.parse({
  货币系统: {
    基准币种: '文',
    账户: {
      pc_linjiu: { 持有: { 文: 100 } }, // 付方
      npc_wang:  { 持有: { 文: 200 } }, // 收方
    },
  },
  _状态机: { 双时钟: { 世界钟: 100 } },
  _席位表: {},
  全局: {},
});

// 转账 option（verb='转移'·pc_linjiu 付 → npc_wang 收 50 文）
const TRANSFER_OPTION = 动词选项条目Schema.parse({
  verb:           '转移',
  target_choices: ['npc_wang'],
  tool_name:      'transfer',
  params:         {},
  value_slot:     '金额',
  min:            1,
  max:            200,
});

const TRANSFER_OPTION_SET = sampleOptionSet({
  declaredOptions: [TRANSFER_OPTION],
  seed:       42,
  tick:        1,
  rerollSalt:  0,
});

// ── Fixture: SINK → player 封闭经济（赋予测试）──────────────────────────────────

const STATE_COLLECT: RootState = RootSchema.parse({
  货币系统: {
    基准币种: '文',
    账户: {
      world_sink: { 持有: { 文: 500 } }, // 显式 SINK（无 _ 前缀·Gate③ 兼容）
      pc_linjiu:  { 持有: { 文: 50  } }, // player 受赠方
    },
  },
  _状态机: { 双时钟: { 世界钟: 100 } },
  _席位表: {},
  全局: {},
});

// 赋予 option（verb='赋予'·world_sink 给 → pc_linjiu 收 30 文）
// seatId = 'world_sink'（donor·传入 injectedSeatId）
const COLLECT_OPTION = 动词选项条目Schema.parse({
  verb:           '赋予',
  target_choices: ['pc_linjiu'],
  tool_name:      'collect',
  params:         {},
  value_slot:     '数量',
  min:            1,
  max:            100,
});

const COLLECT_OPTION_SET = sampleOptionSet({
  declaredOptions: [COLLECT_OPTION],
  seed:       7,
  tick:        1,
  rerollSalt:  0,
});

// ── ① 转账 option → 付方 −N / 收方 +N · 守恒 Σ=0 · gateOk=true ──────────────

describe('① 转账 option → 全闸 + 守恒', () => {
  expect(TRANSFER_OPTION_SET.length).toBeGreaterThan(0);
  const optionId = TRANSFER_OPTION_SET[0]!.option_id;

  const result = runTick(STATE_TRANSFER, {
    tickId:          'opt-t1-transfer',
    optionSetInput:  { chosenOptionId: optionId, optionSet: TRANSFER_OPTION_SET, chosenValue: 50 },
    injectedSeatId:  'pc_linjiu',
  });

  it('Phase 提案落账 出现在 settledPhases', () => {
    expect(result.settledPhases).toContain('提案落账');
  });

  it('proposalGateResult.ok === true', () => {
    expect(result.proposalGateResult?.ok).toBe(true);
  });

  it('pc_linjiu 持有.文 = 100 − 50 = 50', () => {
    expect(getHolding(result.state, 'pc_linjiu')).toBe(50);
  });

  it('npc_wang 持有.文 = 200 + 50 = 250', () => {
    expect(getHolding(result.state, 'npc_wang')).toBe(250);
  });

  it('Σ净值守恒：300 = 300', () => {
    const preNet  = calcNetAsset(STATE_TRANSFER);
    const postNet = calcNetAsset(result.state);
    expect(postNet).toBe(preNet);
  });

  it('envelope.provenance = player_option', () => {
    // provenance 在 envelope·通过 proposalGateResult 间接验：gateOk=true·不直接暴露 envelope
    // 用 executeActionOption 验 provenance 字段（独立非 runTick 路径）
    const { executeActionOption } = require('../engine/aohpExecutor.js');
    const r = executeActionOption({ chosenOptionId: optionId, optionSet: TRANSFER_OPTION_SET, chosenValue: 50 });
    expect(r.envelope?.provenance).toBe('player_option');
  });
});

// ── ② 同 optionSetInput 双宿主 diff=0 逐位恒等 ────────────────────────────────

describe('② 双宿主逐位恒等', () => {
  expect(TRANSFER_OPTION_SET.length).toBeGreaterThan(0);
  const optionId = TRANSFER_OPTION_SET[0]!.option_id;

  const INPUT = {
    tickId:         'opt-t2-dual',
    optionSetInput: { chosenOptionId: optionId, optionSet: TRANSFER_OPTION_SET, chosenValue: 30 },
    injectedSeatId: 'pc_linjiu',
  };

  it('两次调用 state JSON 逐位恒等', () => {
    const r1 = runTick(STATE_TRANSFER, INPUT);
    const r2 = runTick(STATE_TRANSFER, INPUT);
    expect(JSON.stringify(r1.state)).toBe(JSON.stringify(r2.state));
  });

  it('两次调用 settledPhases 逐位恒等', () => {
    const r1 = runTick(STATE_TRANSFER, INPUT);
    const r2 = runTick(STATE_TRANSFER, INPUT);
    expect(JSON.stringify(r1.settledPhases)).toBe(JSON.stringify(r2.settledPhases));
  });

  it('两次调用 proposalGateResult.ok 均为 true', () => {
    const r1 = runTick(STATE_TRANSFER, INPUT);
    const r2 = runTick(STATE_TRANSFER, INPUT);
    expect(r1.proposalGateResult?.ok).toBe(true);
    expect(r2.proposalGateResult?.ok).toBe(true);
  });
});

// ── ③ 越界 option_id → matched=false · 不写账 · state 不变 ───────────────────

describe('③ 越界 option_id → downgrade · 不写账', () => {
  const result = runTick(STATE_TRANSFER, {
    tickId:         'opt-t3-oob',
    optionSetInput: {
      chosenOptionId: '赋予:npc_unknown:未注册_选项',  // 不在权威集
      optionSet:      TRANSFER_OPTION_SET,
      chosenValue:    999,
    },
    injectedSeatId: 'pc_linjiu',
  });

  it('proposalGateResult 不存在（downgrade·跳过五道闸）', () => {
    expect(result.proposalGateResult).toBeUndefined();
  });

  it('pc_linjiu 持有.文 不变（零写账）', () => {
    expect(getHolding(result.state, 'pc_linjiu')).toBe(100);
  });

  it('npc_wang 持有.文 不变（零写账）', () => {
    expect(getHolding(result.state, 'npc_wang')).toBe(200);
  });

  it('Σ净值守恒：越界 option 不破守恒', () => {
    const preNet  = calcNetAsset(STATE_TRANSFER);
    const postNet = calcNetAsset(result.state);
    expect(postNet).toBe(preNet);
  });
});

// ── ④ 赋予 option(SINK → player) → 守恒 · gateOk=true ──────────────────────────

describe('④ 收集/赋予 option → SINK 显式守恒', () => {
  expect(COLLECT_OPTION_SET.length).toBeGreaterThan(0);
  const collectId = COLLECT_OPTION_SET[0]!.option_id;

  const result = runTick(STATE_COLLECT, {
    tickId:         'opt-t4-collect',
    optionSetInput: { chosenOptionId: collectId, optionSet: COLLECT_OPTION_SET, chosenValue: 30 },
    injectedSeatId: 'world_sink',  // 显式 SINK 来源方
  });

  it('proposalGateResult.ok === true', () => {
    expect(result.proposalGateResult?.ok).toBe(true);
  });

  it('world_sink 持有.文 = 500 − 30 = 470', () => {
    expect(getHolding(result.state, 'world_sink')).toBe(470);
  });

  it('pc_linjiu 持有.文 = 50 + 30 = 80', () => {
    expect(getHolding(result.state, 'pc_linjiu')).toBe(80);
  });

  it('Σ净值守恒：SINK + player = 550 不变', () => {
    const preNet  = calcNetAsset(STATE_COLLECT);
    const postNet = calcNetAsset(result.state);
    expect(postNet).toBe(preNet);
  });

  it('双宿主逐位恒等（赋予路径）', () => {
    const INPUT = {
      tickId:         'opt-t4-dual',
      optionSetInput: { chosenOptionId: collectId, optionSet: COLLECT_OPTION_SET, chosenValue: 30 },
      injectedSeatId: 'world_sink',
    };
    const r1 = runTick(STATE_COLLECT, INPUT);
    const r2 = runTick(STATE_COLLECT, INPUT);
    expect(JSON.stringify(r1.state)).toBe(JSON.stringify(r2.state));
  });
});

// ── ⑤ optionSetInput 与 injectedEnvelope 互斥：optionSetInput 优先 ──────────────

describe('⑤ optionSetInput > injectedEnvelope 优先级', () => {
  expect(TRANSFER_OPTION_SET.length).toBeGreaterThan(0);
  const optionId = TRANSFER_OPTION_SET[0]!.option_id;

  it('两者同时存在 → optionSetInput 胜出·正常落账', () => {
    const { 指令信封Schema } = require('../schema/proposal.js');
    const freeEnvelope = 指令信封Schema.parse({ 提案: { 动作类别: '转移', 目标引用: 'npc_wang', 数值槽: 999 } });
    const result = runTick(STATE_TRANSFER, {
      tickId:          'opt-t5-priority',
      optionSetInput:  { chosenOptionId: optionId, optionSet: TRANSFER_OPTION_SET, chosenValue: 10 },
      injectedEnvelope: freeEnvelope, // 应被忽略
      injectedSeatId:  'pc_linjiu',
    });
    expect(result.proposalGateResult?.ok).toBe(true);
    // optionSetInput 转 10 → pc_linjiu 持有应为 90（非 freeEnvelope 的 999）
    expect(getHolding(result.state, 'pc_linjiu')).toBe(90);
  });
});
