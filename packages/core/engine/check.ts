// Ring 0 check primitives — pure functions, zero side effects.
// No Math.random(), no Date.now(), no global reads.
// DC偏置 is caller-computed (决议6.38): 难度系数组.检定DC偏移 × $玩家偏好.写实程度.
import { assertFinite } from './assertFinite.js';
import { resolveFormula, type FormulaResolveConfig } from './formulaRegistry.js';

// ── 6.45 拓扑 + 宿主类型 ───────────────────────────────────────────────────
/** 检定拓扑: 即掷 = instant roll (P0); 骰池 = pre-rolled pool consumed at action (P2). */
export type 检定拓扑 = '即掷' | '骰池';

/** 宿主类型: declares which entity's attribute axes to fetch data from. */
export type 宿主类型 = '角色' | '组织' | '世界域';

/** Secondary attribute axis entry in a recipe. */
export interface 副属性条目 {
  轴名: string;
  权重: number;
  /** 6.48 停用轴: if true, use 中性缺省 instead of live axis data. */
  停用?: boolean;
  /** Neutral default value when 停用=true. Defaults to 0 if omitted. */
  中性缺省?: number;
}

export interface 属性配方 {
  主属性: string;
  副属性列?: 副属性条目[];
  /** 检定拓扑: defaults to '即掷'. '骰池' is a P2 placeholder. */
  拓扑?: 检定拓扑;
  /** 宿主类型: defaults to '角色'. '组织'/'世界域' are P0-1 dispatch stubs. */
  宿主类型?: 宿主类型;
}

/** Minimal cut-off shape — check reads only these four fields from preset data. */
export interface 切分界 {
  大胜下限: number;
  胜下限: number;
  惨胜下限: number;
  败下限: number;
}

export type 检定档 = '大胜' | '胜' | '惨胜' | '败' | '溃';

export interface 情境修正条目 {
  来源: string;
  数值: number;
}

export interface CheckInput {
  基线: number;
  熟练: number;
  等级: number;
  属性项: number;          // caller computes via resolveAttribute
  情境修正: 情境修正条目[];
  DC偏置: number;          // caller-computed; check() never reads global config
  rawU: number;            // from rngFor / rngForFate
  判定骰型: 100 | 20;      // P0 恒等直通; d20 snap-to-face 归 P1
  切分表: 切分界;          // from 玩法预设.检定档切分表; no hardcoded numbers inside
}

export interface CheckOutput {
  公式值: number;
  余量M: number;
  tier: 检定档;
  rawU: number;
  修正明细: 情境修正条目[];
}

/**
 * Compute 属性项 = (主属性 + Σ副属性列_i.轴名 × 权重_i) / 2.
 *
 * Dispatch order:
 *   1. 拓扑: '即掷' implemented; '骰池' throws 未实装 (P2).
 *   2. 宿主类型: '角色' implemented (reads from `属性轴数据`);
 *      '组织'/'世界域' throw 未实装 — P0-1 schema接线后接入.
 *   3. 停用轴 (6.48): 副属性列 entries with 停用=true use 中性缺省 instead
 *      of live axis data — prevents NaN from absent axes.
 * Gate ①: assertFinite on every axis value and weight before arithmetic.
 */
export function resolveAttribute(
  配方条目: 属性配方,
  属性轴数据: Record<string, number>,
  formulaConfig?: FormulaResolveConfig,
): number {
  // ── 拓扑 dispatch ────────────────────────────────────────────────────────
  const 拓扑 = 配方条目.拓扑 ?? '即掷';
  if (拓扑 !== '即掷') {
    // 骰池: 拍首掷 N 骰入池、行动消费 — P2 实装
    throw new Error(`resolveAttribute: 拓扑 "${拓扑}" 未实装 — 骰池分支归 P2`);
  }

  // ── 宿主类型 dispatch ─────────────────────────────────────────────────────
  const 宿主 = 配方条目.宿主类型 ?? '角色';
  if (宿主 !== '角色') {
    // TODO(P0-5): 组织属性轴 / 全局属性轴 待 P0-1 schema 接线后接入
    throw new Error(`resolveAttribute: 宿主类型 "${宿主}" 未实装 — P0-1 schema接线`);
  }

  // ── 角色分支: resolve from NPC attribute axes ────────────────────────────
  const 主 = 属性轴数据[配方条目.主属性] ?? 0;
  assertFinite(主, `resolveAttribute.主属性[${配方条目.主属性}]`);

  const 副合计 = (配方条目.副属性列 ?? []).reduce(
    (sum, { 轴名, 权重, 停用, 中性缺省 }) => {
      // 6.48 停用轴中性缺省: disabled axis → use declared neutral default
      const 值 = (停用 === true) ? (中性缺省 ?? 0) : (属性轴数据[轴名] ?? 0);
      assertFinite(值, `resolveAttribute.副[${轴名}]`);
      assertFinite(权重, `resolveAttribute.副[${轴名}].权重`);
      return sum + 值 * 权重;
    },
    0,
  );

  const _divisor = resolveFormula('attr_combine_divisor', formulaConfig);
  const 属性项 = (主 + 副合计) / _divisor;
  assertFinite(属性项, 'resolveAttribute.属性项');
  return 属性项;
}

/**
 * Classify M against 切分界 read from preset data.
 * Sequential from highest to lowest — first match wins.
 * No hardcoded boundary numbers; callers supply the full 切分表.
 */
function classifyTier(M: number, 切分表: 切分界): 检定档 {
  if (M >= 切分表.大胜下限) return '大胜';
  if (M >= 切分表.胜下限) return '胜';
  if (M >= 切分表.惨胜下限) return '惨胜';
  if (M >= 切分表.败下限) return '败';
  return '溃';
}

/**
 * Pure deterministic check function.
 *
 * 公式值 = clamp(基线 + 熟练×0.4 + 等级×3 + 属性项 + Σ情境修正 − DC偏置, 0, 100)
 * M     = 公式值 − rawU
 * tier  ← classifyTier(M, 切分表)   ← read from preset data, never hardcoded here
 *
 * Gate ①: assertFinite on every numeric input + every formula output (H2 first卡口).
 * Gate ②: TODO(P0-6) — assertFinite on the 余量M / 公式值 before writing to the
 *   涟漪/state delta (第⑤闸入账前). Clamp logic + second gate live in P0-6.
 */
export function check(input: CheckInput, formulaConfig?: FormulaResolveConfig): CheckOutput {
  const { 基线, 熟练, 等级, 属性项, 情境修正, DC偏置, rawU, 切分表 } = input;
  // input.判定骰型: P0 恒等直通 — rawU used as-is; d20 snap-to-face 归 P1

  // ── Gate ①: all numeric inputs must be finite ─────────────────────────────
  assertFinite(基线,   'check.基线');
  assertFinite(熟练,   'check.熟练');
  assertFinite(等级,   'check.等级');
  assertFinite(属性项, 'check.属性项');
  assertFinite(DC偏置, 'check.DC偏置');
  assertFinite(rawU,   'check.rawU');
  for (const 修正 of 情境修正) {
    assertFinite(修正.数值, `check.情境修正[${修正.来源}].数值`);
  }
  assertFinite(切分表.大胜下限, 'check.切分表.大胜下限');
  assertFinite(切分表.胜下限,   'check.切分表.胜下限');
  assertFinite(切分表.惨胜下限, 'check.切分表.惨胜下限');
  assertFinite(切分表.败下限,   'check.切分表.败下限');

  // ── Formula ────────────────────────────────────────────────────────────────
  const _profCoeff  = resolveFormula('check_proficiency_coeff', formulaConfig);
  const _levelCoeff = resolveFormula('check_level_coeff',       formulaConfig);
  const 修正合计 = 情境修正.reduce((sum, c) => sum + c.数值, 0);
  const 公式值Raw = 基线 + 熟练 * _profCoeff + 等级 * _levelCoeff + 属性项 + 修正合计 - DC偏置;
  assertFinite(公式值Raw, 'check.公式值Raw');
  const 公式值 = Math.max(0, Math.min(100, 公式值Raw));
  assertFinite(公式值, 'check.公式值');

  const 余量M = 公式值 - rawU;
  assertFinite(余量M, 'check.余量M');

  return {
    公式值,
    余量M,
    tier: classifyTier(余量M, 切分表),
    rawU,
    修正明细: [...情境修正],
  };
}
