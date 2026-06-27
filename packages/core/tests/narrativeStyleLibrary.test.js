/**
 * 文风库（冰箱）schema + resolve + 引用原语验收
 *
 * 断言①  文风库独立 parse：文风定义条目/文风冰箱Schema parse 正确（信封 typed·渲染面 opaque）
 * 断言②  文风ID 正则覆盖：合法蛇形过 / 大写·中文·空串键拒
 * 断言③  渲染载荷 opaque：任意结构过
 * 断言④  按 文风ID resolve 挂载：命中加载 / 缺失跳过 / 原型名句柄 → 不命中
 * 断言⑤  不进 hashJudgmentBundle：改文风库内容 → 金向量逐位恒等 · BUNDLE=21 不变
 * 断言⑥  content_hash round-trip 闭环
 * 断言⑦  守恒门：schemaKeys=53 / BUNDLE=21 / manifest=86 / 命名空间枚举 24 项
 */
import { describe, it, expect } from 'vitest';
import { 文风定义条目Schema, 文风冰箱Schema, 文风ID正则, } from '../schema/narrativeStyleLibrary.js';
import { resolve } from '../engine/preset/resolve.js';
import { 引用Schema, 创建引用, 解引用 } from '../engine/preset/ref.js';
import { 命名空间枚举 } from '../schema/governedKeySpace.js';
import { 冰箱绑定表 } from '../engine/preset/refBinding.js';
import { computeEffectPackHash } from '../interfaces/contentPackHash.js';
import { RootSchema, BLUEPRINT_KEYS } from '../schema/index.js';
import { hashPresetFingerprint, hashJudgmentBundle } from '../engine/rng.js';
import { FINGERPRINT_BUNDLE_MEMBERS, FINGERPRINT_PRESET_FIELDS, FINGERPRINT_SNAPSHOT_FIELDS, FINGERPRINT_EXCLUDED_FIELDS, } from '../engine/fingerprintManifest.js';
const SNAPSHOT_BASE = {
    难度系数组: {},
    判定骰型: 100,
    暴击映射: '关',
    钳制表: {},
    预设数值面域上下界: {},
};
const JUDGMENT_BASE = {
    历法皮肤: {},
    粒度模板覆盖: {},
    种族模板: {},
    母题配额: {},
    媒体渠道表: {},
    检定配方表: {},
    检定档切分表: {},
    欠债参数: {},
    赛事结构模板: {},
    派生量配方: {},
    概率域夹逼: {},
    纠缠闭包弱边阈值: 0.2,
};
function mkStyle(name, overrides = {}) {
    return { 名称: name, ...overrides };
}
function 条目ToPackEnvelope(entry) {
    const { 内容哈希, ...rest } = entry;
    return 内容哈希 !== undefined ? { ...rest, content_hash: 内容哈希 } : { ...rest };
}
describe('文风库 · 文风定义条目Schema · 独立 parse', () => {
    it('最小条目（仅 名称）→ parse 成功', () => {
        const r = 文风定义条目Schema.safeParse({ 名称: '古典文言风' });
        expect(r.success).toBe(true);
        if (r.success)
            expect(r.data.名称).toBe('古典文言风');
    });
    it('缺 名称 → parse 失败', () => {
        expect(文风定义条目Schema.safeParse({ 渲染载荷: {} }).success).toBe(false);
    });
    it('可选字段缺省时 undefined', () => {
        const r = 文风定义条目Schema.safeParse({ 名称: 'x' });
        expect(r.success).toBe(true);
        if (r.success) {
            expect(r.data.版本).toBeUndefined();
            expect(r.data.作者).toBeUndefined();
            expect(r.data.描述).toBeUndefined();
            expect(r.data.内容哈希).toBeUndefined();
            expect(r.data.渲染载荷).toBeUndefined();
        }
    });
    it('全字段条目 parse 通过', () => {
        const r = 文风定义条目Schema.safeParse({
            名称: '古典文言风',
            版本: '1.0.0',
            作者: 'mod_author',
            描述: '文言文叙事风格',
            内容哈希: 'abcd1234',
            渲染载荷: { 风格提示词: '以文言文叙述', 禁词: ['俚语'], 默认开: true },
        });
        expect(r.success).toBe(true);
        if (r.success) {
            expect(r.data.名称).toBe('古典文言风');
        }
    });
});
describe('文风库 · 文风冰箱Schema + ID 正则', () => {
    it('空库 parse 成功', () => {
        expect(文风冰箱Schema.safeParse({}).success).toBe(true);
    });
    it('未定义时 default {}', () => {
        const r = 文风冰箱Schema.safeParse(undefined);
        expect(r.success).toBe(true);
        if (r.success)
            expect(r.data).toEqual({});
    });
    it('多条目 parse 成功', () => {
        expect(文风冰箱Schema.safeParse({
            classical_style: mkStyle('文言风', { 渲染载荷: { 提示词: '文言叙述' } }),
            modern_style: mkStyle('现代风', { 渲染载荷: { 提示词: '口语化' } }),
        }).success).toBe(true);
    });
    it('ID 含大写 → parse 失败', () => {
        expect(文风冰箱Schema.safeParse({ 'ClassicalStyle': mkStyle('非法') }).success).toBe(false);
    });
    it('ID 含中文 → parse 失败', () => {
        expect(文风冰箱Schema.safeParse({ '文言风': mkStyle('非法') }).success).toBe(false);
    });
    it('ID 空串 → parse 失败', () => {
        expect(文风冰箱Schema.safeParse({ '': mkStyle('非法') }).success).toBe(false);
    });
    it('ID 数字开头 → parse 失败', () => {
        expect(文风冰箱Schema.safeParse({ '1style': mkStyle('非法') }).success).toBe(false);
    });
    it('ID 含连字符 → parse 失败', () => {
        expect(文风冰箱Schema.safeParse({ 'classical-style': mkStyle('非法') }).success).toBe(false);
    });
    it('ID 正则标准蛇形', () => {
        expect(文风ID正则.test('classical_style')).toBe(true);
        expect(文风ID正则.test('style2')).toBe(true);
        expect(文风ID正则.test('2style')).toBe(false);
        expect(文风ID正则.test('')).toBe(false);
        expect(文风ID正则.test('ClassicalStyle')).toBe(false);
    });
});
describe('文风库 · 渲染载荷 opaque', () => {
    it('渲染载荷 接受任意 opaque 载荷', () => {
        const r = 文风定义条目Schema.safeParse({
            名称: 'x',
            渲染载荷: { 风格提示词: '以文言文叙述', 禁词: ['俚语'], nested: { deep: true }, 数值: 42 },
        });
        expect(r.success).toBe(true);
        if (r.success) {
            expect(r.data.渲染载荷['风格提示词']).toBe('以文言文叙述');
        }
    });
    it('渲染载荷 空 record → 通过', () => {
        expect(文风定义条目Schema.safeParse({ 名称: 'x', 渲染载荷: {} }).success).toBe(true);
    });
});
describe('文风库 · resolve 挂载 + by-ID 加载', () => {
    const styleLib = {
        classical_style: mkStyle('文言风', { 渲染载荷: { 提示词: '古典' } }),
        modern_style: mkStyle('现代风', { 渲染载荷: { 提示词: '口语' } }),
        orphan: mkStyle('孤儿文风', { 描述: '未被引用' }),
    };
    it('resolve manifest.文风 → 文风成品 含引用条目', () => {
        const r = resolve({ packs: [], 文风: ['classical_style'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, styleLib);
        expect(r.文风成品['classical_style']).toBeDefined();
        expect(r.文风成品['classical_style']?.渲染载荷?.['提示词']).toBe('古典');
    });
    it('多条目引用 → 文风成品 含全部命中', () => {
        const r = resolve({ packs: [], 文风: ['classical_style', 'modern_style'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, styleLib);
        expect(r.文风成品['classical_style']).toBeDefined();
        expect(r.文风成品['modern_style']).toBeDefined();
    });
    it('orphan 不进 文风成品', () => {
        const r = resolve({ packs: [], 文风: ['classical_style'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, styleLib);
        expect(r.文风成品['orphan']).toBeUndefined();
    });
    it('引用不存在 → fail-open 跳过', () => {
        const r = resolve({ packs: [], 文风: ['nonexistent'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, styleLib);
        expect(Object.keys(r.文风成品)).toHaveLength(0);
    });
    it('styleLib 未传 → 文风成品空', () => {
        const r = resolve({ packs: [], 文风: ['classical_style'] }, {});
        expect(Object.keys(r.文风成品)).toHaveLength(0);
        expect(r.生效中文风集).toHaveLength(0);
    });
    it('生效中文风集 顺序与 manifest 一致', () => {
        const r = resolve({ packs: [], 文风: ['modern_style', 'classical_style'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, styleLib);
        expect(r.生效中文风集[0]?.名称).toBe('现代风');
        expect(r.生效中文风集[1]?.名称).toBe('文言风');
    });
    it('原型名句柄(constructor) → own-property guard 拦截', () => {
        const r = resolve({ packs: [], 文风: ['constructor', 'classical_style'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, styleLib);
        expect(Object.prototype.hasOwnProperty.call(r.文风成品, 'constructor')).toBe(false);
        expect(r.文风成品['classical_style']).toBeDefined();
    });
    it('原型名句柄(toString) → own-property guard 拦截', () => {
        const r = resolve({ packs: [], 文风: ['toString'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, styleLib);
        expect(Object.keys(r.文风成品)).toHaveLength(0);
    });
    it('文风 命名空间·句柄 = constructor → 引用Schema safeParse 失败', () => {
        const s = 引用Schema('文风');
        expect(s.safeParse('constructor').success).toBe(false);
        expect(s.safeParse('__proto__').success).toBe(false);
    });
    it('冰箱中 toString 作 handle → 解引用 own-property guard 拦截', () => {
        const 成品 = { 文风库: { classical_style: mkStyle('文言风') } };
        expect(解引用(创建引用('文风', 'classical_style'), 成品)).toBeDefined();
        expect(解引用({ __ns: '文风', handle: 'toString' }, 成品)).toBeNull();
    });
});
describe('文风库 · 不进判定面指纹', () => {
    it('FINGERPRINT_BUNDLE_MEMBERS 不含文风库相关键（BUNDLE=21）', () => {
        expect(FINGERPRINT_BUNDLE_MEMBERS.length).toBe(21);
        const bundleSet = new Set(FINGERPRINT_BUNDLE_MEMBERS);
        expect(bundleSet.has('文风库')).toBe(false);
        expect(bundleSet.has('文风')).toBe(false);
        expect(bundleSet.has('文风成品')).toBe(false);
    });
    it('改渲染载荷 → hashPresetFingerprint 逐位恒等', () => {
        const lib1 = { style: mkStyle('x', { 渲染载荷: { 提示词: 'A' } }) };
        const lib2 = { style: mkStyle('x', { 渲染载荷: { 提示词: 'B', 禁词: ['xxx'] } }) };
        const r1 = resolve({ packs: [], 文风: ['style'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, lib1);
        const r2 = resolve({ packs: [], 文风: ['style'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, lib2);
        const fp1 = hashPresetFingerprint({ 判定面整包: hashJudgmentBundle(JUDGMENT_BASE), 生效中内容包集哈希: r1.生效中内容包集哈希, snapshot: SNAPSHOT_BASE });
        const fp2 = hashPresetFingerprint({ 判定面整包: hashJudgmentBundle(JUDGMENT_BASE), 生效中内容包集哈希: r2.生效中内容包集哈希, snapshot: SNAPSHOT_BASE });
        expect(fp1).toBe(fp2);
    });
    it('三金向量逐位恒等（0 重定基）', () => {
        const fp = hashPresetFingerprint({ 判定面整包: hashJudgmentBundle(JUDGMENT_BASE), 生效中内容包集哈希: resolve({ packs: [] }, {}).生效中内容包集哈希, snapshot: SNAPSHOT_BASE });
        const fp2 = hashPresetFingerprint({ 判定面整包: hashJudgmentBundle(JUDGMENT_BASE), 生效中内容包集哈希: resolve({ packs: [] }, {}).生效中内容包集哈希, snapshot: SNAPSHOT_BASE });
        expect(fp).toBe(fp2);
        expect(fp).toMatch(/^[0-9a-f]{8}$/);
    });
});
describe('文风库 · content_hash（mod 可复现面）', () => {
    it('包信封 computeEffectPackHash 产生确定性 8 字符 hex', () => {
        expect(computeEffectPackHash(条目ToPackEnvelope(mkStyle('x', { 渲染载荷: { 提示词: '文言' } })))).toMatch(/^[0-9a-f]{8}$/);
    });
    it('round-trip 闭环', () => {
        const envelope = 条目ToPackEnvelope(mkStyle('x', { 渲染载荷: { 提示词: '古典' } }));
        const h = computeEffectPackHash(envelope);
        expect(computeEffectPackHash({ ...envelope, content_hash: h })).toBe(h);
    });
    it('内容哈希字段不影响包信封哈希', () => {
        const base = mkStyle('x', { 渲染载荷: {} });
        const h1 = computeEffectPackHash(条目ToPackEnvelope(base));
        const h2 = computeEffectPackHash(条目ToPackEnvelope({ ...base, 内容哈希: 'abcd1234' }));
        expect(h1).toBe(h2);
    });
    it('渲染载荷变 → 包信封哈希变', () => {
        const h1 = computeEffectPackHash(条目ToPackEnvelope(mkStyle('x', { 渲染载荷: { 提示词: 'A' } })));
        const h2 = computeEffectPackHash(条目ToPackEnvelope(mkStyle('x', { 渲染载荷: { 提示词: 'B' } })));
        expect(h1).not.toBe(h2);
    });
    it('同内容两次 → 哈希恒等', () => {
        const envelope = 条目ToPackEnvelope(mkStyle('x', { 渲染载荷: { 提示词: '文言' } }));
        expect(computeEffectPackHash(envelope)).toBe(computeEffectPackHash(envelope));
    });
});
describe('文风库 · 守恒门', () => {
    it('schemaKeys = 53', () => {
        expect(Object.keys(RootSchema.shape).length).toBe(53);
        expect(BLUEPRINT_KEYS.length).toBe(53);
    });
    it('BUNDLE = 21', () => {
        expect(FINGERPRINT_BUNDLE_MEMBERS.length).toBe(21);
    });
    it('manifest 四组总长 = 86', () => {
        expect(FINGERPRINT_BUNDLE_MEMBERS.length + FINGERPRINT_PRESET_FIELDS.length + FINGERPRINT_SNAPSHOT_FIELDS.length + FINGERPRINT_EXCLUDED_FIELDS.length).toBe(86);
    });
    it('命名空间枚举 = 32 項（含文风）', () => {
        expect(命名空间枚举.length).toBe(32);
        expect(命名空间枚举.includes('文风')).toBe(true);
    });
    it('冰箱绑定表含 文风·解析器键 = 文风库', () => {
        expect(冰箱绑定表['文风'].解析器键).toBe('文风库');
    });
    it('0 重定基验证', () => {
        const lib = { classical: mkStyle('文言风', { 渲染载荷: { 提示词: '古典' } }) };
        const r = resolve({ packs: [], 文风: ['classical'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, lib);
        const fp = hashPresetFingerprint({ 判定面整包: hashJudgmentBundle(JUDGMENT_BASE), 生效中内容包集哈希: r.生效中内容包集哈希, snapshot: SNAPSHOT_BASE });
        const fpBase = hashPresetFingerprint({ 判定面整包: hashJudgmentBundle(JUDGMENT_BASE), 生效中内容包集哈希: resolve({ packs: [] }, {}).生效中内容包集哈希, snapshot: SNAPSHOT_BASE });
        expect(fp).toBe(fpBase);
    });
});
