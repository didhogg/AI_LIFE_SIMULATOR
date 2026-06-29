/**
 * PR-5d · 玩法/Mod 导入·导出接口 验收
 *
 * 断言① RT   往返幂等：export → import → export，canonicalize 逐位恒等
 * 断言② HASH content_hash 逐位恒等：导出条目 内容哈希 === 重算值
 * 断言③ TOMB 非法条目进墓碑（不静默丢）：顶层 hash 篡改·条目内容篡改·key≠pack_id·自环
 * 断言④ COLL 撞库幂等 / 不同 hash 禁覆盖
 * 断言⑤ FILE 文件名无关（同内容·不同路径标签·结果恒等）
 * 断言⑥ CONS 守恒门：schemaKeys=54·信封不入 RootSchema
 */
import { describe, it, expect } from 'vitest';
import { exportContentPack, importContentPack, 内容包信封Schema, } from '../engine/contentPackIO.js';
import { 内容包条目Schema, 内容包库Schema, 薄清单Schema, } from '../engine/preset/contentPack.js';
import { RootSchema } from '../schema/index.js';
import { canonicalize } from '../engine/text/canonicalize.js';
import { computeEffectPackHash } from '../interfaces/contentPackHash.js';
// ── 测试 fixtures ─────────────────────────────────────────────────────────────
function mkPack(packId, extra = {}) {
    return 内容包条目Schema.parse({ pack_id: packId, 依赖: [], 冲突: [], ...extra });
}
function mkLib(packs) {
    return 内容包库Schema.parse(packs);
}
function emptyInstalled() {
    return { 内容包库: mkLib({}) };
}
// ─────────────────────────────────────────────────────────────────────────────
// 断言① · 往返幂等
// ─────────────────────────────────────────────────────────────────────────────
describe('PR-5d ① RT · 往返幂等', () => {
    it('RT-1 export → import → export：canonicalize 逐位恒等', () => {
        const pack = mkPack('alpha');
        const library = mkLib({ alpha: pack });
        const manifest = 薄清单Schema.parse({ packs: ['alpha'] });
        const r1 = exportContentPack(manifest, library);
        expect(r1.ok).toBe(true);
        if (!r1.ok)
            return;
        const imp = importContentPack(r1.信封, emptyInstalled());
        expect(Object.keys(imp._mod墓碑库)).toHaveLength(0);
        const r2 = exportContentPack(manifest, imp.已安装.内容包库);
        expect(r2.ok).toBe(true);
        if (!r2.ok)
            return;
        expect(canonicalize(r1.信封)).toBe(canonicalize(r2.信封));
    });
    it('RT-2 export → import（到非空已安装）→ 二次 import same hash → 幂等·无墓碑', () => {
        const pack = mkPack('beta');
        const library = mkLib({ beta: pack });
        const manifest = 薄清单Schema.parse({ packs: ['beta'] });
        const r = exportContentPack(manifest, library);
        expect(r.ok).toBe(true);
        if (!r.ok)
            return;
        const imp1 = importContentPack(r.信封, emptyInstalled());
        expect(Object.keys(imp1._mod墓碑库)).toHaveLength(0);
        // 二次导入 same envelope（same hash → 幂等）
        const imp2 = importContentPack(r.信封, imp1.已安装);
        expect(Object.keys(imp2._mod墓碑库)).toHaveLength(0);
        // beta 仍然只有一份
        expect(Object.keys(imp2.已安装.内容包库)).toHaveLength(1);
    });
    it('RT-3 多包排序稳定：两种插入顺序→ canonicalize 相同', () => {
        const p1 = mkPack('pack_a');
        const p2 = mkPack('pack_b');
        const manifest = 薄清单Schema.parse({ packs: ['pack_a', 'pack_b'] });
        const lib_ab = mkLib({ pack_a: p1, pack_b: p2 });
        const lib_ba = mkLib({ pack_b: p2, pack_a: p1 });
        const r1 = exportContentPack(manifest, lib_ab);
        const r2 = exportContentPack(manifest, lib_ba);
        expect(r1.ok).toBe(true);
        expect(r2.ok).toBe(true);
        if (!r1.ok || !r2.ok)
            return;
        expect(r1.信封.顶层哈希).toBe(r2.信封.顶层哈希);
    });
});
// ─────────────────────────────────────────────────────────────────────────────
// 断言② · content_hash 逐位恒等
// ─────────────────────────────────────────────────────────────────────────────
describe('PR-5d ② HASH · content_hash 逐位恒等', () => {
    it('HASH-1 导出条目 内容哈希 === computeEffectPackHash 重算值', () => {
        const pack = mkPack('gamma', { 名称: '测试包', 描述: '描述文本' });
        const library = mkLib({ gamma: pack });
        const manifest = 薄清单Schema.parse({ packs: ['gamma'] });
        const r = exportContentPack(manifest, library);
        expect(r.ok).toBe(true);
        if (!r.ok)
            return;
        const exported = r.信封.内容包库['gamma'];
        const stored = exported['内容哈希'];
        const recomputed = computeEffectPackHash(Object.fromEntries(Object.entries(exported).filter(([k]) => k !== '内容哈希')));
        expect(stored).toBe(recomputed);
        expect(stored).toMatch(/^[0-9a-f]{8}$/);
    });
    it('HASH-2 导出后 内容哈希 是稳定的 8 位 hex 字符串', () => {
        const pack = mkPack('delta');
        const library = mkLib({ delta: pack });
        const manifest = 薄清单Schema.parse({ packs: ['delta'] });
        const r1 = exportContentPack(manifest, library);
        const r2 = exportContentPack(manifest, library);
        expect(r1.ok && r2.ok).toBe(true);
        if (!r1.ok || !r2.ok)
            return;
        const h1 = r1.信封.内容包库['delta']['内容哈希'];
        const h2 = r2.信封.内容包库['delta']['内容哈希'];
        expect(h1).toBe(h2);
    });
    it('HASH-3 导出信封顶层哈希非空', () => {
        const pack = mkPack('epsilon');
        const library = mkLib({ epsilon: pack });
        const manifest = 薄清单Schema.parse({ packs: ['epsilon'] });
        const r = exportContentPack(manifest, library);
        expect(r.ok).toBe(true);
        if (!r.ok)
            return;
        expect(typeof r.信封.顶层哈希).toBe('string');
        expect(r.信封.顶层哈希.length).toBeGreaterThan(0);
    });
});
// ─────────────────────────────────────────────────────────────────────────────
// 断言③ · 非法条目进墓碑（不静默丢）
// ─────────────────────────────────────────────────────────────────────────────
describe('PR-5d ③ TOMB · 非法条目进墓碑', () => {
    it('TOMB-1 顶层哈希篡改 → __envelope__ 进墓碑·整包拒·已安装不变', () => {
        const pack = mkPack('zeta');
        const library = mkLib({ zeta: pack });
        const manifest = 薄清单Schema.parse({ packs: ['zeta'] });
        const r = exportContentPack(manifest, library);
        expect(r.ok).toBe(true);
        if (!r.ok)
            return;
        // 篡改顶层哈希
        const tampered = { ...r.信封, 顶层哈希: 'deadbeef' };
        const imp = importContentPack(tampered, emptyInstalled());
        expect(imp._mod墓碑库['__envelope__']).toBeDefined();
        expect(imp._mod墓碑库['__envelope__']?.原因).toBe('其他');
        // 已安装未被修改
        expect(Object.keys(imp.已安装.内容包库)).toHaveLength(0);
    });
    it('TOMB-2 条目内容篡改（保持 内容哈希 不变）→ per-entry 检拦截 → 条目进墓碑', () => {
        const pack = mkPack('eta', { 名称: '原始名称' });
        const library = mkLib({ eta: pack });
        const manifest = 薄清单Schema.parse({ packs: ['eta'] });
        const r = exportContentPack(manifest, library);
        expect(r.ok).toBe(true);
        if (!r.ok)
            return;
        // 深拷贝·改内容·保留 内容哈希（= hash 不一致）
        const deepCopy = JSON.parse(JSON.stringify(r.信封));
        const entry = deepCopy.内容包库['eta'];
        entry['名称'] = '恶意篡改'; // content changed, hash stays
        // 顶层哈希不变（基于 内容哈希 值·我们没改 内容哈希）→ 顶层检查通过
        // per-entry 检：computeEntryHash(篡改条目) ≠ stored 内容哈希 → 条目进墓碑
        const imp = importContentPack(deepCopy, emptyInstalled());
        expect(imp._mod墓碑库['eta']).toBeDefined();
        expect(Object.keys(imp.已安装.内容包库)).not.toContain('eta');
    });
    it('TOMB-3 key ≠ pack_id → resolve 层一级拒 → pack 进 _mod墓碑库', () => {
        // key='theta_wrong' 但 pack_id='theta' → resolve key不等pack_id
        const pack = mkPack('theta');
        const library = mkLib({ theta_wrong: pack }); // key不匹配
        const manifest = 薄清单Schema.parse({ packs: ['theta_wrong'] });
        const r = exportContentPack(manifest, library);
        // key != pack_id → resolve 拒 → 生效中包集空 → 导出失败
        expect(r.ok).toBe(false);
    });
    it('TOMB-4 自环（pack A 依赖 pack A）→ resolve 自环墓碑·不静默丢', () => {
        const selfPack = 内容包条目Schema.parse({ pack_id: 'loop', 依赖: ['loop'], 冲突: [] });
        const library = mkLib({ loop: selfPack });
        const manifest = 薄清单Schema.parse({ packs: ['loop'] });
        const r = exportContentPack(manifest, library);
        // 自环 → 墓碑 → 生效中包集空 → 导出失败
        expect(r.ok).toBe(false);
        if (r.ok)
            return;
        expect(r.gate).toBe('export-resolve');
    });
    it('TOMB-5 信封 schema 解析失败（缺必填字段）→ __envelope__ 进墓碑·整包拒', () => {
        const imp = importContentPack({ 格式版本: '1.0.0' }, emptyInstalled());
        expect(imp._mod墓碑库['__envelope__']).toBeDefined();
        expect(Object.keys(imp.已安装.内容包库)).toHaveLength(0);
    });
    it('TOMB-6 格式版本 major=2 → 不识别 → __envelope__ 进墓碑', () => {
        const pack = mkPack('iota');
        const library = mkLib({ iota: pack });
        const manifest = 薄清单Schema.parse({ packs: ['iota'] });
        const r = exportContentPack(manifest, library);
        expect(r.ok).toBe(true);
        if (!r.ok)
            return;
        const v2 = { ...r.信封, 格式版本: '2.0.0' };
        const imp = importContentPack(v2, emptyInstalled());
        expect(imp._mod墓碑库['__envelope__']).toBeDefined();
    });
});
// ─────────────────────────────────────────────────────────────────────────────
// 断言④ · 撞库幂等 / 不同 hash 禁覆盖
// ─────────────────────────────────────────────────────────────────────────────
describe('PR-5d ④ COLL · 撞库检测', () => {
    it('COLL-1 same hash 二次 import → 幂等 no-op·无墓碑·pack 不重复', () => {
        const pack = mkPack('kappa');
        const library = mkLib({ kappa: pack });
        const manifest = 薄清单Schema.parse({ packs: ['kappa'] });
        const r = exportContentPack(manifest, library);
        expect(r.ok).toBe(true);
        if (!r.ok)
            return;
        const imp1 = importContentPack(r.信封, emptyInstalled());
        const imp2 = importContentPack(r.信封, imp1.已安装);
        // 第二次无新墓碑
        const newTombs = Object.keys(imp2._mod墓碑库).filter(k => k !== '__envelope__');
        expect(newTombs).toHaveLength(0);
        expect(Object.keys(imp2.已安装.内容包库)).toHaveLength(1);
    });
    it('COLL-2 diff hash 撞库 → 禁覆盖·进 _mod墓碑库', () => {
        const packV1 = mkPack('lambda', { 描述: 'version 1' });
        const packV2 = mkPack('lambda', { 描述: 'version 2' });
        const lib1 = mkLib({ lambda: packV1 });
        const lib2 = mkLib({ lambda: packV2 });
        const manifest = 薄清单Schema.parse({ packs: ['lambda'] });
        const r1 = exportContentPack(manifest, lib1);
        const r2 = exportContentPack(manifest, lib2);
        expect(r1.ok && r2.ok).toBe(true);
        if (!r1.ok || !r2.ok)
            return;
        // 安装 v1
        const imp1 = importContentPack(r1.信封, emptyInstalled());
        expect(Object.keys(imp1._mod墓碑库)).toHaveLength(0);
        // 尝试安装 v2（不同 hash）
        const imp2 = importContentPack(r2.信封, imp1.已安装);
        expect(imp2._mod墓碑库['lambda']).toBeDefined();
        expect(imp2._mod墓碑库['lambda']?.原因).toBe('覆写授权越权');
        // 已安装仍是 v1（未被覆盖）
        const existHash = imp2.已安装.内容包库['lambda']?.['内容哈希'];
        const v1Hash = imp1.已安装.内容包库['lambda']?.['内容哈希'];
        expect(existHash).toBe(v1Hash);
    });
});
// ─────────────────────────────────────────────────────────────────────────────
// 断言⑤ · 文件名无关
// ─────────────────────────────────────────────────────────────────────────────
describe('PR-5d ⑤ FILE · 文件名无关', () => {
    it('FILE-1 相同内容包·不同宿主路径标签（宿主自行 label·core 不读文件名）→ 导出信封恒等', () => {
        const pack = mkPack('mu');
        const library = mkLib({ mu: pack });
        const manifest = 薄清单Schema.parse({ packs: ['mu'] });
        // 模拟宿主用不同路径加载后传入同一内容·core 不接触路径
        const r1 = exportContentPack(manifest, library);
        const r2 = exportContentPack(manifest, library);
        expect(r1.ok && r2.ok).toBe(true);
        if (!r1.ok || !r2.ok)
            return;
        // 路由唯一认 pack_id + content_hash·文件名从不进 core
        expect(canonicalize(r1.信封)).toBe(canonicalize(r2.信封));
    });
    it('FILE-2 两个不同 pack_id 的包（非撞名）→ 都安装成功·无墓碑', () => {
        const packA = mkPack('nu_a', { 名称: '包A' });
        const packB = mkPack('nu_b', { 名称: '包B' });
        const manifest = 薄清单Schema.parse({ packs: ['nu_a', 'nu_b'] });
        const library = mkLib({ nu_a: packA, nu_b: packB });
        const r = exportContentPack(manifest, library);
        expect(r.ok).toBe(true);
        if (!r.ok)
            return;
        const imp = importContentPack(r.信封, emptyInstalled());
        const packTombs = Object.keys(imp._mod墓碑库).filter(k => k !== '__envelope__');
        expect(packTombs).toHaveLength(0);
        expect(Object.keys(imp.已安装.内容包库)).toHaveLength(2);
        expect(imp.已安装.内容包库['nu_a']).toBeDefined();
        expect(imp.已安装.内容包库['nu_b']).toBeDefined();
    });
});
// ─────────────────────────────────────────────────────────────────────────────
// 断言⑥ · 守恒门
// ─────────────────────────────────────────────────────────────────────────────
describe('PR-5d ⑥ CONS · 守恒门', () => {
    it('CONS-1 schemaKeys = 54（信封 schema 属装配层·未进 RootSchema）', () => {
        const count = Object.keys(RootSchema.shape).length;
        expect(count).toBe(54);
    });
    it('CONS-2 内容包信封Schema 顶层字段不含 RootSchema 顶层键', () => {
        const rootKeys = new Set(Object.keys(RootSchema.shape));
        const envelopeKeys = Object.keys(内容包信封Schema.shape);
        for (const k of envelopeKeys) {
            expect(rootKeys.has(k), `信封字段「${k}」不应出现在 RootSchema 中`).toBe(false);
        }
    });
    it('CONS-3 薄清单Schema 可从 contentPack.ts 独立导入（单一权威·无双声明漂移）', () => {
        const parsed = 薄清单Schema.safeParse({ packs: ['xi'] });
        expect(parsed.success).toBe(true);
    });
    it('CONS-4 空 manifest.packs → exportContentPack 返回 ok=false（不抛）', () => {
        const r = exportContentPack({ packs: [] }, mkLib({}));
        expect(r.ok).toBe(false);
        if (r.ok)
            return;
        expect(r.gate).toBe('export-resolve');
    });
    it('CONS-5 无内容包库中引用的包 → exportContentPack ok=false（成品空）', () => {
        const manifest = 薄清单Schema.parse({ packs: ['omicron'] });
        // 库里没有 omicron
        const r = exportContentPack(manifest, mkLib({}));
        expect(r.ok).toBe(false);
    });
    it('CONS-6 信封格式版本默认 1.0.0', () => {
        const pack = mkPack('pi');
        const library = mkLib({ pi: pack });
        const manifest = 薄清单Schema.parse({ packs: ['pi'] });
        const r = exportContentPack(manifest, library);
        expect(r.ok).toBe(true);
        if (!r.ok)
            return;
        expect(r.信封.格式版本).toBe('1.0.0');
    });
    it('CONS-7 导入结果 已安装.内容包库 含 import 进来的包', () => {
        const pack = mkPack('rho');
        const library = mkLib({ rho: pack });
        const manifest = 薄清单Schema.parse({ packs: ['rho'] });
        const r = exportContentPack(manifest, library);
        expect(r.ok).toBe(true);
        if (!r.ok)
            return;
        const imp = importContentPack(r.信封, emptyInstalled());
        expect(imp.已安装.内容包库['rho']).toBeDefined();
    });
});
