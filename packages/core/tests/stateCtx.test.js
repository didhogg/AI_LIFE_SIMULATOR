// P7-7.a · projectStateCtx 单测
// entity scope / global-only / missing entity / path miss → evalPred false
import { describe, it, expect } from 'vitest';
import { projectStateCtx } from '../engine/dsl/stateCtx.js';
import { evalPredStr } from '../engine/dsl/eval.js';
import { RootSchema } from '../schema/index.js';
// ── fixtures ─────────────────────────────────────────────────────────────────
const BASE = RootSchema.parse({
    NPC: {
        npc_a: {
            属性: { 体质: 60, 智慧: 40, 感知: 50, 魅力: 30, 心理: 70 },
            技能: { 格斗: { 等级: 3 }, 医术: { 等级: 7 } },
        },
    },
    货币系统: {
        账户: { npc_a: { 持有: { 文: 500, 金: 2 } } },
    },
    _tick: { 拍计数: 10 },
    世界: { 纪元分钟: 1440 },
    _状态机: { 双时钟: { 世界钟: 100 } },
    _席位表: {},
    全局: {},
});
// ── P7.a-1 · entity scope：NPC 属性 / 技能 / 账户 / 全局 ──────────────────────
describe('P7.a-1 · entity scope (npc_a)', () => {
    const ctx = projectStateCtx(BASE, { entityKey: 'npc_a' });
    it('属性.体质 = 60', () => {
        expect(ctx['属性']['体质']).toBe(60);
    });
    it('属性.魅力 = 30', () => {
        expect(ctx['属性']['魅力']).toBe(30);
    });
    it('技能.格斗 = 3（等级提取）', () => {
        expect(ctx['技能']['格斗']).toBe(3);
    });
    it('技能.医术 = 7', () => {
        expect(ctx['技能']['医术']).toBe(7);
    });
    it('账户.文 = 500', () => {
        expect(ctx['账户']['文']).toBe(500);
    });
    it('账户.金 = 2', () => {
        expect(ctx['账户']['金']).toBe(2);
    });
    it('全局.拍计数 = 10', () => {
        expect(ctx['全局']['拍计数']).toBe(10);
    });
    it('全局.纪元分钟 = 1440', () => {
        expect(ctx['全局']['纪元分钟']).toBe(1440);
    });
});
// ── P7.a-2 · evalPredStr 集成：ctx 可被 DSL 谓词直接消费 ──────────────────
describe('P7.a-2 · evalPredStr with entity ctx', () => {
    const ctx = projectStateCtx(BASE, { entityKey: 'npc_a' });
    it('属性.体质 >= 60 → true', () => {
        expect(evalPredStr('属性.体质 >= 60', ctx)).toBe(true);
    });
    it('属性.体质 >= 61 → false', () => {
        expect(evalPredStr('属性.体质 >= 61', ctx)).toBe(false);
    });
    it('技能.格斗 >= 3 → true', () => {
        expect(evalPredStr('技能.格斗 >= 3', ctx)).toBe(true);
    });
    it('账户.文 >= 500 → true', () => {
        expect(evalPredStr('账户.文 >= 500', ctx)).toBe(true);
    });
    it('账户.文 >= 501 → false', () => {
        expect(evalPredStr('账户.文 >= 501', ctx)).toBe(false);
    });
    it('全局.拍计数 >= 10 → true', () => {
        expect(evalPredStr('全局.拍计数 >= 10', ctx)).toBe(true);
    });
});
// ── P7.a-3 · global-only scope（无 entityKey）─────────────────────────────
describe('P7.a-3 · global-only scope', () => {
    const ctx = projectStateCtx(BASE);
    it('全局.拍计数 = 10（全局恒可用）', () => {
        expect(ctx['全局']['拍计数']).toBe(10);
    });
    it('属性 = {}（无实体 → 空 record）', () => {
        expect(ctx['属性']).toEqual({});
    });
    it('技能 = {}', () => {
        expect(ctx['技能']).toEqual({});
    });
    it('账户 = {}', () => {
        expect(ctx['账户']).toEqual({});
    });
    it('属性.体质 >= 1 → false（路径 miss = 0 · fail-closed）', () => {
        expect(evalPredStr('属性.体质 >= 1', ctx)).toBe(false);
    });
});
// ── P7.a-4 · missing entity（entityKey 不存在于 NPC）────────────────────────
describe('P7.a-4 · missing entity → 空 record（fail-closed）', () => {
    const ctx = projectStateCtx(BASE, { entityKey: 'npc_nonexistent' });
    it('属性 = {}', () => {
        expect(ctx['属性']).toEqual({});
    });
    it('技能 = {}', () => {
        expect(ctx['技能']).toEqual({});
    });
    it('账户 = {}', () => {
        expect(ctx['账户']).toEqual({});
    });
    it('evalPredStr(属性.体质 >= 1) → false（fail-closed）', () => {
        expect(evalPredStr('属性.体质 >= 1', ctx)).toBe(false);
    });
    it('全局 仍可用（拍计数 = 10）', () => {
        expect(ctx['全局']['拍计数']).toBe(10);
    });
});
// ── P7.a-5 · scope = undefined（等价 global-only）────────────────────────────
describe('P7.a-5 · scope = undefined (explicit)', () => {
    const ctx = projectStateCtx(BASE, undefined);
    it('全局.纪元分钟 可用', () => {
        expect(ctx['全局']['纪元分钟']).toBe(1440);
    });
    it('属性 = {}', () => {
        expect(ctx['属性']).toEqual({});
    });
});
