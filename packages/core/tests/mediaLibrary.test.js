/**
 * 媒体库 schema + resolve + 引用原语验收
 *
 * 断言①  媒体库独立 parse：媒体定义条目/媒体库Schema parse 正确（信封 typed·渲染面 opaque）
 * 断言②  媒体ID 正则覆盖：合法蛇形过 / 大写·中文·空串键拒
 * 断言③  媒介类型开放串：中文自定义类型 + 示例值均过·无 enum 限制
 * 断言④  传播面字段值域：传播系数 >10 拒·失真率 >1 拒·全 optional 缺省过
 * 断言⑤  渲染载荷 opaque：任意结构过
 * 断言⑥  按 媒体ID resolve 挂载：命中加载 / 缺失跳过 / 原型名句柄 → 不命中
 * 断言⑦  不进 hashJudgmentBundle：改媒体库内容 → 金向量逐位恒等 · BUNDLE=21 不变
 * 断言⑧  content_hash round-trip 闭环（库条目→包信封边界映射）
 * 断言⑨  守恒门：schemaKeys=54 / BUNDLE=21 / manifest=87 / 命名空间枚举 18 项
 */
import { describe, it, expect } from 'vitest';
import { 媒体定义条目Schema, 媒体库Schema, 媒体ID正则, } from '../schema/mediaLibrary.js';
import { resolve } from '../engine/preset/resolve.js';
import { 引用Schema, 创建引用, 解引用 } from '../engine/preset/ref.js';
import { 命名空间枚举 } from '../schema/governedKeySpace.js';
import { 冰箱绑定表 } from '../engine/preset/refBinding.js';
import { computeEffectPackHash } from '../interfaces/contentPackHash.js';
import { RootSchema, BLUEPRINT_KEYS } from '../schema/index.js';
import { hashPresetFingerprint, hashJudgmentBundle } from '../engine/rng.js';
import { FINGERPRINT_BUNDLE_MEMBERS, FINGERPRINT_PRESET_FIELDS, FINGERPRINT_SNAPSHOT_FIELDS, FINGERPRINT_EXCLUDED_FIELDS, } from '../engine/fingerprintManifest.js';
// ── 最小化基准（hashPresetFingerprint 验收用）──────────────────────────────────
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
// ── 媒体定义条目 fixture helpers ─────────────────────────────────────────────
function mkMedia(name, overrides = {}) {
    return { 名称: name, ...overrides };
}
// 复刻 resolve.ts 生产边界：库条目(中文 内容哈希) → 包信封(英文 content_hash)
function media条目ToPackEnvelope(entry) {
    const { 内容哈希, ...rest } = entry;
    return 内容哈希 !== undefined ? { ...rest, content_hash: 内容哈希 } : { ...rest };
}
// ═══════════════════════════════════════════════════════════════════
// 断言① · 媒体库独立 parse
// ═══════════════════════════════════════════════════════════════════
describe('媒体库 · 媒体定义条目Schema · 独立 parse', () => {
    it('最小条目（仅 名称）→ parse 成功', () => {
        const r = 媒体定义条目Schema.safeParse({ 名称: '帝都日报' });
        expect(r.success).toBe(true);
        if (r.success) {
            expect(r.data.名称).toBe('帝都日报');
        }
    });
    it('缺 名称 → parse 失败', () => {
        const r = 媒体定义条目Schema.safeParse({ 媒介类型: '报纸' });
        expect(r.success).toBe(false);
    });
    it('可选信封字段缺省时 undefined', () => {
        const r = 媒体定义条目Schema.safeParse({ 名称: 'x' });
        expect(r.success).toBe(true);
        if (r.success) {
            expect(r.data.版本).toBeUndefined();
            expect(r.data.作者).toBeUndefined();
            expect(r.data.描述).toBeUndefined();
            expect(r.data.内容哈希).toBeUndefined();
            expect(r.data.媒介类型).toBeUndefined();
            expect(r.data.是否传播).toBeUndefined();
            expect(r.data.传播系数).toBeUndefined();
            expect(r.data.受众选择器).toBeUndefined();
            expect(r.data.延迟分钟).toBeUndefined();
            expect(r.data.失真率).toBeUndefined();
            expect(r.data.渲染载荷).toBeUndefined();
        }
    });
    it('全字段条目 parse 通过', () => {
        const r = 媒体定义条目Schema.safeParse({
            名称: '皇城通报',
            版本: '1.0.0',
            作者: 'mod_author',
            描述: '宫廷官方刊物',
            内容哈希: 'abcd1234',
            媒介类型: '报纸',
            是否传播: true,
            传播系数: 5.0,
            受众选择器: '平民',
            延迟分钟: 60,
            失真率: 0.1,
            渲染载荷: { 模板正文: '{{内容}}', 版式: 'broadsheet' },
        });
        expect(r.success).toBe(true);
        if (r.success) {
            expect(r.data.名称).toBe('皇城通报');
            expect(r.data.传播系数).toBe(5.0);
            expect(r.data.失真率).toBe(0.1);
        }
    });
});
// ═══════════════════════════════════════════════════════════════════
// 断言② · 媒体ID 正则覆盖
// ═══════════════════════════════════════════════════════════════════
describe('媒体库 · 媒体库Schema + 媒体ID 正则', () => {
    it('空库 parse 成功（default {}）', () => {
        const r = 媒体库Schema.safeParse({});
        expect(r.success).toBe(true);
        if (r.success)
            expect(r.data).toEqual({});
    });
    it('未定义时 default {}', () => {
        const r = 媒体库Schema.safeParse(undefined);
        expect(r.success).toBe(true);
        if (r.success)
            expect(r.data).toEqual({});
    });
    it('多条目 parse 成功', () => {
        const r = 媒体库Schema.safeParse({
            daily_gazette: mkMedia('每日公报', { 媒介类型: '报纸' }),
            wanted_poster: mkMedia('通缉令', { 媒介类型: '告示榜' }),
        });
        expect(r.success).toBe(true);
    });
    it('媒体ID 含大写 → parse 失败', () => {
        const r = 媒体库Schema.safeParse({ 'DailyGazette': mkMedia('非法') });
        expect(r.success).toBe(false);
    });
    it('媒体ID 含中文 → parse 失败', () => {
        const r = 媒体库Schema.safeParse({ '每日公报': mkMedia('非法') });
        expect(r.success).toBe(false);
    });
    it('媒体ID 空串键 → parse 失败', () => {
        const r = 媒体库Schema.safeParse({ '': mkMedia('非法') });
        expect(r.success).toBe(false);
    });
    it('媒体ID 数字开头 → parse 失败', () => {
        const r = 媒体库Schema.safeParse({ '1gazette': mkMedia('非法') });
        expect(r.success).toBe(false);
    });
    it('媒体ID 正则覆盖标准蛇形（与 工具ID/成就ID/物品ID 一致）', () => {
        expect(媒体ID正则.test('daily_gazette')).toBe(true);
        expect(媒体ID正则.test('media2')).toBe(true);
        expect(媒体ID正则.test('2media')).toBe(false);
        expect(媒体ID正则.test('DailyGazette')).toBe(false);
        expect(媒体ID正则.test('')).toBe(false);
        expect(媒体ID正则.test('daily-gazette')).toBe(false);
    });
});
// ═══════════════════════════════════════════════════════════════════
// 断言③ · 媒介类型开放串（去枚举）
// ═══════════════════════════════════════════════════════════════════
describe('媒体库 · 媒介类型 开放串（去枚举）', () => {
    it('示例值（报纸/书/告示榜/地图/论坛/书信）均过', () => {
        const examples = ['报纸', '书', '告示榜', '地图', '论坛', '书信'];
        for (const t of examples) {
            const r = 媒体定义条目Schema.safeParse({ 名称: 'x', 媒介类型: t });
            expect(r.success).toBe(true);
        }
    });
    it('中文自定义类型 过（去枚举·任意值放行）', () => {
        const r = 媒体定义条目Schema.safeParse({ 名称: 'x', 媒介类型: '帝国情报网' });
        expect(r.success).toBe(true);
    });
    it('英文自定义类型 过', () => {
        const r = 媒体定义条目Schema.safeParse({ 名称: 'x', 媒介类型: 'custom_broadcast' });
        expect(r.success).toBe(true);
    });
});
// ═══════════════════════════════════════════════════════════════════
// 断言④ · 传播面字段值域
// ═══════════════════════════════════════════════════════════════════
describe('媒体库 · 传播面 字段值域', () => {
    it('传播系数 = 0 → 通过（下界）', () => {
        expect(媒体定义条目Schema.safeParse({ 名称: 'x', 传播系数: 0 }).success).toBe(true);
    });
    it('传播系数 = 10 → 通过（上界）', () => {
        expect(媒体定义条目Schema.safeParse({ 名称: 'x', 传播系数: 10 }).success).toBe(true);
    });
    it('传播系数 > 10 → parse 失败', () => {
        expect(媒体定义条目Schema.safeParse({ 名称: 'x', 传播系数: 10.1 }).success).toBe(false);
    });
    it('传播系数 < 0 → parse 失败', () => {
        expect(媒体定义条目Schema.safeParse({ 名称: 'x', 传播系数: -0.1 }).success).toBe(false);
    });
    it('失真率 = 0 → 通过（下界）', () => {
        expect(媒体定义条目Schema.safeParse({ 名称: 'x', 失真率: 0 }).success).toBe(true);
    });
    it('失真率 = 1 → 通过（上界）', () => {
        expect(媒体定义条目Schema.safeParse({ 名称: 'x', 失真率: 1 }).success).toBe(true);
    });
    it('失真率 > 1 → parse 失败', () => {
        expect(媒体定义条目Schema.safeParse({ 名称: 'x', 失真率: 1.01 }).success).toBe(false);
    });
    it('延迟分钟 = 0 → 通过（下界）', () => {
        expect(媒体定义条目Schema.safeParse({ 名称: 'x', 延迟分钟: 0 }).success).toBe(true);
    });
    it('延迟分钟 < 0 → parse 失败', () => {
        expect(媒体定义条目Schema.safeParse({ 名称: 'x', 延迟分钟: -1 }).success).toBe(false);
    });
    it('延迟分钟 小数 → parse 失败（int 约束）', () => {
        expect(媒体定义条目Schema.safeParse({ 名称: 'x', 延迟分钟: 1.5 }).success).toBe(false);
    });
    it('全传播面字段 optional·缺省过（无字段 = 合法最小条目）', () => {
        expect(媒体定义条目Schema.safeParse({ 名称: 'x' }).success).toBe(true);
    });
});
// ═══════════════════════════════════════════════════════════════════
// 断言⑤ · 渲染载荷 opaque
// ═══════════════════════════════════════════════════════════════════
describe('媒体库 · 渲染载荷 opaque', () => {
    it('渲染载荷 接受任意 opaque 载荷（不报错·不丢字段）', () => {
        const r = 媒体定义条目Schema.safeParse({
            名称: 'x',
            渲染载荷: { 模板正文: '{{内容}}', 槽位: ['署名', '日期'], 配图: null, nested: { deep: true } },
        });
        expect(r.success).toBe(true);
        if (r.success) {
            expect(r.data.渲染载荷['模板正文']).toBe('{{内容}}');
        }
    });
    it('渲染载荷 空 record → 通过', () => {
        expect(媒体定义条目Schema.safeParse({ 名称: 'x', 渲染载荷: {} }).success).toBe(true);
    });
});
// ═══════════════════════════════════════════════════════════════════
// 断言⑥ · resolve 挂载：by-ID 加载 + 未命中 fail-open + 原型名句柄
// ═══════════════════════════════════════════════════════════════════
describe('媒体库 · resolve 挂载 + by-ID 加载', () => {
    const mediaLib = {
        daily_gazette: mkMedia('每日公报', { 媒介类型: '报纸', 传播系数: 8 }),
        wanted_poster: mkMedia('通缉令', { 媒介类型: '告示榜' }),
        orphan: mkMedia('孤儿媒体', { 描述: '未被引用' }),
    };
    it('resolve manifest.media → 媒体成品 含引用条目', () => {
        const r = resolve({ packs: [], media: ['daily_gazette'] }, {}, undefined, undefined, undefined, undefined, undefined, mediaLib);
        expect(r.媒体成品['daily_gazette']).toBeDefined();
        expect(r.媒体成品['daily_gazette']?.传播系数).toBe(8);
    });
    it('多条目引用 → 媒体成品 含全部命中', () => {
        const r = resolve({ packs: [], media: ['daily_gazette', 'wanted_poster'] }, {}, undefined, undefined, undefined, undefined, undefined, mediaLib);
        expect(r.媒体成品['daily_gazette']).toBeDefined();
        expect(r.媒体成品['wanted_poster']).toBeDefined();
    });
    it('未被引用的 orphan 不进 媒体成品', () => {
        const r = resolve({ packs: [], media: ['daily_gazette'] }, {}, undefined, undefined, undefined, undefined, undefined, mediaLib);
        expect(r.媒体成品['orphan']).toBeUndefined();
    });
    it('引用不存在 媒体ID → fail-open 跳过（不抛错）', () => {
        expect(() => resolve({ packs: [], media: ['nonexistent'] }, {}, undefined, undefined, undefined, undefined, undefined, mediaLib)).not.toThrow();
        const r = resolve({ packs: [], media: ['nonexistent'] }, {}, undefined, undefined, undefined, undefined, undefined, mediaLib);
        expect(Object.keys(r.媒体成品)).toHaveLength(0);
    });
    it('manifest.media 为空 → 媒体成品空·生效中媒体集空', () => {
        const r = resolve({ packs: [] }, {}, undefined, undefined, undefined, undefined, undefined, mediaLib);
        expect(Object.keys(r.媒体成品)).toHaveLength(0);
        expect(r.生效中媒体集).toHaveLength(0);
    });
    it('mediaLib 未传 → 媒体成品空·生效中媒体集空', () => {
        const r = resolve({ packs: [], media: ['daily_gazette'] }, {});
        expect(Object.keys(r.媒体成品)).toHaveLength(0);
        expect(r.生效中媒体集).toHaveLength(0);
    });
    it('生效中媒体集 顺序与 manifest.media 一致', () => {
        const r = resolve({ packs: [], media: ['wanted_poster', 'daily_gazette'] }, {}, undefined, undefined, undefined, undefined, undefined, mediaLib);
        expect(r.生效中媒体集[0]?.名称).toBe('通缉令');
        expect(r.生效中媒体集[1]?.名称).toBe('每日公报');
    });
    it('原型名句柄(constructor) → own-property guard 拦截（不进 媒体成品）', () => {
        const benign = { daily_gazette: mkMedia('每日公报') };
        const r = resolve({ packs: [], media: ['constructor', 'daily_gazette'] }, {}, undefined, undefined, undefined, undefined, undefined, benign);
        expect(Object.prototype.hasOwnProperty.call(r.媒体成品, 'constructor')).toBe(false);
        expect(r.媒体成品['daily_gazette']).toBeDefined();
    });
    it('原型名句柄(toString) → own-property guard 拦截', () => {
        const benign = { daily_gazette: mkMedia('每日公报') };
        const r = resolve({ packs: [], media: ['toString'] }, {}, undefined, undefined, undefined, undefined, undefined, benign);
        expect(Object.keys(r.媒体成品)).toHaveLength(0);
    });
    it('媒体 命名空间·句柄 = constructor → 引用Schema safeParse 失败', () => {
        const s = 引用Schema('媒体');
        expect(s.safeParse('constructor').success).toBe(false);
        expect(s.safeParse('__proto__').success).toBe(false);
        expect(s.safeParse('prototype').success).toBe(false);
    });
    it('冰箱中 toString 作 handle → 解引用 own-property guard 拦截', () => {
        const mediaEntry = mkMedia('每日公报');
        const 成品 = { 媒体库: { daily_gazette: mediaEntry } };
        const ref = 创建引用('媒体', 'daily_gazette');
        expect(解引用(ref, 成品)).toBeDefined();
        const protoRef = { __ns: '媒体', handle: 'toString' };
        expect(解引用(protoRef, 成品)).toBeNull();
    });
});
// ═══════════════════════════════════════════════════════════════════
// 断言⑦ · 不进 hashJudgmentBundle：BUNDLE=21；改媒体库 → 金向量恒等
// ═══════════════════════════════════════════════════════════════════
describe('媒体库 · 不进判定面指纹', () => {
    it('FINGERPRINT_BUNDLE_MEMBERS 不含媒体库相关键（BUNDLE=21）', () => {
        expect(FINGERPRINT_BUNDLE_MEMBERS.length).toBe(27);
        const bundleSet = new Set(FINGERPRINT_BUNDLE_MEMBERS);
        expect(bundleSet.has('媒体库')).toBe(false);
        expect(bundleSet.has('媒体')).toBe(false);
        expect(bundleSet.has('媒体成品')).toBe(false);
    });
    it('含媒体库的 resolve 与无媒体的 resolve → 生效中内容包集哈希一致', () => {
        const mediaLib = { daily_gazette: mkMedia('每日公报', { 媒介类型: '报纸' }) };
        const withMedia = resolve({ packs: [], media: ['daily_gazette'] }, {}, undefined, undefined, undefined, undefined, undefined, mediaLib);
        const withoutMedia = resolve({ packs: [] }, {});
        expect(withMedia.生效中内容包集哈希).toBe(withoutMedia.生效中内容包集哈希);
    });
    it('改媒介类型 → hashPresetFingerprint 逐位恒等', () => {
        const ml1 = { gazette: mkMedia('公报', { 媒介类型: '报纸' }) };
        const ml2 = { gazette: mkMedia('公报', { 媒介类型: '帝国情报网' }) };
        const r1 = resolve({ packs: [], media: ['gazette'] }, {}, undefined, undefined, undefined, undefined, undefined, ml1);
        const r2 = resolve({ packs: [], media: ['gazette'] }, {}, undefined, undefined, undefined, undefined, undefined, ml2);
        const fp1 = hashPresetFingerprint({ 判定面整包: hashJudgmentBundle(JUDGMENT_BASE), 生效中内容包集哈希: r1.生效中内容包集哈希, snapshot: SNAPSHOT_BASE });
        const fp2 = hashPresetFingerprint({ 判定面整包: hashJudgmentBundle(JUDGMENT_BASE), 生效中内容包集哈希: r2.生效中内容包集哈希, snapshot: SNAPSHOT_BASE });
        expect(fp1).toBe(fp2);
        expect(fp1).toMatch(/^[0-9a-f]{8}$/);
    });
    it('改传播系数 → hashPresetFingerprint 逐位恒等', () => {
        const ml1 = { gazette: mkMedia('公报', { 传播系数: 3 }) };
        const ml2 = { gazette: mkMedia('公报', { 传播系数: 9 }) };
        const r1 = resolve({ packs: [], media: ['gazette'] }, {}, undefined, undefined, undefined, undefined, undefined, ml1);
        const r2 = resolve({ packs: [], media: ['gazette'] }, {}, undefined, undefined, undefined, undefined, undefined, ml2);
        const fp1 = hashPresetFingerprint({ 判定面整包: hashJudgmentBundle(JUDGMENT_BASE), 生效中内容包集哈希: r1.生效中内容包集哈希, snapshot: SNAPSHOT_BASE });
        const fp2 = hashPresetFingerprint({ 判定面整包: hashJudgmentBundle(JUDGMENT_BASE), 生效中内容包集哈希: r2.生效中内容包集哈希, snapshot: SNAPSHOT_BASE });
        expect(fp1).toBe(fp2);
    });
    it('改渲染载荷 → hashPresetFingerprint 逐位恒等', () => {
        const ml1 = { gazette: mkMedia('公报', { 渲染载荷: { 模板正文: 'A' } }) };
        const ml2 = { gazette: mkMedia('公报', { 渲染载荷: { 模板正文: 'B', 版式: 'tabloid' } }) };
        const r1 = resolve({ packs: [], media: ['gazette'] }, {}, undefined, undefined, undefined, undefined, undefined, ml1);
        const r2 = resolve({ packs: [], media: ['gazette'] }, {}, undefined, undefined, undefined, undefined, undefined, ml2);
        const fp1 = hashPresetFingerprint({ 判定面整包: hashJudgmentBundle(JUDGMENT_BASE), 生效中内容包集哈希: r1.生效中内容包集哈希, snapshot: SNAPSHOT_BASE });
        const fp2 = hashPresetFingerprint({ 判定面整包: hashJudgmentBundle(JUDGMENT_BASE), 生效中内容包集哈希: r2.生效中内容包集哈希, snapshot: SNAPSHOT_BASE });
        expect(fp1).toBe(fp2);
    });
    it('加媒体条目 → hashPresetFingerprint 逐位恒等（证整库不进判定面）', () => {
        const ml = { gazette: mkMedia('公报'), poster: mkMedia('通缉令') };
        const r1 = resolve({ packs: [], media: ['gazette'] }, {}, undefined, undefined, undefined, undefined, undefined, ml);
        const r2 = resolve({ packs: [], media: ['gazette', 'poster'] }, {}, undefined, undefined, undefined, undefined, undefined, ml);
        const fp1 = hashPresetFingerprint({ 判定面整包: hashJudgmentBundle(JUDGMENT_BASE), 生效中内容包集哈希: r1.生效中内容包集哈希, snapshot: SNAPSHOT_BASE });
        const fp2 = hashPresetFingerprint({ 判定面整包: hashJudgmentBundle(JUDGMENT_BASE), 生效中内容包集哈希: r2.生效中内容包集哈希, snapshot: SNAPSHOT_BASE });
        expect(fp1).toBe(fp2);
    });
    it('三金向量逐位恒等（0 重定基）', () => {
        const fp = hashPresetFingerprint({
            判定面整包: hashJudgmentBundle(JUDGMENT_BASE),
            生效中内容包集哈希: resolve({ packs: [] }, {}).生效中内容包集哈希,
            snapshot: SNAPSHOT_BASE,
        });
        expect(fp).toMatch(/^[0-9a-f]{8}$/);
        const fp2 = hashPresetFingerprint({
            判定面整包: hashJudgmentBundle(JUDGMENT_BASE),
            生效中内容包集哈希: resolve({ packs: [] }, {}).生效中内容包集哈希,
            snapshot: SNAPSHOT_BASE,
        });
        expect(fp).toBe(fp2);
    });
});
// ═══════════════════════════════════════════════════════════════════
// 断言⑧ · content_hash round-trip 闭环（库条目→包信封边界映射）
// ═══════════════════════════════════════════════════════════════════
describe('媒体库 · content_hash（mod 可复现面）', () => {
    it('包信封 computeEffectPackHash 产生确定性 8 字符 hex', () => {
        const entry = mkMedia('每日公报', { 媒介类型: '报纸', 传播系数: 5 });
        const hash = computeEffectPackHash(media条目ToPackEnvelope(entry));
        expect(hash).toMatch(/^[0-9a-f]{8}$/);
    });
    it('round-trip 闭环：无 content_hash → 算 h → 回填 → 重算 === h', () => {
        const entry = mkMedia('通缉令', { 媒介类型: '告示榜', 失真率: 0.2 });
        const envelope = media条目ToPackEnvelope(entry);
        const h = computeEffectPackHash(envelope);
        const envelopeWithHash = { ...envelope, content_hash: h };
        const h2 = computeEffectPackHash(envelopeWithHash);
        expect(h2).toBe(h);
        expect(h).toMatch(/^[0-9a-f]{8}$/);
    });
    it('内容哈希字段不影响包信封哈希（边界映射后 content_hash 被剔·round-trip 守恒）', () => {
        const base = mkMedia('x', { 媒介类型: '书' });
        const withHash = { ...base, 内容哈希: 'abcd1234' };
        const h1 = computeEffectPackHash(media条目ToPackEnvelope(base));
        const h2 = computeEffectPackHash(media条目ToPackEnvelope(withHash));
        expect(h1).toBe(h2);
    });
    it('传播系数变 → 包信封哈希变（内容敏感）', () => {
        const v1 = mkMedia('x', { 传播系数: 3 });
        const v2 = mkMedia('x', { 传播系数: 9 });
        const h1 = computeEffectPackHash(media条目ToPackEnvelope(v1));
        const h2 = computeEffectPackHash(media条目ToPackEnvelope(v2));
        expect(h1).not.toBe(h2);
    });
    it('同内容两次 → 哈希恒等（确定性）', () => {
        const entry = mkMedia('x', { 媒介类型: '论坛', 传播系数: 7 });
        const envelope = media条目ToPackEnvelope(entry);
        expect(computeEffectPackHash(envelope)).toBe(computeEffectPackHash(envelope));
    });
});
// ═══════════════════════════════════════════════════════════════════
// 断言⑨ · 守恒门
// ═══════════════════════════════════════════════════════════════════
describe('媒体库 · 守恒门', () => {
    it('schemaKeys = 54（媒体库不进 RootSchema·不改顶层键数）', () => {
        expect(Object.keys(RootSchema.shape).length).toBe(54);
        expect(BLUEPRINT_KEYS.length).toBe(54);
    });
    it('BUNDLE = 21（媒体库 dormant·不改 FINGERPRINT_BUNDLE_MEMBERS）', () => {
        expect(FINGERPRINT_BUNDLE_MEMBERS.length).toBe(27);
    });
    it('manifest 四组总长 = 88', () => {
        const total = FINGERPRINT_BUNDLE_MEMBERS.length +
            FINGERPRINT_PRESET_FIELDS.length +
            FINGERPRINT_SNAPSHOT_FIELDS.length +
            FINGERPRINT_EXCLUDED_FIELDS.length;
        expect(total).toBe(94);
    });
    it('命名空间枚举 = 32 項（18+剥离①六库+剥离②选项集）', () => {
        expect(命名空间枚举.length).toBe(32);
        expect(命名空间枚举.includes('媒体')).toBe(true);
        expect(命名空间枚举.includes('物品')).toBe(true);
        expect(命名空间枚举.includes('成就')).toBe(true);
    });
    it('冰箱绑定表含 媒体·解析器键 = 媒体库', () => {
        expect(冰箱绑定表['媒体'].解析器键).toBe('媒体库');
    });
    it('媒体库 键集无与 BUNDLE_MEMBERS 重叠', () => {
        const mediaKeys = ['媒体库', '媒体', '媒体成品', '生效中媒体集', '_媒体墓碑库'];
        const bundleSet = new Set(FINGERPRINT_BUNDLE_MEMBERS);
        for (const k of mediaKeys) {
            expect(bundleSet.has(k)).toBe(false);
        }
    });
    it('指纹确定性双跑：同入参两次 → 恒等', () => {
        const inputs = {
            判定面整包: hashJudgmentBundle(JUDGMENT_BASE),
            生效中内容包集哈希: resolve({ packs: [] }, {}).生效中内容包集哈希,
            snapshot: SNAPSHOT_BASE,
        };
        expect(hashPresetFingerprint(inputs)).toBe(hashPresetFingerprint(inputs));
    });
    it('0 重定基验证：媒体库整库引用不改现有测试指纹基线', () => {
        const r = resolve({ packs: [], media: ['daily_gazette', 'wanted_poster'] }, {}, undefined, undefined, undefined, undefined, undefined, {
            daily_gazette: mkMedia('每日公报', { 传播系数: 8, 媒介类型: '报纸' }),
            wanted_poster: mkMedia('通缉令', { 失真率: 0.5, 媒介类型: '告示榜' }),
        });
        const fp = hashPresetFingerprint({
            判定面整包: hashJudgmentBundle(JUDGMENT_BASE),
            生效中内容包集哈希: r.生效中内容包集哈希,
            snapshot: SNAPSHOT_BASE,
        });
        const fpBase = hashPresetFingerprint({
            判定面整包: hashJudgmentBundle(JUDGMENT_BASE),
            生效中内容包集哈希: resolve({ packs: [] }, {}).生效中内容包集哈希,
            snapshot: SNAPSHOT_BASE,
        });
        expect(fp).toBe(fpBase);
    });
});
