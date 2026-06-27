// ⊕-1 computeDelta + setAtPath unit tests
// Covers: set/add/sub / lock / max_delta cap / type-mismatch / non-integer /
//         AA4 reserved-key / _/$ prefix / path-not-found / setAtPath immutability /
//         determinism.
import { describe, it, expect } from 'vitest';
import { computeDelta, setAtPath, ComputeDeltaError } from '../engine/proposal/computeDelta.js';
// ─── Fixture ──────────────────────────────────────────────────────────────────
const BASE = Object.freeze({
    持有: Object.freeze({ 文: 30, 银两: 5 }),
    名称: '林九',
    等级: 1,
    启用: true,
});
function entry(path, op, value, max_delta) {
    return max_delta !== undefined
        ? { path, op, value, max_delta }
        : value !== undefined
            ? { path, op, value }
            : { path, op };
}
function expectDeltaError(fn, code) {
    let threw = false;
    try {
        fn();
    }
    catch (e) {
        threw = true;
        expect(e).toBeInstanceOf(ComputeDeltaError);
        expect(e.code).toBe(code);
    }
    expect(threw).toBe(true);
}
// ─── 1. Basic ops ─────────────────────────────────────────────────────────────
describe('computeDelta — set op', () => {
    it('sets a string field to a new string', () => {
        const r = computeDelta(BASE, entry('名称', 'set', '王掌柜'));
        expect(r.path).toBe('名称');
        expect(r.proposedValue).toBe('王掌柜');
    });
    it('sets a number field to a new number', () => {
        const r = computeDelta(BASE, entry('等级', 'set', 5));
        expect(r.proposedValue).toBe(5);
    });
    it('sets a nested number field', () => {
        const r = computeDelta(BASE, entry('持有.文', 'set', 0));
        expect(r.proposedValue).toBe(0);
    });
});
describe('computeDelta — add op', () => {
    it('adds integer delta to number field', () => {
        const r = computeDelta(BASE, entry('持有.文', 'add', 8));
        expect(r.proposedValue).toBe(38);
    });
    it('add with max_delta cap (value exceeds cap)', () => {
        const r = computeDelta(BASE, { path: '持有.文', op: 'add', value: 100, max_delta: 10 });
        expect(r.proposedValue).toBe(40); // 30 + 10
    });
    it('add with max_delta cap (value within cap — no change)', () => {
        const r = computeDelta(BASE, { path: '持有.文', op: 'add', value: 5, max_delta: 10 });
        expect(r.proposedValue).toBe(35); // 30 + 5
    });
});
describe('computeDelta — sub op', () => {
    it('subtracts integer delta from number field', () => {
        const r = computeDelta(BASE, entry('持有.文', 'sub', 8));
        expect(r.proposedValue).toBe(22);
    });
    it('sub with max_delta cap (value exceeds cap)', () => {
        const r = computeDelta(BASE, { path: '持有.文', op: 'sub', value: 50, max_delta: 10 });
        expect(r.proposedValue).toBe(20); // 30 - 10
    });
    it('sub below zero is allowed (透支档·bounds not hardcoded)', () => {
        const r = computeDelta(BASE, entry('持有.文', 'sub', 100));
        expect(r.proposedValue).toBe(-70);
    });
});
// ─── 2. lock op ───────────────────────────────────────────────────────────────
describe('computeDelta — lock op', () => {
    it('lock op returns proposedValue = undefined (marker only)', () => {
        const r = computeDelta(BASE, { path: '持有.文', op: 'lock' });
        expect(r.path).toBe('持有.文');
        expect(r.proposedValue).toBeUndefined();
    });
    it('lock op on an already-locked path is not a violation', () => {
        const locked = new Set(['持有.文']);
        const r = computeDelta(BASE, { path: '持有.文', op: 'lock' }, { lockedPaths: locked });
        expect(r.proposedValue).toBeUndefined();
    });
    it('non-lock op on locked path throws lock-violation', () => {
        const locked = new Set(['持有.文']);
        expectDeltaError(() => computeDelta(BASE, entry('持有.文', 'add', 5), { lockedPaths: locked }), 'lock-violation');
    });
});
// ─── 3. Type mismatch ─────────────────────────────────────────────────────────
describe('computeDelta — type-mismatch', () => {
    it('add on a string field throws type-mismatch', () => {
        expectDeltaError(() => computeDelta(BASE, entry('名称', 'add', 1)), 'type-mismatch');
    });
    it('sub on a boolean field throws type-mismatch', () => {
        expectDeltaError(() => computeDelta(BASE, entry('启用', 'sub', 1)), 'type-mismatch');
    });
    it('set with wrong type (number → string) throws type-mismatch', () => {
        expectDeltaError(() => computeDelta(BASE, entry('等级', 'set', '五级')), 'type-mismatch');
    });
    it('set with wrong type (string → number) throws type-mismatch', () => {
        expectDeltaError(() => computeDelta(BASE, entry('名称', 'set', 99)), 'type-mismatch');
    });
});
// ─── 4. Integer safety ────────────────────────────────────────────────────────
describe('computeDelta — integer safety', () => {
    it('add with float value throws non-integer-value', () => {
        expectDeltaError(() => computeDelta(BASE, entry('持有.文', 'add', 0.5)), 'non-integer-value');
    });
    it('sub with float value throws non-integer-value', () => {
        expectDeltaError(() => computeDelta(BASE, entry('持有.文', 'sub', 1.1)), 'non-integer-value');
    });
    it('max_delta with float throws non-integer-value', () => {
        expectDeltaError(() => computeDelta(BASE, { path: '持有.文', op: 'add', value: 10, max_delta: 2.5 }), 'non-integer-value');
    });
});
// ─── 5. AA4 reserved-key path segments ────────────────────────────────────────
describe('computeDelta — AA4 reserved-key segments', () => {
    it('__proto__ in path throws reserved-key-segment', () => {
        expectDeltaError(() => computeDelta(BASE, entry('__proto__.污染键', 'set', 1)), 'reserved-key-segment');
    });
    it('constructor in path throws reserved-key-segment', () => {
        expectDeltaError(() => computeDelta(BASE, entry('constructor.prototype', 'set', 1)), 'reserved-key-segment');
    });
    it('prototype in path throws reserved-key-segment', () => {
        expectDeltaError(() => computeDelta(BASE, entry('Object.prototype', 'set', 1)), 'reserved-key-segment');
    });
});
// ─── 6. _/$ prefix guard (Gate③ defense-in-depth) ────────────────────────────
describe('computeDelta — forbidden prefix', () => {
    it('_ prefixed segment throws forbidden-prefix', () => {
        expectDeltaError(() => computeDelta(BASE, entry('_应收.债务01', 'set', '某约定库')), 'forbidden-prefix');
    });
    it('_ prefix at any segment position throws forbidden-prefix', () => {
        const s = { ...BASE, 账户: { _负债: {} } };
        expectDeltaError(() => computeDelta(s, entry('账户._负债', 'set', {})), 'forbidden-prefix');
    });
});
// ─── 7. Path validation ───────────────────────────────────────────────────────
describe('computeDelta — path validation', () => {
    it('empty path throws invalid-path-segment', () => {
        expectDeltaError(() => computeDelta(BASE, entry('', 'set', 1)), 'invalid-path-segment');
    });
    it('consecutive dots throw invalid-path-segment', () => {
        expectDeltaError(() => computeDelta(BASE, entry('持有..文', 'set', 1)), 'invalid-path-segment');
    });
    it('path not found in state throws path-not-found (no auto-vivify)', () => {
        expectDeltaError(() => computeDelta(BASE, entry('不存在的键', 'set', '值')), 'path-not-found');
    });
    it('nested path not found throws path-not-found', () => {
        expectDeltaError(() => computeDelta(BASE, entry('持有.不存在', 'add', 1)), 'path-not-found');
    });
});
// ─── 8. Determinism ───────────────────────────────────────────────────────────
describe('computeDelta — determinism', () => {
    it('same inputs produce identical outputs (逐位恒等)', () => {
        const e = entry('持有.文', 'add', 8);
        const r1 = computeDelta(BASE, e);
        const r2 = computeDelta(BASE, e);
        expect(r1.path).toBe(r2.path);
        expect(r1.proposedValue).toBe(r2.proposedValue);
    });
    it('computeDelta does not mutate the input state', () => {
        const state = { 持有: { 文: 30 } };
        computeDelta(state, entry('持有.文', 'add', 5));
        expect(state['持有']['文']).toBe(30);
    });
});
// ─── 9. setAtPath ─────────────────────────────────────────────────────────────
describe('setAtPath', () => {
    it('sets a top-level key immutably', () => {
        const orig = { 名称: '林九', 等级: 1 };
        const next = setAtPath(orig, '名称', '王掌柜');
        expect(next['名称']).toBe('王掌柜');
        expect(orig['名称']).toBe('林九'); // original unchanged
    });
    it('sets a nested key immutably', () => {
        const orig = { 持有: { 文: 30 } };
        const next = setAtPath(orig, '持有.文', 99);
        expect(next['持有']['文']).toBe(99);
        expect(orig['持有']['文']).toBe(30);
    });
    it('sets a deeply nested key and preserves sibling keys', () => {
        const orig = { 持有: { 文: 30, 银两: 5 } };
        const next = setAtPath(orig, '持有.文', 50);
        expect(next['持有']['银两']).toBe(5);
        expect(next['持有']['文']).toBe(50);
    });
    it('does not share nested object references with the original', () => {
        const orig = { 持有: { 文: 30 } };
        const next = setAtPath(orig, '持有.文', 99);
        expect(next['持有']).not.toBe(orig['持有']);
    });
});
