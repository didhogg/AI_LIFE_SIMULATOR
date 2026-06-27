/**
 * H2 assertFinite 反向断言测试.
 * 每条测试故意喂入 NaN / ±Infinity，验证守卫必定拦截，绝不静默放行。
 */
import { describe, it, expect } from 'vitest';
import { assertFinite, FiniteAssertionError } from '../engine/assertFinite.js';
import { resolveAttribute, check } from '../engine/check.js';
// ── assertFinite 自身行为 ─────────────────────────────────────────────────────
describe('assertFinite — guard unit', () => {
    it('NaN → throws FiniteAssertionError', () => {
        expect(() => assertFinite(NaN, 'test.field')).toThrow(FiniteAssertionError);
    });
    it('+Infinity → throws FiniteAssertionError', () => {
        expect(() => assertFinite(Infinity, 'test.field')).toThrow(FiniteAssertionError);
    });
    it('-Infinity → throws FiniteAssertionError', () => {
        expect(() => assertFinite(-Infinity, 'test.field')).toThrow(FiniteAssertionError);
    });
    it('error message includes stringified value (NaN)', () => {
        expect(() => assertFinite(NaN, 'chain.attr')).toThrowError(/NaN/);
    });
    it('error message includes context label', () => {
        expect(() => assertFinite(Infinity, 'chain.attr')).toThrowError(/chain\.attr/);
    });
    it('thrown instance carries .value and .ctx', () => {
        let err;
        try {
            assertFinite(NaN, 'my.ctx');
        }
        catch (e) {
            if (e instanceof FiniteAssertionError)
                err = e;
        }
        expect(err).toBeInstanceOf(FiniteAssertionError);
        expect(Number.isNaN(err?.value)).toBe(true);
        expect(err?.ctx).toBe('my.ctx');
    });
    it('0 is finite — no throw', () => {
        expect(() => assertFinite(0, 'test')).not.toThrow();
    });
    it('negative finite — no throw', () => {
        expect(() => assertFinite(-999.5, 'test')).not.toThrow();
    });
    it('large finite — no throw', () => {
        expect(() => assertFinite(1e15, 'test')).not.toThrow();
    });
});
// ── NaN 常见来源：must be blocked before they reach check() ──────────────────
describe('assertFinite — NaN 源头场景', () => {
    it('0 / 0 produces NaN → blocked', () => {
        const nan = 0 / 0;
        expect(() => assertFinite(nan, '0/0')).toThrow(FiniteAssertionError);
    });
    it('Infinity − Infinity produces NaN → blocked', () => {
        const nan = Infinity - Infinity;
        expect(() => assertFinite(nan, 'Inf-Inf')).toThrow(FiniteAssertionError);
    });
    it('undefined coerced to arithmetic produces NaN → blocked', () => {
        // typeof guard: simulates missing preset field read
        const missing = undefined;
        const nan = missing + 10;
        expect(() => assertFinite(nan, 'missing+10')).toThrow(FiniteAssertionError);
    });
    it('empty-array reduce with no initial value does NOT produce NaN (baseline check)', () => {
        // Array.reduce() on empty array WITHOUT initial value throws — this is distinct from NaN.
        // With initial value 0 it returns 0 (finite). This confirms the reduce pattern in check() is safe.
        const result = [].reduce((s, x) => s + x, 0);
        expect(() => assertFinite(result, 'empty-reduce')).not.toThrow();
    });
});
// ── check() 第一卡口：每个数值入参喂 NaN 必被拦下 ─────────────────────────────
const VALID_BASE = {
    基线: 50,
    熟练: 0,
    等级: 0,
    属性项: 0,
    情境修正: [],
    DC偏置: 0,
    rawU: 10,
    判定骰型: 100,
    切分表: { 大胜下限: 40, 胜下限: 15, 惨胜下限: 1, 败下限: -24 },
};
describe('check() — Gate ① NaN 入参全部被拦', () => {
    it('NaN 基线 → FiniteAssertionError (绝不静默失败)', () => {
        expect(() => check({ ...VALID_BASE, 基线: NaN })).toThrow(FiniteAssertionError);
    });
    it('NaN 熟练 → FiniteAssertionError', () => {
        expect(() => check({ ...VALID_BASE, 熟练: NaN })).toThrow(FiniteAssertionError);
    });
    it('NaN 等级 → FiniteAssertionError', () => {
        expect(() => check({ ...VALID_BASE, 等级: NaN })).toThrow(FiniteAssertionError);
    });
    it('NaN 属性项 → FiniteAssertionError', () => {
        expect(() => check({ ...VALID_BASE, 属性项: NaN })).toThrow(FiniteAssertionError);
    });
    it('NaN DC偏置 → FiniteAssertionError', () => {
        expect(() => check({ ...VALID_BASE, DC偏置: NaN })).toThrow(FiniteAssertionError);
    });
    it('NaN rawU → FiniteAssertionError', () => {
        expect(() => check({ ...VALID_BASE, rawU: NaN })).toThrow(FiniteAssertionError);
    });
    it('NaN 情境修正.数值 → FiniteAssertionError', () => {
        expect(() => check({ ...VALID_BASE, 情境修正: [{ 来源: 'poison', 数值: NaN }] })).toThrow(FiniteAssertionError);
    });
    it('NaN 切分表.大胜下限 → FiniteAssertionError', () => {
        expect(() => check({ ...VALID_BASE, 切分表: { ...VALID_BASE.切分表, 大胜下限: NaN } })).toThrow(FiniteAssertionError);
    });
    it('Infinity 基线 → FiniteAssertionError', () => {
        expect(() => check({ ...VALID_BASE, 基线: Infinity })).toThrow(FiniteAssertionError);
    });
    it('-Infinity DC偏置 → FiniteAssertionError', () => {
        expect(() => check({ ...VALID_BASE, DC偏置: -Infinity })).toThrow(FiniteAssertionError);
    });
});
// ── resolveAttribute() 第一卡口 ───────────────────────────────────────────────
describe('resolveAttribute() — Gate ① NaN 入参被拦', () => {
    it('NaN 主属性值 → FiniteAssertionError', () => {
        expect(() => resolveAttribute({ 主属性: '魅力' }, { 魅力: NaN })).toThrow(FiniteAssertionError);
    });
    it('NaN 副属性值 → FiniteAssertionError', () => {
        expect(() => resolveAttribute({ 主属性: '魅力', 副属性列: [{ 轴名: '智慧', 权重: 0.5 }] }, { 魅力: 60, 智慧: NaN })).toThrow(FiniteAssertionError);
    });
    it('NaN 权重 → FiniteAssertionError', () => {
        expect(() => resolveAttribute({ 主属性: '魅力', 副属性列: [{ 轴名: '智慧', 权重: NaN }] }, { 魅力: 60, 智慧: 40 })).toThrow(FiniteAssertionError);
    });
    it('valid inputs still work (regression)', () => {
        const res = resolveAttribute({ 主属性: '魅力', 副属性列: [{ 轴名: '智慧', 权重: 0.5 }] }, { 魅力: 60, 智慧: 40 });
        expect(res).toBe(40); // (60 + 40×0.5) / 2 = 40
    });
});
