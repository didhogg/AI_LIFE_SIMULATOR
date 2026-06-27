import { describe, it, expect } from 'vitest';
import { convertFx, assertNoDirectCrossRate } from '../engine/math/fx.js';
// 基准币：基准（对基准汇率=1）；金币=5基准·银币=1基准·铜钱=0.1基准
const RATES = {
    基准: 1,
    金币: 5,
    银币: 1,
    铜钱: 0.1,
};
describe('H3 convertFx — 两跳汇率换算', () => {
    it('同币种换算 → 恒等（buy·无取整误差）', () => {
        expect(convertFx(10, '银币', '银币', RATES, 'buy')).toBe(10);
    });
    it('同币种换算 → 恒等（sell）', () => {
        expect(convertFx(10, '银币', '银币', RATES, 'sell')).toBe(10);
    });
    it('银币→金币 buy（1银=0.2金·向上取整）', () => {
        // 1 银 → base = 1；÷5 = 0.2；ceil → 1
        expect(convertFx(1, '银币', '金币', RATES, 'buy')).toBe(1);
        // 10 银 → 2 金（整除·无误差）
        expect(convertFx(10, '银币', '金币', RATES, 'buy')).toBe(2);
    });
    it('银币→金币 sell（3银·0.6金·向下取整）', () => {
        // 3 银 → 0.6 金；floor → 0
        expect(convertFx(3, '银币', '金币', RATES, 'sell')).toBe(0);
    });
    it('金币→银币 buy（整数比·无取整）', () => {
        // 1 金 → base = 5；÷1 = 5；ceil = 5
        expect(convertFx(1, '金币', '银币', RATES, 'buy')).toBe(5);
    });
    it('铜钱→银币 buy（10铜=1银·向上取整）', () => {
        // 10 铜 → base = 1；÷1 = 1；ceil = 1
        expect(convertFx(10, '铜钱', '银币', RATES, 'buy')).toBe(1);
        // 9 铜 → 0.9；ceil = 1
        expect(convertFx(9, '铜钱', '银币', RATES, 'buy')).toBe(1);
    });
    it('铜钱→银币 sell（9铜·0.9银·向下=0）', () => {
        expect(convertFx(9, '铜钱', '银币', RATES, 'sell')).toBe(0);
        expect(convertFx(10, '铜钱', '银币', RATES, 'sell')).toBe(1);
    });
    it('H3 环路≤1 anti-arbitrage: A→B→A≤原始数量（sell round trip）', () => {
        // 银→金（sell·floor）→金→银（sell·floor）≤ 原始银币数量
        const silver = 7;
        const gold = convertFx(silver, '银币', '金币', RATES, 'sell'); // floor(1.4) = 1
        const back = convertFx(gold, '金币', '银币', RATES, 'sell'); // floor(5) = 5
        expect(back).toBeLessThanOrEqual(silver);
    });
    it('H3 环路≤1: 铜钱→银币→铜钱（sell）≤ 原始铜钱', () => {
        const copper = 15;
        const silver = convertFx(copper, '铜钱', '银币', RATES, 'sell'); // floor(1.5) = 1
        const back = convertFx(silver, '银币', '铜钱', RATES, 'sell'); // floor(10) = 10
        expect(back).toBeLessThanOrEqual(copper);
    });
    it('amount=0 → 抛出', () => {
        expect(() => convertFx(0, '银币', '金币', RATES, 'buy')).toThrow();
    });
    it('负数 amount → 抛出', () => {
        expect(() => convertFx(-1, '银币', '金币', RATES, 'buy')).toThrow();
    });
    it('无效汇率（汇率=0）→ 抛出', () => {
        expect(() => convertFx(1, '银币', '金币', { ...RATES, 金币: 0 }, 'buy')).toThrow();
    });
    it('缺省汇率（币种不在 rateMap 中）→ 视为 1（基准级）', () => {
        // 未知币→基准；rateFrom=1·rateTo=1；原值不变
        const result = convertFx(10, '未知币', '基准', RATES, 'sell');
        expect(result).toBe(10);
    });
});
describe('H3 assertNoDirectCrossRate — 直连汇率对拒收', () => {
    it('空列表 → 不抛出', () => {
        expect(() => assertNoDirectCrossRate([])).not.toThrow();
    });
    it('非空列表 → 抛出含"直连"信息的错误', () => {
        expect(() => assertNoDirectCrossRate(['USD/EUR', 'JPY/GBP'])).toThrow(/直连/);
    });
    it('错误消息含违规对名称', () => {
        expect(() => assertNoDirectCrossRate(['金币/银币'])).toThrow(/金币\/银币/);
    });
});
