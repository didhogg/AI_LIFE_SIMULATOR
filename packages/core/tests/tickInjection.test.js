// tickInjection — runTick 注入入口单测
// 覆盖：T1 合法注入落账守恒 · T2 非法闸拒零写账 · T3 无注入逐位恒等回归 · T4 双宿主逐位恒等
import { describe, it, expect } from 'vitest';
import { runTick } from '../engine/tick.js';
import { RootSchema } from '../schema/index.js';
import { 指令信封Schema } from '../schema/proposal.js';
// ── Fixtures ──────────────────────────────────────────────────────────────────
// Whitelisted numeric paths (from whitelistDryRun probe⑧)
const PATH_WANG = '货币系统.账户.npc_wang.持有.文';
const PATH_LI = '货币系统.账户.npc_li.持有.文'; // 资金来源方
// 注意：SINK_ENTITY_KEY='__sink__' 含前导 _，computeDelta 拒写。
// 守恒用 npc_li（普通账户键）作为 counter-party：npc_wang +50 / npc_li -50 → 净变化 0。
const BASE_STATE = RootSchema.parse({
    货币系统: {
        账户: {
            npc_wang: { 持有: { 文: 100 } },
            npc_li: { 持有: { 文: 200 } },
        },
    },
    _状态机: { 双时钟: { 世界钟: 100 } },
    _席位表: {},
    全局: {},
});
// 合法信封：転移 npc_wang
const VALID_ENVELOPE = 指令信封Schema.parse({
    提案: { 动作类别: '転移', 目标引用: 'npc_wang', 数值槽: 50 },
});
// 守恒平衡 pack：npc_wang +50 / npc_li -50（净变化 0·preNet=300=postNet）
const PACKS_CONSERVATION = [[
        { path: PATH_WANG, op: 'add', value: 50 },
        { path: PATH_LI, op: 'sub', value: 50 },
    ]];
// ── T1: 合法注入 → 落账成功 + 守恒（SINK 平衡）+ 幂等 ─────────────────────────
describe('T1 · 合法注入 → 落账成功 + 守恒 + 幂等', () => {
    const result = runTick(BASE_STATE, {
        tickId: 'inj-t1',
        injectedEnvelope: VALID_ENVELOPE,
        injectedPacks: PACKS_CONSERVATION,
    });
    it('Phase 提案落账 出现在 settledPhases', () => {
        expect(result.settledPhases).toContain('提案落账');
    });
    it('proposalGateResult.ok === true', () => {
        expect(result.proposalGateResult?.ok).toBe(true);
    });
    it('npc_wang 持有.文 从 100 升至 150', () => {
        const 账户 = result.state.货币系统?.账户;
        expect(账户['npc_wang']?.持有['文']).toBe(150);
    });
    it('npc_li 持有.文 从 200 降至 150（资金来源方）', () => {
        const 账户 = result.state.货币系统?.账户;
        expect(账户['npc_li']?.持有['文']).toBe(150);
    });
    it('Σ净值守恒：注入后净值 = 注入前净值', () => {
        // preNet = 100 + 200 = 300; postNet = 150 + 150 = 300
        const 账户 = result.state.货币系统?.账户;
        const postNet = Object.values(账户).reduce((s, a) => s + Object.values(a.持有).reduce((x, v) => x + v, 0), 0);
        expect(postNet).toBe(300);
    });
    it('幂等：同 tickId 再跑一次返回空 settledPhases', () => {
        const r2 = runTick(result.state, { tickId: 'inj-t1' });
        expect(r2.settledPhases).toHaveLength(0);
    });
    it('原始 BASE_STATE 未被写回（入口深拷）', () => {
        const 账户 = BASE_STATE.货币系统?.账户;
        expect(账户['npc_wang']?.持有['文']).toBe(100);
    });
});
// ── T2: 非法信封/pack → 被对应闸拒 + 零写账 ──────────────────────────────────
describe('T2a · Gate②-whitelist 违反 → 拒绝 + 零写账', () => {
    const result = runTick(BASE_STATE, {
        tickId: 'inj-t2a',
        injectedEnvelope: VALID_ENVELOPE,
        injectedPacks: [[{ path: '非法路径.abc', op: 'add', value: 10 }]],
    });
    it('proposalGateResult.ok === false', () => {
        expect(result.proposalGateResult?.ok).toBe(false);
    });
    it('被 Gate② 拒绝', () => {
        const r = result.proposalGateResult;
        if (!r?.ok)
            expect(r?.gate).toBe('②-whitelist');
    });
    it('npc_wang 持有.文 未变（零写账）', () => {
        const 账户 = result.state.货币系统?.账户;
        expect(账户['npc_wang']?.持有['文']).toBe(100);
    });
});
describe('T2b · Gate④ computeDelta 违反（非整数 add）→ 拒绝 + 零写账', () => {
    const result = runTick(BASE_STATE, {
        tickId: 'inj-t2b',
        injectedEnvelope: VALID_ENVELOPE,
        injectedPacks: [[{ path: PATH_WANG, op: 'add', value: 1.5 }]],
    });
    it('proposalGateResult.ok === false', () => {
        expect(result.proposalGateResult?.ok).toBe(false);
    });
    it('被 Gate④ 拒绝', () => {
        const r = result.proposalGateResult;
        if (!r?.ok)
            expect(r?.gate).toBe('④-delta');
    });
    it('npc_wang 持有.文 未变（零写账）', () => {
        const 账户 = result.state.货币系统?.账户;
        expect(账户['npc_wang']?.持有['文']).toBe(100);
    });
});
// ── T3: 无 injectedEnvelope → 行为逐位恒等（回归） ──────────────────────────────
describe('T3 · 无 injectedEnvelope → 现有 runTick 逐位恒等', () => {
    const r1 = runTick(BASE_STATE, { tickId: 'inj-t3-base' });
    const r2 = runTick(BASE_STATE, { tickId: 'inj-t3-base' }); // 同 tickId 幂等
    it('proposalGateResult 不出现（无注入）', () => {
        expect(r1.proposalGateResult).toBeUndefined();
    });
    it('两次运行 state 逐位 JSON 恒等', () => {
        expect(JSON.stringify(r1.state)).toBe(JSON.stringify(r2.state));
    });
    it('settledPhases 包含 提案落账（empty callback·零写账）', () => {
        expect(r1.settledPhases).toContain('提案落账');
    });
    it('无注入时 npc_wang 持有.文 不变', () => {
        const 账户 = r1.state.货币系统?.账户;
        expect(账户['npc_wang']?.持有['文']).toBe(100);
    });
});
// ── T4: 双宿主逐位恒等（同参数 → 逐位相同） ──────────────────────────────────
describe('T4 · 双宿主逐位恒等 — 同 (state, input) 两次调用 JSON 逐位恒等', () => {
    const INPUT = {
        tickId: 'inj-t4-dual',
        injectedEnvelope: VALID_ENVELOPE,
        injectedPacks: PACKS_CONSERVATION,
    };
    it('注入路径：两次调用 state JSON 逐位恒等', () => {
        const r1 = runTick(BASE_STATE, INPUT);
        const r2 = runTick(BASE_STATE, INPUT);
        expect(JSON.stringify(r1.state)).toBe(JSON.stringify(r2.state));
    });
    it('注入路径：两次调用 settledPhases 逐位恒等', () => {
        const r1 = runTick(BASE_STATE, INPUT);
        const r2 = runTick(BASE_STATE, INPUT);
        expect(JSON.stringify(r1.settledPhases)).toBe(JSON.stringify(r2.settledPhases));
    });
    it('注入路径：proposalGateResult.ok 两次恒等 true', () => {
        const r1 = runTick(BASE_STATE, INPUT);
        const r2 = runTick(BASE_STATE, INPUT);
        expect(r1.proposalGateResult?.ok).toBe(true);
        expect(r2.proposalGateResult?.ok).toBe(true);
    });
    it('无注入路径：两次调用 state JSON 逐位恒等（回归）', () => {
        const r1 = runTick(BASE_STATE, { tickId: 'inj-t4-noinj' });
        const r2 = runTick(BASE_STATE, { tickId: 'inj-t4-noinj' });
        expect(JSON.stringify(r1.state)).toBe(JSON.stringify(r2.state));
    });
});
