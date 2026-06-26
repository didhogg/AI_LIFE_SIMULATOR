/**
 * 工具库 schema + resolve + 引用原语验收
 *
 * 断言①  工具库独立 parse：工具条目/工具库Schema parse 正确（信封 typed·实现载荷 opaque）
 * 断言②  TOOL_能力条目Schema 独立验收：6 能力类型·触发时机 enum·字段边界
 * 断言③  工具引用Schema parse：带/不带 命名空间覆盖 两态均通过；缺 工具ID 报错
 * 断言④  resolve 挂载：工具引用.工具ID 命中条目 / 未命中 fail-open / 原型名 → 跳过
 * 断言⑤  安全硬化覆盖：原型名作 工具ID → 解引用返 null（own-property guard）
 * 断言⑥  不进 hashJudgmentBundle：改工具库内容 → golden 逐位恒等 · BUNDLE=21 不变
 * 断言⑦  content_hash round-trip 闭环（复刻 UI库 test·库条目→包信封边界映射）
 * 断言⑧  lore 工具引用/状态转移.工具 parse 通过 + 旧 能力集 字段零残留
 * 断言⑨  守恒门：schemaKeys=52 / BUNDLE=21 / manifest=86 / 命名空间枚举 15 项
 */
import { describe, it, expect } from 'vitest';
import {
  工具条目Schema,
  工具库Schema,
  工具引用Schema,
  TOOL_能力类型,
  TOOL_能力条目Schema,
  工具ID正则,
} from '../schema/toolLibrary.js';
import type { 工具条目Type, 工具库Type } from '../schema/toolLibrary.js';
import {
  lore条目Schema,
} from '../schema/lore.js';
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

// ── 工具条目 fixture helpers ──────────────────────────────────────────────────
function mkTool(id: string, overrides: Partial<工具条目Type> = {}): 工具条目Type {
  return {
    名称: id,
    能力: { 类型: 'code' },
    ...overrides,
  };
}

// 复刻 resolve.ts 生产边界：库条目(中文 内容哈希) → 包信封(英文 content_hash)
function tool条目ToPackEnvelope(entry: 工具条目Type): Record<string, unknown> {
  const { 内容哈希, ...rest } = entry;
  return 内容哈希 !== undefined ? { ...rest, content_hash: 内容哈希 } : { ...rest };
}

// ═══════════════════════════════════════════════════════════════════
// 断言① · 工具库独立 parse
// ═══════════════════════════════════════════════════════════════════
describe('工具库 · 工具条目Schema · 独立 parse', () => {
  it('最小条目（名称+能力）→ parse 成功', () => {
    const r = 工具条目Schema.safeParse({ 名称: '骰点工具', 能力: { 类型: 'roll_dice' } });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.名称).toBe('骰点工具');
      expect(r.data.能力.类型).toBe('roll_dice');
    }
  });

  it('缺 名称 → parse 失败', () => {
    const r = 工具条目Schema.safeParse({ 能力: { 类型: 'code' } });
    expect(r.success).toBe(false);
  });

  it('缺 能力 → parse 失败', () => {
    const r = 工具条目Schema.safeParse({ 名称: '工具' });
    expect(r.success).toBe(false);
  });

  it('可选信封字段缺省时 undefined', () => {
    const r = 工具条目Schema.safeParse({ 名称: 'x', 能力: { 类型: 'code' } });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.版本).toBeUndefined();
      expect(r.data.作者).toBeUndefined();
      expect(r.data.描述).toBeUndefined();
      expect(r.data.内容哈希).toBeUndefined();
      expect(r.data.调用约束).toBeUndefined();
      expect(r.data.触发时机).toBeUndefined();
      expect(r.data.需预算).toBeUndefined();
      expect(r.data.输出契约).toBeUndefined();
      expect(r.data.实现载荷).toBeUndefined();
    }
  });

  it('实现载荷 接受任意 opaque 载荷（不报错·不丢字段）', () => {
    const r = 工具条目Schema.safeParse({
      名称: 'llm_tool',
      能力: { 类型: 'llm' },
      实现载荷: { prompt: '你是一个助手', temperature: 0.7, nested: { k: true } },
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect((r.data.实现载荷 as Record<string, unknown>)['prompt']).toBe('你是一个助手');
    }
  });

  it('触发时机 enum 边界：planning/post_pipeline 通过·其他失败', () => {
    const r1 = 工具条目Schema.safeParse({ 名称: 'a', 能力: { 类型: 'trigger' }, 触发时机: 'planning' });
    const r2 = 工具条目Schema.safeParse({ 名称: 'b', 能力: { 类型: 'trigger' }, 触发时机: 'post_pipeline' });
    const r3 = 工具条目Schema.safeParse({ 名称: 'c', 能力: { 类型: 'trigger' }, 触发时机: 'immediate' });
    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
    expect(r3.success).toBe(false);
  });

  it('output_tag 工具带 能力.输出命名空间 parse 通过', () => {
    const r = 工具条目Schema.safeParse({
      名称: 'output_tagger',
      能力: { 类型: 'output_tag', 输出命名空间: 'dialect:苏白口音' },
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.能力.输出命名空间).toBe('dialect:苏白口音');
    }
  });
});

describe('工具库 · 工具库Schema · parse', () => {
  it('空库 parse 成功（default {}）', () => {
    const r = 工具库Schema.safeParse({});
    expect(r.success).toBe(true);
  });

  it('多条目 parse 成功', () => {
    const r = 工具库Schema.safeParse({
      roll_tool: mkTool('roll_tool', { 能力: { 类型: 'roll_dice' } }),
      llm_tool: mkTool('llm_tool', { 能力: { 类型: 'llm' }, 需预算: true }),
    });
    expect(r.success).toBe(true);
  });

  it('工具ID 不符合正则 → parse 失败', () => {
    const r = 工具库Schema.safeParse({ 'Bad-ID': mkTool('Bad-ID') });
    expect(r.success).toBe(false);
  });

  it('工具ID 含大写 → parse 失败', () => {
    const r = 工具库Schema.safeParse({ 'MyTool': mkTool('MyTool') });
    expect(r.success).toBe(false);
  });

  it('工具ID 正则覆盖标准蛇形（与 rule_id/pack_id/UI_ID 一致）', () => {
    expect(工具ID正则.test('roll_dice_tool')).toBe(true);
    expect(工具ID正则.test('tool2')).toBe(true);
    expect(工具ID正则.test('2tool')).toBe(false);
    expect(工具ID正则.test('Tool')).toBe(false);
    expect(工具ID正则.test('')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 断言② · TOOL_能力条目Schema 独立验收（唯一权威已在 toolLibrary.ts）
// ═══════════════════════════════════════════════════════════════════
describe('工具库 · TOOL_能力类型 + TOOL_能力条目Schema 独立验收', () => {
  it('TOOL_能力类型 枚举包含全部六种类型', () => {
    expect(TOOL_能力类型).toContain('code');
    expect(TOOL_能力类型).toContain('llm');
    expect(TOOL_能力类型).toContain('roll_dice');
    expect(TOOL_能力类型).toContain('json_schema');
    expect(TOOL_能力类型).toContain('trigger');
    expect(TOOL_能力类型).toContain('output_tag');
    expect(TOOL_能力类型).toHaveLength(6);
  });

  it('output_tag 带 输出命名空间 parse 通过', () => {
    const r = TOOL_能力条目Schema.parse({ 类型: 'output_tag', 输出命名空间: 'cuisine:flavor_tag' });
    expect(r.类型).toBe('output_tag');
    expect(r.输出命名空间).toBe('cuisine:flavor_tag');
  });

  it('输出命名空间 可缺省（非 output_tag 类型）', () => {
    const r = TOOL_能力条目Schema.parse({ 类型: 'roll_dice' });
    expect(r.类型).toBe('roll_dice');
    expect(r.输出命名空间).toBeUndefined();
  });

  it('非法类型 → 校验失败', () => {
    expect(TOOL_能力条目Schema.safeParse({ 类型: 'eval_js' }).success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 断言③ · 工具引用Schema parse
// ═══════════════════════════════════════════════════════════════════
describe('工具库 · 工具引用Schema parse', () => {
  it('仅 工具ID → parse 通过', () => {
    const r = 工具引用Schema.safeParse({ 工具ID: 'roll_dice_tool' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.工具ID).toBe('roll_dice_tool');
      expect(r.data.命名空间覆盖).toBeUndefined();
    }
  });

  it('工具ID + 命名空间覆盖 → parse 通过', () => {
    const r = 工具引用Schema.safeParse({ 工具ID: 'dialect_output_tag', 命名空间覆盖: 'dialect:苏白口音' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.工具ID).toBe('dialect_output_tag');
      expect(r.data.命名空间覆盖).toBe('dialect:苏白口音');
    }
  });

  it('缺 工具ID → parse 失败', () => {
    const r = 工具引用Schema.safeParse({ 命名空间覆盖: 'some:ns' });
    expect(r.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 断言④ · resolve 挂载：by-ID 加载 + 未命中 fail-open
// ═══════════════════════════════════════════════════════════════════
describe('工具库 · resolve 挂载 + by-ID 加载', () => {
  const toolLib: 工具库Type = {
    roll_tool: mkTool('roll_tool', { 能力: { 类型: 'roll_dice' } }),
    llm_tool: mkTool('llm_tool', { 能力: { 类型: 'llm' }, 需预算: true }),
    orphan: mkTool('orphan', { 能力: { 类型: 'code' } }),
  };

  it('resolve manifest.tools → 工具成品 含引用条目', () => {
    const r = resolve({ packs: [], tools: ['roll_tool'] }, {}, undefined, undefined, toolLib);
    expect(r.工具成品['roll_tool']).toBeDefined();
    expect(r.工具成品['roll_tool']!.能力.类型).toBe('roll_dice');
  });

  it('多条目引用 → 工具成品 含全部命中', () => {
    const r = resolve({ packs: [], tools: ['roll_tool', 'llm_tool'] }, {}, undefined, undefined, toolLib);
    expect(r.工具成品['roll_tool']).toBeDefined();
    expect(r.工具成品['llm_tool']).toBeDefined();
  });

  it('未被引用的 orphan 不进 工具成品', () => {
    const r = resolve({ packs: [], tools: ['roll_tool'] }, {}, undefined, undefined, toolLib);
    expect(r.工具成品['orphan']).toBeUndefined();
  });

  it('引用不存在 工具ID → fail-open 跳过（不抛错）', () => {
    expect(() => resolve({ packs: [], tools: ['nonexistent'] }, {}, undefined, undefined, toolLib)).not.toThrow();
    const r = resolve({ packs: [], tools: ['nonexistent'] }, {}, undefined, undefined, toolLib);
    expect(Object.keys(r.工具成品)).toHaveLength(0);
  });

  it('manifest.tools 为空 → 工具成品空·生效中工具集空', () => {
    const r = resolve({ packs: [] }, {}, undefined, undefined, toolLib);
    expect(Object.keys(r.工具成品)).toHaveLength(0);
    expect(r.生效中工具集).toHaveLength(0);
  });

  it('toolLib 未传 → 工具成品空·生效中工具集空', () => {
    const r = resolve({ packs: [], tools: ['roll_tool'] }, {});
    expect(Object.keys(r.工具成品)).toHaveLength(0);
    expect(r.生效中工具集).toHaveLength(0);
  });

  it('生效中工具集 顺序与 manifest.tools 一致', () => {
    const r = resolve({ packs: [], tools: ['llm_tool', 'roll_tool'] }, {}, undefined, undefined, toolLib);
    expect(r.生效中工具集[0]!.名称).toBe('llm_tool');
    expect(r.生效中工具集[1]!.名称).toBe('roll_tool');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 断言⑤ · 安全硬化覆盖（原型名 → 解引用返 null）
// ═══════════════════════════════════════════════════════════════════
describe('工具库 · 安全硬化：原型名 工具ID → null', () => {
  it('工具ID = constructor → own-property guard 拦截（不进 工具成品）', () => {
    const benign: 工具库Type = { roll_tool: mkTool('roll_tool') };
    const r = resolve({ packs: [], tools: ['constructor', 'roll_tool'] }, {}, undefined, undefined, benign);
    expect(Object.prototype.hasOwnProperty.call(r.工具成品, 'constructor')).toBe(false);
    expect(r.工具成品['roll_tool']).toBeDefined();
  });

  it('工具 命名空间·句柄 = constructor → 引用Schema safeParse 失败', () => {
    const s = 引用Schema('工具');
    expect(s.safeParse('constructor').success).toBe(false);
    expect(s.safeParse('__proto__').success).toBe(false);
    expect(s.safeParse('prototype').success).toBe(false);
  });

  it('冰箱中 toString 作 handle → 解引用 own-property guard 拦截', () => {
    const toolEntry = mkTool('roll_tool');
    const 成品 = { 工具库: { roll_tool: toolEntry } };
    // 正常引用命中
    const ref = 创建引用('工具', 'roll_tool');
    expect(解引用(ref, 成品)).toBeDefined();
    // 原型成员非自有属性 → null
    const protoRef = { __ns: '工具' as const, handle: 'toString' };
    expect(解引用(protoRef, 成品)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════
// 断言⑥ · 不进 hashJudgmentBundle：BUNDLE=21；改工具库 → 金向量恒等
// ═══════════════════════════════════════════════════════════════════
describe('工具库 · 不进判定面指纹', () => {
  it('FINGERPRINT_BUNDLE_MEMBERS 不含工具库相关键（BUNDLE=21）', () => {
    expect(FINGERPRINT_BUNDLE_MEMBERS.length).toBe(21);
    const bundleSet = new Set(FINGERPRINT_BUNDLE_MEMBERS as readonly string[]);
    expect(bundleSet.has('工具库')).toBe(false);
    expect(bundleSet.has('工具')).toBe(false);
    expect(bundleSet.has('工具成品')).toBe(false);
  });

  it('含工具库 的 resolve 与无工具 的 resolve → 生效中内容包集哈希一致（工具不贡献内容包哈希）', () => {
    const toolLib: 工具库Type = {
      code_tool: mkTool('code_tool', { 能力: { 类型: 'code' }, 实现载荷: { expr: 'a + b' } }),
    };
    const withTool = resolve({ packs: [], tools: ['code_tool'] }, {}, undefined, undefined, toolLib);
    const withoutTool = resolve({ packs: [] }, {});
    expect(withTool.生效中内容包集哈希).toBe(withoutTool.生效中内容包集哈希);
  });

  it('改工具库内容 + 改 命名空间覆盖 → hashPresetFingerprint 结果逐位恒等', () => {
    const toolLibV1: 工具库Type = {
      t: mkTool('t', { 能力: { 类型: 'code' }, 实现载荷: { expr: 'x > 0' } }),
    };
    const toolLibV2: 工具库Type = {
      t: mkTool('t', { 能力: { 类型: 'code' }, 实现载荷: { expr: 'x > 99' } }),
    };
    const r1 = resolve({ packs: [], tools: ['t'] }, {}, undefined, undefined, toolLibV1);
    const r2 = resolve({ packs: [], tools: ['t'] }, {}, undefined, undefined, toolLibV2);
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
});

// ═══════════════════════════════════════════════════════════════════
// 断言⑦ · content_hash round-trip 闭环（库条目→包信封边界映射）
// ═══════════════════════════════════════════════════════════════════
describe('工具库 · content_hash（mod 可复现面）', () => {
  it('包信封 computeEffectPackHash 产生确定性 8 字符 hex', () => {
    const entry = mkTool('t', { 能力: { 类型: 'code' }, 实现载荷: { expr: 'x > 0' } });
    const hash = computeEffectPackHash(tool条目ToPackEnvelope(entry));
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('round-trip 闭环：无 content_hash → 算 h → 回填 → 重算 === h', () => {
    const entry = mkTool('t', { 能力: { 类型: 'llm' }, 实现载荷: { prompt: '你好' } });
    const envelope = tool条目ToPackEnvelope(entry);
    const h = computeEffectPackHash(envelope);
    const envelopeWithHash = { ...envelope, content_hash: h };
    const h2 = computeEffectPackHash(envelopeWithHash);
    expect(h2).toBe(h);
    expect(h).toMatch(/^[0-9a-f]{8}$/);
  });

  it('内容哈希字段不影响包信封哈希（边界映射后 content_hash 被剔·round-trip 守恒）', () => {
    const base = mkTool('t', { 能力: { 类型: 'code' } });
    const withHash = { ...base, 内容哈希: 'abcd1234' } as 工具条目Type;
    const h1 = computeEffectPackHash(tool条目ToPackEnvelope(base));
    const h2 = computeEffectPackHash(tool条目ToPackEnvelope(withHash));
    expect(h1).toBe(h2);
  });

  it('实现载荷变 → 包信封哈希变（内容敏感）', () => {
    const v1 = mkTool('t', { 能力: { 类型: 'code' }, 实现载荷: { expr: 'a' } });
    const v2 = mkTool('t', { 能力: { 类型: 'code' }, 实现载荷: { expr: 'b' } });
    const h1 = computeEffectPackHash(tool条目ToPackEnvelope(v1));
    const h2 = computeEffectPackHash(tool条目ToPackEnvelope(v2));
    expect(h1).not.toBe(h2);
  });

  it('同内容两次 → 哈希恒等（确定性）', () => {
    const entry = mkTool('t', { 能力: { 类型: 'code' } });
    const envelope = tool条目ToPackEnvelope(entry);
    expect(computeEffectPackHash(envelope)).toBe(computeEffectPackHash(envelope));
  });
});

// ═══════════════════════════════════════════════════════════════════
// 断言⑧ · lore 工具引用/状态转移.工具 改引用形态后 parse 通过
// ═══════════════════════════════════════════════════════════════════
describe('工具库 · lore 引用形态验收', () => {
  it('lore条目.工具引用 为 工具引用Schema 数组·parse 通过', () => {
    const r = lore条目Schema.safeParse({
      工具引用: [
        { 工具ID: 'cuisine_trigger' },
        { 工具ID: 'output_tagger', 命名空间覆盖: 'cuisine:flavor_tag' },
      ],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.工具引用![0]!.工具ID).toBe('cuisine_trigger');
      expect(r.data.工具引用![1]!.命名空间覆盖).toBe('cuisine:flavor_tag');
    }
  });

  it('lore条目.状态转移.工具 为 工具引用Schema·parse 通过', () => {
    const r = lore条目Schema.safeParse({
      状态转移: [
        {
          触发条件: 'x > 0',
          动作描述: '触发工具',
          结果状态: '已触发',
          工具: { 工具ID: 'trigger_tool', 命名空间覆盖: 'dialect:苏白口音' },
        },
      ],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.状态转移![0]!.工具!.工具ID).toBe('trigger_tool');
      expect(r.data.状态转移![0]!.工具!.命名空间覆盖).toBe('dialect:苏白口音');
    }
  });

  it('lore条目 无 能力集 字段（旧字段零残留·schema 已迁移）', () => {
    const r = lore条目Schema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) {
      // 旧 能力集 字段不存在于新 schema 产出
      expect('能力集' in r.data).toBe(false);
    }
  });

  it('lore条目.工具引用 缺省 undefined', () => {
    const r = lore条目Schema.parse({});
    expect(r.工具引用).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════
// 断言⑨ · 守恒门
// ═══════════════════════════════════════════════════════════════════
describe('工具库 · 守恒门', () => {
  it('schemaKeys = 52（工具库不进 RootSchema·不改顶层键数）', () => {
    expect(Object.keys(RootSchema.shape).length).toBe(52);
    expect(BLUEPRINT_KEYS.length).toBe(52);
  });

  it('BUNDLE = 21（工具库 dormant·不改 FINGERPRINT_BUNDLE_MEMBERS）', () => {
    expect(FINGERPRINT_BUNDLE_MEMBERS.length).toBe(21);
  });

  it('manifest 四组总长 = 86（不变）', () => {
    const total =
      FINGERPRINT_BUNDLE_MEMBERS.length +
      FINGERPRINT_PRESET_FIELDS.length +
      FINGERPRINT_SNAPSHOT_FIELDS.length +
      FINGERPRINT_EXCLUDED_FIELDS.length;
    expect(total).toBe(86);
  });

  it('命名空间枚举 = 17 项（16+物品）', () => {
    expect(命名空间枚举.length).toBe(18);
    expect((命名空间枚举 as readonly string[]).includes('工具')).toBe(true);
    expect((命名空间枚举 as readonly string[]).includes('UI组件')).toBe(true);
    expect((命名空间枚举 as readonly string[]).includes('物品')).toBe(true);
  });

  it('冰箱绑定表含 工具·解析器键 = 工具库', () => {
    expect(冰箱绑定表['工具'].解析器键).toBe('工具库');
  });

  it('工具库 键集无与 BUNDLE_MEMBERS 重叠', () => {
    const toolKeys = ['工具库', '工具', '工具成品', '生效中工具集', '_工具墓碑库'];
    const bundleSet = new Set(FINGERPRINT_BUNDLE_MEMBERS as readonly string[]);
    for (const k of toolKeys) {
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
