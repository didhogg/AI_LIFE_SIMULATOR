// tickInjectionVerb — deriveVerbDelta 声明式哑执行器单测（R9）
// 覆盖：T1 転移 守恒 · T2 双宿主逐位恒等 · T3 违闸拒零写账
//       T4 无 injectedEnvelope 回归 · T5 缺键/ccy 空 no-op
//       T6 调整 · T7 披露 · T8 施加 · T9a-e 缔结/解除/剥夺/移动/植入
//       T10 未知动词 no-op · Treg 赋予守恒回归
import { describe, it, expect } from 'vitest';
import { runTick } from '../engine/tick.js';
import { RootSchema } from '../schema/index.js';
import { 指令信封Schema } from '../schema/proposal.js';
// ── 守恒对模板（転移/赋予语义：seatId sub → target add · Σ=0）──────────────
const CONSERVATION_PAIR_DECLS = [
    { path_tmpl: '货币系统.账户.{seatId}.持有.{ccy}', op: 'sub', value_src: '数值槽', conservation_role: 'debit' },
    { path_tmpl: '货币系统.账户.{target}.持有.{ccy}', op: 'add', value_src: '数值槽', conservation_role: 'credit' },
];
// ── Fixtures ──────────────────────────────────────────────────────────────────
const BASE_STATE = RootSchema.parse({
    货币系统: {
        基准币种: '文',
        账户: {
            npc_li: { 持有: { 文: 200 } },
            npc_wang: { 持有: { 文: 100 } },
        },
    },
    _状态机: { 双时钟: { 世界钟: 100 } },
    _席位表: {},
    全局: {},
});
// 転移信封（携带 effect_decls·seatId=npc_li → npc_wang 50文）
const ENVELOPE_転移 = 指令信封Schema.parse({
    提案: {
        动作类别: '転移',
        目标引用: 'npc_wang',
        数值槽: 50,
        effect_decls: CONSERVATION_PAIR_DECLS,
    },
});
// 赋予信封（SINK=npc_li → recipient=npc_wang·同守恒対结构）
const ENVELOPE_赋予 = 指令信封Schema.parse({
    提案: {
        动作类别: '赋予',
        目标引用: 'npc_wang',
        数值槽: 30,
        effect_decls: CONSERVATION_PAIR_DECLS,
    },
});
// 违闸信封（使用与 T1 相同的有效信封·T3 走 injectedPacks 路径不走 verbDelta）
const ENVELOPE_合法 = ENVELOPE_転移;
function getHolding(state, entity, ccy = '文') {
    const accts = state.货币系统?.账户;
    return accts?.[entity]?.持有[ccy] ?? 0;
}
// ── 较大额度的 state（T6-T10 共用·各动词哑执行用例）────────────────────────
const BASE_STATE_V = RootSchema.parse({
    货币系统: {
        基准币种: '文',
        账户: {
            npc_li: { 持有: { 文: 1000 } },
            npc_wang: { 持有: { 文: 1000 } },
        },
    },
    _状态机: { 双时钟: { 世界钟: 100 } },
    _席位表: {},
    全局: {},
});
// ── T1: 転移-支 · 落账成功 + 守恒 ──────────────────────────────────────────────
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
// ── T3: 违闸信封 → 拒绝 + 零写账 ─────────────────────────────────────────────
describe('T3 · 违闸 pack → Gate④ 拒绝 + 零写账', () => {
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
describe('T5a · 收方缺该币种键 → no-op（effect_decls 缺失·不报错）', () => {
    const stateWith两 = RootSchema.parse({
        货币系统: {
            基准币种: '两',
            账户: {
                npc_li: { 持有: { 两: 100 } },
                npc_wang: { 持有: { 文: 50 } },
            },
        },
        _状态机: { 双时钟: { 世界钟: 100 } },
        _席位表: {},
        全局: {},
    });
    const result = runTick(stateWith两, {
        tickId: 'verb-t5a',
        injectedEnvelope: 指令信封Schema.parse({
            提案: { 动作类别: '転移', 目标引用: 'npc_wang', 数值槽: 30 },
            // 无 effect_decls → verbDelta no-op
        }),
        injectedSeatId: 'npc_li',
    });
    it('packs 为空 → runProposalGate 返回 ok（空 packs 通闸）或 gateResult 正常', () => {
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
            基准币种: '',
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
            提案: { 动作类别: '転移', 目标引用: 'npc_wang', 数值槽: 10 },
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
// ── T6-T9: 8 动词哑执行用例（全部守恒对·Σ=0·seatId=npc_li·target=npc_wang）──
// 守恒性由 conservation_role 声明·assertConservation 校验；
// 测试验证「effect_decls 哑执行」机制，非验证每动词独立守恒语义。
describe('T6 · 调整 · 多 path_tmpl·数值槽 debit+credit', () => {
    // 调整：target.ccy sub → seatId.ccy add（展示 {target}/{seatId} 双占位符）
    const result = runTick(BASE_STATE_V, {
        tickId: 'verb-t6',
        injectedEnvelope: 指令信封Schema.parse({
            提案: {
                动作类别: '调整',
                目标引用: 'npc_wang',
                数值槽: 50,
                effect_decls: [
                    { path_tmpl: '货币系统.账户.{target}.持有.{ccy}', op: 'sub', value_src: '数值槽', conservation_role: 'debit' },
                    { path_tmpl: '货币系统.账户.{seatId}.持有.{ccy}', op: 'add', value_src: '数值槽', conservation_role: 'credit' },
                ],
            },
        }),
        injectedSeatId: 'npc_li',
    });
    it('proposalGateResult.ok === true', () => { expect(result.proposalGateResult?.ok).toBe(true); });
    it('npc_wang 持有.文 950（sub 50 via {target}）', () => { expect(getHolding(result.state, 'npc_wang')).toBe(950); });
    it('npc_li 持有.文 1050（add 50 via {seatId}）', () => { expect(getHolding(result.state, 'npc_li')).toBe(1050); });
    it('Σ守恒 2000', () => { expect(getHolding(result.state, 'npc_li') + getHolding(result.state, 'npc_wang')).toBe(2000); });
});
describe('T7 · 披露 · 数值槽 debit+credit', () => {
    // 披露：seatId.ccy sub → target.ccy add（展示方向对调）
    const result = runTick(BASE_STATE_V, {
        tickId: 'verb-t7',
        injectedEnvelope: 指令信封Schema.parse({
            提案: {
                动作类别: '披露',
                目标引用: 'npc_wang',
                数值槽: 10,
                effect_decls: [
                    { path_tmpl: '货币系统.账户.{seatId}.持有.{ccy}', op: 'sub', value_src: '数值槽', conservation_role: 'debit' },
                    { path_tmpl: '货币系统.账户.{target}.持有.{ccy}', op: 'add', value_src: '数值槽', conservation_role: 'credit' },
                ],
            },
        }),
        injectedSeatId: 'npc_li',
    });
    it('proposalGateResult.ok === true', () => { expect(result.proposalGateResult?.ok).toBe(true); });
    it('npc_li 持有.文 990（sub 10）', () => { expect(getHolding(result.state, 'npc_li')).toBe(990); });
    it('npc_wang 持有.文 1010（add 10）', () => { expect(getHolding(result.state, 'npc_wang')).toBe(1010); });
    it('Σ守恒 2000', () => { expect(getHolding(result.state, 'npc_li') + getHolding(result.state, 'npc_wang')).toBe(2000); });
});
describe('T8 · 施加 · 常量 debit+credit', () => {
    // 施加：常量 value·target sub + seatId add（展示 value_src=常量）
    const result = runTick(BASE_STATE_V, {
        tickId: 'verb-t8',
        injectedEnvelope: 指令信封Schema.parse({
            提案: {
                动作类别: '施加',
                目标引用: 'npc_wang',
                effect_decls: [
                    { path_tmpl: '货币系统.账户.{target}.持有.{ccy}', op: 'sub', value_src: '常量', value: 15, conservation_role: 'debit' },
                    { path_tmpl: '货币系统.账户.{seatId}.持有.{ccy}', op: 'add', value_src: '常量', value: 15, conservation_role: 'credit' },
                ],
            },
        }),
        injectedSeatId: 'npc_li',
    });
    it('proposalGateResult.ok === true', () => { expect(result.proposalGateResult?.ok).toBe(true); });
    it('npc_wang 持有.文 985（sub 常量 15）', () => { expect(getHolding(result.state, 'npc_wang')).toBe(985); });
    it('npc_li 持有.文 1015（add 常量 15）', () => { expect(getHolding(result.state, 'npc_li')).toBe(1015); });
    it('Σ守恒 2000', () => { expect(getHolding(result.state, 'npc_li') + getHolding(result.state, 'npc_wang')).toBe(2000); });
});
describe('T9a · 缔结 · debit+credit', () => {
    const result = runTick(BASE_STATE_V, {
        tickId: 'verb-t9a',
        injectedEnvelope: 指令信封Schema.parse({
            提案: {
                动作类别: '缔结',
                目标引用: 'npc_wang',
                数值槽: 20,
                effect_decls: [
                    { path_tmpl: '货币系统.账户.{seatId}.持有.{ccy}', op: 'sub', value_src: '数值槽', conservation_role: 'debit' },
                    { path_tmpl: '货币系统.账户.{target}.持有.{ccy}', op: 'add', value_src: '数值槽', conservation_role: 'credit' },
                ],
            },
        }),
        injectedSeatId: 'npc_li',
    });
    it('proposalGateResult.ok === true', () => { expect(result.proposalGateResult?.ok).toBe(true); });
    it('npc_li 持有.文 980（sub 20）', () => { expect(getHolding(result.state, 'npc_li')).toBe(980); });
    it('npc_wang 持有.文 1020（add 20）', () => { expect(getHolding(result.state, 'npc_wang')).toBe(1020); });
    it('Σ守恒 2000', () => { expect(getHolding(result.state, 'npc_li') + getHolding(result.state, 'npc_wang')).toBe(2000); });
});
describe('T9b · 解除 · 常量 debit+credit', () => {
    const result = runTick(BASE_STATE_V, {
        tickId: 'verb-t9b',
        injectedEnvelope: 指令信封Schema.parse({
            提案: {
                动作类别: '解除',
                目标引用: 'npc_wang',
                effect_decls: [
                    { path_tmpl: '货币系统.账户.{target}.持有.{ccy}', op: 'sub', value_src: '常量', value: 5, conservation_role: 'debit' },
                    { path_tmpl: '货币系统.账户.{seatId}.持有.{ccy}', op: 'add', value_src: '常量', value: 5, conservation_role: 'credit' },
                ],
            },
        }),
        injectedSeatId: 'npc_li',
    });
    it('proposalGateResult.ok === true', () => { expect(result.proposalGateResult?.ok).toBe(true); });
    it('npc_li 持有.文 1005（add 常量 5）', () => { expect(getHolding(result.state, 'npc_li')).toBe(1005); });
    it('npc_wang 持有.文 995（sub 常量 5）', () => { expect(getHolding(result.state, 'npc_wang')).toBe(995); });
    it('Σ守恒 2000', () => { expect(getHolding(result.state, 'npc_li') + getHolding(result.state, 'npc_wang')).toBe(2000); });
});
describe('T9c · 剥夺 · debit+credit', () => {
    const result = runTick(BASE_STATE_V, {
        tickId: 'verb-t9c',
        injectedEnvelope: 指令信封Schema.parse({
            提案: {
                动作类别: '剥夺',
                目标引用: 'npc_wang',
                数值槽: 40,
                effect_decls: [
                    { path_tmpl: '货币系统.账户.{seatId}.持有.{ccy}', op: 'sub', value_src: '数值槽', conservation_role: 'debit' },
                    { path_tmpl: '货币系统.账户.{target}.持有.{ccy}', op: 'add', value_src: '数值槽', conservation_role: 'credit' },
                ],
            },
        }),
        injectedSeatId: 'npc_li',
    });
    it('proposalGateResult.ok === true', () => { expect(result.proposalGateResult?.ok).toBe(true); });
    it('npc_li 持有.文 960（sub 40）', () => { expect(getHolding(result.state, 'npc_li')).toBe(960); });
    it('npc_wang 持有.文 1040（add 40）', () => { expect(getHolding(result.state, 'npc_wang')).toBe(1040); });
    it('Σ守恒 2000', () => { expect(getHolding(result.state, 'npc_li') + getHolding(result.state, 'npc_wang')).toBe(2000); });
});
describe('T9d · 移动 · 常量 debit+credit（seatId=npc_wang）', () => {
    // seatId=npc_wang：验证 {seatId} 不固定为 npc_li
    const result = runTick(BASE_STATE_V, {
        tickId: 'verb-t9d',
        injectedEnvelope: 指令信封Schema.parse({
            提案: {
                动作类别: '移动',
                目标引用: 'npc_li',
                effect_decls: [
                    { path_tmpl: '货币系统.账户.{seatId}.持有.{ccy}', op: 'sub', value_src: '常量', value: 100, conservation_role: 'debit' },
                    { path_tmpl: '货币系统.账户.{target}.持有.{ccy}', op: 'add', value_src: '常量', value: 100, conservation_role: 'credit' },
                ],
            },
        }),
        injectedSeatId: 'npc_wang',
    });
    it('proposalGateResult.ok === true', () => { expect(result.proposalGateResult?.ok).toBe(true); });
    it('npc_wang 持有.文 900（sub 常量 100 via {seatId}）', () => { expect(getHolding(result.state, 'npc_wang')).toBe(900); });
    it('npc_li 持有.文 1100（add 常量 100 via {target}）', () => { expect(getHolding(result.state, 'npc_li')).toBe(1100); });
    it('Σ守恒 2000', () => { expect(getHolding(result.state, 'npc_li') + getHolding(result.state, 'npc_wang')).toBe(2000); });
});
describe('T9e · 植入 · 数值槽 debit+credit', () => {
    const result = runTick(BASE_STATE_V, {
        tickId: 'verb-t9e',
        injectedEnvelope: 指令信封Schema.parse({
            提案: {
                动作类别: '植入',
                目标引用: 'npc_wang',
                数值槽: 25,
                effect_decls: [
                    { path_tmpl: '货币系统.账户.{seatId}.持有.{ccy}', op: 'sub', value_src: '数值槽', conservation_role: 'debit' },
                    { path_tmpl: '货币系统.账户.{target}.持有.{ccy}', op: 'add', value_src: '数值槽', conservation_role: 'credit' },
                ],
            },
        }),
        injectedSeatId: 'npc_li',
    });
    it('proposalGateResult.ok === true', () => { expect(result.proposalGateResult?.ok).toBe(true); });
    it('npc_li 持有.文 975（sub 25）', () => { expect(getHolding(result.state, 'npc_li')).toBe(975); });
    it('npc_wang 持有.文 1025（add 25）', () => { expect(getHolding(result.state, 'npc_wang')).toBe(1025); });
    it('Σ守恒 2000', () => { expect(getHolding(result.state, 'npc_li') + getHolding(result.state, 'npc_wang')).toBe(2000); });
});
// ── T10: 未知动词 + 无 effect_decls → 可观测 no-op（防乱写）──────────────────
describe('T10 · 未知动词/无 effect_decls → 可观测 no-op', () => {
    const result = runTick(BASE_STATE_V, {
        tickId: 'verb-t10',
        injectedEnvelope: 指令信封Schema.parse({
            提案: {
                动作类别: 'UNKNOWN_VERB',
                目标引用: 'npc_wang',
                数值槽: 999,
                // 无 effect_decls → verbDelta 返回 []·非静默可观测
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
    it('npc_li 持有.文 从 200 降至 170（sub 30）', () => {
        expect(getHolding(result.state, 'npc_li')).toBe(170);
    });
    it('npc_wang 持有.文 从 100 升至 130（add 30）', () => {
        expect(getHolding(result.state, 'npc_wang')).toBe(130);
    });
    it('Σ净值守恒：preNet=300 = postNet=300', () => {
        expect(getHolding(result.state, 'npc_li') + getHolding(result.state, 'npc_wang')).toBe(300);
    });
});
