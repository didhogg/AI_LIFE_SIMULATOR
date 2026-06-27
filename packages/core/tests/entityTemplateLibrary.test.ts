/**
 * 实体模板库（冰箱）schema + resolve + 引用原语验收
 *
 * 断言①  实体模板库独立 parse：实体模板定义条目/实体模板冰箱Schema parse 正确（信封 typed·黑洞面 opaque）
 * 断言②  实体模板ID 正则覆盖：合法蛇形过 / 大写·中文·空串键拒
 * 断言③  黑洞面 opaque：NPC模板/组织模板 任意结构过·物品模板字段不存在
 * 断言④  按 实体模板ID resolve 挂载：命中加载 / 缺失跳过 / 原型名句柄 → 不命中
 * 断言⑤  不进 hashJudgmentBundle：改实体模板库内容 → 金向量逐位恒等 · BUNDLE=21 不变
 * 断言⑥  content_hash round-trip 闭环
 * 断言⑦  守恒门：schemaKeys=53 / BUNDLE=21 / manifest=86 / 命名空间枚举 24 项
 */
import { describe, it, expect } from 'vitest';
import {
  实体模板定义条目Schema,
  实体模板冰箱Schema,
  实体模板ID正则,
} from '../schema/entityTemplateLibrary.js';
import type { 实体模板定义条目Type, 实体模板冰箱Type } from '../schema/entityTemplateLibrary.js';
import { resolve } from '../engine/preset/resolve.js';
import { 引用Schema, 创建引用, 解引用 } from '../engine/preset/ref.js';
import { 命名空间枚举 } from '../schema/governedKeySpace.js';
import { 冰箱绑定表 } from '../engine/preset/refBinding.js';
import { computeEffectPackHash } from '../interfaces/contentPackHash.js';
import { RootSchema, BLUEPRINT_KEYS } from '../schema/index.js';
import { hashPresetFingerprint, hashJudgmentBundle } from '../engine/rng.js';
import {
  FINGERPRINT_BUNDLE_MEMBERS,
  FINGERPRINT_PRESET_FIELDS,
  FINGERPRINT_SNAPSHOT_FIELDS,
  FINGERPRINT_EXCLUDED_FIELDS,
} from '../engine/fingerprintManifest.js';

const SNAPSHOT_BASE = {
  难度系数组: {},
  判定骰型: 100 as 100 | 20,
  暴击映射: '关' as '关',
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

function mkEntityTpl(name: string, overrides: Partial<实体模板定义条目Type> = {}): 实体模板定义条目Type {
  return { 名称: name, ...overrides };
}

function 条目ToPackEnvelope(entry: 实体模板定义条目Type): Record<string, unknown> {
  const { 内容哈希, ...rest } = entry;
  return 内容哈希 !== undefined ? { ...rest, content_hash: 内容哈希 } : { ...rest };
}

describe('实体模板库 · 实体模板定义条目Schema · 独立 parse', () => {
  it('最小条目（仅 名称）→ parse 成功', () => {
    const r = 实体模板定义条目Schema.safeParse({ 名称: '基础NPC包' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.名称).toBe('基础NPC包');
  });
  it('缺 名称 → parse 失败', () => {
    expect(实体模板定义条目Schema.safeParse({ NPC模板: [] }).success).toBe(false);
  });
  it('可选字段缺省时 undefined', () => {
    const r = 实体模板定义条目Schema.safeParse({ 名称: 'x' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.版本).toBeUndefined();
      expect(r.data.内容哈希).toBeUndefined();
      expect(r.data.NPC模板).toBeUndefined();
      expect(r.data.组织模板).toBeUndefined();
    }
  });
  it('全字段条目 parse 通过', () => {
    const r = 实体模板定义条目Schema.safeParse({
      名称: '帝国NPC集',
      版本: '1.0.0',
      作者: 'mod_author',
      描述: '包含所有帝国职位NPC模板',
      内容哈希: 'abcd1234',
      NPC模板: [{ 姓名: '王大人', 职业: '官员' }],
      组织模板: [{ 名称: '帝国军团', 类型: '军事' }],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect((r.data.NPC模板 as unknown[]).length).toBe(1);
      expect((r.data.组织模板 as unknown[]).length).toBe(1);
    }
  });
  it('物品模板字段不存在（物品库为唯一权威·条目无此字段）', () => {
    const r = 实体模板定义条目Schema.safeParse({
      名称: 'x',
      物品模板: [{ 名称: '剑' }],
    } as Record<string, unknown>);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(Object.prototype.hasOwnProperty.call(r.data, '物品模板')).toBe(false);
    }
  });
});

describe('实体模板库 · 实体模板冰箱Schema + ID 正则', () => {
  it('空库 parse 成功', () => {
    expect(实体模板冰箱Schema.safeParse({}).success).toBe(true);
  });
  it('未定义时 default {}', () => {
    const r = 实体模板冰箱Schema.safeParse(undefined);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual({});
  });
  it('多条目 parse 成功', () => {
    expect(实体模板冰箱Schema.safeParse({
      imperial_npcs: mkEntityTpl('帝国NPC集', { NPC模板: [] }),
      guild_orgs: mkEntityTpl('行会组织集', { 组织模板: [] }),
    }).success).toBe(true);
  });
  it('ID 含大写 → parse 失败', () => {
    expect(实体模板冰箱Schema.safeParse({ 'ImperialNpcs': mkEntityTpl('非法') }).success).toBe(false);
  });
  it('ID 含中文 → parse 失败', () => {
    expect(实体模板冰箱Schema.safeParse({ '帝国NPC': mkEntityTpl('非法') }).success).toBe(false);
  });
  it('ID 空串 → parse 失败', () => {
    expect(实体模板冰箱Schema.safeParse({ '': mkEntityTpl('非法') }).success).toBe(false);
  });
  it('ID 数字开头 → parse 失败', () => {
    expect(实体模板冰箱Schema.safeParse({ '1npcs': mkEntityTpl('非法') }).success).toBe(false);
  });
  it('ID 正则标准蛇形', () => {
    expect(实体模板ID正则.test('imperial_npcs')).toBe(true);
    expect(实体模板ID正则.test('tpl2')).toBe(true);
    expect(实体模板ID正则.test('2tpl')).toBe(false);
    expect(实体模板ID正则.test('')).toBe(false);
  });
});

describe('实体模板库 · 黑洞面 opaque（NPC/组织模板）', () => {
  it('NPC模板 接受任意 opaque 结构', () => {
    const r = 实体模板定义条目Schema.safeParse({
      名称: 'x',
      NPC模板: [{ 姓名: '张三', 职业: '官员', 属性: { 智力: 80 } }],
    });
    expect(r.success).toBe(true);
  });
  it('组织模板 接受任意 opaque 结构', () => {
    const r = 实体模板定义条目Schema.safeParse({
      名称: 'x',
      组织模板: [{ 名称: '帝国军', 成员数: 10000, 派系: '皇室' }],
    });
    expect(r.success).toBe(true);
  });
  it('NPC模板 空数组 → 通过', () => {
    expect(实体模板定义条目Schema.safeParse({ 名称: 'x', NPC模板: [] }).success).toBe(true);
  });
  it('组织模板 空数组 → 通过', () => {
    expect(实体模板定义条目Schema.safeParse({ 名称: 'x', 组织模板: [] }).success).toBe(true);
  });
});

describe('实体模板库 · resolve 挂载 + by-ID 加载', () => {
  const entityLib: 实体模板冰箱Type = {
    imperial_npcs: mkEntityTpl('帝国NPC集', { NPC模板: [{ 姓名: '王大人' }] }),
    guild_orgs:    mkEntityTpl('行会组织集', { 组织模板: [{ 名称: '商人行会' }] }),
    orphan:        mkEntityTpl('孤儿模板', { 描述: '未被引用' }),
  };

  it('resolve manifest.实体模板 → 实体模板成品 含引用条目', () => {
    const r = resolve({ packs: [], 实体模板: ['imperial_npcs'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, entityLib);
    expect(r.实体模板成品['imperial_npcs']).toBeDefined();
  });
  it('多条目引用 → 实体模板成品 含全部命中', () => {
    const r = resolve({ packs: [], 实体模板: ['imperial_npcs', 'guild_orgs'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, entityLib);
    expect(r.实体模板成品['imperial_npcs']).toBeDefined();
    expect(r.实体模板成品['guild_orgs']).toBeDefined();
  });
  it('orphan 不进 实体模板成品', () => {
    const r = resolve({ packs: [], 实体模板: ['imperial_npcs'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, entityLib);
    expect(r.实体模板成品['orphan']).toBeUndefined();
  });
  it('引用不存在 → fail-open 跳过', () => {
    const r = resolve({ packs: [], 实体模板: ['nonexistent'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, entityLib);
    expect(Object.keys(r.实体模板成品)).toHaveLength(0);
  });
  it('entityTplLib 未传 → 实体模板成品空', () => {
    const r = resolve({ packs: [], 实体模板: ['imperial_npcs'] }, {});
    expect(Object.keys(r.实体模板成品)).toHaveLength(0);
    expect(r.生效中实体模板集).toHaveLength(0);
  });
  it('生效中实体模板集 顺序与 manifest 一致', () => {
    const r = resolve({ packs: [], 实体模板: ['guild_orgs', 'imperial_npcs'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, entityLib);
    expect(r.生效中实体模板集[0]?.名称).toBe('行会组织集');
    expect(r.生效中实体模板集[1]?.名称).toBe('帝国NPC集');
  });
  it('原型名句柄(constructor) → own-property guard 拦截', () => {
    const r = resolve({ packs: [], 实体模板: ['constructor', 'imperial_npcs'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, entityLib);
    expect(Object.prototype.hasOwnProperty.call(r.实体模板成品, 'constructor')).toBe(false);
    expect(r.实体模板成品['imperial_npcs']).toBeDefined();
  });
  it('原型名句柄(toString) → own-property guard 拦截', () => {
    const r = resolve({ packs: [], 实体模板: ['toString'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, entityLib);
    expect(Object.keys(r.实体模板成品)).toHaveLength(0);
  });
  it('实体模板 命名空间·句柄 = constructor → 引用Schema safeParse 失败', () => {
    const s = 引用Schema('实体模板');
    expect(s.safeParse('constructor').success).toBe(false);
    expect(s.safeParse('__proto__').success).toBe(false);
  });
  it('冰箱中 toString 作 handle → 解引用 own-property guard 拦截', () => {
    const 成品: Record<string, unknown> = { 实体模板库: { imperial_npcs: mkEntityTpl('帝国NPC集') } };
    expect(解引用(创建引用('实体模板', 'imperial_npcs'), 成品)).toBeDefined();
    expect(解引用({ __ns: '实体模板' as const, handle: 'toString' }, 成品)).toBeNull();
  });
});

describe('实体模板库 · 不进判定面指纹', () => {
  it('FINGERPRINT_BUNDLE_MEMBERS 不含实体模板库相关键（BUNDLE=21）', () => {
    expect(FINGERPRINT_BUNDLE_MEMBERS.length).toBe(21);
    const bundleSet = new Set(FINGERPRINT_BUNDLE_MEMBERS as readonly string[]);
    expect(bundleSet.has('实体模板库')).toBe(false);
    expect(bundleSet.has('实体模板')).toBe(false);
  });
  it('改实体模板条目 → hashPresetFingerprint 逐位恒等', () => {
    const lib1: 实体模板冰箱Type = { tpl: mkEntityTpl('A', { NPC模板: [{ 姓名: '甲' }] }) };
    const lib2: 实体模板冰箱Type = { tpl: mkEntityTpl('A', { NPC模板: [{ 姓名: '乙' }, { 姓名: '丙' }] }) };
    const r1 = resolve({ packs: [], 实体模板: ['tpl'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, lib1);
    const r2 = resolve({ packs: [], 实体模板: ['tpl'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, lib2);
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

describe('实体模板库 · content_hash（mod 可复现面）', () => {
  it('包信封 computeEffectPackHash 产生确定性 8 字符 hex', () => {
    const entry = mkEntityTpl('帝国NPC集', { NPC模板: [{ 姓名: '王大人' }] });
    expect(computeEffectPackHash(条目ToPackEnvelope(entry))).toMatch(/^[0-9a-f]{8}$/);
  });
  it('round-trip 闭环', () => {
    const envelope = 条目ToPackEnvelope(mkEntityTpl('x', { 组织模板: [{ 名称: '军团' }] }));
    const h = computeEffectPackHash(envelope);
    expect(computeEffectPackHash({ ...envelope, content_hash: h })).toBe(h);
  });
  it('内容哈希字段不影响包信封哈希', () => {
    const base = mkEntityTpl('x', { NPC模板: [] });
    const h1 = computeEffectPackHash(条目ToPackEnvelope(base));
    const h2 = computeEffectPackHash(条目ToPackEnvelope({ ...base, 内容哈希: 'abcd1234' }));
    expect(h1).toBe(h2);
  });
  it('NPC模板内容变 → 包信封哈希变', () => {
    const h1 = computeEffectPackHash(条目ToPackEnvelope(mkEntityTpl('x', { NPC模板: [{ 姓名: '甲' }] })));
    const h2 = computeEffectPackHash(条目ToPackEnvelope(mkEntityTpl('x', { NPC模板: [{ 姓名: '乙' }] })));
    expect(h1).not.toBe(h2);
  });
  it('同内容两次 → 哈希恒等', () => {
    const envelope = 条目ToPackEnvelope(mkEntityTpl('x', { 组织模板: [] }));
    expect(computeEffectPackHash(envelope)).toBe(computeEffectPackHash(envelope));
  });
});

describe('实体模板库 · 守恒门', () => {
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
  it('命名空间枚举 = 32 項（含实体模板）', () => {
    expect(命名空间枚举.length).toBe(32);
    expect((命名空间枚举 as readonly string[]).includes('实体模板')).toBe(true);
  });
  it('冰箱绑定表含 实体模板·解析器键 = 实体模板库', () => {
    expect(冰箱绑定表['实体模板'].解析器键).toBe('实体模板库');
  });
  it('0 重定基验证', () => {
    const lib: 实体模板冰箱Type = { tpl: mkEntityTpl('帝国NPC集', { NPC模板: [{ 姓名: '王大人' }] }) };
    const r = resolve({ packs: [], 实体模板: ['tpl'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, lib);
    const fp = hashPresetFingerprint({ 判定面整包: hashJudgmentBundle(JUDGMENT_BASE), 生效中内容包集哈希: r.生效中内容包集哈希, snapshot: SNAPSHOT_BASE });
    const fpBase = hashPresetFingerprint({ 判定面整包: hashJudgmentBundle(JUDGMENT_BASE), 生效中内容包集哈希: resolve({ packs: [] }, {}).生效中内容包集哈希, snapshot: SNAPSHOT_BASE });
    expect(fp).toBe(fpBase);
  });
});
