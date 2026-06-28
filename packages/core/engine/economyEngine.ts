// packages/core/engine/economyEngine.ts
// PR-3 · 动态修正层（P12–P14）+ 经济派生（P27）
//
// 三原则：
//  ① 事实⊥认知：有效价格 = 真相层确定性派生量，不落库，不走 LLM
//  ② 不发明公式：基线 × clamp(1 + Σ权重×信号, 钳制档)，信号取自真相层
//  ③ 派生不存储：有效价格本身不写 state；仅 applyDriftCandidate 写候选基线
//
// 红线：禁改 gate/conservation/rng/computeDelta/fixed 函数体
// 六禁：禁 Date.now/new Date/Math.random/localeCompare/裸 JSON.stringify/NFC normalize
// Math.round 允许（IEEE 754 整数舍入·确定性）

import { type RootState } from '../schema/index.js';
import { type 玩法预设Type } from '../schema/preset.js';
import { fixedPow, v1 } from './math/fixed.js';
import { resolveFormula, type FormulaResolveConfig } from './formulaRegistry.js';

// ── P3-3 · 修正系数衰减（闭式·锚拍号·禁逐拍累积）──────────────────────────────

/**
 * 给定衰减率 d 和当前拍号 tick，返回衰减乘子。
 * 闭式：pow(1 - d, tick)——任意拍号直接重算，无浮点累积漂移。
 */
export function computeDecayFactor(decayRate: number, tick: number): number {
  if (decayRate <= 0) return 1;
  return fixedPow(1 - decayRate, tick);
}

// ── 辅助：战时信号（只读 state.战争状态）───────────────────────────────────────

/** state.战争状态 中存在 状态='交战' 的条目 → true（一档判断·停战细分留参数暴露） */
export function hasActiveWar(state: RootState): boolean {
  const wars = state.战争状态;
  if (!wars) return false;
  for (const w of Object.values(wars)) {
    if (w.状态 === '交战') return true;
  }
  return false;
}

// ── P3-2 · 有效价格派生（P12 + P27·核心·确定性·禁直写货币系统）────────────────

/**
 * 派生有效价格（只读·不写 state）。
 *
 * 退化守卫：preset 无 经济生成规则 → 返回 区域物价[regionId][category].基准价（或 0）。
 * 公式：baseline × clamp(1 + rawCorrection × decayFactor, LO, HI)
 *   rawCorrection = Σ(weight_i × signal_i)
 *   decayFactor   = pow(1 - 衰减率, 当前拍计数)   [P3-3 闭式]
 *
 * @param state      当前 RootState（只读）
 * @param preset     当前挂载预设对象（caller 传入；为 undefined → 退化）
 * @param regionId   区域节点键（state.地图.地点 中 类别='区域级' 的键）
 * @param category   品类键（与 区域物价[regionId] 的内层键一致）
 * @returns 有效价格整数（Math.round·与 基准价 同单位）
 */
export function deriveEffectivePrice(
  state: RootState,
  preset: 玩法预设Type | undefined,
  regionId: string,
  category: string,
  formulaConfig?: FormulaResolveConfig,
): number {
  const rule = preset?.经济生成规则;
  const stateBase = state.地图?.区域物价?.[regionId]?.[category]?.基准价 ?? 0;

  if (!rule) return stateBase;

  // 基线：预设显式指定 > 区域物价.基准价 > 0
  const baseline = rule.品类基线?.[category] ?? stateBase;
  if (baseline === 0) return 0;

  // P3-3 衰减乘子（锚当前拍计数·闭式）
  const currentTick = state._tick?.拍计数 ?? 0;
  const decayFactor = computeDecayFactor(rule.衰减率 ?? 0, currentTick);

  // 归一化信号（均在 [-1, 1] 或 [0, 1]）
  const tension  = (state.地图?.地点?.[regionId]?.区域资源紧张度 ?? 0) / 100; // [0, 1]
  const supply   = (state.地图?.区域物价?.[regionId]?.[category]?.供需 ?? 0) / 100; // [-1, 1]
  const wartime  = hasActiveWar(state) ? 1 : 0;

  const rawCorrection =
    (rule.资源紧张度权重 ?? 0) * tension +
    (rule.供需权重 ?? 0) * supply +
    (rule.战时修正权重 ?? 0) * wartime;

  const _clampLo = resolveFormula('economy_price_clamp_lo', formulaConfig);
  const _clampHi = resolveFormula('economy_price_clamp_hi', formulaConfig);
  const correctionFactor = v1.clamp(
    1 + rawCorrection * decayFactor,
    _clampLo,
    _clampHi,
  );

  return Math.round(baseline * correctionFactor);
}

// ── P3-4 · 漂移候选再基线（additive·不回写预设·不 bump 预设版本）──────────────

/**
 * 相对漂移纯函数（|cur−base| / base·base>0 守卫·不写 state）。
 * 供 LOD 触发 ctx 投影（漂移命名空间）和 applyDriftCandidate 复用。
 */
export function computeRelativeDrift(cur: number, baseline: number): number {
  if (baseline <= 0) return 0;
  return Math.abs(cur - baseline) / baseline;
}

/**
 * 若有效价格相对区域物价.基准价 漂移超过阈值，将候选新基线写入
 * state.地图.区域物价[regionId][category].候选基线（inner additive 字段）。
 *
 * 明确排除：
 *  · 不自动 bump 预设版本
 *  · 不回写只读预设对象
 *  · 不新增顶层 schemaKey（候选基线 是 区域物价 内层字段）
 *
 * @param state     当前 RootState（in-place 写候选基线）
 * @param preset    当前挂载预设（为 undefined → 退化 no-op）
 * @param regionId  区域节点键
 * @param category  品类键
 */
export function applyDriftCandidate(
  state: RootState,
  preset: 玩法预设Type | undefined,
  regionId: string,
  category: string,
  formulaConfig?: FormulaResolveConfig,
): void {
  const rule = preset?.经济生成规则;
  if (!rule) return;

  const entry = state.地图?.区域物价?.[regionId]?.[category];
  const stateBaseline = entry?.基准价 ?? 0;
  if (stateBaseline === 0) return;

  const effective = deriveEffectivePrice(state, preset, regionId, category, formulaConfig);
  const drift = computeRelativeDrift(effective, stateBaseline);
  const _driftThreshold = resolveFormula('economy_drift_threshold', formulaConfig);
  if (drift <= _driftThreshold) return;

  // 写入候选基线（additive·optional 字段·不触发 schemaKey 增长）
  // stateBaseline > 0 implies 地图?.区域物价 exists; guard satisfies TypeScript.
  if (!state.地图?.区域物价) return;
  if (!state.地图.区域物价[regionId]) {
    state.地图.区域物价[regionId] = {};
  }
  const catEntry = state.地图.区域物价[regionId]![category];
  if (!catEntry) {
    state.地图.区域物价[regionId]![category] = { 基准价: stateBaseline, 供需: 0, 候选基线: effective };
  } else {
    catEntry.候选基线 = effective;
  }
}
