// P0-8 Batch 3: 对账闸正式化 — M2.5/M2.6/M2.7 三层统一出口 + 分级失败处理
//
// 失败分级（拍板①）:
//   可解析歧义（金额漏项·reason 未定义）→ 单次纠偏重试·失败→「重 Roll」提示
//   不可解析（语义拦截·reason 有值: 方向/性质/单位/实体）→ 即时硬拒+「重 Roll」提示
//
// 进指纹边界（拍板⑤）:
//   确定性判定（gateCoverage）依赖 CHINESE_NUMBER_RULE_VERSION（'中文数字解析规则版'·fingerprintManifest）
//   调用方应将 CHINESE_NUMBER_RULE_VERSION 传入 hashPresetFingerprint 的 '中文数字解析规则版' 字段
//
// 玩家主权铁律: 不自动重生·不替玩家选·不抬 token 预算（调用方仅单次重试）
// UX: rollHint 用于重Roll图标旁常驻静态文字·不弹窗·不主动教学

import { gateCoverage, type GateContext, type CoverageResult } from '../ledger/gate.js';
import type { TickProposal } from '../ledger/proposalSchema.js';
import { CHINESE_NUMBER_RULE_VERSION } from '@ai-life-sim/core/engine/text/chineseNumber';
import type { SoftRejectHint } from './outputGuard.js';

export type ReconcileGateStatus =
  | 'covered'           // 全部金额已覆盖
  | 'retried_covered'   // 单次纠偏重试后覆盖
  | 'retried_failed'    // 重试仍失败（降级·附重Roll提示）
  | 'hard_rejected';    // 语义拦截·即时硬拒（附重Roll提示）

export interface ReconcileGateResult {
  status: ReconcileGateStatus;
  /** 最终覆盖性判定结果（retried 路径为重试后结果） */
  finalCoverage: CoverageResult;
  /** 重Roll提示（status 非 'covered'/'retried_covered' 时必存在）
   *  UX: 常驻图标旁静态文字·不主动弹窗·不教学 */
  rollHint?: SoftRejectHint;
  /** 进指纹规则版本——确定性判定口径（与 fingerprintManifest '中文数字解析规则版' 一致） */
  ruleVersion: typeof CHINESE_NUMBER_RULE_VERSION;
}

/** 对账失败重Roll提示（常驻图标旁·不弹窗·不教学·不替玩家做事） */
export const RECONCILE_ROLL_HINT: SoftRejectHint = {
  ui提示: '出现错误，请「重 Roll」',
  重Roll说明: '点击重 Roll 图标重新生成本拍叙事',
};

/**
 * 对账闸（M2.5/M2.6/M2.7 三层）分级失败处理统一出口。
 *
 * 判定路径: 确定性·依赖 CHINESE_NUMBER_RULE_VERSION（进指纹·'中文数字解析规则版'）
 * 切片降级: 不在此层（组装层·不进指纹）
 *
 * 分级规则:
 *   - covered → 无需处理
 *   - covered:false + reason 有值（语义拦截）→ 即时硬拒（hard_rejected）
 *   - covered:false + reason 未定义（金额漏项）→ 单次纠偏重试（需提供 retryNarrative）
 *
 * @param narrative       首次叙事文本
 * @param proposal        提案（含 transfers 金额列表）
 * @param retryNarrative  纠偏重试叙事（金额漏项时由调用方提供；不提供则直接降级）
 * @param context         可选世界上下文（from/to 实体校验·M2.7 要求③）
 */
export function runReconcileGate(
  narrative: string,
  proposal: TickProposal,
  retryNarrative?: string,
  context?: GateContext,
): ReconcileGateResult {
  const ruleVersion = CHINESE_NUMBER_RULE_VERSION;

  // ── 首次判定 ───────────────────────────────────────────────────────────────────
  const first = gateCoverage(narrative, proposal, context);

  if (first.covered) {
    return { status: 'covered', finalCoverage: first, ruleVersion };
  }

  // ── 语义拦截（reason 有值）→ 即时硬拒（不可解析·不重试）───────────────────────────
  if (first.reason !== undefined) {
    return {
      status:        'hard_rejected',
      finalCoverage: first,
      rollHint:      RECONCILE_ROLL_HINT,
      ruleVersion,
    };
  }

  // ── 金额漏项（reason 未定义）→ 单次纠偏重试（可解析歧义）────────────────────────────
  if (retryNarrative === undefined) {
    // 未提供重试叙事：无重试来源·直接降级（调用方未触发 LLM 重写）
    return {
      status:        'retried_failed',
      finalCoverage: first,
      rollHint:      RECONCILE_ROLL_HINT,
      ruleVersion,
    };
  }

  const retried = gateCoverage(retryNarrative, proposal, context);
  if (retried.covered) {
    return { status: 'retried_covered', finalCoverage: retried, ruleVersion };
  }

  // 重试仍失败 → 降级·附重Roll提示
  const degradedResult: CoverageResult = retried.covered
    ? retried
    : { ...retried, degraded: true };

  return {
    status:        'retried_failed',
    finalCoverage: degradedResult,
    rollHint:      RECONCILE_ROLL_HINT,
    ruleVersion,
  };
}
