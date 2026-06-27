// B1·K1 Step 1 — modGraph pure-graph unit tests
// Self-contained; no expectTypeOf / @ts-expect-error per project test paradigm.
import { describe, it, expect } from 'vitest';
import { buildModGraph, assertNoSelfLoops, assertAcyclic, } from '../loader/modGraph.js';
// ─── Helpers ──────────────────────────────────────────────────────────────────
function entry(deps) {
    return { 依赖: deps };
}
// ─── 1. Empty registry ────────────────────────────────────────────────────────
describe('buildModGraph — empty registry', () => {
    it('returns empty result', () => {
        const _check = true;
        void _check;
        const r = buildModGraph({});
        expect(r.sccs).toEqual([]);
        expect(r.selfLoops).toEqual([]);
        expect(r.cycles).toEqual([]);
        expect(r.danglingDeps).toEqual([]);
    });
});
// ─── 2. Single node, no deps ─────────────────────────────────────────────────
describe('buildModGraph — single node', () => {
    it('forms a size-1 SCC', () => {
        const r = buildModGraph({ alpha: entry([]) });
        expect(r.sccs).toEqual([['alpha']]);
        expect(r.selfLoops).toEqual([]);
        expect(r.cycles).toEqual([]);
        expect(r.danglingDeps).toEqual([]);
    });
});
// ─── 3. Self-loop detection ───────────────────────────────────────────────────
describe('buildModGraph — self-loop', () => {
    it('detects X → X', () => {
        const r = buildModGraph({ alpha: entry(['alpha']) });
        expect(r.selfLoops).toEqual(['alpha']);
    });
    it('self-loop node still appears in sccs (as size-1 SCC)', () => {
        const r = buildModGraph({ alpha: entry(['alpha']) });
        // The self-loop edge is not added; the node is still its own SCC.
        expect(r.sccs).toEqual([['alpha']]);
        expect(r.cycles).toEqual([]); // size-1: not a "true cycle"
    });
    it('multiple self-loops sorted by codepoint', () => {
        const r = buildModGraph({
            beta: entry(['beta']),
            alpha: entry(['alpha']),
        });
        expect(r.selfLoops).toEqual(['alpha', 'beta']);
    });
});
// ─── 4. Dangling dependency detection ────────────────────────────────────────
describe('buildModGraph — dangling deps', () => {
    it('detects reference to absent key', () => {
        const r = buildModGraph({ alpha: entry(['ghost']) });
        expect(r.danglingDeps).toEqual(['ghost']);
        // alpha still forms a size-1 SCC (no edge to ghost)
        expect(r.sccs).toEqual([['alpha']]);
    });
    it('deduplicates same dangling target referenced by multiple mods', () => {
        const r = buildModGraph({
            alpha: entry(['ghost']),
            beta: entry(['ghost']),
        });
        expect(r.danglingDeps).toEqual(['ghost']);
    });
    it('multiple distinct dangling targets sorted by codepoint', () => {
        const r = buildModGraph({
            alpha: entry(['zebra', 'ant']),
        });
        expect(r.danglingDeps).toEqual(['ant', 'zebra']);
    });
    it('does not build edge to absent node (no phantom SCC)', () => {
        const r = buildModGraph({ alpha: entry(['missing']) });
        expect(r.sccs.flat()).not.toContain('missing');
    });
});
// ─── 5. Linear chain (DAG, no cycle) ─────────────────────────────────────────
describe('buildModGraph — linear chain A→B→C', () => {
    const reg = {
        a: entry(['b']),
        b: entry(['c']),
        c: entry([]),
    };
    it('three singleton SCCs', () => {
        const r = buildModGraph(reg);
        expect(r.sccs.every(s => s.length === 1)).toBe(true);
        expect(r.sccs.length).toBe(3);
        expect(r.cycles).toEqual([]);
        expect(r.selfLoops).toEqual([]);
        expect(r.danglingDeps).toEqual([]);
    });
    it('SCCs sorted by codepoint of min key', () => {
        const r = buildModGraph(reg);
        const mins = r.sccs.map(s => s[0]);
        const sorted = [...mins].sort((a, b) => {
            const aArr = [...a];
            const bArr = [...b];
            const len = Math.min(aArr.length, bArr.length);
            for (let i = 0; i < len; i++) {
                const d = aArr[i].codePointAt(0) - bArr[i].codePointAt(0);
                if (d !== 0)
                    return d;
            }
            return aArr.length - bArr.length;
        });
        expect(mins).toEqual(sorted);
    });
});
// ─── 6. True cycle (SCC size > 1) ────────────────────────────────────────────
describe('buildModGraph — 3-cycle A→B→C→A', () => {
    const reg = {
        a: entry(['b']),
        b: entry(['c']),
        c: entry(['a']),
    };
    it('one SCC containing all three nodes', () => {
        const r = buildModGraph(reg);
        expect(r.sccs.length).toBe(1);
        expect(r.sccs[0]).toEqual(['a', 'b', 'c']); // codepoint sorted
    });
    it('cycles equals sccs (all size>1)', () => {
        const r = buildModGraph(reg);
        expect(r.cycles).toEqual(r.sccs);
    });
    it('no self-loops, no dangling', () => {
        const r = buildModGraph(reg);
        expect(r.selfLoops).toEqual([]);
        expect(r.danglingDeps).toEqual([]);
    });
});
// ─── 7. Mixed: DAG node + cycle cluster ──────────────────────────────────────
describe('buildModGraph — mix: standalone D, cycle (A→B→A)', () => {
    const reg = {
        d: entry([]),
        a: entry(['b']),
        b: entry(['a']),
    };
    it('two SCCs: the 2-cycle and singleton d', () => {
        const r = buildModGraph(reg);
        expect(r.sccs.length).toBe(2);
        const sizes = r.sccs.map(s => s.length).sort();
        expect(sizes).toEqual([1, 2]);
    });
    it('cycles contains only the size-2 SCC', () => {
        const r = buildModGraph(reg);
        expect(r.cycles.length).toBe(1);
        expect(r.cycles[0]).toEqual(['a', 'b']);
    });
    it('sccs sorted: [a,b] before [d] (a < d by codepoint)', () => {
        const r = buildModGraph(reg);
        expect(r.sccs[0]).toEqual(['a', 'b']);
        expect(r.sccs[1]).toEqual(['d']);
    });
});
// ─── 8. Within-SCC codepoint sort ────────────────────────────────────────────
describe('buildModGraph — SCC internal codepoint sort', () => {
    it('nodes within a cycle sorted by codepoint, not insertion order', () => {
        const reg = {
            zebra: entry(['mango']),
            mango: entry(['apple']),
            apple: entry(['zebra']),
        };
        const r = buildModGraph(reg);
        expect(r.sccs.length).toBe(1);
        expect(r.sccs[0]).toEqual(['apple', 'mango', 'zebra']);
    });
});
// ─── 9. Groups sorted by min key (codepoint) ─────────────────────────────────
describe('buildModGraph — SCC group ordering by min key', () => {
    it('group with min key "a" comes before group with min key "z"', () => {
        const reg = {
            z1: entry(['z2']),
            z2: entry(['z1']),
            a1: entry(['a2']),
            a2: entry(['a1']),
        };
        const r = buildModGraph(reg);
        expect(r.sccs.length).toBe(2);
        expect(r.sccs[0]).toEqual(['a1', 'a2']);
        expect(r.sccs[1]).toEqual(['z1', 'z2']);
    });
});
// ─── 10. Determinism: same input → same output ───────────────────────────────
describe('buildModGraph — determinism', () => {
    it('produces identical output on repeated calls', () => {
        const reg = {
            m: entry(['n', 'o']),
            n: entry(['o']),
            o: entry([]),
            p: entry(['p']), // self-loop
            q: entry(['missing']), // dangling
        };
        const r1 = buildModGraph(reg);
        const r2 = buildModGraph(reg);
        expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
    });
});
// ─── 11. Large flat registry (iterative stack, no overflow) ──────────────────
describe('buildModGraph — large flat registry (stack safety)', () => {
    it('handles 2000 independent nodes without stack overflow', () => {
        const reg = {};
        for (let i = 0; i < 2000; i++) {
            const key = `mod_${String(i).padStart(5, '0')}`;
            reg[key] = entry([]);
        }
        const r = buildModGraph(reg);
        expect(r.sccs.length).toBe(2000);
        expect(r.cycles).toEqual([]);
    });
    it('handles 500-node linear chain without stack overflow', () => {
        const keys = [];
        for (let i = 0; i < 500; i++)
            keys.push(`n${String(i).padStart(4, '0')}`);
        const reg = {};
        for (let i = 0; i < keys.length; i++) {
            reg[keys[i]] = entry(i + 1 < keys.length ? [keys[i + 1]] : []);
        }
        const r = buildModGraph(reg);
        expect(r.sccs.length).toBe(500);
        expect(r.cycles).toEqual([]);
    });
});
// ─── 12. Assert helpers ───────────────────────────────────────────────────────
describe('assertNoSelfLoops', () => {
    it('does not throw when no self-loops', () => {
        const r = buildModGraph({ a: entry(['b']), b: entry([]) });
        expect(() => assertNoSelfLoops(r)).not.toThrow();
    });
    it('throws with self-loop key in message', () => {
        const r = buildModGraph({ alpha: entry(['alpha']) });
        expect(() => assertNoSelfLoops(r)).toThrowError(/alpha/);
    });
});
describe('assertAcyclic', () => {
    it('does not throw when acyclic', () => {
        const r = buildModGraph({ a: entry(['b']), b: entry([]) });
        expect(() => assertAcyclic(r)).not.toThrow();
    });
    it('throws when true cycle exists', () => {
        const r = buildModGraph({ a: entry(['b']), b: entry(['a']) });
        expect(() => assertAcyclic(r)).toThrowError(/K1/);
    });
    it('self-loop does NOT trigger assertAcyclic (it is size-1 SCC)', () => {
        const r = buildModGraph({ a: entry(['a']) });
        expect(() => assertAcyclic(r)).not.toThrow();
        expect(() => assertNoSelfLoops(r)).toThrow();
    });
});
// ─── 13. Conflict[] not touched ──────────────────────────────────────────────
describe('buildModGraph — 冲突[] ignored', () => {
    it('entries with 冲突 field are accepted without error if ModRegistry omits it', () => {
        // ModEntry only requires 依赖; conflict checks are Step 2's job.
        const reg = { a: { 依赖: ['b'] }, b: { 依赖: [] } };
        expect(() => buildModGraph(reg)).not.toThrow();
    });
});
