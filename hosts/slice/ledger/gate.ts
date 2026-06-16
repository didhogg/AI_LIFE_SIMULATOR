// M2.7 三道闸（语义方向/性质硬化 + NFKC 归一 + from/to 实体校验）
// 闸①: 结构校验 (Zod)
// 闸②: 单写者 (TransferWorklist)
// 闸③: 对账覆盖性 —— 按顺序拦截：
//   a. 单位不可确认 (M2.6)
//   b. 方向=收入不记支出 (M2.7 找你/找零)
//   c. 性质=债权不记现金 (M2.7 赊账/欠款/借了)
//   d. 性质=代付不记现金 (M2.7 垫付/代付)
//   e. 总价防重复计数   (M2.7 共/合计+数字)
//   f. from/to 实体不可确认 (M2.7, 可选 context)
//   g. 金额数值漏项 (M2.5)
//
// 任一拦截 → covered:false → 调用方触发定点重写；重写仍失败 → degraded:true → 不落账
// 绝不 fail-open；绝不默认 from=主角 兜底。
import { TickProposalSchema, type TickProposal } from './proposalSchema.js';
import {
  extractMoneyAmounts,
  isCanonicalUnit,
  prepareNarrative,
  RE_CHANGE_GIVING,
  RE_DEBT,
  RE_ADVANCE,
  RE_TOTAL,
} from '@ai-life-sim/core/engine/text/chineseNumber';

// ── 闸① 结构校验 ──────────────────────────────────────────────────────────────
export type StructuralResult =
  | { ok: true;  proposal: TickProposal }
  | { ok: false; reason: string };

export function gateStructural(rawJson: string): StructuralResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch (e) {
    return { ok: false, reason: `JSON 解析失败: ${String(e)}` };
  }
  const result = TickProposalSchema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, reason: `Zod 校验失败: ${result.error.message}` };
  }
  return { ok: true, proposal: result.data };
}

// ── 闸③ 上下文（可选）────────────────────────────────────────────────────────

/**
 * 可选世界上下文，用于 from/to 实体存在性校验（M2.7 要求③）。
 * 不传则跳过实体校验（向后兼容）。
 */
export interface GateContext {
  /** 实体键 → 在叙事文本中可识别的别名列表（名字/称谓等）。 */
  entities?: Array<{ key: string; aliases: string[] }>;
}

// ── 闸③ 覆盖性结果 ────────────────────────────────────────────────────────────

export type CoverageResult =
  | { covered: true }
  | { covered: false; missing: number[]; degraded: boolean; reason?: string };

/**
 * 对账覆盖性闸（M2.7）。
 *
 * reason 含义：
 *   undefined          — 金额数值漏项（单位正确，方向/性质无问题）
 *   '单位不可确认'      — 叙事含非文单位（M2.6）
 *   '方向:收入不记支出' — 找你/找零/退你等收入场景（M2.7）
 *   '性质:债权不记现金' — 赊账/欠款/借了等债权场景（M2.7）
 *   '性质:代付不记现金' — 垫付/代付等代付场景（M2.7）
 *   '总价:防重复计数'   — 共/合计+数字，疑似总价（M2.7）
 *   'from/to:实体不可确认' — 实体名称未出现在叙事中（M2.7，需传入 context）
 *
 * degraded 由调用方在重试仍失败后设为 true。
 */
export function gateCoverage(
  narrative: string,
  proposal: TickProposal,
  context?: GateContext,
): CoverageResult {
  // ── 入口归一（M2.7）———————————————————————————————————————————————————————
  const norm = prepareNarrative(narrative);

  // ── 金额抽取（M2.5/M2.6，内部已归一）───────────────────────────────────────
  const amounts = extractMoneyAmounts(norm);
  if (amounts.length === 0) return { covered: true };

  // ── a. 单位不可确认（M2.6）──────────────────────────────────────────────────
  const unconfirmed = amounts.filter(a => !isCanonicalUnit(a.unit));
  if (unconfirmed.length > 0) {
    return { covered: false, missing: [], degraded: false, reason: '单位不可确认' };
  }

  // ── b–e. 语义方向/性质词（M2.7）────────────────────────────────────────────
  if (RE_CHANGE_GIVING.test(norm)) {
    return { covered: false, missing: [], degraded: false, reason: '方向:收入不记支出' };
  }
  if (RE_DEBT.test(norm)) {
    return { covered: false, missing: [], degraded: false, reason: '性质:债权不记现金' };
  }
  if (RE_ADVANCE.test(norm)) {
    return { covered: false, missing: [], degraded: false, reason: '性质:代付不记现金' };
  }
  if (RE_TOTAL.test(norm)) {
    return { covered: false, missing: [], degraded: false, reason: '总价:防重复计数' };
  }

  // ── f. from/to 实体存在性（M2.7，可选）──────────────────────────────────────
  if (context?.entities && proposal.transfers.length > 0) {
    for (const t of proposal.transfers) {
      const fromAliases = context.entities.find(e => e.key === t.from)?.aliases ?? [];
      const toAliases   = context.entities.find(e => e.key === t.to  )?.aliases ?? [];
      // 找不到别名定义视同不可确认
      const fromOk = fromAliases.length > 0 && fromAliases.some(n => norm.includes(n));
      const toOk   = toAliases.length   > 0 && toAliases.some(n   => norm.includes(n));
      if (!fromOk || !toOk) {
        return { covered: false, missing: [], degraded: false, reason: 'from/to:实体不可确认' };
      }
    }
  }

  // ── g. 金额数值比对（M2.5）──────────────────────────────────────────────────
  const proposalAmounts = new Set(proposal.transfers.map(t => t.amount));
  const missing = amounts.map(a => a.value).filter(v => !proposalAmounts.has(v));
  if (missing.length === 0) return { covered: true };
  return { covered: false, missing, degraded: false };
}

// ── 守恒断言 ──────────────────────────────────────────────────────────────────
export function assertConservation(records: {
  before_from: number; after_from: number;
  before_to:   number; after_to:   number;
  actualAmt?:  number;
}[]): void {
  for (const r of records) {
    const sent     = r.before_from - r.after_from;
    const received = r.after_to    - r.before_to;
    if (sent !== received) {
      throw new Error(`守恒断言失败: 发出 ${sent} ≠ 收到 ${received}`);
    }
    if (r.actualAmt !== undefined && sent !== r.actualAmt) {
      throw new Error(`守恒断言失败: 实际落账 ${r.actualAmt} ≠ 余额差 ${sent}`);
    }
  }
}

export function assertNetZero(records: {
  before_from: number; after_from: number; before_to: number; after_to: number;
}[]): void {
  const totalSent     = records.reduce((s, r) => s + (r.before_from - r.after_from), 0);
  const totalReceived = records.reduce((s, r) => s + (r.after_to    - r.before_to ), 0);
  if (totalSent !== totalReceived) {
    throw new Error(`净额守恒失败: Σ发出 ${totalSent} ≠ Σ收到 ${totalReceived}`);
  }
}
