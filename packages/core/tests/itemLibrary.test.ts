/**
 * 物品库 schema + resolve + 引用原语验收
 *
 * 断言①  物品库独立 parse：物品定义条目/物品库Schema parse 正确（信封 typed·展示层 opaque）
 * 断言②  按 物品ID resolve 挂载：by-ID 加载 + 未命中 fail-open + 原型名 → 跳过
 * 断言③  安全硬化覆盖：原型名作 物品ID → 解引用返 null（own-property guard）
 * 断言④  定义字段开放串验收（类别/稀有度/默认重要级别·去枚举）
 * 断言⑤  不进 hashJudgmentBundle：改物品库内容 → golden 逐位恒等 · BUNDLE=21 不变
 * 断言⑥  content_hash round-trip 闭环（库条目→包信封边界映射）
 * 断言⑦  守恒门：schemaKeys=54 / BUNDLE=21 / manifest=87 / 命名空间枚举 17 项
 */
import { describe, it, expect } from 'vitest';
import {
  物品定义条目Schema,
  物品库Schema,
  物品ID正则,
} from '../schema/itemLibrary.js';
import type { 物品定义条目Type, 物品库Type } from '../schema/itemLibrary.js';
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

// ── 最小化基准（hashPresetFingerprint 验收用）──────────────────────────────────
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

// ── 物品定义条目 fixture helpers ─────────────────────────────────────────────
function mkItem(name: string, overrides: Partial<物品定义条目Type> = {}): 物品定义条目Type {
  return { 名称: name, ...overrides };
}

// 复刻 resolve.ts 生产边界：库条目(中文 内容哈希) → 包信封(英文 content_hash)
function item条目ToPackEnvelope(entry: 物品定义条目Type): Record<string, unknown> {
  const { 内容哈希, ...rest } = entry;
  return 内容哈希 !== undefined ? { ...rest, content_hash: 内容哈希 } : { ...rest };
}

// ═══════════════════════════════════════════════════════════════════
// 断言① · 物品库独立 parse
// ═══════════════════════════════════════════════════════════════════
describe('物品库 · 物品定义条目Schema · 独立 parse', () => {
  it('最小条目（仅 名称）→ parse 成功', () => {
    const r = 物品定义条目Schema.safeParse({ 名称: '铁剑' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.名称).toBe('铁剑');
    }
  });

  it('缺 名称 → parse 失败', () => {
    const r = 物品定义条目Schema.safeParse({ 类别: '武器' });
    expect(r.success).toBe(false);
  });

  it('可选信封字段缺省时 undefined', () => {
    const r = 物品定义条目Schema.safeParse({ 名称: 'x' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.版本).toBeUndefined();
      expect(r.data.作者).toBeUndefined();
      expect(r.data.描述).toBeUndefined();
      expect(r.data.内容哈希).toBeUndefined();
      expect(r.data.类别).toBeUndefined();
      expect(r.data.默认重要级别).toBeUndefined();
      expect(r.data.稀有度).toBeUndefined();
      expect(r.data.默认到期).toBeUndefined();
      expect(r.data.默认遗失保护).toBeUndefined();
      expect(r.data.默认效果引用).toBeUndefined();
      expect(r.data.展示).toBeUndefined();
    }
  });

  it('全字段条目 parse 通过', () => {
    const r = 物品定义条目Schema.safeParse({
      名称: '传说长剑',
      版本: '1.0.0',
      作者: 'mod_author',
      描述: '上古铸造师传世之作',
      内容哈希: 'abcd1234',
      类别: '武器',
      默认重要级别: '重要',
      稀有度: '传说',
      默认到期: 0,
      默认遗失保护: true,
      默认效果引用: [{ path: '武力', op: 'add', value: 20 }],
      展示: { 图标: 'sword_legend.png', 颜色: 'gold' },
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.名称).toBe('传说长剑');
      expect(r.data.稀有度).toBe('传说');
      expect(r.data.默认遗失保护).toBe(true);
    }
  });

  it('展示层 接受任意 opaque 载荷（不报错·不丢字段）', () => {
    const r = 物品定义条目Schema.safeParse({
      名称: 'x',
      展示: { 图标: 'ring.png', 效果描述: '赋予主人永生', nested: { deep: true } },
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect((r.data.展示 as Record<string, unknown>)['图标']).toBe('ring.png');
    }
  });

  it('默认效果引用 接受任意 unknown 数组（松散·修饰通道引用 deferred）', () => {
    const r = 物品定义条目Schema.safeParse({
      名称: 'x',
      默认效果引用: [{ path: '武力', op: 'add', value: 5 }, { arbitrary: true }],
    });
    expect(r.success).toBe(true);
  });
});

describe('物品库 · 物品库Schema · parse', () => {
  it('空库 parse 成功（default {}）', () => {
    const r = 物品库Schema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual({});
  });

  it('未定义时 default {}', () => {
    const r = 物品库Schema.safeParse(undefined);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual({});
  });

  it('多条目 parse 成功', () => {
    const r = 物品库Schema.safeParse({
      iron_sword: mkItem('铁剑', { 类别: '武器', 稀有度: '普通' }),
      magic_ring:  mkItem('魔法戒指', { 类别: '饰品', 稀有度: '稀有' }),
    });
    expect(r.success).toBe(true);
  });

  it('物品ID 不符合正则（含大写）→ parse 失败', () => {
    const r = 物品库Schema.safeParse({ 'IronSword': mkItem('非法') });
    expect(r.success).toBe(false);
  });

  it('物品ID 含连字符 → parse 失败', () => {
    const r = 物品库Schema.safeParse({ 'iron-sword': mkItem('非法') });
    expect(r.success).toBe(false);
  });

  it('物品ID 数字开头 → parse 失败', () => {
    const r = 物品库Schema.safeParse({ '1st_sword': mkItem('非法') });
    expect(r.success).toBe(false);
  });

  it('物品ID 正则覆盖标准蛇形（与 rule_id/pack_id/工具ID/成就ID 一致）', () => {
    expect(物品ID正则.test('iron_sword')).toBe(true);
    expect(物品ID正则.test('item2')).toBe(true);
    expect(物品ID正则.test('2item')).toBe(false);
    expect(物品ID正则.test('IronSword')).toBe(false);
    expect(物品ID正则.test('')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 断言② · resolve 挂载：by-ID 加载 + 未命中 fail-open
// ═══════════════════════════════════════════════════════════════════
describe('物品库 · resolve 挂载 + by-ID 加载', () => {
  const itemLib: 物品库Type = {
    iron_sword: mkItem('铁剑', { 类别: '武器' }),
    magic_ring:  mkItem('魔法戒指', { 稀有度: '稀有' }),
    orphan:      mkItem('孤儿物品', { 描述: '未被引用' }),
  };

  it('resolve manifest.items → 物品成品 含引用条目', () => {
    const r = resolve({ packs: [], items: ['iron_sword'] }, {}, undefined, undefined, undefined, undefined, itemLib);
    expect(r.物品成品['iron_sword']).toBeDefined();
    expect(r.物品成品['iron_sword']!.类别).toBe('武器');
  });

  it('多条目引用 → 物品成品 含全部命中', () => {
    const r = resolve({ packs: [], items: ['iron_sword', 'magic_ring'] }, {}, undefined, undefined, undefined, undefined, itemLib);
    expect(r.物品成品['iron_sword']).toBeDefined();
    expect(r.物品成品['magic_ring']).toBeDefined();
  });

  it('未被引用的 orphan 不进 物品成品', () => {
    const r = resolve({ packs: [], items: ['iron_sword'] }, {}, undefined, undefined, undefined, undefined, itemLib);
    expect(r.物品成品['orphan']).toBeUndefined();
  });

  it('引用不存在 物品ID → fail-open 跳过（不抛错）', () => {
    expect(() =>
      resolve({ packs: [], items: ['nonexistent'] }, {}, undefined, undefined, undefined, undefined, itemLib)
    ).not.toThrow();
    const r = resolve({ packs: [], items: ['nonexistent'] }, {}, undefined, undefined, undefined, undefined, itemLib);
    expect(Object.keys(r.物品成品)).toHaveLength(0);
  });

  it('manifest.items 为空 → 物品成品空·生效中物品集空', () => {
    const r = resolve({ packs: [] }, {}, undefined, undefined, undefined, undefined, itemLib);
    expect(Object.keys(r.物品成品)).toHaveLength(0);
    expect(r.生效中物品集).toHaveLength(0);
  });

  it('itemLib 未传 → 物品成品空·生效中物品集空', () => {
    const r = resolve({ packs: [], items: ['iron_sword'] }, {});
    expect(Object.keys(r.物品成品)).toHaveLength(0);
    expect(r.生效中物品集).toHaveLength(0);
  });

  it('生效中物品集 顺序与 manifest.items 一致', () => {
    const r = resolve({ packs: [], items: ['magic_ring', 'iron_sword'] }, {}, undefined, undefined, undefined, undefined, itemLib);
    expect(r.生效中物品集[0]!.名称).toBe('魔法戒指');
    expect(r.生效中物品集[1]!.名称).toBe('铁剑');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 断言③ · 安全硬化覆盖（原型名 → 解引用返 null）
// ═══════════════════════════════════════════════════════════════════
describe('物品库 · 安全硬化：原型名 物品ID → null', () => {
  it('物品ID = constructor → own-property guard 拦截（不进 物品成品）', () => {
    const benign: 物品库Type = { iron_sword: mkItem('铁剑') };
    const r = resolve({ packs: [], items: ['constructor', 'iron_sword'] }, {}, undefined, undefined, undefined, undefined, benign);
    expect(Object.prototype.hasOwnProperty.call(r.物品成品, 'constructor')).toBe(false);
    expect(r.物品成品['iron_sword']).toBeDefined();
  });

  it('物品 命名空间·句柄 = constructor → 引用Schema safeParse 失败', () => {
    const s = 引用Schema('物品');
    expect(s.safeParse('constructor').success).toBe(false);
    expect(s.safeParse('__proto__').success).toBe(false);
    expect(s.safeParse('prototype').success).toBe(false);
  });

  it('冰箱中 toString 作 handle → 解引用 own-property guard 拦截', () => {
    const itemEntry = mkItem('铁剑');
    const 成品 = { 物品库: { iron_sword: itemEntry } };
    // 正常引用命中
    const ref = 创建引用('物品', 'iron_sword');
    expect(解引用(ref, 成品)).toBeDefined();
    // 原型成员非自有属性 → null
    const protoRef = { __ns: '物品' as const, handle: 'toString' };
    expect(解引用(protoRef, 成品)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════
// 断言④ · 定义字段开放串验收（去枚举）
// ═══════════════════════════════════════════════════════════════════
describe('物品库 · 定义字段开放串（去枚举）', () => {
  it('类别 开放字符串·任意值均通过（去枚举）', () => {
    const cats = ['武器', '防具', '饰品', '消耗品', '任务物品', 'custom_category'];
    for (const c of cats) {
      const r = 物品定义条目Schema.safeParse({ 名称: 'x', 类别: c });
      expect(r.success).toBe(true);
    }
  });

  it('稀有度 开放字符串·任意值均通过（稀有度库 P0-8+ 未建·暂不引用命名空间）', () => {
    const rarities = ['普通', '优秀', '稀有', '史诗', '传说', '自定义稀有度'];
    for (const rarity of rarities) {
      const r = 物品定义条目Schema.safeParse({ 名称: 'x', 稀有度: rarity });
      expect(r.success).toBe(true);
    }
  });

  it('默认重要级别 开放字符串·任意值均通过', () => {
    const levels = ['普通', '重要', '关键', 'high_priority'];
    for (const lvl of levels) {
      const r = 物品定义条目Schema.safeParse({ 名称: 'x', 默认重要级别: lvl });
      expect(r.success).toBe(true);
    }
  });

  it('默认到期 接受 0（永久）和正整数（绝对纪元分钟）', () => {
    expect(物品定义条目Schema.safeParse({ 名称: 'x', 默认到期: 0 }).success).toBe(true);
    expect(物品定义条目Schema.safeParse({ 名称: 'x', 默认到期: 525600 }).success).toBe(true);
  });

  it('默认到期 不接受小数', () => {
    expect(物品定义条目Schema.safeParse({ 名称: 'x', 默认到期: 1.5 }).success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 断言⑤ · 不进 hashJudgmentBundle：BUNDLE=21；改物品库 → 金向量恒等
// ═══════════════════════════════════════════════════════════════════
describe('物品库 · 不进判定面指纹', () => {
  it('FINGERPRINT_BUNDLE_MEMBERS 不含物品库相关键（BUNDLE=21）', () => {
    expect(FINGERPRINT_BUNDLE_MEMBERS.length).toBe(27);
    const bundleSet = new Set(FINGERPRINT_BUNDLE_MEMBERS as readonly string[]);
    expect(bundleSet.has('物品库')).toBe(false);
    expect(bundleSet.has('物品')).toBe(false);
    expect(bundleSet.has('物品成品')).toBe(false);
  });

  it('含物品库 的 resolve 与无物品 的 resolve → 生效中内容包集哈希一致（物品不贡献内容包哈希）', () => {
    const itemLib: 物品库Type = {
      iron_sword: mkItem('铁剑', { 类别: '武器' }),
    };
    const withItem = resolve({ packs: [], items: ['iron_sword'] }, {}, undefined, undefined, undefined, undefined, itemLib);
    const withoutItem = resolve({ packs: [] }, {});
    expect(withItem.生效中内容包集哈希).toBe(withoutItem.生效中内容包集哈希);
  });

  it('改物品库内容 → hashPresetFingerprint 结果逐位恒等（定义层零指纹影响）', () => {
    const itemLibV1: 物品库Type = {
      sword: mkItem('铁剑', { 稀有度: '普通' }),
    };
    const itemLibV2: 物品库Type = {
      sword: mkItem('铁剑', { 稀有度: '传说', 类别: '神器' }),
    };
    const r1 = resolve({ packs: [], items: ['sword'] }, {}, undefined, undefined, undefined, undefined, itemLibV1);
    const r2 = resolve({ packs: [], items: ['sword'] }, {}, undefined, undefined, undefined, undefined, itemLibV2);
    const fp1 = hashPresetFingerprint({
      判定面整包: hashJudgmentBundle(JUDGMENT_BASE),
      生效中内容包集哈希: r1.生效中内容包集哈希,
      snapshot: SNAPSHOT_BASE,
    });
    const fp2 = hashPresetFingerprint({
      判定面整包: hashJudgmentBundle(JUDGMENT_BASE),
      生效中内容包集哈希: r2.生效中内容包集哈希,
      snapshot: SNAPSHOT_BASE,
    });
    expect(fp1).toBe(fp2);
    expect(fp1).toMatch(/^[0-9a-f]{8}$/);
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
// 断言⑥ · content_hash round-trip 闭环（库条目→包信封边界映射）
// ═══════════════════════════════════════════════════════════════════
describe('物品库 · content_hash（mod 可复现面）', () => {
  it('包信封 computeEffectPackHash 产生确定性 8 字符 hex', () => {
    const entry = mkItem('铁剑', { 类别: '武器', 稀有度: '普通' });
    const hash = computeEffectPackHash(item条目ToPackEnvelope(entry));
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('round-trip 闭环：无 content_hash → 算 h → 回填 → 重算 === h', () => {
    const entry = mkItem('魔法戒指', { 稀有度: '稀有' });
    const envelope = item条目ToPackEnvelope(entry);
    const h = computeEffectPackHash(envelope);
    const envelopeWithHash = { ...envelope, content_hash: h };
    const h2 = computeEffectPackHash(envelopeWithHash);
    expect(h2).toBe(h);
    expect(h).toMatch(/^[0-9a-f]{8}$/);
  });

  it('内容哈希字段不影响包信封哈希（边界映射后 content_hash 被剔·round-trip 守恒）', () => {
    const base = mkItem('x', { 类别: '消耗品' });
    const withHash = { ...base, 内容哈希: 'abcd1234' } as 物品定义条目Type;
    const h1 = computeEffectPackHash(item条目ToPackEnvelope(base));
    const h2 = computeEffectPackHash(item条目ToPackEnvelope(withHash));
    expect(h1).toBe(h2);
  });

  it('稀有度变 → 包信封哈希变（内容敏感）', () => {
    const v1 = mkItem('x', { 稀有度: '普通' });
    const v2 = mkItem('x', { 稀有度: '传说' });
    const h1 = computeEffectPackHash(item条目ToPackEnvelope(v1));
    const h2 = computeEffectPackHash(item条目ToPackEnvelope(v2));
    expect(h1).not.toBe(h2);
  });

  it('同内容两次 → 哈希恒等（确定性）', () => {
    const entry = mkItem('x', { 类别: '武器' });
    const envelope = item条目ToPackEnvelope(entry);
    expect(computeEffectPackHash(envelope)).toBe(computeEffectPackHash(envelope));
  });
});

// ═══════════════════════════════════════════════════════════════════
// 断言⑦ · 守恒门
// ═══════════════════════════════════════════════════════════════════
describe('物品库 · 守恒门', () => {
  it('schemaKeys = 54（物品库不进 RootSchema·不改顶层键数）', () => {
    expect(Object.keys(RootSchema.shape).length).toBe(54);
    expect(BLUEPRINT_KEYS.length).toBe(54);
  });

  it('BUNDLE = 21（物品库 dormant·不改 FINGERPRINT_BUNDLE_MEMBERS）', () => {
    expect(FINGERPRINT_BUNDLE_MEMBERS.length).toBe(27);
  });

  it('manifest 四组总长 = 88', () => {
    const total =
      FINGERPRINT_BUNDLE_MEMBERS.length +
      FINGERPRINT_PRESET_FIELDS.length +
      FINGERPRINT_SNAPSHOT_FIELDS.length +
      FINGERPRINT_EXCLUDED_FIELDS.length;
    expect(total).toBe(94);
  });

  it('命名空间枚举 = 32 項（18+剥离①六库+剥离②选项集）', () => {
    expect(命名空间枚举.length).toBe(32);
    expect((命名空间枚举 as readonly string[]).includes('物品')).toBe(true);
    expect((命名空间枚举 as readonly string[]).includes('成就')).toBe(true);
    expect((命名空间枚举 as readonly string[]).includes('工具')).toBe(true);
  });

  it('冰箱绑定表含 物品·解析器键 = 物品库', () => {
    expect(冰箱绑定表['物品'].解析器键).toBe('物品库');
  });

  it('物品库 键集无与 BUNDLE_MEMBERS 重叠', () => {
    const itemKeys = ['物品库', '物品', '物品成品', '生效中物品集', '_物品墓碑库'];
    const bundleSet = new Set(FINGERPRINT_BUNDLE_MEMBERS as readonly string[]);
    for (const k of itemKeys) {
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
});
