// P0-8 prompt assembly layer — override injection gate + NSFW model routing
import type { RootState } from '../schema/index.js';
import type { 叙事调用条目Type } from '../schema/memory.js';

// ── Override injection gate ────────────────────────────────────────────────────

export interface AssembledCall {
  systemPrompt: string;
  assistantPrefill: string | undefined;
}

// Gate is computed live on every call — never cached. Condition is hardcoded:
// both 内容分级==='community' AND 允许玩家覆盖===true must hold simultaneously.
function overrideAllowed(state: RootState, entry: 叙事调用条目Type): boolean {
  return state.$玩家偏好.内容分级 === 'community' && entry.允许玩家覆盖SystemPrompt === true;
}

export function assembleNarrativeCall(
  baseSystemPrompt: string,
  entry: 叙事调用条目Type,
  state: RootState,
): AssembledCall {
  const allowed = overrideAllowed(state, entry);
  return {
    systemPrompt: (allowed && entry.玩家SystemPrompt覆盖) ? entry.玩家SystemPrompt覆盖 : baseSystemPrompt,
    assistantPrefill: (allowed && entry.assistant预填) ? entry.assistant预填 : undefined,
  };
}

// ── NSFW model routing (三态开关) ─────────────────────────────────────────────
//
// 三态:
//   关 (启用=false):   恒用默认模型，软拒 → 重roll叙事（同模型，不切）
//   失败兜底:          软拒/拒答命中 → 切目标模型重试
//   场景预判:          叙事前场景检测命中 → 预路由到目标模型；仍失败再重roll
//
// 硬约束:
//   ① 切模型必明示原因 (explicitReason 恒非空)
//   ② 只在已配 key 模型间切；目标无 key → nsfw-disabled + 提示
//   ③ 路由决策字段供调用方写入 tick_log（快照锁定，回滚/重放不漂移）
//
// 作用域: 仅叙事调用。记账/检定/谜底校准/结算调用方绝不调用此函数。
// 内容分级 ⊥ NSFW降级模型: 前者控提示词强度，后者控是否/何时切模型，二者独立。

export type NsfwRouteVia = 'default' | 'nsfw-fallback' | 'nsfw-preempt' | 'nsfw-disabled';

export interface ModelRouteDecision {
  /** null = 使用调用方默认模型；非 null = 切到此 provider key */
  modelKey: string | null;
  routedVia: NsfwRouteVia;
  /** 硬约束①: 恒非空的路由原因，供 tick_log 写入（硬约束③）和前端明示用户 */
  explicitReason: string;
}

export interface NsfwRouteOpts {
  /** B: 软拒/拒答检测命中 */
  softRejectDetected: boolean;
  /** 场景预判器命中 NSFW（内容分级∈{explicit,community} ∧ 叙事意图/情境标签命中） */
  scenePredictedNsfw: boolean;
}

export function selectNarrativeModel(
  state: RootState,
  opts: NsfwRouteOpts,
): ModelRouteDecision {
  const pref = state.$玩家偏好.NSFW降级模型;

  // 关态：永不切模型
  if (!pref.启用) {
    return {
      modelKey: null,
      routedVia: 'default',
      explicitReason: 'NSFW降级模型已关闭，恒用当前默认模型；软拒走重roll叙事（同模型·重渲不重判·账本冻结）',
    };
  }

  // 硬约束②: 目标 key 必须在 $模型画像 中已配置
  const targetKey = state.$预算控制台.NSFW降级目标模型键;
  if (!targetKey || !(targetKey in state.$模型画像)) {
    const missing = targetKey ?? '(未设置)';
    return {
      modelKey: null,
      routedVia: 'nsfw-disabled',
      explicitReason: `NSFW降级目标模型键「${missing}」不在$模型画像，开关自动降级为不可用；请在$预算控制台.NSFW降级目标模型键配置有效的provider key`,
    };
  }

  // 场景预判模式：检测命中即预路由
  if (pref.触发模式 === '场景预判' && opts.scenePredictedNsfw) {
    return {
      modelKey: targetKey,
      routedVia: 'nsfw-preempt',
      explicitReason: `场景预判命中NSFW，预先路由到模型「${targetKey}」（内容分级∈{explicit,community}∧情境标签匹配）`,
    };
  }

  // 失败兜底 / 场景预判未命中但有软拒：切换重试
  if (opts.softRejectDetected) {
    return {
      modelKey: targetKey,
      routedVia: 'nsfw-fallback',
      explicitReason: `软拒/拒答检测命中，因「${pref.触发模式}」切换到模型「${targetKey}」重试`,
    };
  }

  // 无触发条件：使用默认模型
  return {
    modelKey: null,
    routedVia: 'default',
    explicitReason: '未触发NSFW切换条件（无软拒·无场景预判命中），使用默认模型',
  };
}
