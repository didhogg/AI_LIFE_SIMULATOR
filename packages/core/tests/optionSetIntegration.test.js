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
//  - schemaKeys=54 / manifest=89 守恒
//  - SINK 使用 world_sink（无 _ 前缀·computeDelta Gate③ 兼容）
//  - 每个测试的 option 在 params.对手方条目 中显式携带带符号数值·executor 零取反
import { describe, it, expect } from 'vitest';
import { runTick } from '../engine/tick.js';
import { sampleOptionSet } from '../engine/optionSet.js';
import { RootSchema } from '../schema/index.js';
import { 动词选项条目Schema } from '../schema/preset.js';
import { getNetAsset } from '../engine/netAsset.js';
// ── 工具函数 ──────────────────────────────────────────────────────────────────
function getHolding(state, entity, ccy = '文') {
    const 账户 = state.货币系统?.账户;
    return 账户?.[entity]?.持有?.[ccy] ?? 0;
}
function calcNetAsset(state) {
    const 账户 = state.货币系统?.账户;
    if (!账户)
        return 0;
    return Object.values(账户).reduce((sum, acct) => sum + getNetAsset(acct), 0);
}
// ── 辅助：构建含显式对手方条目的转账 option ─────────────────────────────────────
// counterAmount 由调用方按 -chosenValue 显式给出·executor 零推导
function makeTransferOption(receiverPath, payerPath, counterAmount) {
    return 动词选项条目Schema.parse({
        verb: '转移',
        target_choices: [receiverPath],
        tool_name: 'transfer',
        params: { 对手方条目: [{ 目标引用: payerPath, 数值槽: counterAmount }] },
        value_slot: '金额',
        min: 1,
        max: 200,
    });
}
function makeCollectOption(receiverPath, sinkPath, counterAmount) {
    return 动词选项条目Schema.parse({
        verb: '赋予',
        target_choices: [receiverPath],
        tool_name: 'collect',
        params: { 对手方条目: [{ 目标引用: sinkPath, 数值槽: counterAmount }] },
        value_slot: '数量',
        min: 1,
        max: 100,
    });
}
// ── 路径常量 ──────────────────────────────────────────────────────────────────
const LINJIU_PATH = '货币系统.账户.pc_linjiu.持有.文';
const WANG_PATH = '货币系统.账户.npc_wang.持有.文';
const SINK_PATH = '货币系统.账户.world_sink.持有.文';
// ── Fixture: 双账户封闭经济（转账测试）──────────────────────────────────────────
const STATE_TRANSFER = RootSchema.parse({
    货币系统: {
        基准币种: '文',
        账户: {
            pc_linjiu: { 持有: { 文: 100 } }, // 付方
            npc_wang: { 持有: { 文: 200 } }, // 收方
        },
    },
    _状态机: { 双时钟: { 世界钟: 100 } },
    _席位表: {},
    全局: {},
});
// ── Fixture: SINK → player 封闭经济（赋予测试）──────────────────────────────────
const STATE_COLLECT = RootSchema.parse({
    货币系统: {
        基准币种: '文',
        账户: {
            world_sink: { 持有: { 文: 500 } }, // 显式 SINK（无 _ 前缀·Gate③ 兼容）
            pc_linjiu: { 持有: { 文: 50 } }, // player 受赠方
        },
    },
    _状态机: { 双时钟: { 世界钟: 100 } },
    _席位表: {},
    全局: {},
});
// ── ① 转账 option → 付方 −50 / 收方 +50 · 守恒 Σ=0 · gateOk=true ──────────────
// 对手方条目.数值槽=-50 由 makeTransferOption 显式给出·与 chosenValue:50 对称
describe('① 转账 option → 全闸 + 守恒', () => {
    const OPT_50 = makeTransferOption(WANG_PATH, LINJIU_PATH, -50);
    const OPT_SET_50 = sampleOptionSet({ declaredOptions: [OPT_50], seed: 42, tick: 1, rerollSalt: 0 });
    expect(OPT_SET_50.length).toBeGreaterThan(0);
    const optionId = OPT_SET_50[0].option_id;
    const result = runTick(STATE_TRANSFER, {
        tickId: 'opt-t1-transfer',
        optionSetInput: { chosenOptionId: optionId, optionSet: OPT_SET_50, chosenValue: 50 },
        injectedSeatId: 'pc_linjiu',
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
        const preNet = calcNetAsset(STATE_TRANSFER);
        const postNet = calcNetAsset(result.state);
        expect(postNet).toBe(preNet);
    });
    it('envelope.provenance = player_option', () => {
        // provenance 在 envelope·通过 proposalGateResult 间接验：gateOk=true·不直接暴露 envelope
        // 用 executeActionOption 验 provenance 字段（独立非 runTick 路径）
        const { executeActionOption } = require('../engine/aohpExecutor.js');
        const r = executeActionOption({ chosenOptionId: optionId, optionSet: OPT_SET_50, chosenValue: 50 });
        expect(r.envelope?.provenance).toBe('player_option');
    });
});
// ── ② 同 optionSetInput 双宿主 diff=0 逐位恒等（chosenValue:30·对手方-30）────────
describe('② 双宿主逐位恒等', () => {
    const OPT_30 = makeTransferOption(WANG_PATH, LINJIU_PATH, -30);
    const OPT_SET_30 = sampleOptionSet({ declaredOptions: [OPT_30], seed: 42, tick: 1, rerollSalt: 0 });
    expect(OPT_SET_30.length).toBeGreaterThan(0);
    const optionId = OPT_SET_30[0].option_id;
    const INPUT = {
        tickId: 'opt-t2-dual',
        optionSetInput: { chosenOptionId: optionId, optionSet: OPT_SET_30, chosenValue: 30 },
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
    const OPT_ANY = makeTransferOption(WANG_PATH, LINJIU_PATH, -50);
    const OPT_SET_ANY = sampleOptionSet({ declaredOptions: [OPT_ANY], seed: 42, tick: 1, rerollSalt: 0 });
    const result = runTick(STATE_TRANSFER, {
        tickId: 'opt-t3-oob',
        optionSetInput: {
            chosenOptionId: '赋予:npc_unknown:未注册_选项', // 不在权威集
            optionSet: OPT_SET_ANY,
            chosenValue: 999,
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
        const preNet = calcNetAsset(STATE_TRANSFER);
        const postNet = calcNetAsset(result.state);
        expect(postNet).toBe(preNet);
    });
});
// ── ④ 赋予 option(SINK → player) → 守恒 · gateOk=true（对手方SINK-30·chosenValue:30）
describe('④ 收集/赋予 option → SINK 显式守恒', () => {
    const OPT_COLLECT = makeCollectOption('货币系统.账户.pc_linjiu.持有.文', SINK_PATH, -30);
    const OPT_SET_COLLECT = sampleOptionSet({ declaredOptions: [OPT_COLLECT], seed: 7, tick: 1, rerollSalt: 0 });
    expect(OPT_SET_COLLECT.length).toBeGreaterThan(0);
    const collectId = OPT_SET_COLLECT[0].option_id;
    const result = runTick(STATE_COLLECT, {
        tickId: 'opt-t4-collect',
        optionSetInput: { chosenOptionId: collectId, optionSet: OPT_SET_COLLECT, chosenValue: 30 },
        injectedSeatId: 'world_sink', // 显式 SINK 来源方
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
        const preNet = calcNetAsset(STATE_COLLECT);
        const postNet = calcNetAsset(result.state);
        expect(postNet).toBe(preNet);
    });
    it('双宿主逐位恒等（赋予路径）', () => {
        const INPUT = {
            tickId: 'opt-t4-dual',
            optionSetInput: { chosenOptionId: collectId, optionSet: OPT_SET_COLLECT, chosenValue: 30 },
            injectedSeatId: 'world_sink',
        };
        const r1 = runTick(STATE_COLLECT, INPUT);
        const r2 = runTick(STATE_COLLECT, INPUT);
        expect(JSON.stringify(r1.state)).toBe(JSON.stringify(r2.state));
    });
});
// ── ⑤ optionSetInput 与 injectedEnvelope 互斥：optionSetInput 优先（chosenValue:10·对手方-10）
describe('⑤ optionSetInput > injectedEnvelope 优先级', () => {
    const OPT_10 = makeTransferOption(WANG_PATH, LINJIU_PATH, -10);
    const OPT_SET_10 = sampleOptionSet({ declaredOptions: [OPT_10], seed: 42, tick: 1, rerollSalt: 0 });
    expect(OPT_SET_10.length).toBeGreaterThan(0);
    const optionId = OPT_SET_10[0].option_id;
    it('两者同时存在 → optionSetInput 胜出·正常落账', () => {
        const { 指令信封Schema } = require('../schema/proposal.js');
        const freeEnvelope = 指令信封Schema.parse({ 提案批: [{ 动作类别: '転移', 目标引用: 'npc_wang', 数值槽: 999 }] });
        const result = runTick(STATE_TRANSFER, {
            tickId: 'opt-t5-priority',
            optionSetInput: { chosenOptionId: optionId, optionSet: OPT_SET_10, chosenValue: 10 },
            injectedEnvelope: freeEnvelope, // 应被忽略
            injectedSeatId: 'pc_linjiu',
        });
        expect(result.proposalGateResult?.ok).toBe(true);
        // optionSetInput 转 10 → pc_linjiu 持有应为 90（非 freeEnvelope 的 999）
        expect(getHolding(result.state, 'pc_linjiu')).toBe(90);
    });
});
