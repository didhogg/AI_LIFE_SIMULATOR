import { describe, it, expect } from 'vitest';
import { fixedLog1p, fixedExpm1, fixedExp, fixedPow, fixedSqrt, stableProb, v1, } from '../engine/math/fixed.js';
// Tolerance: 10 significant digits (well within double-precision)
const SIG10 = 10;
describe('fixedLog1p', () => {
    it('log1p(0) = 0', () => expect(fixedLog1p(0)).toBe(0));
    it('log1p(-1) = -Infinity', () => expect(fixedLog1p(-1)).toBe(-Infinity));
    it('log1p(x < -1) = NaN', () => expect(fixedLog1p(-2)).toBeNaN());
    it('log1p(1) ≈ ln(2)', () => expect(fixedLog1p(1)).toBeCloseTo(0.6931471805599453, SIG10));
    it('log1p(-0.5) ≈ ln(0.5)', () => expect(fixedLog1p(-0.5)).toBeCloseTo(-0.6931471805599453, SIG10));
    it('log1p(e−1) ≈ 1', () => expect(fixedLog1p(Math.E - 1)).toBeCloseTo(1.0, SIG10));
    it('log1p(small: 0.001) stable', () => expect(fixedLog1p(0.001)).toBeCloseTo(0.000999500333083534, SIG10));
    it('log1p(-0.05) ≈ ln(0.95)', () => expect(fixedLog1p(-0.05)).toBeCloseTo(-0.05129329438755058, SIG10));
});
describe('fixedExpm1', () => {
    it('expm1(0) = 0', () => expect(fixedExpm1(0)).toBe(0));
    it('expm1(1) ≈ e−1', () => expect(fixedExpm1(1)).toBeCloseTo(Math.E - 1, SIG10));
    it('expm1(-1) ≈ 1/e − 1', () => expect(fixedExpm1(-1)).toBeCloseTo(1 / Math.E - 1, SIG10));
    it('expm1(small: 1e-10) ≈ 1e-10 (no cancellation)', () => {
        expect(fixedExpm1(1e-10)).toBeCloseTo(1e-10, 15);
    });
    it('expm1(-8) range-reduced — correct sign and magnitude', () => {
        // e^{-8} ≈ 0.000335; expm1 ≈ -0.99966
        expect(fixedExpm1(-8)).toBeCloseTo(-0.9996645373720975, SIG10);
    });
    it('expm1(-1.231) matches stableProb input range', () => {
        expect(fixedExpm1(-1.231)).toBeCloseTo(-0.7077, 3);
    });
});
describe('fixedExp', () => {
    it('exp(0) = 1', () => expect(fixedExp(0)).toBe(1));
    it('exp(1) ≈ e', () => expect(fixedExp(1)).toBeCloseTo(Math.E, SIG10));
    it('exp(-1) ≈ 1/e', () => expect(fixedExp(-1)).toBeCloseTo(1 / Math.E, SIG10));
    it('exp(ln2) ≈ 2', () => expect(fixedExp(0.6931471805599453)).toBeCloseTo(2, SIG10));
});
describe('fixedPow', () => {
    it('x^0 = 1', () => expect(fixedPow(5, 0)).toBe(1));
    it('1^n = 1', () => expect(fixedPow(1, 999)).toBe(1));
    it('0^n = 0 (n > 0)', () => expect(fixedPow(0, 3)).toBe(0));
    it('2^10 = 1024', () => expect(fixedPow(2, 10)).toBeCloseTo(1024, SIG10));
    it('1.1^0.5 ≈ sqrt(1.1)', () => expect(fixedPow(1.1, 0.5)).toBeCloseTo(1.04880884817015, SIG10));
    it('0.95^24 ≈ 0.29199', () => expect(fixedPow(0.95, 24)).toBeCloseTo(0.29199, 4));
    it('compound-growth: 1.06^12 ≈ 2.012', () => expect(fixedPow(1.06, 12)).toBeCloseTo(2.012, 2));
    it('fractional exponent: 8^(1/3) ≈ 2', () => expect(fixedPow(8, 1 / 3)).toBeCloseTo(2, SIG10));
    it('negative base, even int exp: (−2)^4 = 16', () => expect(fixedPow(-2, 4)).toBeCloseTo(16, SIG10));
    it('negative base, fractional exp → NaN', () => expect(fixedPow(-2, 0.5)).toBeNaN());
});
describe('fixedSqrt', () => {
    it('sqrt(0) = 0', () => expect(fixedSqrt(0)).toBe(0));
    it('sqrt(1) = 1', () => expect(fixedSqrt(1)).toBe(1));
    it('sqrt(4) = 2', () => expect(fixedSqrt(4)).toBeCloseTo(2, SIG10));
    it('sqrt(9) = 3', () => expect(fixedSqrt(9)).toBeCloseTo(3, SIG10));
    it('sqrt(2) ≈ 1.41421', () => expect(fixedSqrt(2)).toBeCloseTo(1.4142135623730951, SIG10));
    it('sqrt(negative) = NaN', () => expect(fixedSqrt(-1)).toBeNaN());
    it('sqrt(1e12) ≈ 1e6', () => expect(fixedSqrt(1e12)).toBeCloseTo(1e6, 6));
});
describe('stableProb', () => {
    it('p=0 → 0', () => expect(stableProb(0, 12)).toBe(0));
    it('p=1 → 1', () => expect(stableProb(1, 0)).toBe(1));
    it('n=0 → 0', () => expect(stableProb(0.5, 0)).toBe(0));
    it('5% × 12 months ≈ 45.96%', () => expect(stableProb(0.05, 12)).toBeCloseTo(0.4596, 4));
    it('10% × 6 months ≈ 46.86%', () => expect(stableProb(0.10, 6)).toBeCloseTo(0.4686, 4));
    it('20% × 1 month = 20%', () => expect(stableProb(0.20, 1)).toBeCloseTo(0.20, SIG10));
    it('5% × 24 months ≈ 70.80%', () => expect(stableProb(0.05, 24)).toBeCloseTo(0.70801, 4));
    it('result always ∈ [0, 1]', () => {
        for (const [p, n] of [[0.01, 100], [0.5, 10], [0.99, 3]]) {
            expect(stableProb(p, n)).toBeGreaterThanOrEqual(0);
            expect(stableProb(p, n)).toBeLessThanOrEqual(1);
        }
    });
    it('numerically stable for small p: stableProb ≈ p for p=0.001, n=1', () => {
        expect(stableProb(0.001, 1)).toBeCloseTo(0.001, 5);
    });
});
describe('v1 API set', () => {
    it('v1.min is Math.min', () => expect(v1.min(3, 1, 2)).toBe(1));
    it('v1.max is Math.max', () => expect(v1.max(3, 1, 2)).toBe(3));
    it('v1.clamp: mid → mid', () => expect(v1.clamp(5, 0, 10)).toBe(5));
    it('v1.clamp: below lo → lo', () => expect(v1.clamp(-5, 0, 10)).toBe(0));
    it('v1.clamp: above hi → hi', () => expect(v1.clamp(15, 0, 10)).toBe(10));
    it('v1.pow delegates to fixedPow', () => expect(v1.pow(2, 8)).toBeCloseTo(256, SIG10));
    it('v1.sqrt delegates to fixedSqrt', () => expect(v1.sqrt(16)).toBeCloseTo(4, SIG10));
    it('v1.expm1 delegates to fixedExpm1', () => expect(v1.expm1(0)).toBe(0));
    it('v1.log1p delegates to fixedLog1p', () => expect(v1.log1p(0)).toBe(0));
});
