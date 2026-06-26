/**
 * UI库 schema + resolve + 引用原语验收
 *
 * 断言①  UI库独立 parse：UI条目/UI库Schema parse 正确（信封 typed·配置/渲染位 opaque）
 * 断言②  按 UI_ID resolve 挂载 + 子组件嵌套解析（多层 BFS 展开）
 * 断言③  四类引用解析：解析器键缺失 → fail-open 返 null（option/工具/媒体 尚未建）
 * 断言④  安全硬化覆盖：原型名作 UI_ID/句柄 → 解引用返 null（own-property guard）
 * 断言⑤  不进指纹：BUNDLE=21 不变；改 UI条目 配置 → 金向量逐位恒等
 * 断言⑥  进 content_hash：UI库 内容变 → computeEffectPackHash 值变（mod 可复现面）
 * 断言⑦  守恒门：schemaKeys=52 / BUNDLE=21 / manifest=86 不变；命名空间枚举 15 项
 */
import { describe, it, expect } from 'vitest';
import {
  UI条目Schema,
  UI库Schema,
  UI_ID正则,
} from '../engine/preset/uiLibrary.js';
import type { UI条目Type, UI库Type } from '../engine/preset/uiLibrary.js';
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

// ── UI条目 fixture helpers ──────────────────────────────────────────────────
function mkUI(id: string, overrides: Partial<UI条目Type> = {}): UI条目Type {
  return {
    名称: id,
    类型: 'panel',
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════
// 断言① · UI库独立 parse
// ═══════════════════════════════════════════════════════════════════
describe('UI库 · UI条目Schema · 独立 parse', () => {
  it('最小条目（名称+类型）→ parse 成功', () => {
    const r = UI条目Schema.safeParse({ 名称: '按钮', 类型: 'button' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.名称).toBe('按钮');
      expect(r.data.类型).toBe('button');
    }
  });

  it('缺 名称 → parse 失败', () => {
    const r = UI条目Schema.safeParse({ 类型: 'button' });
    expect(r.success).toBe(false);
  });

  it('缺 类型 → parse 失败', () => {
    const r = UI条目Schema.safeParse({ 名称: '面板' });
    expect(r.success).toBe(false);
  });

  it('信封字段 typed·可选字段缺省时 undefined', () => {
    const r = UI条目Schema.safeParse({ 名称: 'x', 类型: 'y' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.版本).toBeUndefined();
      expect(r.data.作者).toBeUndefined();
      expect(r.data.描述).toBeUndefined();
      expect(r.data.内容哈希).toBeUndefined();
      expect(r.data.子组件).toBeUndefined();
      expect(r.data.配置).toBeUndefined();
      expect(r.data.渲染位).toBeUndefined();
    }
  });

  it('配置/渲染位 接受任意 opaque 载荷（不报错·不丢字段）', () => {
    const r = UI条目Schema.safeParse({
      名称: 'card',
      类型: 'card',
      配置: { color: 'red', nested: { depth: 2, arr: [1, 2] }, flag: true },
      渲染位: { hero_image: null, footer: { type: 'slot' } },
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect((r.data.配置 as Record<string, unknown>)['color']).toBe('red');
      expect((r.data.配置 as Record<string, unknown>)['flag']).toBe(true);
      expect((r.data.渲染位 as Record<string, unknown>)['hero_image']).toBeNull();
    }
  });

  it('四类引用字段均为字符串数组（opaque ID）', () => {
    const r = UI条目Schema.safeParse({
      名称: 'complex',
      类型: 'layout',
      option引用: ['opt_a', 'opt_b'],
      工具引用: ['tool_x'],
      媒体引用: ['img_hero'],
      子组件: ['header', 'footer'],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.option引用).toEqual(['opt_a', 'opt_b']);
      expect(r.data.子组件).toEqual(['header', 'footer']);
    }
  });

  it('类型 = 任意字符串（开放·不枚举）', () => {
    const r1 = UI条目Schema.safeParse({ 名称: 'a', 类型: 'custom_widget_xyz' });
    const r2 = UI条目Schema.safeParse({ 名称: 'b', 类型: '自定义组件' });
    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
  });
});

describe('UI库 · UI库Schema · parse', () => {
  it('空库 parse 成功', () => {
    const r = UI库Schema.safeParse({});
    expect(r.success).toBe(true);
  });

  it('多条目 parse 成功', () => {
    const r = UI库Schema.safeParse({
      panel_main: mkUI('panel_main', { 子组件: ['btn_ok'] }),
      btn_ok: mkUI('btn_ok', { 类型: 'button' }),
    });
    expect(r.success).toBe(true);
  });

  it('UI_ID 不符合正则 → parse 失败', () => {
    const r = UI库Schema.safeParse({ 'Bad-ID': mkUI('Bad-ID') });
    expect(r.success).toBe(false);
  });

  it('UI_ID 含大写 → parse 失败', () => {
    const r = UI库Schema.safeParse({ 'MyPanel': mkUI('MyPanel') });
    expect(r.success).toBe(false);
  });

  it('UI_ID 正则覆盖标准蛇形（与 rule_id/pack_id 一致）', () => {
    expect(UI_ID正则.test('panel_main')).toBe(true);
    expect(UI_ID正则.test('btn2')).toBe(true);
    expect(UI_ID正则.test('2btn')).toBe(false);
    expect(UI_ID正则.test('Btn')).toBe(false);
    expect(UI_ID正则.test('')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 断言② · 按 UI_ID resolve 挂载 + 子组件嵌套解析（多层）
// ═══════════════════════════════════════════════════════════════════
describe('UI库 · resolve 挂载 + 子组件 BFS 展开', () => {
  const uiLib: UI库Type = {
    page_main: mkUI('page_main', { 子组件: ['panel_a', 'panel_b'] }),
    panel_a: mkUI('panel_a', { 子组件: ['btn_ok'] }),
    panel_b: mkUI('panel_b', { 类型: 'sidebar' }),
    btn_ok: mkUI('btn_ok', { 类型: 'button' }),
    orphan: mkUI('orphan', { 类型: 'unused' }),  // 未被引用
  };

  it('resolve manifest.ui → UI成品 含根节点', () => {
    const r = resolve({ packs: [], ui: ['page_main'] }, {}, undefined, uiLib);
    expect(r.UI成品['page_main']).toBeDefined();
  });

  it('子组件 BFS 展开（多层·panel_a.btn_ok 被传递包含）', () => {
    const r = resolve({ packs: [], ui: ['page_main'] }, {}, undefined, uiLib);
    expect(r.UI成品['panel_a']).toBeDefined();
    expect(r.UI成品['panel_b']).toBeDefined();
    expect(r.UI成品['btn_ok']).toBeDefined();
  });

  it('未被引用的节点（orphan）不进 UI成品', () => {
    const r = resolve({ packs: [], ui: ['page_main'] }, {}, undefined, uiLib);
    expect(r.UI成品['orphan']).toBeUndefined();
  });

  it('直接引用叶节点 → UI成品 = {btn_ok}', () => {
    const r = resolve({ packs: [], ui: ['btn_ok'] }, {}, undefined, uiLib);
    expect(Object.keys(r.UI成品)).toEqual(['btn_ok']);
  });

  it('多层嵌套（3 层深）BFS 完整收集', () => {
    const deep: UI库Type = {
      root: mkUI('root', { 子组件: ['mid'] }),
      mid: mkUI('mid', { 子组件: ['leaf'] }),
      leaf: mkUI('leaf', { 类型: 'atom' }),
    };
    const r = resolve({ packs: [], ui: ['root'] }, {}, undefined, deep);
    expect(Object.keys(r.UI成品)).toContain('root');
    expect(Object.keys(r.UI成品)).toContain('mid');
    expect(Object.keys(r.UI成品)).toContain('leaf');
  });

  it('环状引用（A→B→A）不死循环·visited 守卫', () => {
    const cyclic: UI库Type = {
      node_a: mkUI('node_a', { 子组件: ['node_b'] }),
      node_b: mkUI('node_b', { 子组件: ['node_a'] }),
    };
    const r = resolve({ packs: [], ui: ['node_a'] }, {}, undefined, cyclic);
    expect(r.UI成品['node_a']).toBeDefined();
    expect(r.UI成品['node_b']).toBeDefined();
    expect(r.生效中UI集).toHaveLength(2);
  });

  it('manifest.ui 为空 → UI成品空·生效中UI集空', () => {
    const r = resolve({ packs: [] }, {}, undefined, uiLib);
    expect(Object.keys(r.UI成品)).toHaveLength(0);
    expect(r.生效中UI集).toHaveLength(0);
  });

  it('uiLib 未传 → UI成品空·生效中UI集空', () => {
    const r = resolve({ packs: [], ui: ['page_main'] }, {});
    expect(Object.keys(r.UI成品)).toHaveLength(0);
    expect(r.生效中UI集).toHaveLength(0);
  });

  it('子组件引用不存在 UI_ID → fail-open 跳过（不抛错）', () => {
    const partial: UI库Type = {
      root: mkUI('root', { 子组件: ['nonexistent'] }),
    };
    expect(() => resolve({ packs: [], ui: ['root'] }, {}, undefined, partial)).not.toThrow();
    const r = resolve({ packs: [], ui: ['root'] }, {}, undefined, partial);
    expect(r.UI成品['root']).toBeDefined();
    expect(r.UI成品['nonexistent']).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════
// 断言③ · 四类引用解析：解析器键缺失 → fail-open 返 null
// ═══════════════════════════════════════════════════════════════════
describe('UI库 · 四类引用 fail-open（冰箱待建）', () => {
  it('option引用 命名空间待建 → 解引用 fail-open 返 null', () => {
    // option_set库 尚未建·解析器键 undefined
    const ref = 创建引用('标的类型', 'opt_a');  // 借用未建命名空间测 fail-open
    const result = 解引用(ref, {});
    expect(result).toBeNull();
  });

  it('工具引用 命名空间待建 → 解引用 fail-open 返 null', () => {
    const ref = 创建引用('sideEffect句柄', 'tool_x');
    expect(解引用(ref, {})).toBeNull();
  });

  it('媒体引用 命名空间待建 → 解引用 fail-open 返 null', () => {
    const ref = 创建引用('母题', 'img_hero');
    expect(解引用(ref, {})).toBeNull();
  });

  it('UI组件 冰箱存在但成品无对应 key → fail-open 返 null', () => {
    const ref = 创建引用('UI组件', 'panel_main');
    // 成品传空对象（UI库 key 不在其中）
    expect(解引用(ref, {})).toBeNull();
  });

  it('UI组件 冰箱键存在·条目命中 → 返回 UI条目', () => {
    const uiEntry = mkUI('panel_main');
    const ref = 创建引用('UI组件', 'panel_main');
    // 解引用需要成品含 'UI库' key（解析器键=UI库）
    const 成品 = { UI库: { panel_main: uiEntry } };
    const result = 解引用(ref, 成品);
    expect(result).toBeDefined();
    expect((result as UI条目Type).名称).toBe('panel_main');
  });

  it('UI组件 解引用·UI成品作冰箱·多条目命中', () => {
    const uiLib: UI库Type = {
      btn_ok: mkUI('btn_ok', { 类型: 'button', 配置: { label: '确定' } }),
      btn_cancel: mkUI('btn_cancel', { 类型: 'button' }),
    };
    const r = resolve({ packs: [], ui: ['btn_ok', 'btn_cancel'] }, {}, undefined, uiLib);
    const ref = 创建引用('UI组件', 'btn_ok');
    const entry = 解引用(ref, { UI库: r.UI成品 });
    expect((entry as UI条目Type).类型).toBe('button');
    expect(((entry as UI条目Type).配置 as Record<string, unknown>)['label']).toBe('确定');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 断言④ · 安全硬化覆盖（原型名 → 解引用返 null）
// ═══════════════════════════════════════════════════════════════════
describe('UI库 · 安全硬化：原型名 UI_ID/句柄 → null', () => {
  it('UI_ID = constructor → 不作为 own-property 进入 UI成品（BFS own-property guard）', () => {
    // 'constructor' 不在 benign uiLib 自有属性中 → BFS 跳过 → 不进 UI成品
    const benign: UI库Type = { btn_ok: mkUI('btn_ok') };
    const r = resolve({ packs: [], ui: ['constructor', 'btn_ok'] }, {}, undefined, benign);
    // 必须用 hasOwnProperty 检查·直接访问 UI成品['constructor'] 会命中原型链
    expect(Object.prototype.hasOwnProperty.call(r.UI成品, 'constructor')).toBe(false);
    expect(r.UI成品['btn_ok']).toBeDefined();
  });

  it('句柄 = constructor → 引用Schema safeParse 失败（受治理句柄校验）', () => {
    // 受治理句柄Schema 拒绝 JS 保留键
    const s = 引用Schema('UI组件');
    expect(s.safeParse('constructor').success).toBe(false);
    expect(s.safeParse('__proto__').success).toBe(false);
    expect(s.safeParse('prototype').success).toBe(false);
  });

  it('冰箱中 constructor/__proto__ key → 解引用 own-property guard 拦截', () => {
    const ref = 创建引用('UI组件', 'panel_main');
    // 构造一个冰箱·冰箱 record 的 constructor 是 Object 原型上的·非自有属性
    const 成品 = { UI库: { panel_main: mkUI('panel_main') } };
    // panel_main 正常命中
    expect(解引用(ref, 成品)).toBeDefined();
    // 如果用 toString 这类原型成员作 handle：引用Schema 会拒绝·无法到解引用层
    // 但下方验证：即使绕过引用Schema 直接构造 Ref·解引用也安全
    const protoRef = { __ns: 'UI组件' as const, handle: 'toString' };
    // toString 存在于原型链但非自有属性·解引用返 null
    expect(解引用(protoRef, 成品)).toBeNull();
  });

  it('uiLib 查找 own-property guard：__proto__ 作 UI_ID → BFS 跳过', () => {
    const uiLib = { btn_ok: mkUI('btn_ok', { 子组件: ['__proto__'] }) };
    const r = resolve({ packs: [], ui: ['btn_ok'] }, {}, undefined, uiLib);
    // btn_ok 正常加入
    expect(r.UI成品['btn_ok']).toBeDefined();
    // __proto__ 不是自有属性·BFS 跳过·不在 UI成品 中
    expect(Object.prototype.hasOwnProperty.call(r.UI成品, '__proto__')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 断言⑤ · 不进指纹：BUNDLE=21 不变；改 UI条目 配置 → 金向量逐位恒等
// ═══════════════════════════════════════════════════════════════════
describe('UI库 · 不进判定面指纹', () => {
  it('FINGERPRINT_BUNDLE_MEMBERS 不含 UI库相关键（BUNDLE=21）', () => {
    expect(FINGERPRINT_BUNDLE_MEMBERS.length).toBe(21);
    const bundleSet = new Set(FINGERPRINT_BUNDLE_MEMBERS as readonly string[]);
    expect(bundleSet.has('UI库')).toBe(false);
    expect(bundleSet.has('UI组件')).toBe(false);
    expect(bundleSet.has('UI成品')).toBe(false);
  });

  it('含 UI条目 的 resolve 与无 UI 的 resolve → 生效中内容包集哈希一致（UI不贡献内容包哈希）', () => {
    const uiLib: UI库Type = {
      btn_ok: mkUI('btn_ok', { 配置: { color: 'red', size: 'lg' } }),
    };
    const withUI = resolve({ packs: [], ui: ['btn_ok'] }, {}, undefined, uiLib);
    const withoutUI = resolve({ packs: [] }, {});
    expect(withUI.生效中内容包集哈希).toBe(withoutUI.生效中内容包集哈希);
  });

  it('改 UI条目 配置 → hashPresetFingerprint 结果逐位恒等（渲染面零指纹影响）', () => {
    const uiLibV1: UI库Type = {
      btn: mkUI('btn', { 配置: { color: 'red' } }),
    };
    const uiLibV2: UI库Type = {
      btn: mkUI('btn', { 配置: { color: 'blue', size: 'xl' } }),  // 配置改变
    };

    const r1 = resolve({ packs: [], ui: ['btn'] }, {}, undefined, uiLibV1);
    const r2 = resolve({ packs: [], ui: ['btn'] }, {}, undefined, uiLibV2);

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

    expect(fp1).toBe(fp2);  // 金向量逐位恒等
    expect(fp1).toMatch(/^[0-9a-f]{8}$/);
  });

  it('UI库 不在 FINGERPRINT_EXCLUDED_FIELDS（未被显式排除但也不进指纹·通过不进输入实现）', () => {
    // 以装配层手法隔离（不是顶层 key）·无需在排除名单出现
    const excludedSet = new Set(FINGERPRINT_EXCLUDED_FIELDS as readonly string[]);
    // 验证 BUNDLE/EXCLUDED 不含 UI库
    expect(excludedSet.has('UI库')).toBe(false);
    expect(excludedSet.has('UI成品')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 断言⑥ · 进 content_hash：UI条目 内容变 → 包信封哈希变（mod 可复现面）
//
// 双层命名架构（永久契约·禁混用）：
//   「库条目」层 (UI条目/规则条目/内容包条目) = 中文 内容哈希（schema 存储）
//   「包」层 (分发单元·effect pack 信封) = 英文 content_hash  ← computeEffectPackHash 消费
//   生产边界映射 = resolve.ts:222：p.内容哈希 !== undefined ? { content_hash: p.内容哈希 } : {}
//
// 正确用法：哈希 UI条目 前须先经「库条目→包信封」边界映射（复刻 resolve.ts:222）。
// 直接向 computeEffectPackHash 传中文字段的 UI条目 = 绕过边界·测试写法错·禁止。
// UI库 接入 聚合生效中内容包集哈希 留 PR-5d 导入/导出（与工具库/媒体库同批）。
// ═══════════════════════════════════════════════════════════════════

// 复刻 resolve.ts:222 生产边界：库条目(中文 内容哈希) → 包信封(英文 content_hash)
// 与生产路径同源·此函数仅供测试复现生产路径行为
function ui条目ToPackEnvelope(entry: UI条目Type): Record<string, unknown> {
  const { 内容哈希, ...rest } = entry;
  return 内容哈希 !== undefined ? { ...rest, content_hash: 内容哈希 } : { ...rest };
}

describe('UI库 · content_hash（mod 可复现面）', () => {
  it('包信封 computeEffectPackHash 产生确定性 8 字符 hex', () => {
    const entry = mkUI('btn_ok', { 配置: { color: 'red' } });
    const hash = computeEffectPackHash(ui条目ToPackEnvelope(entry));
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('round-trip 闭环：无 content_hash → 算 h → 回填 → 重算 === h（剔除自身·可复现）', () => {
    const entry = mkUI('panel', { 配置: { theme: 'dark' } });
    // Step1: 无 内容哈希 的包信封 → computeEffectPackHash → h
    const envelope = ui条目ToPackEnvelope(entry);
    const h = computeEffectPackHash(envelope);
    // Step2: 回填 content_hash → 重算（content_hash 被 computeEffectPackHash 剔除）
    const envelopeWithHash = { ...envelope, content_hash: h };
    const h2 = computeEffectPackHash(envelopeWithHash);
    // content_hash 剔除 → 输入与 Step1 相同 → 哈希恒等 → round-trip 成立
    expect(h2).toBe(h);
    expect(h).toMatch(/^[0-9a-f]{8}$/);
  });

  it('内容哈希字段不影响包信封哈希（边界映射后 content_hash 被剔·round-trip 守恒）', () => {
    const base = mkUI('x', { 配置: { k: 'v' } });
    const withHash = { ...base, 内容哈希: 'abcd1234' } as UI条目Type;
    // base 无 内容哈希 → 包信封无 content_hash
    // withHash 有 内容哈希 → 包信封有 content_hash → 被 computeEffectPackHash 剔除
    // → 两者实际输入相同 → 哈希相同
    const h1 = computeEffectPackHash(ui条目ToPackEnvelope(base));
    const h2 = computeEffectPackHash(ui条目ToPackEnvelope(withHash));
    expect(h1).toBe(h2);
  });

  it('配置变 → 包信封哈希变（内容敏感）', () => {
    const v1 = mkUI('btn', { 配置: { color: 'red' } });
    const v2 = mkUI('btn', { 配置: { color: 'blue' } });
    const h1 = computeEffectPackHash(ui条目ToPackEnvelope(v1));
    const h2 = computeEffectPackHash(ui条目ToPackEnvelope(v2));
    expect(h1).not.toBe(h2);
  });

  it('类型变 → 包信封哈希变', () => {
    const v1 = mkUI('x', { 类型: 'button' });
    const v2 = mkUI('x', { 类型: 'panel' });
    const h1 = computeEffectPackHash(ui条目ToPackEnvelope(v1));
    const h2 = computeEffectPackHash(ui条目ToPackEnvelope(v2));
    expect(h1).not.toBe(h2);
  });

  it('同内容两次 → 哈希恒等（确定性）', () => {
    const entry = mkUI('btn', { 配置: { x: 1 } });
    const envelope = ui条目ToPackEnvelope(entry);
    expect(computeEffectPackHash(envelope)).toBe(computeEffectPackHash(envelope));
  });
});

// ═══════════════════════════════════════════════════════════════════
// 断言⑦ · 守恒门
// ═══════════════════════════════════════════════════════════════════
describe('UI库 · 守恒门', () => {
  it('schemaKeys = 52（UI库不进 RootSchema·不改顶层键数）', () => {
    expect(Object.keys(RootSchema.shape).length).toBe(52);
    expect(BLUEPRINT_KEYS.length).toBe(52);
  });

  it('BUNDLE = 21（UI库 dormant·不改 FINGERPRINT_BUNDLE_MEMBERS）', () => {
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
    expect(命名空间枚举.length).toBe(17);
    expect((命名空间枚举 as readonly string[]).includes('UI组件')).toBe(true);
    expect((命名空间枚举 as readonly string[]).includes('物品')).toBe(true);
  });

  it('冰箱绑定表含 UI组件·解析器键 = UI库', () => {
    expect(冰箱绑定表['UI组件'].解析器键).toBe('UI库');
  });

  it('UI库 键集无与 BUNDLE_MEMBERS 重叠', () => {
    const uiKeys = ['UI库', 'UI组件', 'UI成品', '生效中UI集', '_UI墓碑库'];
    const bundleSet = new Set(FINGERPRINT_BUNDLE_MEMBERS as readonly string[]);
    for (const k of uiKeys) {
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
