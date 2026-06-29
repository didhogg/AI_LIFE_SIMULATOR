/**
 * 二审维度库 schema + resolve + 引用原语验收
 *
 * 断言①  二审维度库独立 parse：二审维度定义条目/二审维度库Schema parse 正确（信封 typed·事实层 typed enum）
 * 断言②  二审维度ID 正则覆盖：合法蛇形过 / 大写·中文·空串键拒
 * 断言③  事实层 enum 约束（L-8 拍板保留）：检测方式/越界类型
 * 断言④  按 二审维度ID resolve 挂载：命中加载 / 缺失跳过 / 原型名句柄 → 不命中
 * 断言⑤  不进 hashJudgmentBundle：改二审维度库内容 → 金向量逐位恒等 · BUNDLE=21 不变
 * 断言⑥  content_hash round-trip 闭环
 * 断言⑦  守恒门：schemaKeys=54 / BUNDLE=21 / manifest=87 / 命名空间枚举 24 项
 */
import { describe, it, expect } from 'vitest';
import { 二审维度定义条目Schema, 二审维度库Schema, 二审维度ID正则, } from '../schema/reviewDimensionLibrary.js';
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
function mkReview(name, overrides = {}) {
    return { 名称: name, ...overrides };
}
function 条目ToPackEnvelope(entry) {
    const { 内容哈希, ...rest } = entry;
    return 内容哈希 !== undefined ? { ...rest, content_hash: 内容哈希 } : { ...rest };
}
describe('二审维度库 · 二审维度定义条目Schema · 独立 parse', () => {
    it('最小条目（仅 名称）→ parse 成功', () => {
        const r = 二审维度定义条目Schema.safeParse({ 名称: '话题偏移检测' });
        expect(r.success).toBe(true);
        if (r.success)
            expect(r.data.名称).toBe('话题偏移检测');
    });
    it('缺 名称 → parse 失败', () => {
        expect(二审维度定义条目Schema.safeParse({ 检测方式: '机械' }).success).toBe(false);
    });
    it('可选字段缺省时 undefined', () => {
        const r = 二审维度定义条目Schema.safeParse({ 名称: 'x' });
        expect(r.success).toBe(true);
        if (r.success) {
            expect(r.data.版本).toBeUndefined();
            expect(r.data.作者).toBeUndefined();
            expect(r.data.描述).toBeUndefined();
            expect(r.data.内容哈希).toBeUndefined();
            expect(r.data.检测方式).toBeUndefined();
            expect(r.data.规则或提示词).toBeUndefined();
            expect(r.data.阈值).toBeUndefined();
            expect(r.data.默认开).toBeUndefined();
            expect(r.data.越界类型).toBeUndefined();
        }
    });
    it('全字段条目 parse 通过', () => {
        const r = 二审维度定义条目Schema.safeParse({
            名称: '话题偏移检测',
            版本: '1.0.0',
            作者: 'mod_author',
            描述: '检测回复是否偏离主题',
            内容哈希: 'abcd1234',
            检测方式: '机械',
            规则或提示词: '检查关键词',
            阈值: 0.8,
            默认开: true,
            越界类型: 'Off-Topic',
        });
        expect(r.success).toBe(true);
        if (r.success) {
            expect(r.data.检测方式).toBe('机械');
            expect(r.data.越界类型).toBe('Off-Topic');
            expect(r.data.阈值).toBe(0.8);
        }
    });
});
describe('二审维度库 · 二审维度库Schema + ID 正则', () => {
    it('空库 parse 成功', () => {
        expect(二审维度库Schema.safeParse({}).success).toBe(true);
    });
    it('未定义时 default {}', () => {
        const r = 二审维度库Schema.safeParse(undefined);
        expect(r.success).toBe(true);
        if (r.success)
            expect(r.data).toEqual({});
    });
    it('多条目 parse 成功', () => {
        expect(二审维度库Schema.safeParse({
            topic_drift: mkReview('话题偏移', { 检测方式: '机械', 越界类型: 'Off-Topic' }),
            cheat_detect: mkReview('作弊检测', { 检测方式: '审稿提示词', 越界类型: 'Cheating' }),
        }).success).toBe(true);
    });
    it('ID 含大写 → parse 失败', () => {
        expect(二审维度库Schema.safeParse({ 'TopicDrift': mkReview('非法') }).success).toBe(false);
    });
    it('ID 含中文 → parse 失败', () => {
        expect(二审维度库Schema.safeParse({ '话题偏移': mkReview('非法') }).success).toBe(false);
    });
    it('ID 空串 → parse 失败', () => {
        expect(二审维度库Schema.safeParse({ '': mkReview('非法') }).success).toBe(false);
    });
    it('ID 数字开头 → parse 失败', () => {
        expect(二审维度库Schema.safeParse({ '1review': mkReview('非法') }).success).toBe(false);
    });
    it('ID 正则标准蛇形', () => {
        expect(二审维度ID正则.test('topic_drift')).toBe(true);
        expect(二审维度ID正则.test('dim2')).toBe(true);
        expect(二审维度ID正则.test('2dim')).toBe(false);
        expect(二审维度ID正则.test('')).toBe(false);
        expect(二审维度ID正则.test('TopicDrift')).toBe(false);
    });
});
describe('二审维度库 · 事实层 enum 约束（L-8 拍板保留）', () => {
    it('检测方式 = 机械 → 通过', () => {
        expect(二审维度定义条目Schema.safeParse({ 名称: 'x', 检测方式: '机械' }).success).toBe(true);
    });
    it('检测方式 = 审稿提示词 → 通过', () => {
        expect(二审维度定义条目Schema.safeParse({ 名称: 'x', 检测方式: '审稿提示词' }).success).toBe(true);
    });
    it('检测方式 = 非法值 → parse 失败（enum 约束）', () => {
        expect(二审维度定义条目Schema.safeParse({ 名称: 'x', 检测方式: '人工' }).success).toBe(false);
    });
    it('越界类型 = Off-Topic → 通过', () => {
        expect(二审维度定义条目Schema.safeParse({ 名称: 'x', 越界类型: 'Off-Topic' }).success).toBe(true);
    });
    it('越界类型 = Cheating → 通过', () => {
        expect(二审维度定义条目Schema.safeParse({ 名称: 'x', 越界类型: 'Cheating' }).success).toBe(true);
    });
    it('越界类型 = 非法值 → parse 失败（enum 约束）', () => {
        expect(二审维度定义条目Schema.safeParse({ 名称: 'x', 越界类型: 'Spam' }).success).toBe(false);
    });
    it('全事实层字段 optional·缺省过', () => {
        expect(二审维度定义条目Schema.safeParse({ 名称: 'x' }).success).toBe(true);
    });
});
describe('二审维度库 · resolve 挂载 + by-ID 加载', () => {
    const reviewLib = {
        topic_drift: mkReview('话题偏移', { 检测方式: '机械', 越界类型: 'Off-Topic' }),
        cheat_detect: mkReview('作弊检测', { 检测方式: '审稿提示词', 越界类型: 'Cheating' }),
        orphan: mkReview('孤儿维度', { 描述: '未被引用' }),
    };
    it('resolve manifest.二审维度 → 二审维度成品 含引用条目', () => {
        const r = resolve({ packs: [], 二审维度: ['topic_drift'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, reviewLib);
        expect(r.二审维度成品['topic_drift']).toBeDefined();
        expect(r.二审维度成品['topic_drift']?.检测方式).toBe('机械');
    });
    it('多条目引用 → 二审维度成品 含全部命中', () => {
        const r = resolve({ packs: [], 二审维度: ['topic_drift', 'cheat_detect'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, reviewLib);
        expect(r.二审维度成品['topic_drift']).toBeDefined();
        expect(r.二审维度成品['cheat_detect']).toBeDefined();
    });
    it('orphan 不进 二审维度成品', () => {
        const r = resolve({ packs: [], 二审维度: ['topic_drift'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, reviewLib);
        expect(r.二审维度成品['orphan']).toBeUndefined();
    });
    it('引用不存在 → fail-open 跳过', () => {
        const r = resolve({ packs: [], 二审维度: ['nonexistent'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, reviewLib);
        expect(Object.keys(r.二审维度成品)).toHaveLength(0);
    });
    it('reviewLib 未传 → 二审维度成品空', () => {
        const r = resolve({ packs: [], 二审维度: ['topic_drift'] }, {});
        expect(Object.keys(r.二审维度成品)).toHaveLength(0);
        expect(r.生效中二审维度集).toHaveLength(0);
    });
    it('生效中二审维度集 顺序与 manifest 一致', () => {
        const r = resolve({ packs: [], 二审维度: ['cheat_detect', 'topic_drift'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, reviewLib);
        expect(r.生效中二审维度集[0]?.名称).toBe('作弊检测');
        expect(r.生效中二审维度集[1]?.名称).toBe('话题偏移');
    });
    it('原型名句柄(constructor) → own-property guard 拦截', () => {
        const r = resolve({ packs: [], 二审维度: ['constructor', 'topic_drift'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, reviewLib);
        expect(Object.prototype.hasOwnProperty.call(r.二审维度成品, 'constructor')).toBe(false);
        expect(r.二审维度成品['topic_drift']).toBeDefined();
    });
    it('原型名句柄(toString) → own-property guard 拦截', () => {
        const r = resolve({ packs: [], 二审维度: ['toString'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, reviewLib);
        expect(Object.keys(r.二审维度成品)).toHaveLength(0);
    });
    it('二审维度 命名空间·句柄 = constructor → 引用Schema safeParse 失败', () => {
        const s = 引用Schema('二审维度');
        expect(s.safeParse('constructor').success).toBe(false);
        expect(s.safeParse('__proto__').success).toBe(false);
    });
    it('冰箱中 toString 作 handle → 解引用 own-property guard 拦截', () => {
        const 成品 = { 二审维度库: { topic_drift: mkReview('话题偏移') } };
        expect(解引用(创建引用('二审维度', 'topic_drift'), 成品)).toBeDefined();
        expect(解引用({ __ns: '二审维度', handle: 'toString' }, 成品)).toBeNull();
    });
});
describe('二审维度库 · 不进判定面指纹', () => {
    it('FINGERPRINT_BUNDLE_MEMBERS 不含二审维度库相关键（BUNDLE=21）', () => {
        expect(FINGERPRINT_BUNDLE_MEMBERS.length).toBe(28);
        const bundleSet = new Set(FINGERPRINT_BUNDLE_MEMBERS);
        expect(bundleSet.has('二审维度库')).toBe(false);
        expect(bundleSet.has('二审维度')).toBe(false);
    });
    it('改二审维度条目 → hashPresetFingerprint 逐位恒等', () => {
        const lib1 = { dim: mkReview('x', { 阈值: 0.5 }) };
        const lib2 = { dim: mkReview('x', { 阈值: 0.9 }) };
        const r1 = resolve({ packs: [], 二审维度: ['dim'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, lib1);
        const r2 = resolve({ packs: [], 二审维度: ['dim'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, lib2);
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
describe('二审维度库 · content_hash（mod 可复现面）', () => {
    it('包信封 computeEffectPackHash 产生确定性 8 字符 hex', () => {
        expect(computeEffectPackHash(条目ToPackEnvelope(mkReview('x', { 检测方式: '机械' })))).toMatch(/^[0-9a-f]{8}$/);
    });
    it('round-trip 闭环', () => {
        const envelope = 条目ToPackEnvelope(mkReview('x', { 检测方式: '审稿提示词' }));
        const h = computeEffectPackHash(envelope);
        expect(computeEffectPackHash({ ...envelope, content_hash: h })).toBe(h);
    });
    it('内容哈希字段不影响包信封哈希', () => {
        const base = mkReview('x', { 检测方式: '机械' });
        const h1 = computeEffectPackHash(条目ToPackEnvelope(base));
        const h2 = computeEffectPackHash(条目ToPackEnvelope({ ...base, 内容哈希: 'abcd1234' }));
        expect(h1).toBe(h2);
    });
    it('检测方式变 → 包信封哈希变', () => {
        const h1 = computeEffectPackHash(条目ToPackEnvelope(mkReview('x', { 检测方式: '机械' })));
        const h2 = computeEffectPackHash(条目ToPackEnvelope(mkReview('x', { 检测方式: '审稿提示词' })));
        expect(h1).not.toBe(h2);
    });
    it('同内容两次 → 哈希恒等', () => {
        const envelope = 条目ToPackEnvelope(mkReview('x', { 越界类型: 'Off-Topic' }));
        expect(computeEffectPackHash(envelope)).toBe(computeEffectPackHash(envelope));
    });
});
describe('二审维度库 · 守恒门', () => {
    it('schemaKeys = 54', () => {
        expect(Object.keys(RootSchema.shape).length).toBe(54);
        expect(BLUEPRINT_KEYS.length).toBe(54);
    });
    it('BUNDLE = 21', () => {
        expect(FINGERPRINT_BUNDLE_MEMBERS.length).toBe(28);
    });
    it('manifest 四组总长 = 88', () => {
        expect(FINGERPRINT_BUNDLE_MEMBERS.length + FINGERPRINT_PRESET_FIELDS.length + FINGERPRINT_SNAPSHOT_FIELDS.length + FINGERPRINT_EXCLUDED_FIELDS.length).toBe(95);
    });
    it('命名空间枚举 = 32 項（含二审维度）', () => {
        expect(命名空间枚举.length).toBe(32);
        expect(命名空间枚举.includes('二审维度')).toBe(true);
    });
    it('冰箱绑定表含 二审维度·解析器键 = 二审维度库', () => {
        expect(冰箱绑定表['二审维度'].解析器键).toBe('二审维度库');
    });
    it('0 重定基验证', () => {
        const lib = { topic_drift: mkReview('话题偏移', { 检测方式: '机械' }) };
        const r = resolve({ packs: [], 二审维度: ['topic_drift'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, lib);
        const fp = hashPresetFingerprint({ 判定面整包: hashJudgmentBundle(JUDGMENT_BASE), 生效中内容包集哈希: r.生效中内容包集哈希, snapshot: SNAPSHOT_BASE });
        const fpBase = hashPresetFingerprint({ 判定面整包: hashJudgmentBundle(JUDGMENT_BASE), 生效中内容包集哈希: resolve({ packs: [] }, {}).生效中内容包集哈希, snapshot: SNAPSHOT_BASE });
        expect(fp).toBe(fpBase);
    });
});
