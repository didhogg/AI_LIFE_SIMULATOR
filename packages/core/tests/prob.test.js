import { describe, it, expect } from 'vitest';
import { clampProb, stableProb } from '../engine/math/prob.js';
import { v1 } from '../engine/math/fixed.js';
describe('H4 clampProb — 概率域夹逼', () => {
    const P_MIN = 0.0001; // 0.01%
    const P_MAX = 0.9999; // 99.99%
    it('正常概率在域内 → 原值', () => {
        expect(clampProb(0.5, P_MIN, P_MAX)).toBe(0.5);
        expect(clampProb(0.01, P_MIN, P_MAX)).toBe(0.01);
        expect(clampProb(0.99, P_MIN, P_MAX)).toBe(0.99);
    });
    it('p=0（低于下界）→ 夹至 P_MIN', () => {
        expect(clampProb(0, P_MIN, P_MAX)).toBe(P_MIN);
    });
    it('p=1（超过上界）→ 夹至 P_MAX', () => {
        expect(clampProb(1, P_MIN, P_MAX)).toBe(P_MAX);
    });
    it('极小概率（1e-10）→ 夹至 P_MIN', () => {
        expect(clampProb(1e-10, P_MIN, P_MAX)).toBe(P_MIN);
    });
    it('等于 P_MIN 边界 → 原值', () => {
        expect(clampProb(P_MIN, P_MIN, P_MAX)).toBe(P_MIN);
    });
    it('等于 P_MAX 边界 → 原值', () => {
        expect(clampProb(P_MAX, P_MIN, P_MAX)).toBe(P_MAX);
    });
    it('自定义域 [0.05, 0.95] → 正确夹逼', () => {
        expect(clampProb(0.01, 0.05, 0.95)).toBe(0.05);
        expect(clampProb(0.99, 0.05, 0.95)).toBe(0.95);
        expect(clampProb(0.5, 0.05, 0.95)).toBe(0.5);
    });
});
describe('H4 stableProb — 小概率稳定式（复用 fixed.ts）', () => {
    it('p=0 → 0', () => {
        expect(stableProb(0, 10)).toBe(0);
    });
    it('p=1 → 1', () => {
        expect(stableProb(1, 10)).toBe(1);
    });
    it('n=0 → 0', () => {
        expect(stableProb(0.5, 0)).toBe(0);
    });
    it('p=0.5,n=1 → 0.5（单期）', () => {
        expect(stableProb(0.5, 1)).toBeCloseTo(0.5, 12);
    });
    it('p=0.5,n=2 = 1-(1-0.5)^2 = 0.75', () => {
        expect(stableProb(0.5, 2)).toBeCloseTo(0.75, 12);
    });
    it('小概率 p=0.001,n=1000 ≈ 0.6323（注：非精确 1-e^{-1}·因 ln(1-p)≠-p）', () => {
        // 1-(1-0.001)^1000 精确值 ≈ 0.6323；ln1p(-0.001)=-0.0010005…≠-0.001
        // 验证落在 [0.63, 0.64] 范围内即可（数量级正确·非精确近似测试）
        const result = stableProb(0.001, 1000);
        expect(result).toBeGreaterThan(0.63);
        expect(result).toBeLessThan(0.64);
    });
    it('数值稳定性：p=1e-8,n=1e7 应接近 1-e^{-0.1} ≈ 0.09516', () => {
        // Direct 1-(1-p)^n would lose precision; stableProb stays accurate.
        // 1-e^{-0.1} = -expm1(-0.1)，用 v1.expm1 避免平台 Math.exp（禁③）
        const result = stableProb(1e-8, 1e7);
        expect(result).toBeCloseTo(-v1.expm1(-0.1), 6);
    });
    it('确定性：同参数两次调用结果相同', () => {
        const r1 = stableProb(0.03, 50);
        const r2 = stableProb(0.03, 50);
        expect(r1).toBe(r2);
    });
    it('单调性：n 增大 → stableProb 增大', () => {
        const r1 = stableProb(0.1, 5);
        const r2 = stableProb(0.1, 10);
        expect(r2).toBeGreaterThan(r1);
    });
    it('单调性：p 增大 → stableProb 增大（n 固定）', () => {
        const r1 = stableProb(0.05, 10);
        const r2 = stableProb(0.10, 10);
        expect(r2).toBeGreaterThan(r1);
    });
});
