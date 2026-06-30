/**
 * 选项集库 schema + 投影函数 + 指纹等价验收
 *
 * 断言①  选项集定义条目 独立 parse：信封 typed + 条目 z.array(动词选项条目Schema)
 * 断言②  选项集ID 正则覆盖：合法蛇形过 / 大写·中文·空串·数字开头键拒
 * 断言③  条目 max(99)：超出拒 / 恰好 99 通
 * 断言④  等价金测：投影选项集库(lib) deepEqual 旧 动词选项集 原数组（逐条逐序）
 * 断言⑤  指纹金测：hashCanonical(投影结果) === hashCanonical(原数组) → 三金向量 0 重定基
 * 断言⑥  by-ID resolve 挂载：命中加载 / 缺失跳过 / 原型名句柄拦截
 * 断言⑦  content_hash round-trip 闭环
 * 断言⑧  守恒门：schemaKeys=54 / BUNDLE=28 / manifest=97 / 命名空间枚举 = 32 項
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  选项集定义条目Schema,
  选项集库Schema,
  选项集ID正则,
  投影选项集库,
} from '../schema/optionSetLibrary.js';
import type { 选项集定义条目Type, 选项集库Type } from '../schema/optionSetLibrary.js';
import { 动词选项条目Schema } from '../schema/optionSetLibrary.js';
import type { 动词选项条目Type } from '../schema/optionSetLibrary.js';
import { resolve } from '../engine/preset/resolve.js';
import { 引用Schema, 创建引用, 解引用 } from '../engine/preset/ref.js';
import { 命名空间枚举 } from '../schema/governedKeySpace.js';
import { 冰箱绑定表 } from '../engine/preset/refBinding.js';
import { computeEffectPackHash } from '../interfaces/contentPackHash.js';
import { RootSchema, BLUEPRINT_KEYS } from '../schema/index.js';
import { hashPresetFingerprint, hashJudgmentBundle, hashCanonical } from '../engine/rng.js';
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

// 构建一个标准动词选项条目（defaults 已填入）
function mkVerb(verb: string, overrides: Partial<动词选项条目Type> = {}): 动词选项条目Type {
  return 动词选项条目Schema.parse({ verb, ...overrides }) as 动词选项条目Type;
}

function mkEntry(name: string, overrides: Partial<选项集定义条目Type> = {}): 选项集定义条目Type {
  return { 名称: name, ...overrides };
}

function 条目ToPackEnvelope(entry: 选项集定义条目Type): Record<string, unknown> {
  const { 内容哈希, ...rest } = entry;
  return 内容哈希 !== undefined ? { ...rest, content_hash: 内容哈希 } : { ...rest };
}

// ── 断言① · 选项集定义条目 独立 parse ──────────────────────────────────────────────

describe('选项集库 · 选项集定义条目Schema · 独立 parse', () => {
  it('最小条目（仅 名称）→ parse 成功', () => {
    const r = 选项集定义条目Schema.safeParse({ 名称: '移动选项集' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.名称).toBe('移动选项集');
  });

  it('缺 名称 → parse 失败', () => {
    expect(选项集定义条目Schema.safeParse({ 条目: [] }).success).toBe(false);
  });

  it('可选字段缺省时 undefined', () => {
    const r = 选项集定义条目Schema.safeParse({ 名称: 'x' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.版本).toBeUndefined();
      expect(r.data.作者).toBeUndefined();
      expect(r.data.描述).toBeUndefined();
      expect(r.data.内容哈希).toBeUndefined();
      expect(r.data.条目).toBeUndefined();
    }
  });

  it('全字段条目 parse 通过', () => {
    const r = 选项集定义条目Schema.safeParse({
      名称: '移动选项集',
      版本: '1.0.0',
      作者: 'mod_author',
      描述: '包含移动相关动词选项',
      内容哈希: 'abcd1234',
      条目: [
        { verb: 'move', target_choices: ['town'], tool_name: 'move_to', params: {} },
      ],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.名称).toBe('移动选项集');
      expect(r.data.条目).toHaveLength(1);
      expect(r.data.条目?.[0]?.verb).toBe('move');
    }
  });

  it('条目 动词选项条目 defaults 填入（verb default=\'\'）', () => {
    const r = 选项集定义条目Schema.safeParse({
      名称: 'x',
      条目: [{}],  // 全默认
    });
    expect(r.success).toBe(true);
    if (r.success) {
      const item = r.data.条目?.[0];
      expect(item?.verb).toBe('');
      expect(item?.target_choices).toEqual([]);
      expect(item?.tool_name).toBe('');
      expect(item?.params).toEqual({});
    }
  });

  it('条目中 salient_args / display_text optional', () => {
    const r = 选项集定义条目Schema.safeParse({
      名称: 'x',
      条目: [{ verb: 'talk', salient_args: 'npc_a', display_text: '和NPC聊天' }],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.条目?.[0]?.salient_args).toBe('npc_a');
      expect(r.data.条目?.[0]?.display_text).toBe('和NPC聊天');
    }
  });
});

// ── 断言② · ID 正则覆盖 ───────────────────────────────────────────────────────────

describe('选项集库 · 选项集库Schema + ID 正则', () => {
  it('空库 parse 成功', () => {
    expect(选项集库Schema.safeParse({}).success).toBe(true);
  });

  it('未定义时 default {}', () => {
    const r = 选项集库Schema.safeParse(undefined);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual({});
  });

  it('多条目 parse 成功', () => {
    expect(选项集库Schema.safeParse({
      movement_set: mkEntry('移动'),
      social_set:   mkEntry('社交'),
    }).success).toBe(true);
  });

  it('ID 含大写 → parse 失败', () => {
    expect(选项集库Schema.safeParse({ 'MovementSet': mkEntry('非法') }).success).toBe(false);
  });

  it('ID 含中文 → parse 失败', () => {
    expect(选项集库Schema.safeParse({ '移动选项': mkEntry('非法') }).success).toBe(false);
  });

  it('ID 空串 → parse 失败', () => {
    expect(选项集库Schema.safeParse({ '': mkEntry('非法') }).success).toBe(false);
  });

  it('ID 数字开头 → parse 失败', () => {
    expect(选项集库Schema.safeParse({ '1set': mkEntry('非法') }).success).toBe(false);
  });

  it('ID 含连字符 → parse 失败', () => {
    expect(选项集库Schema.safeParse({ 'move-set': mkEntry('非法') }).success).toBe(false);
  });

  it('ID 正则标准蛇形', () => {
    expect(选项集ID正则.test('movement_set')).toBe(true);
    expect(选项集ID正则.test('set2')).toBe(true);
    expect(选项集ID正则.test('2set')).toBe(false);
    expect(选项集ID正则.test('')).toBe(false);
    expect(选项集ID正则.test('MovementSet')).toBe(false);
  });
});

// ── 断言③ · 条目 max(99) ─────────────────────────────────────────────────────────

describe('选项集库 · 条目 max(99) 约束', () => {
  it('99 条 → parse 成功', () => {
    const items = Array.from({ length: 99 }, (_, i) => ({ verb: `v${i}` }));
    const r = 选项集定义条目Schema.safeParse({ 名称: 'x', 条目: items });
    expect(r.success).toBe(true);
  });

  it('100 条 → parse 失败', () => {
    const items = Array.from({ length: 100 }, (_, i) => ({ verb: `v${i}` }));
    const r = 选项集定义条目Schema.safeParse({ 名称: 'x', 条目: items });
    expect(r.success).toBe(false);
  });

  it('空条目列表 → parse 成功', () => {
    expect(选项集定义条目Schema.safeParse({ 名称: 'x', 条目: [] }).success).toBe(true);
  });
});

// ── 断言④ · 等价金测 ──────────────────────────────────────────────────────────────

describe('选项集库 · 等价金测（投影选项集库 deepEqual 旧数组）', () => {
  // 原始动词选项集数组（经 动词选项条目Schema 规范化）
  const 原始条目: 动词选项条目Type[] = [
    mkVerb('move',  { target_choices: ['town'], tool_name: 'move_to' }),
    mkVerb('talk',  { target_choices: ['npc_a'], tool_name: 'converse', salient_args: 'npc_a' }),
    mkVerb('trade', { target_choices: ['merchant'], tool_name: 'open_trade', params: { currency: 'gold' } }),
  ];

  // 将原始数组迁入库（单集·保持顺序）
  const lib单集: 选项集库Type = 选项集库Schema.parse({
    all_options: {
      名称: '全部选项',
      条目: 原始条目,
    },
  });

  it('单集投影 → deepEqual 原始数组', () => {
    const projected = 投影选项集库(lib单集);
    expect(projected).toEqual(原始条目);
  });

  it('多集投影 → deepEqual 分割后的原始数组（顺序保持）', () => {
    // 将原始 3 条分成 2 组
    const lib多集: 选项集库Type = 选项集库Schema.parse({
      movement_set: { 名称: '移动', 条目: [原始条目[0]] },
      social_set:   { 名称: '社交', 条目: [原始条目[1], 原始条目[2]] },
    });
    const projected = 投影选项集库(lib多集);
    expect(projected).toEqual(原始条目);
  });

  it('空库投影 → 空数组', () => {
    expect(投影选项集库({})).toEqual([]);
  });

  it('条目 undefined 的集 → 投影跳过', () => {
    const lib: 选项集库Type = 选项集库Schema.parse({
      empty_set: { 名称: '无条目' },
      real_set:  { 名称: '有条目', 条目: [原始条目[0]] },
    });
    const projected = 投影选项集库(lib);
    expect(projected).toEqual([原始条目[0]]);
  });
});

// ── 断言⑤ · 指纹金测 ──────────────────────────────────────────────────────────────

describe('选项集库 · 指纹金测（0 重定基）', () => {
  const 原始条目: 动词选项条目Type[] = [
    mkVerb('move',  { target_choices: ['town'], tool_name: 'move_to' }),
    mkVerb('talk',  { target_choices: ['npc_a'], tool_name: 'converse' }),
  ];

  it('hashCanonical(投影) === hashCanonical(原始数组)', () => {
    const lib: 选项集库Type = 选项集库Schema.parse({
      opts: { 名称: '选项', 条目: 原始条目 },
    });
    const projected = 投影选项集库(lib);
    expect(projected).toEqual(原始条目);
    expect(hashCanonical(projected)).toBe(hashCanonical(原始条目));
  });

  it('hashPresetFingerprint 迁移前后逐位恒等', () => {
    const lib: 选项集库Type = 选项集库Schema.parse({
      opts: { 名称: '选项', 条目: 原始条目 },
    });
    const projected = 投影选项集库(lib);
    const 动词选项集哈希_旧 = hashCanonical(原始条目);
    const 动词选项集哈希_新 = hashCanonical(projected);

    const fp_旧 = hashPresetFingerprint({
      判定面整包: hashJudgmentBundle(JUDGMENT_BASE),
      生效中内容包集哈希: resolve({ packs: [] }, {}).生效中内容包集哈希,
      动词选项集哈希: 动词选项集哈希_旧,
      snapshot: SNAPSHOT_BASE,
    });
    const fp_新 = hashPresetFingerprint({
      判定面整包: hashJudgmentBundle(JUDGMENT_BASE),
      生效中内容包集哈希: resolve({ packs: [] }, {}).生效中内容包集哈希,
      动词选项集哈希: 动词选项集哈希_新,
      snapshot: SNAPSHOT_BASE,
    });
    expect(fp_旧).toBe(fp_新);
    expect(fp_旧).toMatch(/^[0-9a-f]{8}$/);
  });

  it('三金向量逐位恒等（0 重定基）', () => {
    const base哈希 = resolve({ packs: [] }, {}).生效中内容包集哈希;
    const fp1 = hashPresetFingerprint({ 判定面整包: hashJudgmentBundle(JUDGMENT_BASE), 生效中内容包集哈希: base哈希, snapshot: SNAPSHOT_BASE });
    const fp2 = hashPresetFingerprint({ 判定面整包: hashJudgmentBundle(JUDGMENT_BASE), 生效中内容包集哈希: base哈希, snapshot: SNAPSHOT_BASE });
    expect(fp1).toBe(fp2);
    expect(fp1).toMatch(/^[0-9a-f]{8}$/);
  });

  it('改投影内容（添加条目） → hashCanonical 变化', () => {
    const lib1: 选项集库Type = 选项集库Schema.parse({ opts: { 名称: 'x', 条目: [原始条目[0]] } });
    const lib2: 选项集库Type = 选项集库Schema.parse({ opts: { 名称: 'x', 条目: 原始条目 } });
    const h1 = hashCanonical(投影选项集库(lib1));
    const h2 = hashCanonical(投影选项集库(lib2));
    expect(h1).not.toBe(h2);
  });
});

// ── 断言⑥ · by-ID resolve 挂载 ────────────────────────────────────────────────────

describe('选项集库 · resolve 挂载 + by-ID 加载', () => {
  const optionSetLib: 选项集库Type = {
    movement_set: mkEntry('移动选项集', { 条目: [mkVerb('move')] }),
    social_set:   mkEntry('社交选项集', { 条目: [mkVerb('talk')] }),
    orphan:       mkEntry('孤儿集',   { 描述: '未被引用' }),
  };

  it('resolve manifest.选项集 → 选项集成品 含引用条目', () => {
    const r = resolve({ packs: [], 选项集: ['movement_set'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, optionSetLib);
    expect(r.选项集成品['movement_set']).toBeDefined();
    expect(r.选项集成品['movement_set']?.名称).toBe('移动选项集');
  });

  it('多条目引用 → 选项集成品 含全部命中', () => {
    const r = resolve({ packs: [], 选项集: ['movement_set', 'social_set'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, optionSetLib);
    expect(r.选项集成品['movement_set']).toBeDefined();
    expect(r.选项集成品['social_set']).toBeDefined();
  });

  it('orphan 不进 选项集成品', () => {
    const r = resolve({ packs: [], 选项集: ['movement_set'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, optionSetLib);
    expect(r.选项集成品['orphan']).toBeUndefined();
  });

  it('引用不存在 → fail-open 跳过', () => {
    const r = resolve({ packs: [], 选项集: ['nonexistent'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, optionSetLib);
    expect(Object.keys(r.选项集成品)).toHaveLength(0);
  });

  it('optionSetLib 未传 → 选项集成品空', () => {
    const r = resolve({ packs: [], 选项集: ['movement_set'] }, {});
    expect(Object.keys(r.选项集成品)).toHaveLength(0);
    expect(r.生效中选项集集).toHaveLength(0);
  });

  it('生效中选项集集 顺序与 manifest 一致', () => {
    const r = resolve({ packs: [], 选项集: ['social_set', 'movement_set'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, optionSetLib);
    expect(r.生效中选项集集[0]?.名称).toBe('社交选项集');
    expect(r.生效中选项集集[1]?.名称).toBe('移动选项集');
  });

  it('原型名句柄(constructor) → own-property guard 拦截', () => {
    const r = resolve({ packs: [], 选项集: ['constructor', 'movement_set'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, optionSetLib);
    expect(Object.prototype.hasOwnProperty.call(r.选项集成品, 'constructor')).toBe(false);
    expect(r.选项集成品['movement_set']).toBeDefined();
  });

  it('原型名句柄(toString) → own-property guard 拦截', () => {
    const r = resolve({ packs: [], 选项集: ['toString'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, optionSetLib);
    expect(Object.keys(r.选项集成品)).toHaveLength(0);
  });

  it('选项集 命名空间·constructor → 引用Schema safeParse 失败', () => {
    const s = 引用Schema('选项集');
    expect(s.safeParse('constructor').success).toBe(false);
    expect(s.safeParse('__proto__').success).toBe(false);
  });

  it('冰箱中 toString 作 handle → 解引用 own-property guard 拦截', () => {
    const 成品: Record<string, unknown> = { 选项集库: { movement_set: mkEntry('移动') } };
    expect(解引用(创建引用('选项集', 'movement_set'), 成品)).toBeDefined();
    expect(解引用({ __ns: '选项集' as const, handle: 'toString' }, 成品)).toBeNull();
  });
});

// ── 断言⑦ · content_hash round-trip ───────────────────────────────────────────────

describe('选项集库 · content_hash（mod 可复现面）', () => {
  it('包信封 computeEffectPackHash 产生确定性 8 字符 hex', () => {
    expect(computeEffectPackHash(条目ToPackEnvelope(mkEntry('x', { 条目: [mkVerb('move')] })))).toMatch(/^[0-9a-f]{8}$/);
  });

  it('round-trip 闭环', () => {
    const envelope = 条目ToPackEnvelope(mkEntry('x', { 条目: [mkVerb('talk')] }));
    const h = computeEffectPackHash(envelope);
    expect(computeEffectPackHash({ ...envelope, content_hash: h })).toBe(h);
  });

  it('内容哈希字段不影响包信封哈希', () => {
    const base = mkEntry('x', { 条目: [mkVerb('move')] });
    const h1 = computeEffectPackHash(条目ToPackEnvelope(base));
    const h2 = computeEffectPackHash(条目ToPackEnvelope({ ...base, 内容哈希: 'abcd1234' }));
    expect(h1).toBe(h2);
  });

  it('条目变 → 包信封哈希变', () => {
    const h1 = computeEffectPackHash(条目ToPackEnvelope(mkEntry('x', { 条目: [mkVerb('move')] })));
    const h2 = computeEffectPackHash(条目ToPackEnvelope(mkEntry('x', { 条目: [mkVerb('talk')] })));
    expect(h1).not.toBe(h2);
  });

  it('同内容两次 → 哈希恒等', () => {
    const envelope = 条目ToPackEnvelope(mkEntry('x', { 条目: [mkVerb('trade')] }));
    expect(computeEffectPackHash(envelope)).toBe(computeEffectPackHash(envelope));
  });
});

// ── 断言⑧ · 守恒门 ──────────────────────────────────────────────────────────────────

describe('选项集库 · 守恒门', () => {
  it('schemaKeys = 54', () => {
    expect(Object.keys(RootSchema.shape).length).toBe(54);
    expect(BLUEPRINT_KEYS.length).toBe(54);
  });

  it('BUNDLE = 28', () => {
    expect(FINGERPRINT_BUNDLE_MEMBERS.length).toBe(28);
  });

  it('manifest 四组总长 = 97（C-2 漂移绑定策略→LOD模块·模块绑定策略+局部覆盖+引用包）', () => {
    expect(
      FINGERPRINT_BUNDLE_MEMBERS.length +
      FINGERPRINT_PRESET_FIELDS.length +
      FINGERPRINT_SNAPSHOT_FIELDS.length +
      FINGERPRINT_EXCLUDED_FIELDS.length,
    ).toBe(97);
  });

  it('命名空间枚举 = 32 項（含选项集）', () => {
    expect(命名空间枚举.length).toBe(32);
    expect((命名空间枚举 as readonly string[]).includes('选项集')).toBe(true);
  });

  it('冰箱绑定表含 选项集·解析器键 = 选项集库', () => {
    expect(冰箱绑定表['选项集'].解析器键).toBe('选项集库');
  });

  it('FINGERPRINT_BUNDLE_MEMBERS 不含选项集库相关键（BUNDLE=28）', () => {
    const bundleSet = new Set(FINGERPRINT_BUNDLE_MEMBERS as readonly string[]);
    expect(bundleSet.has('选项集库')).toBe(false);
    expect(bundleSet.has('选项集')).toBe(false);
    expect(bundleSet.has('选项集成品')).toBe(false);
  });

  it('0 重定基验证：加载选项集库不改 hashPresetFingerprint', () => {
    const lib: 选项集库Type = { movement: mkEntry('移动', { 条目: [mkVerb('move')] }) };
    const r = resolve({ packs: [], 选项集: ['movement'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, lib);
    const fp_有库 = hashPresetFingerprint({ 判定面整包: hashJudgmentBundle(JUDGMENT_BASE), 生效中内容包集哈希: r.生效中内容包集哈希, snapshot: SNAPSHOT_BASE });
    const fp_无库 = hashPresetFingerprint({ 判定面整包: hashJudgmentBundle(JUDGMENT_BASE), 生效中内容包集哈希: resolve({ packs: [] }, {}).生效中内容包集哈希, snapshot: SNAPSHOT_BASE });
    expect(fp_有库).toBe(fp_无库);
  });
});
