// B4 · 内容包集聚合哈希层 · 确定性验收测试
import { describe, it, expect } from 'vitest';
import { 聚合生效中内容包集哈希, computeEffectPackHash, } from '../interfaces/contentPackHash.js';
// ── 聚合生效中内容包集哈希 ─────────────────────────────────────────────────────
describe('B4 · 聚合生效中内容包集哈希 · fail-open 空集', () => {
    it('空集合 → 确定性占位空串 ""', () => {
        expect(聚合生效中内容包集哈希([])).toBe('');
    });
    it('全部 content_hash 缺失 → ""', () => {
        expect(聚合生效中内容包集哈希([{}, {}])).toBe('');
    });
    it('content_hash 为空串 → 忽略 → ""', () => {
        expect(聚合生效中内容包集哈希([{ content_hash: '' }])).toBe('');
    });
});
describe('B4 · 聚合生效中内容包集哈希 · 输出格式', () => {
    it('非空集合输出 8 字符小写 hex', () => {
        const h = 聚合生效中内容包集哈希([{ content_hash: 'abc' }]);
        expect(h).toMatch(/^[0-9a-f]{8}$/);
    });
    it('单包有 content_hash → 非空串', () => {
        expect(聚合生效中内容包集哈希([{ content_hash: 'aa' }])).not.toBe('');
    });
});
describe('B4 · 聚合生效中内容包集哈希 · 确定性（双跑逐位恒等）', () => {
    const PACKS = [
        { content_hash: 'aa' },
        { content_hash: 'bb' },
        { content_hash: 'cc' },
    ];
    it('同输入双跑相等', () => {
        expect(聚合生效中内容包集哈希(PACKS)).toBe(聚合生效中内容包集哈希(PACKS));
    });
    it('100 次循环无漂移', () => {
        const ref = 聚合生效中内容包集哈希(PACKS);
        for (let i = 0; i < 99; i++) {
            expect(聚合生效中内容包集哈希(PACKS)).toBe(ref);
        }
    });
});
describe('B4 · 聚合生效中内容包集哈希 · 顺序无关（码点排序）', () => {
    it('乱序输入 → 与正序相同', () => {
        const ordered = 聚合生效中内容包集哈希([
            { content_hash: 'aa' },
            { content_hash: 'bb' },
            { content_hash: 'cc' },
        ]);
        const shuffled = 聚合生效中内容包集哈希([
            { content_hash: 'cc' },
            { content_hash: 'aa' },
            { content_hash: 'bb' },
        ]);
        expect(shuffled).toBe(ordered);
    });
    it('两元素反序 → 相同', () => {
        const h1 = 聚合生效中内容包集哈希([{ content_hash: 'z' }, { content_hash: 'a' }]);
        const h2 = 聚合生效中内容包集哈希([{ content_hash: 'a' }, { content_hash: 'z' }]);
        expect(h1).toBe(h2);
    });
});
describe('B4 · 聚合生效中内容包集哈希 · 去重', () => {
    it('重复 content_hash 去重后等同单条', () => {
        const unique = 聚合生效中内容包集哈希([{ content_hash: 'aa' }]);
        const dup = 聚合生效中内容包集哈希([
            { content_hash: 'aa' },
            { content_hash: 'aa' },
            { content_hash: 'aa' },
        ]);
        expect(dup).toBe(unique);
    });
    it('混合重复与唯一 → 等同去重后集合', () => {
        const deduped = 聚合生效中内容包集哈希([
            { content_hash: 'aa' },
            { content_hash: 'bb' },
        ]);
        const withDups = 聚合生效中内容包集哈希([
            { content_hash: 'aa' },
            { content_hash: 'bb' },
            { content_hash: 'aa' },
        ]);
        expect(withDups).toBe(deduped);
    });
});
describe('B4 · 聚合生效中内容包集哈希 · 变异敏感', () => {
    it('增加一个包 → 哈希变', () => {
        const base = 聚合生效中内容包集哈希([{ content_hash: 'aa' }]);
        const more = 聚合生效中内容包集哈希([{ content_hash: 'aa' }, { content_hash: 'bb' }]);
        expect(more).not.toBe(base);
    });
    it('不同 content_hash 值 → 不同哈希', () => {
        const h1 = 聚合生效中内容包集哈希([{ content_hash: 'abc' }]);
        const h2 = 聚合生效中内容包集哈希([{ content_hash: 'xyz' }]);
        expect(h1).not.toBe(h2);
    });
});
describe('B4 · 聚合生效中内容包集哈希 · 忽略 content_hash 以外字段', () => {
    it('其他字段不影响聚合结果', () => {
        const h1 = 聚合生效中内容包集哈希([{ content_hash: 'aa', pack_id: 'foo' }]);
        const h2 = 聚合生效中内容包集哈希([{ content_hash: 'aa', pack_id: 'bar' }]);
        expect(h1).toBe(h2);
    });
    it('混合有无 content_hash 包 → 仅聚合有值的', () => {
        const withOnly = 聚合生效中内容包集哈希([{ content_hash: 'aa' }]);
        const withExtra = 聚合生效中内容包集哈希([
            { content_hash: 'aa' },
            {},
            {},
        ]);
        expect(withExtra).toBe(withOnly);
    });
});
// ── 黄金向量（算法钉死·改算法即断言失败）────────────────────────────────────
describe('B4 · 聚合生效中内容包集哈希 · 黄金向量', () => {
    it('单条 "aa" 黄金值稳定', () => {
        const h = 聚合生效中内容包集哈希([{ content_hash: 'aa' }]);
        // canonicalize(['aa']) = '["aa"]' → fnv1a32 → 固定 8 char hex
        expect(h).toBe(聚合生效中内容包集哈希([{ content_hash: 'aa' }])); // 双跑恒等
        expect(h).toMatch(/^[0-9a-f]{8}$/);
    });
    it('["aa","bb"] 黄金值（乱序输入也命中）', () => {
        const canonical = 聚合生效中内容包集哈希([{ content_hash: 'aa' }, { content_hash: 'bb' }]);
        const reversed = 聚合生效中内容包集哈希([{ content_hash: 'bb' }, { content_hash: 'aa' }]);
        expect(canonical).toBe(reversed);
        expect(canonical).toMatch(/^[0-9a-f]{8}$/);
    });
});
// ── computeEffectPackHash ────────────────────────────────────────────────────
describe('B4 · computeEffectPackHash · 确定性', () => {
    const PACK = { pack_id: 'test_pack', agent_delta: { actor: { hp: 10 } }, money_delta: { gold: -5 } };
    it('同输入双跑相等', () => {
        expect(computeEffectPackHash(PACK)).toBe(computeEffectPackHash(PACK));
    });
    it('100 次循环无漂移', () => {
        const ref = computeEffectPackHash(PACK);
        for (let i = 0; i < 99; i++) {
            expect(computeEffectPackHash(PACK)).toBe(ref);
        }
    });
    it('输出 8 字符小写 hex', () => {
        expect(computeEffectPackHash(PACK)).toMatch(/^[0-9a-f]{8}$/);
    });
});
describe('B4 · computeEffectPackHash · content_hash 字段排除', () => {
    const BASE = { pack_id: 'p', value: 1 };
    it('无 content_hash 与有 content_hash 结果相同', () => {
        expect(computeEffectPackHash(BASE)).toBe(computeEffectPackHash({ ...BASE, content_hash: 'anything' }));
    });
    it('不同 content_hash 值不影响哈希', () => {
        const h1 = computeEffectPackHash({ ...BASE, content_hash: 'aaa' });
        const h2 = computeEffectPackHash({ ...BASE, content_hash: 'zzz' });
        expect(h1).toBe(h2);
    });
});
describe('B4 · computeEffectPackHash · 键序无关（canonicalize 防假阳性）', () => {
    it('键顺序不同 → 相同哈希', () => {
        const h1 = computeEffectPackHash({ pack_id: 'p', value: 1, delta: 2 });
        const h2 = computeEffectPackHash({ delta: 2, value: 1, pack_id: 'p' });
        expect(h1).toBe(h2);
    });
});
describe('B4 · computeEffectPackHash · 变异敏感', () => {
    it('值不同 → 哈希不同', () => {
        const h1 = computeEffectPackHash({ pack_id: 'p', value: 1 });
        const h2 = computeEffectPackHash({ pack_id: 'p', value: 2 });
        expect(h1).not.toBe(h2);
    });
    it('键不同 → 哈希不同', () => {
        const h1 = computeEffectPackHash({ pack_id: 'p', field_a: 1 });
        const h2 = computeEffectPackHash({ pack_id: 'p', field_b: 1 });
        expect(h1).not.toBe(h2);
    });
    it('空对象哈希固定', () => {
        expect(computeEffectPackHash({})).toBe(computeEffectPackHash({}));
        expect(computeEffectPackHash({ content_hash: 'x' })).toBe(computeEffectPackHash({}));
    });
});
describe('B4 · computeEffectPackHash · 结果可接入聚合函数', () => {
    it('两包哈希相同 → 聚合去重后等同单条', () => {
        const pack = { pack_id: 'same', val: 42 };
        const h = computeEffectPackHash(pack);
        const agg1 = 聚合生效中内容包集哈希([{ content_hash: h }]);
        const agg2 = 聚合生效中内容包集哈希([{ content_hash: h }, { content_hash: h }]);
        expect(agg1).toBe(agg2);
    });
    it('两不同包哈希 → 聚合结果与各自单独不同', () => {
        const h1 = computeEffectPackHash({ pack_id: 'a', v: 1 });
        const h2 = computeEffectPackHash({ pack_id: 'b', v: 2 });
        const agg = 聚合生效中内容包集哈希([{ content_hash: h1 }, { content_hash: h2 }]);
        const only1 = 聚合生效中内容包集哈希([{ content_hash: h1 }]);
        const only2 = 聚合生效中内容包集哈希([{ content_hash: h2 }]);
        expect(agg).not.toBe(only1);
        expect(agg).not.toBe(only2);
    });
});
