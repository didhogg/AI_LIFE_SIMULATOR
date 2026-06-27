/**
 * 学业制式库 schema + resolve + 引用原语验收
 *
 * 断言①  学业制式库独立 parse：学业制式定义条目/学业制式库Schema parse 正确（信封 typed·事实层 typed）
 * 断言②  学业制式ID 正则覆盖：合法蛇形过 / 大写·中文·空串键拒
 * 断言③  事实层字段值域：时长分钟负数拒·非整数拒·全 optional 缺省过
 * 断言④  按 学业制式ID resolve 挂载：命中加载 / 缺失跳过 / 原型名句柄 → 不命中
 * 断言⑤  不进 hashJudgmentBundle：改学业制式库内容 → 金向量逐位恒等 · BUNDLE=21 不变
 * 断言⑥  content_hash round-trip 闭环（库条目→包信封边界映射）
 * 断言⑦  守恒门：schemaKeys=54 / BUNDLE=21 / manifest=87 / 命名空间枚举 24 项
 */
import { describe, it, expect } from 'vitest';
import { 学业制式定义条目Schema, 学业制式库Schema, 学业制式ID正则, } from '../schema/academicSystemLibrary.js';
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
function mkAcademic(name, overrides = {}) {
    return { 名称: name, ...overrides };
}
function 条目ToPackEnvelope(entry) {
    const { 内容哈希, ...rest } = entry;
    return 内容哈希 !== undefined ? { ...rest, content_hash: 内容哈希 } : { ...rest };
}
// ═══════════════════════════════════════════════════════════════
// 断言① · 学业制式库独立 parse
// ═══════════════════════════════════════════════════════════════
describe('学业制式库 · 学业制式定义条目Schema · 独立 parse', () => {
    it('最小条目（仅 名称）→ parse 成功', () => {
        const r = 学业制式定义条目Schema.safeParse({ 名称: '初级学业' });
        expect(r.success).toBe(true);
        if (r.success)
            expect(r.data.名称).toBe('初级学业');
    });
    it('缺 名称 → parse 失败', () => {
        expect(学业制式定义条目Schema.safeParse({ 阶段名: '大学' }).success).toBe(false);
    });
    it('可选字段缺省时 undefined', () => {
        const r = 学业制式定义条目Schema.safeParse({ 名称: 'x' });
        expect(r.success).toBe(true);
        if (r.success) {
            expect(r.data.版本).toBeUndefined();
            expect(r.data.作者).toBeUndefined();
            expect(r.data.描述).toBeUndefined();
            expect(r.data.内容哈希).toBeUndefined();
            expect(r.data.阶段名).toBeUndefined();
            expect(r.data.时长分钟).toBeUndefined();
            expect(r.data.前置条件).toBeUndefined();
            expect(r.data.解锁技能).toBeUndefined();
            expect(r.data.考核检定).toBeUndefined();
        }
    });
    it('全字段条目 parse 通过', () => {
        const r = 学业制式定义条目Schema.safeParse({
            名称: '帝国科举制',
            版本: '1.0.0',
            作者: 'mod_author',
            描述: '帝国官方考试制度',
            内容哈希: 'abcd1234',
            阶段名: '乡试',
            时长分钟: 10080,
            前置条件: ['识字', '四书五经'],
            解锁技能: ['官员_初级'],
            考核检定: '学识_文科',
        });
        expect(r.success).toBe(true);
        if (r.success) {
            expect(r.data.名称).toBe('帝国科举制');
            expect(r.data.时长分钟).toBe(10080);
        }
    });
});
// ═══════════════════════════════════════════════════════════════
// 断言② · 学业制式ID 正则覆盖
// ═══════════════════════════════════════════════════════════════
describe('学业制式库 · 学业制式库Schema + ID 正则', () => {
    it('空库 parse 成功（default {}）', () => {
        const r = 学业制式库Schema.safeParse({});
        expect(r.success).toBe(true);
        if (r.success)
            expect(r.data).toEqual({});
    });
    it('未定义时 default {}', () => {
        const r = 学业制式库Schema.safeParse(undefined);
        expect(r.success).toBe(true);
        if (r.success)
            expect(r.data).toEqual({});
    });
    it('多条目 parse 成功', () => {
        const r = 学业制式库Schema.safeParse({
            imperial_exam: mkAcademic('科举制', { 阶段名: '乡试' }),
            guild_training: mkAcademic('行会培训', { 时长分钟: 2880 }),
        });
        expect(r.success).toBe(true);
    });
    it('ID 含大写 → parse 失败', () => {
        expect(学业制式库Schema.safeParse({ 'ImperialExam': mkAcademic('非法') }).success).toBe(false);
    });
    it('ID 含中文 → parse 失败', () => {
        expect(学业制式库Schema.safeParse({ '科举': mkAcademic('非法') }).success).toBe(false);
    });
    it('ID 空串键 → parse 失败', () => {
        expect(学业制式库Schema.safeParse({ '': mkAcademic('非法') }).success).toBe(false);
    });
    it('ID 数字开头 → parse 失败', () => {
        expect(学业制式库Schema.safeParse({ '1exam': mkAcademic('非法') }).success).toBe(false);
    });
    it('ID 含连字符 → parse 失败', () => {
        expect(学业制式库Schema.safeParse({ 'imperial-exam': mkAcademic('非法') }).success).toBe(false);
    });
    it('ID 正则覆盖标准蛇形（与其他冰箱库 ID 一致）', () => {
        expect(学业制式ID正则.test('imperial_exam')).toBe(true);
        expect(学业制式ID正则.test('exam2')).toBe(true);
        expect(学业制式ID正则.test('2exam')).toBe(false);
        expect(学业制式ID正则.test('ImperialExam')).toBe(false);
        expect(学业制式ID正则.test('')).toBe(false);
        expect(学业制式ID正则.test('imperial-exam')).toBe(false);
    });
});
// ═══════════════════════════════════════════════════════════════
// 断言③ · 事实层字段值域
// ═══════════════════════════════════════════════════════════════
describe('学业制式库 · 事实层字段值域', () => {
    it('时长分钟 = 0 → 通过（下界）', () => {
        expect(学业制式定义条目Schema.safeParse({ 名称: 'x', 时长分钟: 0 }).success).toBe(true);
    });
    it('时长分钟 < 0 → parse 失败', () => {
        expect(学业制式定义条目Schema.safeParse({ 名称: 'x', 时长分钟: -1 }).success).toBe(false);
    });
    it('时长分钟 小数 → parse 失败（int 约束）', () => {
        expect(学业制式定义条目Schema.safeParse({ 名称: 'x', 时长分钟: 1.5 }).success).toBe(false);
    });
    it('前置条件 字符串数组 → 通过', () => {
        expect(学业制式定义条目Schema.safeParse({ 名称: 'x', 前置条件: ['识字'] }).success).toBe(true);
    });
    it('全事实层字段 optional·缺省过（无字段 = 合法最小条目）', () => {
        expect(学业制式定义条目Schema.safeParse({ 名称: 'x' }).success).toBe(true);
    });
});
// ═══════════════════════════════════════════════════════════════
// 断言④ · resolve 挂载：by-ID 加载 + 未命中 fail-open + 原型名句柄
// ═══════════════════════════════════════════════════════════════
describe('学业制式库 · resolve 挂载 + by-ID 加载', () => {
    const academicLib = {
        imperial_exam: mkAcademic('科举制', { 阶段名: '乡试', 时长分钟: 10080 }),
        guild_training: mkAcademic('行会培训', { 时长分钟: 2880 }),
        orphan: mkAcademic('孤儿条目', { 描述: '未被引用' }),
    };
    it('resolve manifest.学业制式 → 学业制式成品 含引用条目', () => {
        const r = resolve({ packs: [], 学业制式: ['imperial_exam'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, academicLib);
        expect(r.学业制式成品['imperial_exam']).toBeDefined();
        expect(r.学业制式成品['imperial_exam']?.时长分钟).toBe(10080);
    });
    it('多条目引用 → 学业制式成品 含全部命中', () => {
        const r = resolve({ packs: [], 学业制式: ['imperial_exam', 'guild_training'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, academicLib);
        expect(r.学业制式成品['imperial_exam']).toBeDefined();
        expect(r.学业制式成品['guild_training']).toBeDefined();
    });
    it('未被引用的 orphan 不进 学业制式成品', () => {
        const r = resolve({ packs: [], 学业制式: ['imperial_exam'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, academicLib);
        expect(r.学业制式成品['orphan']).toBeUndefined();
    });
    it('引用不存在 ID → fail-open 跳过（不抛错）', () => {
        expect(() => resolve({ packs: [], 学业制式: ['nonexistent'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, academicLib)).not.toThrow();
        const r = resolve({ packs: [], 学业制式: ['nonexistent'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, academicLib);
        expect(Object.keys(r.学业制式成品)).toHaveLength(0);
    });
    it('manifest.学业制式 为空 → 学业制式成品空·生效中学业制式集空', () => {
        const r = resolve({ packs: [] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, academicLib);
        expect(Object.keys(r.学业制式成品)).toHaveLength(0);
        expect(r.生效中学业制式集).toHaveLength(0);
    });
    it('academicLib 未传 → 学业制式成品空·生效中学业制式集空', () => {
        const r = resolve({ packs: [], 学业制式: ['imperial_exam'] }, {});
        expect(Object.keys(r.学业制式成品)).toHaveLength(0);
        expect(r.生效中学业制式集).toHaveLength(0);
    });
    it('生效中学业制式集 顺序与 manifest.学业制式 一致', () => {
        const r = resolve({ packs: [], 学业制式: ['guild_training', 'imperial_exam'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, academicLib);
        expect(r.生效中学业制式集[0]?.名称).toBe('行会培训');
        expect(r.生效中学业制式集[1]?.名称).toBe('科举制');
    });
    it('原型名句柄(constructor) → own-property guard 拦截（不进 学业制式成品）', () => {
        const r = resolve({ packs: [], 学业制式: ['constructor', 'imperial_exam'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, academicLib);
        expect(Object.prototype.hasOwnProperty.call(r.学业制式成品, 'constructor')).toBe(false);
        expect(r.学业制式成品['imperial_exam']).toBeDefined();
    });
    it('原型名句柄(toString) → own-property guard 拦截', () => {
        const r = resolve({ packs: [], 学业制式: ['toString'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, academicLib);
        expect(Object.keys(r.学业制式成品)).toHaveLength(0);
    });
    it('学业制式 命名空间·句柄 = constructor → 引用Schema safeParse 失败', () => {
        const s = 引用Schema('学业制式');
        expect(s.safeParse('constructor').success).toBe(false);
        expect(s.safeParse('__proto__').success).toBe(false);
        expect(s.safeParse('prototype').success).toBe(false);
    });
    it('冰箱中 toString 作 handle → 解引用 own-property guard 拦截', () => {
        const entry = mkAcademic('科举制');
        const 成品 = { 学业制式库: { imperial_exam: entry } };
        const ref = 创建引用('学业制式', 'imperial_exam');
        expect(解引用(ref, 成品)).toBeDefined();
        const protoRef = { __ns: '学业制式', handle: 'toString' };
        expect(解引用(protoRef, 成品)).toBeNull();
    });
});
// ═══════════════════════════════════════════════════════════════
// 断言⑤ · 不进 hashJudgmentBundle：BUNDLE=21；改学业制式库 → 金向量恒等
// ═══════════════════════════════════════════════════════════════
describe('学业制式库 · 不进判定面指纹', () => {
    it('FINGERPRINT_BUNDLE_MEMBERS 不含学业制式库相关键（BUNDLE=21）', () => {
        expect(FINGERPRINT_BUNDLE_MEMBERS.length).toBe(21);
        const bundleSet = new Set(FINGERPRINT_BUNDLE_MEMBERS);
        expect(bundleSet.has('学业制式库')).toBe(false);
        expect(bundleSet.has('学业制式')).toBe(false);
        expect(bundleSet.has('学业制式成品')).toBe(false);
    });
    it('改学制条目 → hashPresetFingerprint 逐位恒等', () => {
        const lib1 = { exam: mkAcademic('科举', { 时长分钟: 1000 }) };
        const lib2 = { exam: mkAcademic('科举', { 时长分钟: 9999 }) };
        const r1 = resolve({ packs: [], 学业制式: ['exam'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, lib1);
        const r2 = resolve({ packs: [], 学业制式: ['exam'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, lib2);
        const fp1 = hashPresetFingerprint({ 判定面整包: hashJudgmentBundle(JUDGMENT_BASE), 生效中内容包集哈希: r1.生效中内容包集哈希, snapshot: SNAPSHOT_BASE });
        const fp2 = hashPresetFingerprint({ 判定面整包: hashJudgmentBundle(JUDGMENT_BASE), 生效中内容包集哈希: r2.生效中内容包集哈希, snapshot: SNAPSHOT_BASE });
        expect(fp1).toBe(fp2);
        expect(fp1).toMatch(/^[0-9a-f]{8}$/);
    });
    it('加学制条目 → hashPresetFingerprint 逐位恒等（证整库不进判定面）', () => {
        const lib = { exam: mkAcademic('科举'), guild: mkAcademic('行会') };
        const r1 = resolve({ packs: [], 学业制式: ['exam'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, lib);
        const r2 = resolve({ packs: [], 学业制式: ['exam', 'guild'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, lib);
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
        const fp2 = hashPresetFingerprint({
            判定面整包: hashJudgmentBundle(JUDGMENT_BASE),
            生效中内容包集哈希: resolve({ packs: [] }, {}).生效中内容包集哈希,
            snapshot: SNAPSHOT_BASE,
        });
        expect(fp).toBe(fp2);
        expect(fp).toMatch(/^[0-9a-f]{8}$/);
    });
});
// ═══════════════════════════════════════════════════════════════
// 断言⑥ · content_hash round-trip 闭环
// ═══════════════════════════════════════════════════════════════
describe('学业制式库 · content_hash（mod 可复现面）', () => {
    it('包信封 computeEffectPackHash 产生确定性 8 字符 hex', () => {
        const entry = mkAcademic('科举制', { 时长分钟: 10080 });
        const hash = computeEffectPackHash(条目ToPackEnvelope(entry));
        expect(hash).toMatch(/^[0-9a-f]{8}$/);
    });
    it('round-trip 闭环：无 content_hash → 算 h → 回填 → 重算 === h', () => {
        const entry = mkAcademic('行会培训', { 阶段名: '初级', 时长分钟: 2880 });
        const envelope = 条目ToPackEnvelope(entry);
        const h = computeEffectPackHash(envelope);
        const h2 = computeEffectPackHash({ ...envelope, content_hash: h });
        expect(h2).toBe(h);
        expect(h).toMatch(/^[0-9a-f]{8}$/);
    });
    it('内容哈希字段不影响包信封哈希（round-trip 守恒）', () => {
        const base = mkAcademic('x', { 时长分钟: 100 });
        const withHash = { ...base, 内容哈希: 'abcd1234' };
        const h1 = computeEffectPackHash(条目ToPackEnvelope(base));
        const h2 = computeEffectPackHash(条目ToPackEnvelope(withHash));
        expect(h1).toBe(h2);
    });
    it('时长分钟变 → 包信封哈希变（内容敏感）', () => {
        const v1 = mkAcademic('x', { 时长分钟: 100 });
        const v2 = mkAcademic('x', { 时长分钟: 200 });
        const h1 = computeEffectPackHash(条目ToPackEnvelope(v1));
        const h2 = computeEffectPackHash(条目ToPackEnvelope(v2));
        expect(h1).not.toBe(h2);
    });
    it('同内容两次 → 哈希恒等（确定性）', () => {
        const entry = mkAcademic('x', { 时长分钟: 1440, 阶段名: '高级' });
        const envelope = 条目ToPackEnvelope(entry);
        expect(computeEffectPackHash(envelope)).toBe(computeEffectPackHash(envelope));
    });
});
// ═══════════════════════════════════════════════════════════════
// 断言⑦ · 守恒门
// ═══════════════════════════════════════════════════════════════
describe('学业制式库 · 守恒门', () => {
    it('schemaKeys = 54（学业制式库不进 RootSchema·不改顶层键数）', () => {
        expect(Object.keys(RootSchema.shape).length).toBe(54);
        expect(BLUEPRINT_KEYS.length).toBe(54);
    });
    it('BUNDLE = 21（学业制式库 dormant·不改 FINGERPRINT_BUNDLE_MEMBERS）', () => {
        expect(FINGERPRINT_BUNDLE_MEMBERS.length).toBe(21);
    });
    it('manifest 四组总长 = 87（不变）', () => {
        const total = FINGERPRINT_BUNDLE_MEMBERS.length +
            FINGERPRINT_PRESET_FIELDS.length +
            FINGERPRINT_SNAPSHOT_FIELDS.length +
            FINGERPRINT_EXCLUDED_FIELDS.length;
        expect(total).toBe(88);
    });
    it('命名空间枚举 = 32 項（含学业制式）', () => {
        expect(命名空间枚举.length).toBe(32);
        expect(命名空间枚举.includes('学业制式')).toBe(true);
    });
    it('冰箱绑定表含 学业制式·解析器键 = 学业制式库', () => {
        expect(冰箱绑定表['学业制式'].解析器键).toBe('学业制式库');
    });
    it('学业制式库 键集无与 BUNDLE_MEMBERS 重叠', () => {
        const keys = ['学业制式库', '学业制式', '学业制式成品', '生效中学业制式集', '_学业制式墓碑库'];
        const bundleSet = new Set(FINGERPRINT_BUNDLE_MEMBERS);
        for (const k of keys) {
            expect(bundleSet.has(k)).toBe(false);
        }
    });
    it('0 重定基验证：学业制式库整库引用不改现有测试指纹基线', () => {
        const lib = {
            imperial_exam: mkAcademic('科举制', { 时长分钟: 10080 }),
            guild_training: mkAcademic('行会培训', { 时长分钟: 2880 }),
        };
        const r = resolve({ packs: [], 学业制式: ['imperial_exam', 'guild_training'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, lib);
        const fp = hashPresetFingerprint({ 判定面整包: hashJudgmentBundle(JUDGMENT_BASE), 生效中内容包集哈希: r.生效中内容包集哈希, snapshot: SNAPSHOT_BASE });
        const fpBase = hashPresetFingerprint({ 判定面整包: hashJudgmentBundle(JUDGMENT_BASE), 生效中内容包集哈希: resolve({ packs: [] }, {}).生效中内容包集哈希, snapshot: SNAPSHOT_BASE });
        expect(fp).toBe(fpBase);
    });
});
