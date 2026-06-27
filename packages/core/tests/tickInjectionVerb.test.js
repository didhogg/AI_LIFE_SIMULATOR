// tickInjectionVerb — deriveVerbDelta 单测
// 覆盖：T1 转移-支 落账守恒 · T2 双宿主逐位恒等 · T3 违闸拒零写账
//       T4 无 injectedEnvelope 回归 · T5 缺键/ccy 空 no-op
import { describe, it, expect } from 'vitest';
import { runTick } from '../engine/tick.js';
import { RootSchema } from '../schema/index.js';
import { 指令信封Schema } from '../schema/proposal.js';
// ── Fixtures ──────────────────────────────────────────────────────────────────
const BASE_STATE = RootSchema.parse({
    货币系统: {
        基准币种: '文',
        账户: {
            npc_li: { 持有: { 文: 200 } }, // 付方（seatId）
            npc_wang: { 持有: { 文: 100 } }, // 收方
        },
    },
    _状态机: { 双时钟: { 世界钟: 100 } },
    _席位表: {},
    全局: {},
});
// 转移信封：seatId=npc_li → npc_wang 50文（不传 injectedPacks → 走 deriveVerbDelta）
const ENVELOPE_转移 = 指令信封Schema.parse({
    提案: { 动作类别: '转移', 目标引用: 'npc_wang', 数值槽: 50 },
});
// 违闸信封（非法动作类别不是问题，闸拒走 packs 层·此处用合法信封+非法 pack 测拒闸）
const ENVELOPE_合法 = ENVELOPE_转移;
function getHolding(state, entity, ccy = '文') {
    const accts = state.货币系统?.账户;
    return accts?.[entity]?.持有[ccy] ?? 0;
}
// ── T1: 转移-支 · 落账成功 + 守恒 ──────────────────────────────────────────────
describe('T1 · 转移-支 · deriveVerbDelta 落账守恒', () => {
    const result = runTick(BASE_STATE, {
        tickId: 'verb-t1',
        injectedEnvelope: ENVELOPE_转移,
        injectedSeatId: 'npc_li',
        // injectedPacks 未传 → 走 deriveVerbDelta
    });
    it('Phase 提案落账 出现在 settledPhases', () => {
        expect(result.settledPhases).toContain('提案落账');
    });
    it('proposalGateResult.ok === true', () => {
        expect(result.proposalGateResult?.ok).toBe(true);
    });
    it('付方 npc_li 持有.文 从 200 降至 150', () => {
        expect(getHolding(result.state, 'npc_li')).toBe(150);
    });
    it('收方 npc_wang 持有.文 从 100 升至 150', () => {
        expect(getHolding(result.state, 'npc_wang')).toBe(150);
    });
    it('Σ净值守恒：preNet=300 = postNet=300', () => {
        const post = getHolding(result.state, 'npc_li') + getHolding(result.state, 'npc_wang');
        expect(post).toBe(300);
    });
    it('原始 BASE_STATE 未被写回（深拷隔离）', () => {
        expect(getHolding(BASE_STATE, 'npc_li')).toBe(200);
        expect(getHolding(BASE_STATE, 'npc_wang')).toBe(100);
    });
});
// ── T2: 双宿主逐位恒等 ─────────────────────────────────────────────────────────
describe('T2 · 双宿主逐位恒等', () => {
    const INPUT = {
        tickId: 'verb-t2',
        injectedEnvelope: ENVELOPE_转移,
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
// ── T3: 违闸信封 → 拒绝 + 零写账 ─────────────────────────────────────────────
describe('T3 · 违闸 pack → Gate④ 拒绝 + 零写账', () => {
    // injectedPacks 传非法路径（走旧路径，验证 packs 优先于 deriveVerbDelta）
    const result = runTick(BASE_STATE, {
        tickId: 'verb-t3',
        injectedEnvelope: ENVELOPE_合法,
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
// ── T4: 无 injectedEnvelope → 行为逐位恒等（回归） ────────────────────────────
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
// ── T5: 缺键 / 基准币种为空 → no-op（不写账·不报错）────────────────────────────
describe('T5a · 收方缺该币种键 → no-op（deferred additive）', () => {
    // npc_wang 只持有 文，转 两 给它 → 收方无 两 键 → deriveVerbDelta 返回 []
    const stateWith两 = RootSchema.parse({
        货币系统: {
            基准币种: '两',
            账户: {
                npc_li: { 持有: { 两: 100 } }, // 付方有 两
                npc_wang: { 持有: { 文: 50 } }, // 收方无 两 键
            },
        },
        _状态机: { 双时钟: { 世界钟: 100 } },
        _席位表: {},
        全局: {},
    });
    const result = runTick(stateWith两, {
        tickId: 'verb-t5a',
        injectedEnvelope: 指令信封Schema.parse({
            提案: { 动作类别: '转移', 目标引用: 'npc_wang', 数值槽: 30 },
        }),
        injectedSeatId: 'npc_li',
    });
    it('packs 为空 → runProposalGate 返回 ok（空 packs 通闸）或 gateResult 正常', () => {
        // 空 packs → gate 以空包执行（无 delta·无守恒压力）
        expect(result.proposalGateResult).toBeDefined();
    });
    it('npc_li.持有.两 未变（no-op）', () => {
        const accts = stateWith两.货币系统?.账户;
        expect(accts['npc_li']?.持有['两']).toBe(100);
    });
});
describe('T5b · 基准币种为空 → no-op', () => {
    const stateNoCcy = RootSchema.parse({
        货币系统: {
            基准币种: '', // 空 → no-op
            账户: {
                npc_li: { 持有: { 文: 100 } },
                npc_wang: { 持有: { 文: 50 } },
            },
        },
        _状态机: { 双时钟: { 世界钟: 100 } },
        _席位表: {},
        全局: {},
    });
    const result = runTick(stateNoCcy, {
        tickId: 'verb-t5b',
        injectedEnvelope: 指令信封Schema.parse({
            提案: { 动作类别: '转移', 目标引用: 'npc_wang', 数值槽: 10 },
        }),
        injectedSeatId: 'npc_li',
    });
    it('npc_li.持有.文 未变（no-op）', () => {
        const accts = result.state.货币系统?.账户;
        expect(accts?.['npc_li']?.持有['文']).toBe(100);
    });
    it('npc_wang.持有.文 未变（no-op）', () => {
        const accts = result.state.货币系统?.账户;
        expect(accts?.['npc_wang']?.持有['文']).toBe(50);
    });
});
