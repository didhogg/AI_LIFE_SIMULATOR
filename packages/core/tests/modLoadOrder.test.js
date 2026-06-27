// B1·K1 Step 2 — Kahn topo sort + conflict detection unit tests
// Test file choice: modLoadOrder.test.ts (separate from modGraph.test.ts — different concern).
// Self-contained; no expectTypeOf / @ts-expect-error per project test paradigm.
import { describe, it, expect } from 'vitest';
import { computeLoadOrder, assertNoConflicts, } from '../loader/modGraph.js';
// ─── Fixtures ─────────────────────────────────────────────────────────────────
function mod(deps = [], opts = {}) {
    return { 依赖: deps, ...opts };
}
// ─── 1. Load order shape ─────────────────────────────────────────────────────
describe('LoadOrderResult shape', () => {
    it('has required keys', () => {
        const _check = true;
        void _check;
        const r = computeLoadOrder({});
        expect(r.flattenedLoadOrder).toEqual([]);
        expect(r.orderedGroups).toEqual([]);
        expect(r.rejected).toEqual([]);
        expect(r.disabled).toEqual([]);
        expect(r.conflicts).toEqual([]);
    });
});
// ─── 2. Linear chain — B loads before A ──────────────────────────────────────
describe('linear chain A depends on B', () => {
    // A→B means A depends on B → B loads first.
    const reg = {
        a: mod(['b']),
        b: mod([]),
    };
    it('B before A', () => {
        const r = computeLoadOrder(reg);
        const order = r.flattenedLoadOrder;
        expect(order.indexOf('b')).toBeLessThan(order.indexOf('a'));
    });
    it('no conflicts, no rejected, no disabled', () => {
        const r = computeLoadOrder(reg);
        expect(r.conflicts).toEqual([]);
        expect(r.rejected).toEqual([]);
        expect(r.disabled).toEqual([]);
    });
});
// ─── 3. Diamond: A→B, A→C, B→D, C→D ─────────────────────────────────────────
describe('diamond dependency', () => {
    // D is depended on by B and C → D loads first; A loads last.
    const reg = {
        a: mod(['b', 'c']),
        b: mod(['d']),
        c: mod(['d']),
        d: mod([]),
    };
    it('D loads first, A loads last', () => {
        const r = computeLoadOrder(reg);
        const order = r.flattenedLoadOrder;
        expect(order[0]).toBe('d');
        expect(order[order.length - 1]).toBe('a');
    });
    it('B and C are between D and A', () => {
        const r = computeLoadOrder(reg);
        const order = r.flattenedLoadOrder;
        expect(order.indexOf('b')).toBeGreaterThan(order.indexOf('d'));
        expect(order.indexOf('c')).toBeGreaterThan(order.indexOf('d'));
        expect(order.indexOf('b')).toBeLessThan(order.indexOf('a'));
        expect(order.indexOf('c')).toBeLessThan(order.indexOf('a'));
    });
    it('B vs C tie-break: no-priority → codepoint (b < c)', () => {
        // Both B and C have same priority (0) → codepoint: b < c → b loads before c.
        const r = computeLoadOrder(reg);
        const order = r.flattenedLoadOrder;
        expect(order.indexOf('b')).toBeLessThan(order.indexOf('c'));
    });
});
// ─── 4. Priority tie-break (same deps, different priority) ───────────────────
describe('priority tie-break', () => {
    it('lower 优先级 loads first; higher 优先级 loads later', () => {
        // Both independent; priority 0 before priority 5.
        const reg = {
            high: mod([], { 优先级: 5 }),
            low: mod([], { 优先级: 0 }),
        };
        const r = computeLoadOrder(reg);
        const order = r.flattenedLoadOrder;
        expect(order.indexOf('low')).toBeLessThan(order.indexOf('high'));
    });
    it('three mods different priorities → ascending order', () => {
        const reg = {
            p10: mod([], { 优先级: 10 }),
            p0: mod([], { 优先级: 0 }),
            p5: mod([], { 优先级: 5 }),
        };
        const r = computeLoadOrder(reg);
        const order = r.flattenedLoadOrder;
        expect(order.indexOf('p0')).toBeLessThan(order.indexOf('p5'));
        expect(order.indexOf('p5')).toBeLessThan(order.indexOf('p10'));
    });
    it('priority tie-break overrides codepoint (z has lower priority → loads before a)', () => {
        // 'a' has priority 5; 'z' has priority 0 → 'z' loads first despite z>a in codepoint.
        const reg = {
            a: mod([], { 优先级: 5 }),
            z: mod([], { 优先级: 0 }),
        };
        const r = computeLoadOrder(reg);
        const order = r.flattenedLoadOrder;
        expect(order.indexOf('z')).toBeLessThan(order.indexOf('a'));
    });
});
// ─── 5. Same priority + no deps → pure codepoint order ──────────────────────
describe('same priority + no deps → codepoint order', () => {
    it('alpha < beta < gamma', () => {
        const reg = {
            gamma: mod([], { 优先级: 3 }),
            alpha: mod([], { 优先级: 3 }),
            beta: mod([], { 优先级: 3 }),
        };
        const r = computeLoadOrder(reg);
        expect(r.flattenedLoadOrder).toEqual(['alpha', 'beta', 'gamma']);
    });
});
// ─── 6. SCC (A↔B mutual dep) participates in topo without deadlock ───────────
describe('SCC as super-node in topo', () => {
    const reg = {
        a: mod(['b']),
        b: mod(['a']),
        c: mod(['a']), // c depends on the a↔b SCC
    };
    it('no deadlock; all mods in output', () => {
        const r = computeLoadOrder(reg);
        expect(r.flattenedLoadOrder).toHaveLength(3);
        expect(r.conflicts).toEqual([]);
    });
    it('SCC {a,b} loads before c (c depends on the SCC)', () => {
        const r = computeLoadOrder(reg);
        const order = r.flattenedLoadOrder;
        // a and b are in the SCC → both appear before c.
        expect(order.indexOf('a')).toBeLessThan(order.indexOf('c'));
        expect(order.indexOf('b')).toBeLessThan(order.indexOf('c'));
    });
    it('SCC members in codepoint order within their group', () => {
        const r = computeLoadOrder(reg);
        const sccGroup = r.orderedGroups.find(g => g.includes('a') && g.includes('b'));
        expect(sccGroup).toBeDefined();
        expect(sccGroup.indexOf('a')).toBeLessThan(sccGroup.indexOf('b'));
    });
});
// ─── 7. Conflict detection — mutual (A.冲突 ∋ B, B.冲突 ∋ A) ─────────────────
describe('conflict — mutual declaration', () => {
    it('both enabled → conflict detected', () => {
        const reg = {
            a: mod([], { pack_id: 'a', 冲突: ['b'] }),
            b: mod([], { pack_id: 'b', 冲突: ['a'] }),
        };
        const r = computeLoadOrder(reg);
        expect(r.conflicts).toHaveLength(1);
        expect(r.conflicts[0]).toEqual({ a: 'a', b: 'b' });
    });
    it('pair is de-duplicated (not reported twice)', () => {
        const reg = {
            a: mod([], { pack_id: 'a', 冲突: ['b'] }),
            b: mod([], { pack_id: 'b', 冲突: ['a'] }),
        };
        expect(computeLoadOrder(reg).conflicts).toHaveLength(1);
    });
});
// ─── 8. Conflict detection — unidirectional (only A declares conflict with B) ─
describe('conflict — unidirectional (A.冲突 ∋ B.pack_id, B silent)', () => {
    it('still detected', () => {
        const reg = {
            a: mod([], { pack_id: 'a', 冲突: ['b'] }),
            b: mod([], { pack_id: 'b' }), // no 冲突 declared
        };
        const r = computeLoadOrder(reg);
        expect(r.conflicts).toHaveLength(1);
        expect(r.conflicts[0]).toMatchObject({ a: 'a', b: 'b' });
    });
});
// ─── 9. Conflict with a disabled mod → not reported ──────────────────────────
describe('conflict target is disabled → no conflict', () => {
    it('disabled mod not in active set → not detected', () => {
        const reg = {
            a: mod([], { pack_id: 'a', 冲突: ['b'] }),
            b: mod([], { pack_id: 'b', 启用: false }),
        };
        const r = computeLoadOrder(reg);
        expect(r.conflicts).toEqual([]);
        expect(r.disabled).toContain('b');
    });
});
// ─── 10. Rejected (self-loop) cascade ────────────────────────────────────────
describe('rejected cascade — downstream of self-loop excluded', () => {
    it('self-loop node is rejected', () => {
        const reg = {
            loop: mod(['loop']), // self-loop
        };
        const r = computeLoadOrder(reg);
        expect(r.rejected).toContain('loop');
        expect(r.flattenedLoadOrder).not.toContain('loop');
    });
    it('node that depends on self-loop is cascade-rejected', () => {
        const reg = {
            loop: mod(['loop']),
            victim: mod(['loop']), // depends on loop → cascade-rejected
        };
        const r = computeLoadOrder(reg);
        expect(r.rejected).toContain('victim');
        expect(r.flattenedLoadOrder).not.toContain('victim');
    });
    it('node independent of self-loop is NOT rejected', () => {
        const reg = {
            loop: mod(['loop']),
            safe: mod([]),
        };
        const r = computeLoadOrder(reg);
        expect(r.rejected).not.toContain('safe');
        expect(r.flattenedLoadOrder).toContain('safe');
    });
    it('multi-hop cascade: A→B, B→loop → A also rejected', () => {
        const reg = {
            loop: mod(['loop']),
            b: mod(['loop']),
            a: mod(['b']),
        };
        const r = computeLoadOrder(reg);
        expect(r.rejected).toContain('b');
        expect(r.rejected).toContain('a');
        expect(r.flattenedLoadOrder).toEqual([]);
    });
});
// ─── 11. Disabled mods: no cascade, dependents still load ────────────────────
describe('disabled mods — no cascade', () => {
    it('disabled mod excluded from load order', () => {
        const reg = {
            off: mod([], { 启用: false }),
            on: mod([]),
        };
        const r = computeLoadOrder(reg);
        expect(r.disabled).toContain('off');
        expect(r.flattenedLoadOrder).not.toContain('off');
        expect(r.flattenedLoadOrder).toContain('on');
    });
    it('dependent of disabled mod still loads (disabled does not cascade)', () => {
        const reg = {
            base: mod([], { 启用: false }),
            addon: mod(['base']), // depends on disabled base
        };
        const r = computeLoadOrder(reg);
        expect(r.flattenedLoadOrder).toContain('addon');
        expect(r.rejected).not.toContain('addon');
    });
});
// ─── 12. Determinism — same input → same output ──────────────────────────────
describe('determinism', () => {
    it('two runs produce identical JSON', () => {
        const reg = {
            m: mod(['n', 'o'], { 优先级: 2 }),
            n: mod(['o'], { 优先级: 1 }),
            o: mod([]),
            p: mod(['p']), // self-loop
            q: mod(['p']), // cascade-rejected
            r: mod([], { 启用: false }),
            s: mod([], { pack_id: 's', 冲突: ['t'] }),
            t: mod([], { pack_id: 't' }),
        };
        expect(JSON.stringify(computeLoadOrder(reg))).toBe(JSON.stringify(computeLoadOrder(reg)));
    });
});
// ─── 13. Input key insertion order doesn't affect output ─────────────────────
describe('key insertion order invariance', () => {
    it('reverse key order → same load order', () => {
        const regAB = { a: mod(['b']), b: mod([]) };
        const regBA = { b: mod([]), a: mod(['b']) };
        expect(computeLoadOrder(regAB).flattenedLoadOrder)
            .toEqual(computeLoadOrder(regBA).flattenedLoadOrder);
    });
});
// ─── 14. No localeCompare used (六禁 grep guard) ─────────────────────────────
describe('六禁 — no localeCompare method call in loader', () => {
    it('modGraph.ts must not call .localeCompare()', async () => {
        // Guard against accidental use of localeCompare() method (non-deterministic).
        // Comments mentioning the rule are fine; only method-call syntax is banned.
        const fs = await import('node:fs/promises');
        const src = await fs.readFile(new URL('../loader/modGraph.ts', import.meta.url), 'utf8');
        expect(src).not.toContain('.localeCompare(');
    });
});
// ─── 15. assertNoConflicts helper ────────────────────────────────────────────
describe('assertNoConflicts', () => {
    it('does not throw when no conflicts', () => {
        const r = computeLoadOrder({ a: mod([]), b: mod([]) });
        expect(() => assertNoConflicts(r)).not.toThrow();
    });
    it('throws when conflicts exist', () => {
        const reg = {
            a: mod([], { pack_id: 'a', 冲突: ['b'] }),
            b: mod([], { pack_id: 'b' }),
        };
        const r = computeLoadOrder(reg);
        expect(() => assertNoConflicts(r)).toThrowError(/K1/);
    });
});
// ─── 16. orderedGroups mirrors flattenedLoadOrder ────────────────────────────
describe('orderedGroups consistency', () => {
    it('flatten(orderedGroups) === flattenedLoadOrder', () => {
        const reg = {
            a: mod(['b', 'c']),
            b: mod(['d']),
            c: mod(['d']),
            d: mod([]),
        };
        const r = computeLoadOrder(reg);
        expect(r.orderedGroups.flat()).toEqual(r.flattenedLoadOrder);
    });
});
// ─── 17. Conflict pair canonical form (a < b by codepoint) ───────────────────
describe('conflict pair canonical form', () => {
    it('a is always codepoint-smaller than b', () => {
        const reg = {
            z: mod([], { pack_id: 'z', 冲突: ['a'] }),
            a: mod([], { pack_id: 'a' }),
        };
        const r = computeLoadOrder(reg);
        expect(r.conflicts).toHaveLength(1);
        // codepoint: 'a' < 'z' → a='a', b='z'
        expect(r.conflicts[0]).toEqual({ a: 'a', b: 'z' });
    });
});
// ─── 18. effectiveId fallback (no pack_id → use record key) ──────────────────
describe('conflict matching — effectiveId fallback', () => {
    it('without pack_id field, record key is used as effectiveId for conflict lookup', () => {
        // a.冲突 contains 'b' — b has no explicit pack_id → effectiveId('b') = 'b'
        const reg = {
            a: mod([], { pack_id: 'a', 冲突: ['b'] }),
            b: mod([]), // no pack_id
        };
        const r = computeLoadOrder(reg);
        expect(r.conflicts).toHaveLength(1);
    });
});
