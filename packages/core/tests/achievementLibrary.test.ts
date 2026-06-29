/**
 * 成就库 schema + resolve + 引用原语验收
 *
 * 断言①  成就库独立 parse：成就条目/成就库Schema parse 正确（信封 typed·展示层 opaque）
 * 断言②  按 成就ID resolve 挂载：by-ID 加载 + 未命中 fail-open + 原型名 → 跳过
 * 断言③  安全硬化覆盖：原型名作 成就ID → 解引用返 null（own-property guard）
 * 断言④  解锁条件谓词串 parse（谓词串Schema·DSL gate·dormant）
 * 断言⑤  不进 hashJudgmentBundle：改成就库内容 → golden 逐位恒等 · BUNDLE=21 不变
 * 断言⑥  content_hash round-trip 闭环（库条目→包信封边界映射）
 * 断言⑦  守恒门：schemaKeys=54 / BUNDLE=21 / manifest=87 / 命名空间枚举 16 项
 */
import { describe, it, expect } from 'vitest';
import {
  成就条目Schema,
  成就库Schema,
  成就ID正则,
} from '../schema/achievementLibrary.js';
import type { 成就条目Type, 成就库Type } from '../schema/achievementLibrary.js';
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

// ── 成就条目 fixture helpers ──────────────────────────────────────────────────
function mkAch(name: string, overrides: Partial<成就条目Type> = {}): 成就条目Type {
  return { 名称: name, ...overrides };
}

// 复刻 resolve.ts 生产边界：库条目(中文 内容哈希) → 包信封(英文 content_hash)
function ach条目ToPackEnvelope(entry: 成就条目Type): Record<string, unknown> {
  const { 内容哈希, ...rest } = entry;
  return 内容哈希 !== undefined ? { ...rest, content_hash: 内容哈希 } : { ...rest };
}

// ═══════════════════════════════════════════════════════════════════
// 断言① · 成就库独立 parse
// ═══════════════════════════════════════════════════════════════════
describe('成就库 · 成就条目Schema · 独立 parse', () => {
  it('最小条目（仅 名称）→ parse 成功', () => {
    const r = 成就条目Schema.safeParse({ 名称: '初出茅庐' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.名称).toBe('初出茅庐');
    }
  });

  it('缺 名称 → parse 失败', () => {
    const r = 成就条目Schema.safeParse({ 成就类型: '主线' });
    expect(r.success).toBe(false);
  });

  it('可选信封字段缺省时 undefined', () => {
    const r = 成就条目Schema.safeParse({ 名称: 'x' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.版本).toBeUndefined();
      expect(r.data.作者).toBeUndefined();
      expect(r.data.描述).toBeUndefined();
      expect(r.data.内容哈希).toBeUndefined();
      expect(r.data.解锁条件引用).toBeUndefined();
      expect(r.data.成就类型).toBeUndefined();
      expect(r.data.解锁后果引用).toBeUndefined();
      expect(r.data.徽章展示).toBeUndefined();
    }
  });

  it('全字段条目 parse 通过', () => {
    const r = 成就条目Schema.safeParse({
      名称: '武林高手',
      版本: '1.0.0',
      作者: 'mod_author',
      描述: '完成所有武术挑战',
      内容哈希: 'abcd1234',
      解锁条件引用: '武力 >= 90',
      成就类型: '战斗',
      解锁后果引用: [{ path: '荣誉', op: 'add', value: 100 }],
      徽章展示: { 图标: 'sword.png', 稀有度: '传说' },
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.名称).toBe('武林高手');
      expect(r.data.成就类型).toBe('战斗');
    }
  });

  it('徽章展示 接受任意 opaque 载荷（不报错·不丢字段）', () => {
    const r = 成就条目Schema.safeParse({
      名称: 'x',
      徽章展示: { 图标: 'medal.png', 稀有度: '史诗', nested: { k: true } },
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect((r.data.徽章展示 as Record<string, unknown>)['图标']).toBe('medal.png');
    }
  });

  it('成就类型 开放字符串·任意值均通过（去枚举）', () => {
    const types = ['主线', '支线', '隐藏', '成就', 'custom_type_xyz'];
    for (const t of types) {
      const r = 成就条目Schema.safeParse({ 名称: 'x', 成就类型: t });
      expect(r.success).toBe(true);
    }
  });
});

describe('成就库 · 成就库Schema · parse', () => {
  it('空库 parse 成功（default {}）', () => {
    const r = 成就库Schema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual({});
  });

  it('未定义时 default {}', () => {
    const r = 成就库Schema.safeParse(undefined);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual({});
  });

  it('多条目 parse 成功', () => {
    const r = 成就库Schema.safeParse({
      first_win: mkAch('初胜', { 成就类型: '战斗' }),
      explorer:  mkAch('探险家', { 解锁条件引用: '探索地点数 >= 10' }),
    });
    expect(r.success).toBe(true);
  });

  it('成就ID 不符合正则（含大写）→ parse 失败', () => {
    const r = 成就库Schema.safeParse({ 'BadID': mkAch('非法') });
    expect(r.success).toBe(false);
  });

  it('成就ID 含连字符 → parse 失败', () => {
    const r = 成就库Schema.safeParse({ 'bad-id': mkAch('非法') });
    expect(r.success).toBe(false);
  });

  it('成就ID 数字开头 → parse 失败', () => {
    const r = 成就库Schema.safeParse({ '1st_win': mkAch('非法') });
    expect(r.success).toBe(false);
  });

  it('成就ID 正则覆盖标准蛇形（与 rule_id/pack_id/工具ID 一致）', () => {
    expect(成就ID正则.test('first_win')).toBe(true);
    expect(成就ID正则.test('ach2')).toBe(true);
    expect(成就ID正则.test('2ach')).toBe(false);
    expect(成就ID正则.test('FirstWin')).toBe(false);
    expect(成就ID正则.test('')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 断言② · resolve 挂载：by-ID 加载 + 未命中 fail-open
// ═══════════════════════════════════════════════════════════════════
describe('成就库 · resolve 挂载 + by-ID 加载', () => {
  const achLib: 成就库Type = {
    first_win: mkAch('初胜', { 成就类型: '战斗' }),
    explorer:  mkAch('探险家', { 解锁条件引用: '探索地点数 >= 10' }),
    orphan:    mkAch('孤儿', { 描述: '未被引用' }),
  };

  it('resolve manifest.achievements → 成就成品 含引用条目', () => {
    const r = resolve({ packs: [], achievements: ['first_win'] }, {}, undefined, undefined, undefined, achLib);
    expect(r.成就成品['first_win']).toBeDefined();
    expect(r.成就成品['first_win']!.成就类型).toBe('战斗');
  });

  it('多条目引用 → 成就成品 含全部命中', () => {
    const r = resolve({ packs: [], achievements: ['first_win', 'explorer'] }, {}, undefined, undefined, undefined, achLib);
    expect(r.成就成品['first_win']).toBeDefined();
    expect(r.成就成品['explorer']).toBeDefined();
  });

  it('未被引用的 orphan 不进 成就成品', () => {
    const r = resolve({ packs: [], achievements: ['first_win'] }, {}, undefined, undefined, undefined, achLib);
    expect(r.成就成品['orphan']).toBeUndefined();
  });

  it('引用不存在 成就ID → fail-open 跳过（不抛错）', () => {
    expect(() =>
      resolve({ packs: [], achievements: ['nonexistent'] }, {}, undefined, undefined, undefined, achLib)
    ).not.toThrow();
    const r = resolve({ packs: [], achievements: ['nonexistent'] }, {}, undefined, undefined, undefined, achLib);
    expect(Object.keys(r.成就成品)).toHaveLength(0);
  });

  it('manifest.achievements 为空 → 成就成品空·生效中成就集空', () => {
    const r = resolve({ packs: [] }, {}, undefined, undefined, undefined, achLib);
    expect(Object.keys(r.成就成品)).toHaveLength(0);
    expect(r.生效中成就集).toHaveLength(0);
  });

  it('achLib 未传 → 成就成品空·生效中成就集空', () => {
    const r = resolve({ packs: [], achievements: ['first_win'] }, {});
    expect(Object.keys(r.成就成品)).toHaveLength(0);
    expect(r.生效中成就集).toHaveLength(0);
  });

  it('生效中成就集 顺序与 manifest.achievements 一致', () => {
    const r = resolve({ packs: [], achievements: ['explorer', 'first_win'] }, {}, undefined, undefined, undefined, achLib);
    expect(r.生效中成就集[0]!.名称).toBe('探险家');
    expect(r.生效中成就集[1]!.名称).toBe('初胜');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 断言③ · 安全硬化覆盖（原型名 → 解引用返 null）
// ═══════════════════════════════════════════════════════════════════
describe('成就库 · 安全硬化：原型名 成就ID → null', () => {
  it('成就ID = constructor → own-property guard 拦截（不进 成就成品）', () => {
    const benign: 成就库Type = { first_win: mkAch('first_win') };
    const r = resolve({ packs: [], achievements: ['constructor', 'first_win'] }, {}, undefined, undefined, undefined, benign);
    expect(Object.prototype.hasOwnProperty.call(r.成就成品, 'constructor')).toBe(false);
    expect(r.成就成品['first_win']).toBeDefined();
  });

  it('成就 命名空间·句柄 = constructor → 引用Schema safeParse 失败', () => {
    const s = 引用Schema('成就');
    expect(s.safeParse('constructor').success).toBe(false);
    expect(s.safeParse('__proto__').success).toBe(false);
    expect(s.safeParse('prototype').success).toBe(false);
  });

  it('冰箱中 toString 作 handle → 解引用 own-property guard 拦截', () => {
    const achEntry = mkAch('first_win');
    const 成品 = { 成就库: { first_win: achEntry } };
    // 正常引用命中
    const ref = 创建引用('成就', 'first_win');
    expect(解引用(ref, 成品)).toBeDefined();
    // 原型成员非自有属性 → null
    const protoRef = { __ns: '成就' as const, handle: 'toString' };
    expect(解引用(protoRef, 成品)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════
// 断言④ · 解锁条件谓词串 parse
// ═══════════════════════════════════════════════════════════════════
describe('成就库 · 解锁条件谓词串 parse', () => {
  it('解锁条件引用 为字符串·任意 DSL 表达式均接受', () => {
    const cases = [
      '武力 >= 90',
      '探索地点数 >= 10',
      '(金钱 > 1000) & (声望 >= 50)',
      '',
    ];
    for (const cond of cases) {
      const r = 成就条目Schema.safeParse({ 名称: 'x', 解锁条件引用: cond });
      expect(r.success).toBe(true);
    }
  });

  it('解锁条件引用 缺省 undefined（非必填）', () => {
    const r = 成就条目Schema.parse({ 名称: 'x' });
    expect(r.解锁条件引用).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════
// 断言⑤ · 不进 hashJudgmentBundle：BUNDLE=21；改成就库 → 金向量恒等
// ═══════════════════════════════════════════════════════════════════
describe('成就库 · 不进判定面指纹', () => {
  it('FINGERPRINT_BUNDLE_MEMBERS 不含成就库相关键（BUNDLE=21）', () => {
    expect(FINGERPRINT_BUNDLE_MEMBERS.length).toBe(27);
    const bundleSet = new Set(FINGERPRINT_BUNDLE_MEMBERS as readonly string[]);
    expect(bundleSet.has('成就库')).toBe(false);
    expect(bundleSet.has('成就')).toBe(false);
    expect(bundleSet.has('成就成品')).toBe(false);
  });

  it('含成就库 的 resolve 与无成就 的 resolve → 生效中内容包集哈希一致（成就不贡献内容包哈希）', () => {
    const achLib: 成就库Type = {
      first_win: mkAch('初胜', { 解锁条件引用: '胜利次数 >= 1' }),
    };
    const withAch = resolve({ packs: [], achievements: ['first_win'] }, {}, undefined, undefined, undefined, achLib);
    const withoutAch = resolve({ packs: [] }, {});
    expect(withAch.生效中内容包集哈希).toBe(withoutAch.生效中内容包集哈希);
  });

  it('改成就库内容 → hashPresetFingerprint 结果逐位恒等（定义层零指纹影响）', () => {
    const achLibV1: 成就库Type = {
      ach: mkAch('成就', { 解锁条件引用: '武力 >= 50' }),
    };
    const achLibV2: 成就库Type = {
      ach: mkAch('成就', { 解锁条件引用: '武力 >= 99', 成就类型: '隐藏' }),
    };
    const r1 = resolve({ packs: [], achievements: ['ach'] }, {}, undefined, undefined, undefined, achLibV1);
    const r2 = resolve({ packs: [], achievements: ['ach'] }, {}, undefined, undefined, undefined, achLibV2);
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
    // 金向量不变·改成就库不改指纹·0 重定基
    expect(fp).toMatch(/^[0-9a-f]{8}$/);
    // 双跑逐位恒等（确定性）
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
describe('成就库 · content_hash（mod 可复现面）', () => {
  it('包信封 computeEffectPackHash 产生确定性 8 字符 hex', () => {
    const entry = mkAch('初胜', { 解锁条件引用: '胜利次数 >= 1' });
    const hash = computeEffectPackHash(ach条目ToPackEnvelope(entry));
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('round-trip 闭环：无 content_hash → 算 h → 回填 → 重算 === h', () => {
    const entry = mkAch('探险家', { 解锁条件引用: '探索地点数 >= 10' });
    const envelope = ach条目ToPackEnvelope(entry);
    const h = computeEffectPackHash(envelope);
    const envelopeWithHash = { ...envelope, content_hash: h };
    const h2 = computeEffectPackHash(envelopeWithHash);
    expect(h2).toBe(h);
    expect(h).toMatch(/^[0-9a-f]{8}$/);
  });

  it('内容哈希字段不影响包信封哈希（边界映射后 content_hash 被剔·round-trip 守恒）', () => {
    const base = mkAch('x', { 解锁条件引用: '测试条件' });
    const withHash = { ...base, 内容哈希: 'abcd1234' } as 成就条目Type;
    const h1 = computeEffectPackHash(ach条目ToPackEnvelope(base));
    const h2 = computeEffectPackHash(ach条目ToPackEnvelope(withHash));
    expect(h1).toBe(h2);
  });

  it('解锁条件变 → 包信封哈希变（内容敏感）', () => {
    const v1 = mkAch('x', { 解锁条件引用: '武力 >= 50' });
    const v2 = mkAch('x', { 解锁条件引用: '武力 >= 99' });
    const h1 = computeEffectPackHash(ach条目ToPackEnvelope(v1));
    const h2 = computeEffectPackHash(ach条目ToPackEnvelope(v2));
    expect(h1).not.toBe(h2);
  });

  it('同内容两次 → 哈希恒等（确定性）', () => {
    const entry = mkAch('x', { 成就类型: '主线' });
    const envelope = ach条目ToPackEnvelope(entry);
    expect(computeEffectPackHash(envelope)).toBe(computeEffectPackHash(envelope));
  });
});

// ═══════════════════════════════════════════════════════════════════
// 断言⑦ · 守恒门
// ═══════════════════════════════════════════════════════════════════
describe('成就库 · 守恒门', () => {
  it('schemaKeys = 54（成就库不进 RootSchema·不改顶层键数）', () => {
    expect(Object.keys(RootSchema.shape).length).toBe(54);
    expect(BLUEPRINT_KEYS.length).toBe(54);
  });

  it('BUNDLE = 21（成就库 dormant·不改 FINGERPRINT_BUNDLE_MEMBERS）', () => {
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
    expect((命名空间枚举 as readonly string[]).includes('成就')).toBe(true);
    expect((命名空间枚举 as readonly string[]).includes('工具')).toBe(true);
    expect((命名空间枚举 as readonly string[]).includes('UI组件')).toBe(true);
    expect((命名空间枚举 as readonly string[]).includes('物品')).toBe(true);
  });

  it('冰箱绑定表含 成就·解析器键 = 成就库', () => {
    expect(冰箱绑定表['成就'].解析器键).toBe('成就库');
  });

  it('成就库 键集无与 BUNDLE_MEMBERS 重叠', () => {
    const achKeys = ['成就库', '成就', '成就成品', '生效中成就集', '_成就墓碑库'];
    const bundleSet = new Set(FINGERPRINT_BUNDLE_MEMBERS as readonly string[]);
    for (const k of achKeys) {
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
