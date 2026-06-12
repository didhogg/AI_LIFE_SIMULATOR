// Ring 0 check primitives — pure functions, zero side effects.
// No Math.random(), no Date.now(), no global reads.
// DC偏置 is caller-computed (决议6.38): 难度系数组.检定DC偏移 × $玩家偏好.写实程度.

export interface 属性配方 {
  主属性: string;
  副属性列?: Array<{ 轴名: string; 权重: number }>;
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
 * Only reads data parameters; no global state.
 */
export function resolveAttribute(
  配方条目: 属性配方,
  属性轴数据: Record<string, number>,
): number {
  const 主 = 属性轴数据[配方条目.主属性] ?? 0;
  const 副合计 = (配方条目.副属性列 ?? []).reduce(
    (sum, { 轴名, 权重 }) => sum + (属性轴数据[轴名] ?? 0) * 权重,
    0,
  );
  return (主 + 副合计) / 2;
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
 */
export function check(input: CheckInput): CheckOutput {
  const { 基线, 熟练, 等级, 属性项, 情境修正, DC偏置, rawU, 切分表 } = input;
  // input.判定骰型: P0 恒等直通 — rawU used as-is; d20 snap-to-face 归 P1

  const 修正合计 = 情境修正.reduce((sum, c) => sum + c.数值, 0);
  const 公式值Raw = 基线 + 熟练 * 0.4 + 等级 * 3 + 属性项 + 修正合计 - DC偏置;
  const 公式值 = Math.max(0, Math.min(100, 公式值Raw));

  const 余量M = 公式值 - rawU;

  return {
    公式值,
    余量M,
    tier: classifyTier(余量M, 切分表),
    rawU,
    修正明细: [...情境修正],
  };
}
