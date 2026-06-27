// packages/core/tests/semver.test.ts — B3·K2 semver primitives unit tests
import { describe, it, expect } from 'vitest';
import { parseSemver, coerceSemver, satisfies, intersect, validateRange, } from '../loader/semver.js';
describe('parseSemver', () => {
    it('parses X.Y.Z correctly', () => {
        expect(parseSemver('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 });
        expect(parseSemver('0.0.0')).toEqual({ major: 0, minor: 0, patch: 0 });
        expect(parseSemver('10.20.30')).toEqual({ major: 10, minor: 20, patch: 30 });
    });
    it('strips surrounding whitespace', () => {
        expect(parseSemver('  4.1.0  ')).toEqual({ major: 4, minor: 1, patch: 0 });
    });
    it('throws on two-part version', () => {
        expect(() => parseSemver('1.2')).toThrow();
    });
    it('throws on one-part version', () => {
        expect(() => parseSemver('1')).toThrow();
    });
    it('throws on non-numeric', () => {
        expect(() => parseSemver('a.b.c')).toThrow();
    });
    it('throws on pre-release tag', () => {
        expect(() => parseSemver('1.0.0-alpha')).toThrow();
    });
});
describe('coerceSemver', () => {
    it('X.Y.Z passthrough', () => {
        expect(coerceSemver('1.2.3')).toBe('1.2.3');
        expect(coerceSemver('0.0.0')).toBe('0.0.0');
    });
    it('pads X.Y → X.Y.0', () => {
        expect(coerceSemver('4.1')).toBe('4.1.0');
        expect(coerceSemver('10.20')).toBe('10.20.0');
    });
    it('pads X → X.0.0', () => {
        expect(coerceSemver('4')).toBe('4.0.0');
    });
    it('handles whitespace', () => {
        expect(coerceSemver('  4.1  ')).toBe('4.1.0');
    });
    it('throws on ^ operator', () => {
        expect(() => coerceSemver('^1.0.0')).toThrow();
    });
    it('throws on ~ operator', () => {
        expect(() => coerceSemver('~1.0.0')).toThrow();
    });
    it('throws on non-numeric', () => {
        expect(() => coerceSemver('abc')).toThrow();
    });
});
describe('satisfies', () => {
    it('empty range always true', () => {
        expect(satisfies('1.0.0', '')).toBe(true);
        expect(satisfies('0.0.0', '')).toBe(true);
    });
    it('>= comparator', () => {
        expect(satisfies('4.1.0', '>=4.1.0')).toBe(true);
        expect(satisfies('4.2.0', '>=4.1.0')).toBe(true);
        expect(satisfies('4.0.9', '>=4.1.0')).toBe(false);
        expect(satisfies('3.9.9', '>=4.1.0')).toBe(false);
    });
    it('> comparator', () => {
        expect(satisfies('4.1.1', '>4.1.0')).toBe(true);
        expect(satisfies('4.1.0', '>4.1.0')).toBe(false);
    });
    it('<= comparator', () => {
        expect(satisfies('1.9.9', '<=2.0.0')).toBe(true);
        expect(satisfies('2.0.0', '<=2.0.0')).toBe(true);
        expect(satisfies('2.0.1', '<=2.0.0')).toBe(false);
    });
    it('< comparator', () => {
        expect(satisfies('1.9.9', '<2.0.0')).toBe(true);
        expect(satisfies('2.0.0', '<2.0.0')).toBe(false);
    });
    it('= comparator (explicit and implicit)', () => {
        expect(satisfies('1.2.3', '=1.2.3')).toBe(true);
        expect(satisfies('1.2.4', '=1.2.3')).toBe(false);
        expect(satisfies('1.2.3', '1.2.3')).toBe(true);
        expect(satisfies('1.2.4', '1.2.3')).toBe(false);
    });
    it('space-AND of comparators (>=X <Y)', () => {
        expect(satisfies('1.5.0', '>=1.0.0 <2.0.0')).toBe(true);
        expect(satisfies('1.0.0', '>=1.0.0 <2.0.0')).toBe(true);
        expect(satisfies('2.0.0', '>=1.0.0 <2.0.0')).toBe(false);
        expect(satisfies('0.9.9', '>=1.0.0 <2.0.0')).toBe(false);
    });
    it('engine coerce: satisfies(coerceSemver("4.1"), ">=4.1.0") is true', () => {
        expect(satisfies(coerceSemver('4.1'), '>=4.1.0')).toBe(true);
    });
    it('version below minimum', () => {
        expect(satisfies('3.9.9', '>=4.0.0')).toBe(false);
    });
    it('throws on ^ in range', () => {
        expect(() => satisfies('1.0.0', '^1.0.0')).toThrow();
    });
    it('throws on ~ in range', () => {
        expect(() => satisfies('1.0.0', '~1.0.0')).toThrow();
    });
    it('throws on || in range', () => {
        expect(() => satisfies('1.0.0', '>=1.0.0 || >=2.0.0')).toThrow();
    });
    it('throws on pre-release in range', () => {
        expect(() => satisfies('1.0.0', '>=1.0.0-alpha')).toThrow();
    });
});
describe('intersect', () => {
    it('empty AND range = other range', () => {
        expect(intersect('', '>=1.0.0')).toBe('>=1.0.0');
        expect(intersect('>=1.0.0', '')).toBe('>=1.0.0');
        expect(intersect('', '')).toBe('');
    });
    it('combines two ranges into AND', () => {
        const r = intersect('>=1.0.0', '<2.0.0');
        expect(satisfies('1.5.0', r)).toBe(true);
        expect(satisfies('2.0.0', r)).toBe(false);
        expect(satisfies('0.9.9', r)).toBe(false);
    });
    it('deduplicates identical comparators', () => {
        const r = intersect('>=1.0.0', '>=1.0.0');
        expect(r).toBe('>=1.0.0');
    });
    it('multi-comparator range intersection', () => {
        const r = intersect('>=1.0.0 <3.0.0', '>=2.0.0 <4.0.0');
        expect(satisfies('2.5.0', r)).toBe(true);
        expect(satisfies('1.5.0', r)).toBe(false); // < 2.0.0
        expect(satisfies('3.0.0', r)).toBe(false); // >= 3.0.0
    });
    it('throws on unsupported syntax in either arg', () => {
        expect(() => intersect('^1.0.0', '>=2.0.0')).toThrow();
        expect(() => intersect('>=1.0.0', '~2.0.0')).toThrow();
    });
});
describe('validateRange', () => {
    it('accepts valid ranges', () => {
        expect(() => validateRange('')).not.toThrow();
        expect(() => validateRange('>=1.0.0')).not.toThrow();
        expect(() => validateRange('>=1.0.0 <2.0.0')).not.toThrow();
        expect(() => validateRange('=4.1.0')).not.toThrow();
    });
    it('throws on ^', () => {
        expect(() => validateRange('^1.0.0')).toThrow();
    });
    it('throws on ~', () => {
        expect(() => validateRange('~1.0.0')).toThrow();
    });
    it('throws on ||', () => {
        expect(() => validateRange('>=1.0.0 || >=2.0.0')).toThrow();
    });
    it('throws on malformed version in comparator', () => {
        expect(() => validateRange('>=1.0')).toThrow();
    });
});
