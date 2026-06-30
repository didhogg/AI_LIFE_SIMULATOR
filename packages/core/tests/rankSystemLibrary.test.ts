/**
 * 职级体系库 schema + resolve + 引用原语验收
 *
 * 断言①  职级体系库独立 parse：职级定义条目/职级体系库Schema parse 正确（信封 typed·事实层 typed）
 * 断言②  职级体系ID 正则覆盖：合法蛇形过 / 大写·中文·空串键拒
 * 断言③  事实层字段值域：薪资系数负数拒·全 optional 缺省过
 * 断言④  按 职级体系ID resolve 挂载：命中加载 / 缺失跳过 / 原型名句柄 → 不命中
 * 断言⑤  不进 hashJudgmentBundle：改职级体系库内容 → 金向量逐位恒等 · BUNDLE=21 不变
 * 断言⑥  content_hash round-trip 闭环
 * 断言⑦  守恒门：schemaKeys=54 / BUNDLE=21 / manifest=87 / 命名空间枚举 24 项
 */
import { describe, it, expect } from 'vitest';
import {
  职级定义条目Schema,
  职级体系库Schema,
  职级体系ID正则,
} from '../schema/rankSystemLibrary.js';
import type { 职级定义条目Type, 职级体系库Type } from '../schema/rankSystemLibrary.js';
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

function mkRank(name: string, overrides: Partial<职级定义条目Type> = {}): 职级定义条目Type {
  return { 名称: name, ...overrides };
}

function 条目ToPackEnvelope(entry: 职级定义条目Type): Record<string, unknown> {
  const { 内容哈希, ...rest } = entry;
  return 内容哈希 !== undefined ? { ...rest, content_hash: 内容哈希 } : { ...rest };
}

describe('职级体系库 · 职级定义条目Schema · 独立 parse', () => {
  it('最小条目（仅 名称）→ parse 成功', () => {
    const r = 职级定义条目Schema.safeParse({ 名称: '初级官员' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.名称).toBe('初级官员');
  });
  it('缺 名称 → parse 失败', () => {
    expect(职级定义条目Schema.safeParse({ 职级名: '县令' }).success).toBe(false);
  });
  it('可选字段缺省时 undefined', () => {
    const r = 职级定义条目Schema.safeParse({ 名称: 'x' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.版本).toBeUndefined();
      expect(r.data.职级名).toBeUndefined();
      expect(r.data.组织类型).toBeUndefined();
      expect(r.data.晋升模式).toBeUndefined();
      expect(r.data.前置职级).toBeUndefined();
      expect(r.data.晋升检定).toBeUndefined();
      expect(r.data.薪资系数).toBeUndefined();
      expect(r.data.权限标签).toBeUndefined();
    }
  });
  it('全字段条目 parse 通过', () => {
    const r = 职级定义条目Schema.safeParse({
      名称: '知府',
      版本: '1.0.0',
      作者: 'mod_author',
      描述: '府级行政长官',
      内容哈希: 'abcd1234',
      职级名: '知府',
      组织类型: '朝廷',
      晋升模式: '考核制',
      前置职级: '知县',
      晋升检定: '吏治_考核',
      薪资系数: 2.5,
      权限标签: ['征税', '调兵'],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.薪资系数).toBe(2.5);
      expect(r.data.权限标签).toHaveLength(2);
    }
  });
});

describe('职级体系库 · 职级体系库Schema + ID 正则', () => {
  it('空库 parse 成功', () => {
    const r = 职级体系库Schema.safeParse({});
    expect(r.success).toBe(true);
  });
  it('未定义时 default {}', () => {
    const r = 职级体系库Schema.safeParse(undefined);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual({});
  });
  it('多条目 parse 成功', () => {
    expect(职级体系库Schema.safeParse({
      county_magistrate: mkRank('知县', { 薪资系数: 1.5 }),
      prefecture_gov: mkRank('知府', { 薪资系数: 2.5 }),
    }).success).toBe(true);
  });
  it('ID 含大写 → parse 失败', () => {
    expect(职级体系库Schema.safeParse({ 'CountyMagistrate': mkRank('非法') }).success).toBe(false);
  });
  it('ID 含中文 → parse 失败', () => {
    expect(职级体系库Schema.safeParse({ '知县': mkRank('非法') }).success).toBe(false);
  });
  it('ID 空串 → parse 失败', () => {
    expect(职级体系库Schema.safeParse({ '': mkRank('非法') }).success).toBe(false);
  });
  it('ID 数字开头 → parse 失败', () => {
    expect(职级体系库Schema.safeParse({ '1rank': mkRank('非法') }).success).toBe(false);
  });
  it('ID 正则标准蛇形', () => {
    expect(职级体系ID正则.test('county_magistrate')).toBe(true);
    expect(职级体系ID正则.test('rank2')).toBe(true);
    expect(职级体系ID正则.test('2rank')).toBe(false);
    expect(职级体系ID正则.test('CountyMagistrate')).toBe(false);
    expect(职级体系ID正则.test('')).toBe(false);
  });
});

describe('职级体系库 · 事实层字段值域', () => {
  it('薪资系数 = 0 → 通过（下界）', () => {
    expect(职级定义条目Schema.safeParse({ 名称: 'x', 薪资系数: 0 }).success).toBe(true);
  });
  it('薪资系数 < 0 → parse 失败', () => {
    expect(职级定义条目Schema.safeParse({ 名称: 'x', 薪资系数: -0.1 }).success).toBe(false);
  });
  it('晋升模式开放串（去枚举）→ 任意值通过', () => {
    expect(职级定义条目Schema.safeParse({ 名称: 'x', 晋升模式: '天命制' }).success).toBe(true);
  });
  it('全事实层字段 optional·缺省过', () => {
    expect(职级定义条目Schema.safeParse({ 名称: 'x' }).success).toBe(true);
  });
});

describe('职级体系库 · resolve 挂载 + by-ID 加载', () => {
  const rankLib: 职级体系库Type = {
    county_magistrate: mkRank('知县', { 薪资系数: 1.5 }),
    prefecture_gov:    mkRank('知府', { 薪资系数: 2.5 }),
    orphan:            mkRank('孤儿职级', { 描述: '未被引用' }),
  };

  it('resolve manifest.职级体系 → 职级体系成品 含引用条目', () => {
    const r = resolve({ packs: [], 职级体系: ['county_magistrate'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, rankLib);
    expect(r.职级体系成品['county_magistrate']).toBeDefined();
    expect(r.职级体系成品['county_magistrate']?.薪资系数).toBe(1.5);
  });
  it('多条目引用 → 职级体系成品 含全部命中', () => {
    const r = resolve({ packs: [], 职级体系: ['county_magistrate', 'prefecture_gov'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, rankLib);
    expect(r.职级体系成品['county_magistrate']).toBeDefined();
    expect(r.职级体系成品['prefecture_gov']).toBeDefined();
  });
  it('orphan 不进 职级体系成品', () => {
    const r = resolve({ packs: [], 职级体系: ['county_magistrate'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, rankLib);
    expect(r.职级体系成品['orphan']).toBeUndefined();
  });
  it('引用不存在 → fail-open 跳过', () => {
    const r = resolve({ packs: [], 职级体系: ['nonexistent'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, rankLib);
    expect(Object.keys(r.职级体系成品)).toHaveLength(0);
  });
  it('rankLib 未传 → 职级体系成品空', () => {
    const r = resolve({ packs: [], 职级体系: ['county_magistrate'] }, {});
    expect(Object.keys(r.职级体系成品)).toHaveLength(0);
    expect(r.生效中职级体系集).toHaveLength(0);
  });
  it('生效中职级体系集 顺序与 manifest 一致', () => {
    const r = resolve({ packs: [], 职级体系: ['prefecture_gov', 'county_magistrate'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, rankLib);
    expect(r.生效中职级体系集[0]?.名称).toBe('知府');
    expect(r.生效中职级体系集[1]?.名称).toBe('知县');
  });
  it('原型名句柄(constructor) → own-property guard 拦截', () => {
    const r = resolve({ packs: [], 职级体系: ['constructor', 'county_magistrate'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, rankLib);
    expect(Object.prototype.hasOwnProperty.call(r.职级体系成品, 'constructor')).toBe(false);
    expect(r.职级体系成品['county_magistrate']).toBeDefined();
  });
  it('原型名句柄(toString) → own-property guard 拦截', () => {
    const r = resolve({ packs: [], 职级体系: ['toString'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, rankLib);
    expect(Object.keys(r.职级体系成品)).toHaveLength(0);
  });
  it('职级体系 命名空间·句柄 = constructor → 引用Schema safeParse 失败', () => {
    const s = 引用Schema('职级体系');
    expect(s.safeParse('constructor').success).toBe(false);
    expect(s.safeParse('__proto__').success).toBe(false);
  });
  it('冰箱中 toString 作 handle → 解引用 own-property guard 拦截', () => {
    const entry = mkRank('知县');
    const 成品: Record<string, unknown> = { 职级体系库: { county_magistrate: entry } };
    const ref = 创建引用('职级体系', 'county_magistrate');
    expect(解引用(ref, 成品)).toBeDefined();
    const protoRef = { __ns: '职级体系' as const, handle: 'toString' };
    expect(解引用(protoRef, 成品)).toBeNull();
  });
});

describe('职级体系库 · 不进判定面指纹', () => {
  it('FINGERPRINT_BUNDLE_MEMBERS 不含职级体系库相关键（BUNDLE=21）', () => {
    expect(FINGERPRINT_BUNDLE_MEMBERS.length).toBe(28);
    const bundleSet = new Set(FINGERPRINT_BUNDLE_MEMBERS as readonly string[]);
    expect(bundleSet.has('职级体系库')).toBe(false);
    expect(bundleSet.has('职级体系')).toBe(false);
  });
  it('改职级条目 → hashPresetFingerprint 逐位恒等', () => {
    const lib1: 职级体系库Type = { rank: mkRank('知县', { 薪资系数: 1 }) };
    const lib2: 职级体系库Type = { rank: mkRank('知县', { 薪资系数: 9 }) };
    const r1 = resolve({ packs: [], 职级体系: ['rank'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, lib1);
    const r2 = resolve({ packs: [], 职级体系: ['rank'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, lib2);
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

describe('职级体系库 · content_hash（mod 可复现面）', () => {
  it('包信封 computeEffectPackHash 产生确定性 8 字符 hex', () => {
    const entry = mkRank('知县', { 薪资系数: 1.5 });
    const hash = computeEffectPackHash(条目ToPackEnvelope(entry));
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });
  it('round-trip 闭环', () => {
    const entry = mkRank('知府', { 薪资系数: 2.5 });
    const envelope = 条目ToPackEnvelope(entry);
    const h = computeEffectPackHash(envelope);
    expect(computeEffectPackHash({ ...envelope, content_hash: h })).toBe(h);
  });
  it('内容哈希字段不影响包信封哈希', () => {
    const base = mkRank('x', { 薪资系数: 1 });
    const h1 = computeEffectPackHash(条目ToPackEnvelope(base));
    const h2 = computeEffectPackHash(条目ToPackEnvelope({ ...base, 内容哈希: 'abcd1234' }));
    expect(h1).toBe(h2);
  });
  it('薪资系数变 → 包信封哈希变', () => {
    const h1 = computeEffectPackHash(条目ToPackEnvelope(mkRank('x', { 薪资系数: 1 })));
    const h2 = computeEffectPackHash(条目ToPackEnvelope(mkRank('x', { 薪资系数: 2 })));
    expect(h1).not.toBe(h2);
  });
  it('同内容两次 → 哈希恒等', () => {
    const envelope = 条目ToPackEnvelope(mkRank('x', { 薪资系数: 1.5 }));
    expect(computeEffectPackHash(envelope)).toBe(computeEffectPackHash(envelope));
  });
});

describe('职级体系库 · 守恒门', () => {
  it('schemaKeys = 54', () => {
    expect(Object.keys(RootSchema.shape).length).toBe(54);
    expect(BLUEPRINT_KEYS.length).toBe(54);
  });
  it('BUNDLE = 21', () => {
    expect(FINGERPRINT_BUNDLE_MEMBERS.length).toBe(28);
  });
  it('manifest 四组总长 = 88', () => {
    expect(FINGERPRINT_BUNDLE_MEMBERS.length + FINGERPRINT_PRESET_FIELDS.length + FINGERPRINT_SNAPSHOT_FIELDS.length + FINGERPRINT_EXCLUDED_FIELDS.length).toBe(96);
  });
  it('命名空间枚举 = 32 項（含职级体系）', () => {
    expect(命名空间枚举.length).toBe(32);
    expect((命名空间枚举 as readonly string[]).includes('职级体系')).toBe(true);
  });
  it('冰箱绑定表含 职级体系·解析器键 = 职级体系库', () => {
    expect(冰箱绑定表['职级体系'].解析器键).toBe('职级体系库');
  });
  it('0 重定基验证', () => {
    const lib: 职级体系库Type = { county_magistrate: mkRank('知县', { 薪资系数: 1.5 }) };
    const r = resolve({ packs: [], 职级体系: ['county_magistrate'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, lib);
    const fp = hashPresetFingerprint({ 判定面整包: hashJudgmentBundle(JUDGMENT_BASE), 生效中内容包集哈希: r.生效中内容包集哈希, snapshot: SNAPSHOT_BASE });
    const fpBase = hashPresetFingerprint({ 判定面整包: hashJudgmentBundle(JUDGMENT_BASE), 生效中内容包集哈希: resolve({ packs: [] }, {}).生效中内容包集哈希, snapshot: SNAPSHOT_BASE });
    expect(fp).toBe(fpBase);
  });
});
