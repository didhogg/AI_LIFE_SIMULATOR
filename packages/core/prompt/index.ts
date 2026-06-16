// P0-8 prompt assembly layer — override injection gate + NSFW model routing
import type { RootState } from '../schema/index.js';
import type { 叙事调用条目Type } from '../schema/memory.js';
import type { TickLogEntry } from '../schema/system.js';

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

// ── N-3: key 运行时有效性校验 ─────────────────────────────────────────────────
// 禁: 不得静默路由到失效 key（撤销/过期/额度耗尽）
// 失效时降级为「关态」行为（永不切模型·只重 roll 叙事）+ 玻璃箱 nsfw-disabled 文案

export interface KeyValidityResult {
  valid: boolean;
  failReason?: 'revoked' | 'expired' | 'quota_exhausted' | 'unknown';
}

/** 调用方提供的 key 运行时有效性校验钩子（可选）。不传时跳过 live 校验，兼容历史路径。 */
export type KeyValidityChecker = (key: string) => KeyValidityResult;

// ── N-6: 多人模式路由归属口径（P2 接线·P0 仅注释锁定语义）─────────────────────
// 多人下「模型路由归属」= 全局成本/API-key 行为层面的房间级决策，
// ⚠️ 不是 per-seat 各自切模型——每席独立切会导致 API key 暴露给非房主席位、
//    成本核算混乱、并发调用竞争同一 key 配额。
// 正确口径：路由归属降至「房间级共识/房主权」——一个房间一套路由决策，
//   房主席位的 $玩家偏好.NSFW降级模型 对全房间生效，非房主席位无独立路由权。
// 实装见 P2 · 接 C5 per-seat 投影 + MP6 swipe 房主权时再落地。
// P0 本函数签名不含 seatId 参数——接线前禁止任何实装者按 per-seat 各自切误做。
export function selectNarrativeModel(
  state: RootState,
  opts: NsfwRouteOpts,
  keyChecker?: KeyValidityChecker,
): ModelRouteDecision {
  const pref = state.$玩家偏好.NSFW降级模型;

  // 关态：永不切模型（keyChecker 不调用——关态无需 live 校验）
  if (!pref.启用) {
    return {
      modelKey: null,
      routedVia: 'default',
      explicitReason: 'NSFW降级模型已关闭，恒用当前默认模型；软拒走重roll叙事（同模型·重渲不重判·账本冻结）',
    };
  }

  // 硬约束②: 目标 key 必须在 $模型画像 中已配置（静态配置检查）
  const targetKey = state.$预算控制台.NSFW降级目标模型键;
  if (!targetKey || !(targetKey in state.$模型画像)) {
    const missing = targetKey ?? '(未设置)';
    return {
      modelKey: null,
      routedVia: 'nsfw-disabled',
      explicitReason: `NSFW降级目标模型键「${missing}」不在$模型画像，开关自动降级为不可用；请在$预算控制台.NSFW降级目标模型键配置有效的provider key`,
    };
  }

  // N-3: 运行时 key 有效性校验（切前 live 校验；失效→降级为关态行为）
  if (keyChecker) {
    const validity = keyChecker(targetKey);
    if (!validity.valid) {
      const failDesc = validity.failReason === 'revoked'         ? '已撤销'
                     : validity.failReason === 'expired'         ? '已过期'
                     : validity.failReason === 'quota_exhausted' ? '额度耗尽'
                     :                                             '失效原因未知';
      return {
        modelKey: null,
        routedVia: 'nsfw-disabled',
        explicitReason: `NSFW降级目标模型键「${targetKey}」key失效已回落（${failDesc}）：降级为关态，软拒走重roll叙事（不切模型）`,
      };
    }
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

// ── N-1: 场景检测器（前置·每拍仅跑一次）─────────────────────────────────────
// exported: injectable in tests via assembleTickRoute's sceneDetector param.
// Condition: 内容分级∈{explicit,community} AND intentTags contains an nsfw/explicit marker.
export function isNsfwScene(state: RootState, intentTags: string[]): boolean {
  const rating = state.$玩家偏好.内容分级;
  if (rating !== 'explicit' && rating !== 'community') return false;
  return intentTags.some(t => t === 'nsfw' || t === 'explicit' || t.includes('-nsfw') || t.includes('-explicit'));
}

export type SceneDetector = (state: RootState, intentTags: string[]) => boolean;

// ── N-1: 一拍路由定格 ─────────────────────────────────────────────────────────
// Route is locked on first assembly of a tick and written to _系统.tick_log.
// All same-tick swipes/re-rolls read the frozen snapshot without re-running the
// scene detector or re-calling selectNarrativeModel.
// sceneDetector is injectable so tests can count invocations without module spy tricks.
export function assembleTickRoute(
  state: RootState,
  intentTags: string[],
  sceneDetector: SceneDetector = isNsfwScene,
): { decision: ModelRouteDecision; updatedState: RootState } {
  const tickId = state._tick.id;

  // Return frozen route if already locked for this tick (N-1 idempotency)
  const existing = state._系统.tick_log.find(e => e.tick_id === tickId);
  if (existing?.路由快照) {
    const snap = existing.路由快照;
    return {
      decision: { routedVia: snap.routedVia as NsfwRouteVia, modelKey: snap.modelKey, explicitReason: snap.explicitReason },
      updatedState: state,
    };
  }

  // First assembly: scene detector runs exactly once, then route decision is made
  const scenePredictedNsfw = sceneDetector(state, intentTags);
  const decision = selectNarrativeModel(state, { softRejectDetected: false, scenePredictedNsfw });
  const snapshot = { routedVia: decision.routedVia, modelKey: decision.modelKey, explicitReason: decision.explicitReason };

  const newEntry: TickLogEntry = existing
    ? { ...existing, 路由快照: snapshot }
    : { tick_id: tickId, 拍计数: state._tick.拍计数, 结果摘要: '', 系数组指纹: state._tick.难度系数组指纹, 路由快照: snapshot };

  const newLog = existing
    ? state._系统.tick_log.map(e => e.tick_id === tickId ? newEntry : e)
    : [...state._系统.tick_log, newEntry];

  return { decision, updatedState: { ...state, _系统: { ...state._系统, tick_log: newLog } } };
}

// ── N-2: 重放冻结路由 ─────────────────────────────────────────────────────────
// Reads the route frozen at tick assembly time. Caller must NOT read live state.
// Returns null for pre-N-1 entries (no 路由快照 field) — caller falls back to re-routing.
export function replayRoute(entry: TickLogEntry): ModelRouteDecision | null {
  const snap = entry.路由快照;
  if (!snap) return null;
  return { routedVia: snap.routedVia as NsfwRouteVia, modelKey: snap.modelKey, explicitReason: snap.explicitReason };
}
