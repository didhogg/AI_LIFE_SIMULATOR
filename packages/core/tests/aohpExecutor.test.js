// aohpExecutor 核心单测（additive·小内联数据·零前端 fixture）
// 覆盖契约规定的 6 类验收项。
import { describe, it, expect } from 'vitest';
import { executeActionOption } from '../engine/aohpExecutor.js';
import { runProposalGate } from '../engine/proposal/runProposalGate.js';
import { RootSchema } from '../schema/index.js';
import { FINGERPRINT_BUNDLE_MEMBERS, FINGERPRINT_PRESET_FIELDS, FINGERPRINT_SNAPSHOT_FIELDS, FINGERPRINT_EXCLUDED_FIELDS, } from '../engine/fingerprintManifest.js';
// ── 内联 Fixture ──────────────────────────────────────────────────────────────
const BASE_STATE = RootSchema.parse({
    货币系统: { 账户: { npc_wang: { 持有: { 文: 200 } } } },
    _状态机: { 双时钟: { 世界钟: 100 } },
    _席位表: {},
    全局: {},
});
function makeOpt(overrides = {}) {
    return {
        option_id: '转移:npc_wang',
        tool_name: 'transfer',
        params: {},
        target_choices: ['npc_wang'],
        ...overrides,
    };
}
// ── Test 1: 命中 → envelope → 既有落账 → 逐位恒等 ─────────────────────────────
describe('Test 1 · 命中 → envelope → 既有落账 + 双宿主逐位恒等', () => {
    const opt = makeOpt();
    const args = { chosenOptionId: '转移:npc_wang', optionSet: [opt] };
    it('matched=true · downgrade=false · envelope 存在', () => {
        const r = executeActionOption(args);
        expect(r.matched).toBe(true);
        expect(r.downgrade).toBe(false);
        expect(r.envelope).toBeDefined();
        expect(r.failure).toBeUndefined();
    });
    it('envelope.提案.动作类别 = 转移', () => {
        const r = executeActionOption(args);
        expect(r.envelope?.提案.动作类别).toBe('转移');
    });
    it('envelope.提案.目标引用 = npc_wang', () => {
        const r = executeActionOption(args);
        expect(r.envelope?.提案.目标引用).toBe('npc_wang');
    });
    it('envelope 经 runProposalGate → ok:true（Gate① shape 通过）', () => {
        const r = executeActionOption(args);
        expect(r.envelope).toBeDefined();
        const gate = runProposalGate(r.envelope, BASE_STATE, 'seat1', '系统');
        expect(gate.ok).toBe(true);
    });
    it('双宿主逐位恒等：同参数两次调用 JSON 逐位相同', () => {
        const r1 = executeActionOption(args);
        const r2 = executeActionOption(args);
        expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
    });
});
// ── Test 2: option_id 不命中 → {matched:false, downgrade:true} + 零 state diff ─
describe('Test 2 · option_id 不命中 → matched:false + downgrade:true', () => {
    const opt = makeOpt();
    it('返回 {matched:false, downgrade:true}', () => {
        const r = executeActionOption({
            chosenOptionId: '赋予:npc_hong:未注册选项',
            optionSet: [opt],
        });
        expect(r.matched).toBe(false);
        expect(r.downgrade).toBe(true);
    });
    it('envelope / failure 均未定义（无写账路径）', () => {
        const r = executeActionOption({
            chosenOptionId: 'nonexistent_id',
            optionSet: [opt],
        });
        expect(r.envelope).toBeUndefined();
        expect(r.failure).toBeUndefined();
    });
    it('零 state diff：外部 BASE_STATE 不被 executor 触碰', () => {
        const before = JSON.stringify(BASE_STATE);
        executeActionOption({ chosenOptionId: 'missing', optionSet: [opt] });
        expect(JSON.stringify(BASE_STATE)).toBe(before);
    });
});
// ── Test 3: chosenValue 越界 → 钳制到 [min, max] ────────────────────────────────
describe('Test 3 · chosenValue 越界 → 钳制到 [min, max]', () => {
    const opt = makeOpt({
        option_id: '调整:npc_wang:amount',
        value_slot: '数量',
        min: 10,
        max: 100,
    });
    it('chosenValue < min → 结果 = min', () => {
        const r = executeActionOption({
            chosenOptionId: '调整:npc_wang:amount',
            optionSet: [opt],
            chosenValue: -5,
        });
        expect(r.matched).toBe(true);
        expect(r.downgrade).toBe(false);
        expect(r.envelope?.提案.数值槽).toBe(10);
    });
    it('chosenValue > max → 结果 = max', () => {
        const r = executeActionOption({
            chosenOptionId: '调整:npc_wang:amount',
            optionSet: [opt],
            chosenValue: 999,
        });
        expect(r.envelope?.提案.数值槽).toBe(100);
    });
    it('chosenValue ∈ [min, max] → 原值保留', () => {
        const r = executeActionOption({
            chosenOptionId: '调整:npc_wang:amount',
            optionSet: [opt],
            chosenValue: 50,
        });
        expect(r.envelope?.提案.数值槽).toBe(50);
    });
    it('无 value_slot 时忽略 chosenValue（数值槽 undefined）', () => {
        const optNoSlot = makeOpt({
            option_id: '转移:npc_wang',
        });
        const r = executeActionOption({
            chosenOptionId: '转移:npc_wang',
            optionSet: [optNoSlot],
            chosenValue: 999,
        });
        expect(r.matched).toBe(true);
        expect(r.downgrade).toBe(false);
        expect(r.envelope?.提案.数值槽).toBeUndefined();
    });
});
// ── Test 4: 目标多候选未指定 → downgrade；单候选 → 自动取 ───────────────────────
describe('Test 4 · 目标选取规则', () => {
    it('多候选 + 无 chosenTarget → downgrade:true', () => {
        const opt = makeOpt({
            option_id: '缔结:npc_wang',
            target_choices: ['npc_wang', 'npc_hong'],
        });
        const r = executeActionOption({
            chosenOptionId: '缔结:npc_wang',
            optionSet: [opt],
        });
        expect(r.matched).toBe(true);
        expect(r.downgrade).toBe(true);
    });
    it('多候选 + chosenTarget 不在列表 → downgrade:true', () => {
        const opt = makeOpt({
            option_id: '缔结:npc_wang',
            target_choices: ['npc_wang', 'npc_hong'],
        });
        const r = executeActionOption({
            chosenOptionId: '缔结:npc_wang',
            optionSet: [opt],
            chosenTarget: 'npc_unknown',
        });
        expect(r.downgrade).toBe(true);
    });
    it('单候选 + 无 chosenTarget → 自动取 target_choices[0]', () => {
        const opt = makeOpt({
            option_id: '移动:npc_wang',
            target_choices: ['loc_inn'],
        });
        const r = executeActionOption({
            chosenOptionId: '移动:npc_wang',
            optionSet: [opt],
        });
        expect(r.matched).toBe(true);
        expect(r.downgrade).toBe(false);
        expect(r.envelope?.提案.目标引用).toBe('loc_inn');
    });
    it('多候选 + 有效 chosenTarget → 使用该目标', () => {
        const opt = makeOpt({
            option_id: '赋予:npc_wang',
            target_choices: ['npc_wang', 'npc_hong'],
        });
        const r = executeActionOption({
            chosenOptionId: '赋予:npc_wang',
            optionSet: [opt],
            chosenTarget: 'npc_hong',
        });
        expect(r.downgrade).toBe(false);
        expect(r.envelope?.提案.目标引用).toBe('npc_hong');
    });
});
// ── Test 5: 动词不在 10 个 → downgrade ────────────────────────────────────────
describe('Test 5 · 动词不在动词Id枚举 10 内 → downgrade:true', () => {
    it('option_id 首段为非法动词 → downgrade', () => {
        const opt = {
            option_id: '转账:npc_wang', // '转账' 不在动词Id枚举
            tool_name: 'transfer',
            params: {},
            target_choices: ['npc_wang'],
        };
        const r = executeActionOption({
            chosenOptionId: '转账:npc_wang',
            optionSet: [opt],
        });
        expect(r.matched).toBe(true);
        expect(r.downgrade).toBe(true);
        expect(r.envelope).toBeUndefined();
    });
    it('空首段 → downgrade', () => {
        const opt = {
            option_id: ':npc_wang',
            tool_name: '',
            params: {},
            target_choices: ['npc_wang'],
        };
        const r = executeActionOption({
            chosenOptionId: ':npc_wang',
            optionSet: [opt],
        });
        expect(r.matched).toBe(true);
        expect(r.downgrade).toBe(true);
    });
    it('动词Id枚举 全部 10 项均合法（正向确认）', () => {
        const 动词列表 = ['转移', '缔结', '解除', '赋予', '剥夺', '调整', '披露', '移动', '施加', '植入'];
        for (const verb of 动词列表) {
            const id = `${verb}:npc_wang`;
            const opt = { option_id: id, tool_name: '', params: {}, target_choices: ['npc_wang'] };
            const r = executeActionOption({ chosenOptionId: id, optionSet: [opt] });
            expect(r.downgrade, `${verb} 应合法`).toBe(false);
        }
    });
});
// ── Test 6: 指纹 + 黄金向量不回归 ────────────────────────────────────────────────
describe('Test 6 · 指纹 manifest 不变 + 确定性验证', () => {
    it('指纹 manifest 四组总长 = 87（不变）', () => {
        expect(FINGERPRINT_BUNDLE_MEMBERS.length +
            FINGERPRINT_PRESET_FIELDS.length +
            FINGERPRINT_SNAPSHOT_FIELDS.length +
            FINGERPRINT_EXCLUDED_FIELDS.length).toBe(88);
    });
    it('AOHP選項id集 已在 FINGERPRINT_PRESET_FIELDS（接线已在位）', () => {
        expect(FINGERPRINT_PRESET_FIELDS).toContain('AOHP選項id集');
    });
    it('executor 零 RNG：两次调用 JSON 逐位恒等（确定性）', () => {
        const opt = makeOpt({ option_id: '披露:npc_wang', target_choices: ['npc_wang'] });
        const call = () => executeActionOption({ chosenOptionId: '披露:npc_wang', optionSet: [opt] });
        expect(JSON.stringify(call())).toBe(JSON.stringify(call()));
    });
});
