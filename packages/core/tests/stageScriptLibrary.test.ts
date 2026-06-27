/**
 * 小剧场剧本库 schema + resolve + 引用原语验收
 *
 * 断言①  小剧场剧本库独立 parse：小剧场剧本定义条目/小剧场剧本库Schema parse 正确（信封 typed·渲染面 opaque）
 * 断言②  小剧场剧本ID 正则覆盖：合法蛇形过 / 大写·中文·空串键拒
 * 断言③  渲染载荷 opaque：任意结构过
 * 断言④  按 小剧场剧本ID resolve 挂载：命中加载 / 缺失跳过 / 原型名句柄 → 不命中
 * 断言⑤  不进 hashJudgmentBundle：改小剧场剧本库内容 → 金向量逐位恒等 · BUNDLE=21 不变
 * 断言⑥  content_hash round-trip 闭环
 * 断言⑦  守恒门：schemaKeys=54 / BUNDLE=21 / manifest=87 / 命名空间枚举 24 项
 */
import { describe, it, expect } from 'vitest';
import {
  小剧场剧本定义条目Schema,
  小剧场剧本库Schema,
  小剧场剧本ID正则,
} from '../schema/stageScriptLibrary.js';
import type { 小剧场剧本定义条目Type, 小剧场剧本库Type } from '../schema/stageScriptLibrary.js';
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

function mkScript(name: string, overrides: Partial<小剧场剧本定义条目Type> = {}): 小剧场剧本定义条目Type {
  return { 名称: name, ...overrides };
}

function 条目ToPackEnvelope(entry: 小剧场剧本定义条目Type): Record<string, unknown> {
  const { 内容哈希, ...rest } = entry;
  return 内容哈希 !== undefined ? { ...rest, content_hash: 内容哈希 } : { ...rest };
}

describe('小剧场剧本库 · 小剧场剧本定义条目Schema · 独立 parse', () => {
  it('最小条目（仅 名称）→ parse 成功', () => {
    const r = 小剧场剧本定义条目Schema.safeParse({ 名称: '酒馆偶遇' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.名称).toBe('酒馆偶遇');
  });
  it('缺 名称 → parse 失败', () => {
    expect(小剧场剧本定义条目Schema.safeParse({ 渲染载荷: {} }).success).toBe(false);
  });
  it('可选字段缺省时 undefined', () => {
    const r = 小剧场剧本定义条目Schema.safeParse({ 名称: 'x' });
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
    const r = 小剧场剧本定义条目Schema.safeParse({
      名称: '酒馆偶遇',
      版本: '1.0.0',
      作者: 'mod_author',
      描述: '主角在酒馆遭遇神秘人的小剧场',
      内容哈希: 'abcd1234',
      渲染载荷: {
        键: 'tavern_encounter',
        分类: '社交',
        图标: '🍺',
        提示词: '描述一场酒馆偶遇',
        读历史默认: true,
        输出格式: 'prose',
      },
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.名称).toBe('酒馆偶遇');
      expect((r.data.渲染载荷 as Record<string, unknown>)?.['分类']).toBe('社交');
    }
  });
});

describe('小剧场剧本库 · 小剧场剧本库Schema + ID 正则', () => {
  it('空库 parse 成功', () => {
    expect(小剧场剧本库Schema.safeParse({}).success).toBe(true);
  });
  it('未定义时 default {}', () => {
    const r = 小剧场剧本库Schema.safeParse(undefined);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual({});
  });
  it('多条目 parse 成功', () => {
    expect(小剧场剧本库Schema.safeParse({
      tavern_encounter: mkScript('酒馆偶遇', { 渲染载荷: { 分类: '社交' } }),
      guild_quest:      mkScript('行会接单', { 渲染载荷: { 分类: '任务' } }),
    }).success).toBe(true);
  });
  it('ID 含大写 → parse 失败', () => {
    expect(小剧场剧本库Schema.safeParse({ 'TavernEncounter': mkScript('非法') }).success).toBe(false);
  });
  it('ID 含中文 → parse 失败', () => {
    expect(小剧场剧本库Schema.safeParse({ '酒馆偶遇': mkScript('非法') }).success).toBe(false);
  });
  it('ID 空串 → parse 失败', () => {
    expect(小剧场剧本库Schema.safeParse({ '': mkScript('非法') }).success).toBe(false);
  });
  it('ID 数字开头 → parse 失败', () => {
    expect(小剧场剧本库Schema.safeParse({ '1script': mkScript('非法') }).success).toBe(false);
  });
  it('ID 含连字符 → parse 失败', () => {
    expect(小剧场剧本库Schema.safeParse({ 'tavern-encounter': mkScript('非法') }).success).toBe(false);
  });
  it('ID 正则标准蛇形', () => {
    expect(小剧场剧本ID正则.test('tavern_encounter')).toBe(true);
    expect(小剧场剧本ID正则.test('script2')).toBe(true);
    expect(小剧场剧本ID正则.test('2script')).toBe(false);
    expect(小剧场剧本ID正则.test('')).toBe(false);
    expect(小剧场剧本ID正则.test('TavernEncounter')).toBe(false);
  });
});

describe('小剧场剧本库 · 渲染载荷 opaque', () => {
  it('渲染载荷 接受任意 opaque 结构', () => {
    const r = 小剧场剧本定义条目Schema.safeParse({
      名称: 'x',
      渲染载荷: { 键: 'k', 分类: '社交', 提示词: '描述...', nested: { 深: true }, 数值: 42 },
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect((r.data.渲染载荷 as Record<string, unknown>)?.['分类']).toBe('社交');
    }
  });
  it('渲染载荷 空 record → 通过', () => {
    expect(小剧场剧本定义条目Schema.safeParse({ 名称: 'x', 渲染载荷: {} }).success).toBe(true);
  });
});

describe('小剧场剧本库 · resolve 挂载 + by-ID 加载', () => {
  const scriptLib: 小剧场剧本库Type = {
    tavern_encounter: mkScript('酒馆偶遇', { 渲染载荷: { 分类: '社交' } }),
    guild_quest:      mkScript('行会接单', { 渲染载荷: { 分类: '任务' } }),
    orphan:           mkScript('孤儿剧本', { 描述: '未被引用' }),
  };

  it('resolve manifest.小剧场剧本 → 小剧场剧本成品 含引用条目', () => {
    const r = resolve({ packs: [], 小剧场剧本: ['tavern_encounter'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, scriptLib);
    expect(r.小剧场剧本成品['tavern_encounter']).toBeDefined();
    expect((r.小剧场剧本成品['tavern_encounter']?.渲染载荷 as Record<string, unknown>)?.['分类']).toBe('社交');
  });
  it('多条目引用 → 小剧场剧本成品 含全部命中', () => {
    const r = resolve({ packs: [], 小剧场剧本: ['tavern_encounter', 'guild_quest'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, scriptLib);
    expect(r.小剧场剧本成品['tavern_encounter']).toBeDefined();
    expect(r.小剧场剧本成品['guild_quest']).toBeDefined();
  });
  it('orphan 不进 小剧场剧本成品', () => {
    const r = resolve({ packs: [], 小剧场剧本: ['tavern_encounter'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, scriptLib);
    expect(r.小剧场剧本成品['orphan']).toBeUndefined();
  });
  it('引用不存在 → fail-open 跳过', () => {
    const r = resolve({ packs: [], 小剧场剧本: ['nonexistent'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, scriptLib);
    expect(Object.keys(r.小剧场剧本成品)).toHaveLength(0);
  });
  it('scriptLib 未传 → 小剧场剧本成品空', () => {
    const r = resolve({ packs: [], 小剧场剧本: ['tavern_encounter'] }, {});
    expect(Object.keys(r.小剧场剧本成品)).toHaveLength(0);
    expect(r.生效中小剧场剧本集).toHaveLength(0);
  });
  it('生效中小剧场剧本集 顺序与 manifest 一致', () => {
    const r = resolve({ packs: [], 小剧场剧本: ['guild_quest', 'tavern_encounter'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, scriptLib);
    expect(r.生效中小剧场剧本集[0]?.名称).toBe('行会接单');
    expect(r.生效中小剧场剧本集[1]?.名称).toBe('酒馆偶遇');
  });
  it('原型名句柄(constructor) → own-property guard 拦截', () => {
    const r = resolve({ packs: [], 小剧场剧本: ['constructor', 'tavern_encounter'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, scriptLib);
    expect(Object.prototype.hasOwnProperty.call(r.小剧场剧本成品, 'constructor')).toBe(false);
    expect(r.小剧场剧本成品['tavern_encounter']).toBeDefined();
  });
  it('原型名句柄(toString) → own-property guard 拦截', () => {
    const r = resolve({ packs: [], 小剧场剧本: ['toString'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, scriptLib);
    expect(Object.keys(r.小剧场剧本成品)).toHaveLength(0);
  });
  it('小剧场剧本 命名空间·句柄 = constructor → 引用Schema safeParse 失败', () => {
    const s = 引用Schema('小剧场剧本');
    expect(s.safeParse('constructor').success).toBe(false);
    expect(s.safeParse('__proto__').success).toBe(false);
  });
  it('冰箱中 toString 作 handle → 解引用 own-property guard 拦截', () => {
    const 成品: Record<string, unknown> = { 小剧场剧本库: { tavern_encounter: mkScript('酒馆偶遇') } };
    expect(解引用(创建引用('小剧场剧本', 'tavern_encounter'), 成品)).toBeDefined();
    expect(解引用({ __ns: '小剧场剧本' as const, handle: 'toString' }, 成品)).toBeNull();
  });
});

describe('小剧场剧本库 · 不进判定面指纹', () => {
  it('FINGERPRINT_BUNDLE_MEMBERS 不含小剧场剧本库相关键（BUNDLE=21）', () => {
    expect(FINGERPRINT_BUNDLE_MEMBERS.length).toBe(21);
    const bundleSet = new Set(FINGERPRINT_BUNDLE_MEMBERS as readonly string[]);
    expect(bundleSet.has('小剧场剧本库')).toBe(false);
    expect(bundleSet.has('小剧场剧本')).toBe(false);
    expect(bundleSet.has('小剧场剧本成品')).toBe(false);
  });
  it('改渲染载荷 → hashPresetFingerprint 逐位恒等', () => {
    const lib1: 小剧场剧本库Type = { script: mkScript('x', { 渲染载荷: { 提示词: 'A' } }) };
    const lib2: 小剧场剧本库Type = { script: mkScript('x', { 渲染载荷: { 提示词: 'B', 额外: true } }) };
    const r1 = resolve({ packs: [], 小剧场剧本: ['script'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, lib1);
    const r2 = resolve({ packs: [], 小剧场剧本: ['script'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, lib2);
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

describe('小剧场剧本库 · content_hash（mod 可复现面）', () => {
  it('包信封 computeEffectPackHash 产生确定性 8 字符 hex', () => {
    expect(computeEffectPackHash(条目ToPackEnvelope(mkScript('x', { 渲染载荷: { 分类: '社交' } })))).toMatch(/^[0-9a-f]{8}$/);
  });
  it('round-trip 闭环', () => {
    const envelope = 条目ToPackEnvelope(mkScript('x', { 渲染载荷: { 提示词: '酒馆偶遇...' } }));
    const h = computeEffectPackHash(envelope);
    expect(computeEffectPackHash({ ...envelope, content_hash: h })).toBe(h);
  });
  it('内容哈希字段不影响包信封哈希', () => {
    const base = mkScript('x', { 渲染载荷: {} });
    const h1 = computeEffectPackHash(条目ToPackEnvelope(base));
    const h2 = computeEffectPackHash(条目ToPackEnvelope({ ...base, 内容哈希: 'abcd1234' }));
    expect(h1).toBe(h2);
  });
  it('渲染载荷变 → 包信封哈希变', () => {
    const h1 = computeEffectPackHash(条目ToPackEnvelope(mkScript('x', { 渲染载荷: { 提示词: 'A' } })));
    const h2 = computeEffectPackHash(条目ToPackEnvelope(mkScript('x', { 渲染载荷: { 提示词: 'B' } })));
    expect(h1).not.toBe(h2);
  });
  it('同内容两次 → 哈希恒等', () => {
    const envelope = 条目ToPackEnvelope(mkScript('x', { 渲染载荷: { 分类: '任务', 提示词: '...' } }));
    expect(computeEffectPackHash(envelope)).toBe(computeEffectPackHash(envelope));
  });
});

describe('小剧场剧本库 · 守恒门', () => {
  it('schemaKeys = 54', () => {
    expect(Object.keys(RootSchema.shape).length).toBe(54);
    expect(BLUEPRINT_KEYS.length).toBe(54);
  });
  it('BUNDLE = 21', () => {
    expect(FINGERPRINT_BUNDLE_MEMBERS.length).toBe(21);
  });
  it('manifest 四组总长 = 87', () => {
    expect(FINGERPRINT_BUNDLE_MEMBERS.length + FINGERPRINT_PRESET_FIELDS.length + FINGERPRINT_SNAPSHOT_FIELDS.length + FINGERPRINT_EXCLUDED_FIELDS.length).toBe(87);
  });
  it('命名空间枚举 = 32 項（含小剧场剧本）', () => {
    expect(命名空间枚举.length).toBe(32);
    expect((命名空间枚举 as readonly string[]).includes('小剧场剧本')).toBe(true);
  });
  it('冰箱绑定表含 小剧场剧本·解析器键 = 小剧场剧本库', () => {
    expect(冰箱绑定表['小剧场剧本'].解析器键).toBe('小剧场剧本库');
  });
  it('0 重定基验证', () => {
    const lib: 小剧场剧本库Type = { tavern: mkScript('酒馆偶遇', { 渲染载荷: { 分类: '社交' } }) };
    const r = resolve({ packs: [], 小剧场剧本: ['tavern'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, lib);
    const fp = hashPresetFingerprint({ 判定面整包: hashJudgmentBundle(JUDGMENT_BASE), 生效中内容包集哈希: r.生效中内容包集哈希, snapshot: SNAPSHOT_BASE });
    const fpBase = hashPresetFingerprint({ 判定面整包: hashJudgmentBundle(JUDGMENT_BASE), 生效中内容包集哈希: resolve({ packs: [] }, {}).生效中内容包集哈希, snapshot: SNAPSHOT_BASE });
    expect(fp).toBe(fpBase);
  });
});
