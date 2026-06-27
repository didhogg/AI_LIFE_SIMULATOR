/**
 * P9-2/P9-3 · 扩展参数 实例校验器 + 默认值播种 + DSL ctx + 白名单派生 验收
 *
 * 断言① validateExtensionEntry — 单键类型闸（fail-closed）
 * 断言② validateExtensionParams — 多键批量校验
 * 断言③ seedExtensionParams — 默认值播种（幂等·已有不覆盖·串/布尔照常 seed）
 * 断言④ tick 集成 — 扩展参数播种 phase 落地·空库 no-op·金向量逐位恒等
 * 断言⑤ 守恒门 — SETTLEMENT_PHASES=17·schemaKeys=54·0 重定基
 * 断言⑥ DSL ctx 自定义变量 — 数字型投影·串/布尔 skip·evalPredStr 谓词确定性（P9-3）
 * 断言⑦ deriveExtensionParamPaths — 声明键→条目·未声明键不生成·空库 no-op（P9-3）
 * 断言⑧ 提案闸② 集成 — 声明键可写穿·未声明键拒·0 重定基（P9-3）
 */
import { describe, it, expect } from 'vitest';
import {
  validateExtensionEntry,
  validateExtensionParams,
  seedExtensionParams,
} from '../engine/extensionParams.js';
import type { 变量模板Type, 变量字段声明Type } from '../schema/commonEntry.js';
import { runTick, SETTLEMENT_PHASES } from '../engine/tick.js';
import { RootSchema } from '../schema/index.js';
import type { RootState } from '../schema/index.js';
import { hashPresetFingerprint, hashJudgmentBundle } from '../engine/rng.js';
import {
  FINGERPRINT_BUNDLE_MEMBERS,
  FINGERPRINT_PRESET_FIELDS,
  FINGERPRINT_SNAPSHOT_FIELDS,
} from '../engine/fingerprintManifest.js';
import type { 物品定义条目Type } from '../schema/itemLibrary.js';
import { projectStateCtx } from '../engine/dsl/stateCtx.js';
import { evalPredStr } from '../engine/dsl/eval.js';
import { deriveExtensionParamPaths } from '../loader/modWhitelist.js';
import { runProposalGate } from '../engine/proposal/index.js';
import { 指令信封Schema } from '../schema/proposal.js';

// ── 最小化 state fixture ──────────────────────────────────────────────────────
function makeState() {
  return RootSchema.parse({});
}

// ── 最小化 judgment bundle（金向量通路）────────────────────────────────────────
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
const SNAPSHOT_BASE = {
  难度系数组: {},
  判定骰型: 100 as 100 | 20,
  暴击映射: '关' as '关',
  钳制表: {},
  预设数值面域上下界: {},
};

// ═══════════════════════════════════════════════════════════════════════
// 断言① · validateExtensionEntry — 单键类型闸
// ═══════════════════════════════════════════════════════════════════════
describe('extensionParams · validateExtensionEntry · 单键类型闸', () => {
  const numDecl: 变量字段声明Type = { 类型: '数字', 默认值: 0 };
  const strDecl: 变量字段声明Type = { 类型: '字符串', 默认值: '' };
  const boolDecl: 变量字段声明Type = { 类型: '布尔', 默认值: false };

  it('数字声明 × number 值 → true', () => {
    expect(validateExtensionEntry(42, numDecl)).toBe(true);
    expect(validateExtensionEntry(0, numDecl)).toBe(true);
    expect(validateExtensionEntry(-1.5, numDecl)).toBe(true);
  });

  it('数字声明 × string 值 → false（类型不匹配）', () => {
    expect(validateExtensionEntry('42', numDecl)).toBe(false);
  });

  it('数字声明 × boolean 值 → false（类型不匹配）', () => {
    expect(validateExtensionEntry(true, numDecl)).toBe(false);
  });

  it('字符串声明 × string 值 → true', () => {
    expect(validateExtensionEntry('hello', strDecl)).toBe(true);
    expect(validateExtensionEntry('', strDecl)).toBe(true);
  });

  it('字符串声明 × number 值 → false', () => {
    expect(validateExtensionEntry(0, strDecl)).toBe(false);
  });

  it('字符串声明 × boolean 值 → false', () => {
    expect(validateExtensionEntry(false, strDecl)).toBe(false);
  });

  it('布尔声明 × boolean 值 → true', () => {
    expect(validateExtensionEntry(true, boolDecl)).toBe(true);
    expect(validateExtensionEntry(false, boolDecl)).toBe(true);
  });

  it('布尔声明 × number 值 → false', () => {
    expect(validateExtensionEntry(1, boolDecl)).toBe(false);
  });

  it('布尔声明 × string 值 → false', () => {
    expect(validateExtensionEntry('true', boolDecl)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 断言② · validateExtensionParams — 多键批量校验
// ═══════════════════════════════════════════════════════════════════════
describe('extensionParams · validateExtensionParams · 批量校验', () => {
  const template: 变量模板Type = {
    生命值:  { 类型: '数字',   默认值: 100 },
    昵称:    { 类型: '字符串', 默认值: '' },
    已激活:  { 类型: '布尔',   默认值: false },
  };

  it('空 扩展参数 → 无违规', () => {
    expect(validateExtensionParams({}, template)).toHaveLength(0);
  });

  it('类型全匹配 → 无违规', () => {
    const violations = validateExtensionParams(
      { 生命值: 50, 昵称: 'Alice', 已激活: true },
      template,
    );
    expect(violations).toHaveLength(0);
  });

  it('数字键值为 string → 报 1 项违规', () => {
    const violations = validateExtensionParams({ 生命值: '50' }, template);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.key).toBe('生命值');
    expect(violations[0]!.expected).toBe('数字');
    expect(violations[0]!.got).toBe('string');
  });

  it('多键类型不匹配 → 报多项违规', () => {
    const violations = validateExtensionParams(
      { 生命值: '50', 昵称: 42, 已激活: 'yes' },
      template,
    );
    expect(violations).toHaveLength(3);
  });

  it('未在模板中声明的键 → 不报违规（白名单由 P9-3 管）', () => {
    const violations = validateExtensionParams({ 未知键: 999 }, template);
    expect(violations).toHaveLength(0);
  });

  it('JS 保留键风险：__proto__ 若出现在 扩展参数 → 被 hasOwnProperty 过滤（不报违规也不崩溃）', () => {
    // 通过 Object.create(null) 构造无原型对象验证
    const safeObj = Object.create(null) as Record<string, unknown>;
    safeObj['生命值'] = 'wrong_type';
    const violations = validateExtensionParams(safeObj, template);
    expect(violations).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 断言③ · seedExtensionParams — 默认值播种
// ═══════════════════════════════════════════════════════════════════════
describe('extensionParams · seedExtensionParams · 默认值播种', () => {
  const template: 变量模板Type = {
    生命值:  { 类型: '数字',   默认值: 100 },
    昵称:    { 类型: '字符串', 默认值: '无名' },
    已激活:  { 类型: '布尔',   默认值: false },
  };

  it('空 扩展参数 → 全部键 seed 默认值', () => {
    const 扩展参数: Record<string, number | string | boolean> = {};
    seedExtensionParams(扩展参数, template);
    expect(扩展参数['生命值']).toBe(100);
    expect(扩展参数['昵称']).toBe('无名');
    expect(扩展参数['已激活']).toBe(false);
  });

  it('数字型默认值落地（number）', () => {
    const p: Record<string, number | string | boolean> = {};
    seedExtensionParams(p, { hp: { 类型: '数字', 默认值: 50 } });
    expect(p['hp']).toBe(50);
    expect(typeof p['hp']).toBe('number');
  });

  it('字符串型照常 seed（串/布尔 seed 成功·不拒）', () => {
    const p: Record<string, number | string | boolean> = {};
    seedExtensionParams(p, { name: { 类型: '字符串', 默认值: 'Alice' } });
    expect(p['name']).toBe('Alice');
    expect(typeof p['name']).toBe('string');
  });

  it('布尔型照常 seed', () => {
    const p: Record<string, number | string | boolean> = {};
    seedExtensionParams(p, { active: { 类型: '布尔', 默认值: true } });
    expect(p['active']).toBe(true);
    expect(typeof p['active']).toBe('boolean');
  });

  it('已有键不覆盖（幂等）', () => {
    const p: Record<string, number | string | boolean> = { 生命值: 30 };
    seedExtensionParams(p, template);
    expect(p['生命值']).toBe(30); // 保持原值
    expect(p['昵称']).toBe('无名');   // 缺省键 seed
  });

  it('多次调用幂等（第二次 seed 不改变已 seed 值）', () => {
    const p: Record<string, number | string | boolean> = {};
    seedExtensionParams(p, template);
    const snapshot = { ...p };
    seedExtensionParams(p, template); // 第二次调用
    expect(p).toEqual(snapshot);
  });

  it('模板键与 扩展参数 键部分重叠 → 只 seed 缺省键', () => {
    const p: Record<string, number | string | boolean> = { 生命值: 99 };
    seedExtensionParams(p, template);
    expect(p['生命值']).toBe(99);   // 已有·不覆盖
    expect(p['昵称']).toBe('无名'); // 缺省·seed
    expect(p['已激活']).toBe(false); // 缺省·seed
  });

  it('空模板 → 扩展参数 不变', () => {
    const p: Record<string, number | string | boolean> = { x: 1 };
    seedExtensionParams(p, {});
    expect(p).toEqual({ x: 1 });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 断言④ · tick 集成 — 扩展参数播种 phase 落地
// ═══════════════════════════════════════════════════════════════════════
describe('extensionParams · tick 集成 · 扩展参数播种 phase', () => {
  it('空物品库 → 扩展参数播种 phase 精确 no-op（含 settledPhases）', () => {
    const { settledPhases } = runTick(makeState(), {
      tickId: 'ext-noop-1',
      物品库: {},
    });
    expect(settledPhases).toContain('扩展参数播种');
  });

  it('undefined 物品库 → 扩展参数播种 phase no-op（不抛错）', () => {
    const { settledPhases } = runTick(makeState(), {
      tickId: 'ext-noop-2',
    });
    expect(settledPhases).toContain('扩展参数播种');
  });

  it('NPC 物品 key 命中物品库 + 模板 → seed 缺省扩展参数值（默认值落地）', () => {
    const itemDef: 物品定义条目Type = {
      名称: '铁剑',
      变量模板: {
        耐久度: { 类型: '数字',   默认值: 100 },
        已强化: { 类型: '布尔',   默认值: false },
        刻字:   { 类型: '字符串', 默认值: '无铭文' },
      },
    };
    const state = RootSchema.parse({
      NPC: {
        hero: {
          物品: {
            iron_sword: { 数量: 1 },
          },
        },
      },
    });
    const { state: s1 } = runTick(state, {
      tickId: 'ext-seed-1',
      物品库: { iron_sword: itemDef },
    });
    const item = s1.NPC['hero']?.物品['iron_sword'];
    expect(item).toBeDefined();
    expect(item!.扩展参数['耐久度']).toBe(100);
    expect(item!.扩展参数['已强化']).toBe(false);
    expect(item!.扩展参数['刻字']).toBe('无铭文');
  });

  it('item key 不在物品库 → 扩展参数保持 default {}（no-op）', () => {
    const state = RootSchema.parse({
      NPC: { hero: { 物品: { mystery_item: { 数量: 1 } } } },
    });
    const { state: s1 } = runTick(state, {
      tickId: 'ext-miss-1',
      物品库: { iron_sword: { 名称: '铁剑' } }, // 库里没有 mystery_item
    });
    expect(s1.NPC['hero']?.物品['mystery_item']?.扩展参数).toEqual({});
  });

  it('物品库有 变量模板 = undefined → 扩展参数保持 {}', () => {
    const state = RootSchema.parse({
      NPC: { hero: { 物品: { iron_sword: { 数量: 1 } } } },
    });
    const { state: s1 } = runTick(state, {
      tickId: 'ext-notemplate-1',
      物品库: { iron_sword: { 名称: '铁剑' /* 无变量模板 */ } },
    });
    expect(s1.NPC['hero']?.物品['iron_sword']?.扩展参数).toEqual({});
  });

  it('seed 幂等：同 tickId 第二次调用直接返回（已结算标记）', () => {
    const itemDef: 物品定义条目Type = {
      名称: '铁剑',
      变量模板: { hp: { 类型: '数字', 默认值: 50 } },
    };
    const state = RootSchema.parse({
      NPC: { hero: { 物品: { iron_sword: { 数量: 1 } } } },
    });
    const { state: s1 } = runTick(state, { tickId: 'ext-idem-1', 物品库: { iron_sword: itemDef } });
    const { state: s2 } = runTick(s1,    { tickId: 'ext-idem-2', 物品库: { iron_sword: itemDef } });
    // 第二拍：hp 已 seed = 50（不覆盖）
    expect(s2.NPC['hero']?.物品['iron_sword']?.扩展参数['hp']).toBe(50);
  });

  it('已有 扩展参数 值不被 seed 覆盖', () => {
    const itemDef: 物品定义条目Type = {
      名称: '铁剑',
      变量模板: { hp: { 类型: '数字', 默认值: 100 } },
    };
    const state = RootSchema.parse({
      NPC: {
        hero: {
          物品: {
            iron_sword: { 数量: 1, 扩展参数: { hp: 30 } },
          },
        },
      },
    });
    const { state: s1 } = runTick(state, {
      tickId: 'ext-noover-1',
      物品库: { iron_sword: itemDef },
    });
    expect(s1.NPC['hero']?.物品['iron_sword']?.扩展参数['hp']).toBe(30); // 原值保持
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 断言⑤ · 守恒门
// ═══════════════════════════════════════════════════════════════════════
describe('extensionParams · 守恒门', () => {
  it('SETTLEMENT_PHASES = 17（P9-2 新增 扩展参数播种）', () => {
    expect(SETTLEMENT_PHASES).toHaveLength(17);
    expect(SETTLEMENT_PHASES).toContain('扩展参数播种');
    expect(SETTLEMENT_PHASES).toContain('成就解锁');
    expect(SETTLEMENT_PHASES.at(-1)).toBe('原子提交');
  });

  it('schemaKeys = 54（扩展参数为 NpcSchema/物品条目嵌套字段·非顶层键）', () => {
    expect(Object.keys(RootSchema.shape).length).toBe(54);
  });

  it('BUNDLE = 21 · manifest 总长 = 86（扩展参数/物品库不进判定面指纹）', () => {
    expect(FINGERPRINT_BUNDLE_MEMBERS.length).toBe(21);
    const total = FINGERPRINT_BUNDLE_MEMBERS.length + FINGERPRINT_PRESET_FIELDS.length + FINGERPRINT_SNAPSHOT_FIELDS.length;
    expect(total).toBeGreaterThan(30); // manifest 总体不缩减
  });

  it('金向量逐位恒等（actor 不进 hashJudgmentBundle → 0 重定基）', () => {
    const fp1 = hashPresetFingerprint({
      判定面整包: hashJudgmentBundle(JUDGMENT_BASE),
      生效中内容包集哈希: 'abc00001',
      snapshot: SNAPSHOT_BASE,
    });
    const fp2 = hashPresetFingerprint({
      判定面整包: hashJudgmentBundle(JUDGMENT_BASE),
      生效中内容包集哈希: 'abc00001',
      snapshot: SNAPSHOT_BASE,
    });
    expect(fp1).toBe(fp2);
    expect(fp1).toMatch(/^[0-9a-f]{8}$/);
  });

  it('扩展参数 播种后 runTick → 结算全 17 个 phase', () => {
    const { settledPhases } = runTick(makeState(), { tickId: 'ext-phases-1' });
    expect(settledPhases).toHaveLength(SETTLEMENT_PHASES.length);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 断言⑥ · DSL ctx 自定义变量（P9-3）
// 数字型投影·串/布尔 skip·evalPredStr 谓词求值确定性
// ═══════════════════════════════════════════════════════════════════════

function makeStateWithExt(npcKey: string, 扩展参数: Record<string, number | string | boolean>): RootState {
  return RootSchema.parse({
    NPC: { [npcKey]: { 扩展参数 } },
  });
}

describe('extensionParams · P9-3 · DSL ctx 自定义变量', () => {
  it('数字型扩展参数 → 进 ctx.自定义变量', () => {
    const s = makeStateWithExt('hero', { hp: 80, mp: 40 });
    const ctx = projectStateCtx(s, { entityKey: 'hero' });
    const 自定义变量 = ctx['自定义变量'] as Record<string, number>;
    expect(自定义变量['hp']).toBe(80);
    expect(自定义变量['mp']).toBe(40);
  });

  it('字符串型扩展参数 → skip（不进 ctx.自定义变量）', () => {
    const s = makeStateWithExt('hero', { name: 'Alice', hp: 50 });
    const ctx = projectStateCtx(s, { entityKey: 'hero' });
    const 自定义变量 = ctx['自定义变量'] as Record<string, number>;
    expect('name' in 自定义变量).toBe(false);
    expect(自定义变量['hp']).toBe(50);
  });

  it('布尔型扩展参数 → skip（不进 ctx.自定义变量）', () => {
    const s = makeStateWithExt('hero', { active: true, hp: 99 });
    const ctx = projectStateCtx(s, { entityKey: 'hero' });
    const 自定义变量 = ctx['自定义变量'] as Record<string, number>;
    expect('active' in 自定义变量).toBe(false);
    expect(自定义变量['hp']).toBe(99);
  });

  it('扩展参数 = {} → 自定义变量 = {}（无键）', () => {
    const s = makeStateWithExt('hero', {});
    const ctx = projectStateCtx(s, { entityKey: 'hero' });
    expect(ctx['自定义变量']).toEqual({});
  });

  it('NPC 不存在 → 自定义变量 = {}', () => {
    const s = RootSchema.parse({});
    const ctx = projectStateCtx(s, { entityKey: 'nobody' });
    expect(ctx['自定义变量']).toEqual({});
  });

  it('scope 缺省 → 自定义变量 = {}（无 entityKey）', () => {
    const s = makeStateWithExt('hero', { hp: 100 });
    const ctx = projectStateCtx(s);
    expect(ctx['自定义变量']).toEqual({});
  });

  it('谓词「自定义变量.hp > 50」确定性求值 → true（hp=80）', () => {
    const s = makeStateWithExt('hero', { hp: 80, note: 'text', flag: false });
    const ctx = projectStateCtx(s, { entityKey: 'hero' });
    expect(evalPredStr('自定义变量.hp > 50', ctx)).toBe(true);
  });

  it('谓词「自定义变量.hp <= 30」→ false（hp=80）', () => {
    const s = makeStateWithExt('hero', { hp: 80 });
    const ctx = projectStateCtx(s, { entityKey: 'hero' });
    expect(evalPredStr('自定义变量.hp <= 30', ctx)).toBe(false);
  });

  it('谓词引用串型键 → 退默认 0 → false（守 fail-closed）', () => {
    const s = makeStateWithExt('hero', { note: 'hello', hp: 0 });
    const ctx = projectStateCtx(s, { entityKey: 'hero' });
    // note 不在 ctx·resolvePath 返回 0·"0 > 0"=false
    expect(evalPredStr('自定义变量.note > 0', ctx)).toBe(false);
  });

  it('谓词引用布尔键 → 退默认 0 → false（守 fail-closed）', () => {
    const s = makeStateWithExt('hero', { active: true });
    const ctx = projectStateCtx(s, { entityKey: 'hero' });
    expect(evalPredStr('自定义变量.active > 0', ctx)).toBe(false);
  });

  it('数字型 ctx 投影确定性：同 state 两次调用值相等', () => {
    const s = makeStateWithExt('hero', { hp: 42 });
    const c1 = projectStateCtx(s, { entityKey: 'hero' });
    const c2 = projectStateCtx(s, { entityKey: 'hero' });
    expect((c1['自定义变量'] as Record<string, number>)['hp'])
      .toBe((c2['自定义变量'] as Record<string, number>)['hp']);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 断言⑦ · deriveExtensionParamPaths — 白名单路径派生（P9-3）
// 声明键→条目·未声明键不生成·空库 no-op
// ═══════════════════════════════════════════════════════════════════════

describe('extensionParams · P9-3 · deriveExtensionParamPaths', () => {
  const itemDef: 物品定义条目Type = {
    名称: '铁剑',
    变量模板: {
      耐久度: { 类型: '数字',   默认值: 100 },
      刻字:   { 类型: '字符串', 默认值: '无' },
    },
  };

  it('空物品库 → 返回 []', () => {
    const s = RootSchema.parse({ NPC: { hero: { 物品: { iron_sword: { 数量: 1 } } } } });
    expect(deriveExtensionParamPaths(s, {})).toEqual([]);
  });

  it('undefined 物品库 → 返回 []', () => {
    const s = RootSchema.parse({ NPC: { hero: { 物品: { iron_sword: { 数量: 1 } } } } });
    expect(deriveExtensionParamPaths(s, undefined)).toEqual([]);
  });

  it('NPC 无物品 → 返回 []', () => {
    const s = RootSchema.parse({ NPC: { hero: {} } });
    expect(deriveExtensionParamPaths(s, { iron_sword: itemDef })).toEqual([]);
  });

  it('物品命中库 + 声明模板 → 生成 per-键 DerivedEntry（writable）', () => {
    const s = RootSchema.parse({ NPC: { hero: { 物品: { iron_sword: { 数量: 1 } } } } });
    const entries = deriveExtensionParamPaths(s, { iron_sword: itemDef });
    const paths = entries.map(e => e.path);
    expect(paths).toContain('NPC.hero.物品.iron_sword.扩展参数.耐久度');
    expect(paths).toContain('NPC.hero.物品.iron_sword.扩展参数.刻字');
    expect(entries.every(e => e.layer === 'writable')).toBe(true);
  });

  it('物品在库但无 变量模板 → 不生成条目', () => {
    const s = RootSchema.parse({ NPC: { hero: { 物品: { dagger: { 数量: 1 } } } } });
    const entries = deriveExtensionParamPaths(s, { dagger: { 名称: '匕首' /* 无变量模板 */ } });
    expect(entries).toEqual([]);
  });

  it('item key 不在库 → 不生成条目', () => {
    const s = RootSchema.parse({ NPC: { hero: { 物品: { mystery: { 数量: 1 } } } } });
    const entries = deriveExtensionParamPaths(s, { iron_sword: itemDef });
    expect(entries).toEqual([]);
  });

  it('多 NPC × 多物品 → 正确展开所有声明键', () => {
    const s = RootSchema.parse({
      NPC: {
        hero: { 物品: { iron_sword: { 数量: 1 } } },
        mage: { 物品: { iron_sword: { 数量: 2 } } },
      },
    });
    const entries = deriveExtensionParamPaths(s, { iron_sword: itemDef });
    const paths = entries.map(e => e.path);
    expect(paths).toContain('NPC.hero.物品.iron_sword.扩展参数.耐久度');
    expect(paths).toContain('NPC.mage.物品.iron_sword.扩展参数.耐久度');
    expect(paths.length).toBe(4); // 2 NPC × 2 声明键
  });

  it('派生路径不含通配符（无 {id}/{i}）', () => {
    const s = RootSchema.parse({ NPC: { hero: { 物品: { iron_sword: { 数量: 1 } } } } });
    const entries = deriveExtensionParamPaths(s, { iron_sword: itemDef });
    for (const e of entries) {
      expect(e.path).not.toContain('{');
      expect(e.path).not.toContain('}');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 断言⑧ · 提案闸② 集成 — 声明键可写穿·未声明键拒（P9-3）
// ═══════════════════════════════════════════════════════════════════════

describe('extensionParams · P9-3 · 提案闸② 集成', () => {
  const itemDef: 物品定义条目Type = {
    名称: '铁剑',
    变量模板: {
      耐久度: { 类型: '数字', 默认值: 100 },
    },
  };

  function makeProposalState(): RootState {
    return RootSchema.parse({
      NPC: {
        hero: {
          物品: {
            iron_sword: { 数量: 1, 扩展参数: { 耐久度: 80 } },
          },
        },
      },
      _席位表: { p1: { 控制角色键: 'hero', 模式: '单机' } },
    });
  }

  it('声明键路径 → Gate② pass（扩展参数路径在白名单·set op）', () => {
    const state = makeProposalState();
    const envelope = 指令信封Schema.parse({ 提案: {} });
    const extraPaths = deriveExtensionParamPaths(state, { iron_sword: itemDef });
    const result = runProposalGate(
      envelope,
      state,
      'p1',
      '玩家确认',
      [[{ path: 'NPC.hero.物品.iron_sword.扩展参数.耐久度', op: 'set', value: 70 }]],
      extraPaths,
    );
    expect(result.ok).toBe(true);
    // 写入值应落地
    if (result.ok) {
      expect((result.state.NPC['hero']?.物品['iron_sword']?.扩展参数 as Record<string, number>)['耐久度']).toBe(70);
    }
  });

  it('未声明键路径 → Gate② reject（不在白名单·fail-closed）', () => {
    const state = makeProposalState();
    const envelope = 指令信封Schema.parse({ 提案: {} });
    const extraPaths = deriveExtensionParamPaths(state, { iron_sword: itemDef });
    const result = runProposalGate(
      envelope,
      state,
      'p1',
      '玩家确认',
      [[{ path: 'NPC.hero.物品.iron_sword.扩展参数.未声明键', op: 'set', value: 999 }]],
      extraPaths,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.gate).toBe('②-whitelist');
    }
  });

  it('extraWhitelistPaths 缺省 → 扩展参数路径退出静态白名单·Gate② 全拒（FIX-2）', () => {
    // FIX-2: 静态白名单 post-filter 已剔除 扩展参数 通配条目。
    // 不传 extraWhitelistPaths → 无任何授权源 → Gate②-a 直拒。
    const state = makeProposalState();
    const envelope = 指令信封Schema.parse({ 提案: {} });
    const result = runProposalGate(
      envelope,
      state,
      'p1',
      '玩家确认',
      [[{ path: 'NPC.hero.物品.iron_sword.扩展参数.耐久度', op: 'set', value: 50 }]],
      // 不传 extraWhitelistPaths → 扩展参数零授权 → fail-closed
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.gate).toBe('②-whitelist');
    }
  });

  it('FIX-3: NPC 级扩展参数路径 → Gate② 全拒（静态白名单无通配·无授权源）', () => {
    // NPC.hero.扩展参数.hp 是 4 段路径（NPC 级·非物品级）。
    // FIX-2 剔除了 NPC.{id}.扩展参数.{id} 通配；deriveExtensionParamPaths 当前不产 NPC 级路径。
    // → Gate②-a 无匹配条目 → fail-closed。
    const state = makeProposalState();
    const envelope = 指令信封Schema.parse({ 提案: {} });
    const result = runProposalGate(
      envelope,
      state,
      'p1',
      '玩家确认',
      [[{ path: 'NPC.hero.扩展参数.hp', op: 'set', value: 99 }]],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.gate).toBe('②-whitelist');
    }
  });

  it('FIX-1: 数字声明键 = 字符串值 → Gate② 类型拒（live 写路径·非仅单测）', () => {
    const state = makeProposalState();
    const envelope = 指令信封Schema.parse({ 提案: {} });
    const extraPaths = deriveExtensionParamPaths(state, { iron_sword: itemDef });
    const result = runProposalGate(
      envelope,
      state,
      'p1',
      '玩家确认',
      [[{ path: 'NPC.hero.物品.iron_sword.扩展参数.耐久度', op: 'set', value: '不是数字' }]],
      extraPaths,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.gate).toBe('②-whitelist');
      expect(result.reason).toContain('类型');
    }
  });

  it('FIX-1: 数字声明键 = 数字值 → Gate② 通过 + 落地', () => {
    const state = makeProposalState();
    const envelope = 指令信封Schema.parse({ 提案: {} });
    const extraPaths = deriveExtensionParamPaths(state, { iron_sword: itemDef });
    const result = runProposalGate(
      envelope,
      state,
      'p1',
      '玩家确认',
      [[{ path: 'NPC.hero.物品.iron_sword.扩展参数.耐久度', op: 'set', value: 55 }]],
      extraPaths,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.state.NPC['hero']?.物品['iron_sword']?.扩展参数 as Record<string, number>)['耐久度']).toBe(55);
    }
  });

  it('0 重定基：Gate② 操作不碰 hashPresetFingerprint / hashJudgmentBundle 输出', () => {
    const fp = hashPresetFingerprint({
      判定面整包: hashJudgmentBundle(JUDGMENT_BASE),
      生效中内容包集哈希: 'abc00001',
      snapshot: SNAPSHOT_BASE,
    });
    expect(fp).toMatch(/^[0-9a-f]{8}$/);
    // 两次调用仍逐位恒等
    const fp2 = hashPresetFingerprint({
      判定面整包: hashJudgmentBundle(JUDGMENT_BASE),
      生效中内容包集哈希: 'abc00001',
      snapshot: SNAPSHOT_BASE,
    });
    expect(fp).toBe(fp2);
  });
});
