// K5DeltaOp 结构等价防漂移测试
// 锁死三处 op 集合恒等：memory.ts Zod enum ≡ interventionMerge.ts K5_DELTA_OPS ≡ patchInvariant.ts DELTA_OPS
// 任一处新增/删 op 而其他未跟 → 测试红。
// 红线：不 import rng/hashPresetFingerprint/gate/fingerprintManifest；不改任何函数体；不进指纹。
import { describe, it, expect } from 'vitest';
import { K5_DELTA_OPS } from '../interfaces/interventionMerge.js';
import { DELTA_OPS } from '../interfaces/patchInvariant.js';
import { intervention_pack_delta条目Schema } from '../schema/memory.js';
const _k5Satisfies = ['set', 'add', 'sub', 'clamp', 'lock'];
const _k5Complete = true; // K5DeltaOp 有超出 canonical 的 op 时报错
const CANONICAL = ['add', 'clamp', 'lock', 'set', 'sub'];
describe('K5DeltaOp · 三处定义结构等价防漂移', () => {
    it('memory.ts intervention_pack_delta条目Schema.op Zod enum === canonical ops', () => {
        const zopts = [...intervention_pack_delta条目Schema.shape.op.options].sort();
        expect(zopts).toEqual(CANONICAL);
    });
    it('interventionMerge.ts K5_DELTA_OPS === canonical ops', () => {
        expect([...K5_DELTA_OPS].sort()).toEqual(CANONICAL);
    });
    it('patchInvariant.ts DELTA_OPS === canonical ops', () => {
        expect([...DELTA_OPS].sort()).toEqual(CANONICAL);
    });
});
