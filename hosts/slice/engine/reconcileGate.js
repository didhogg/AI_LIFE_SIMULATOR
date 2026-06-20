// P0-8 Batch 3: 对账闸正式化 — M2.5/M2.6/M2.7 三层统一出口 + 分级失败处理
import { gateCoverage } from '../ledger/gate.js';
import { CHINESE_NUMBER_RULE_VERSION } from '@ai-life-sim/core/engine/text/chineseNumber';
/** 对账失败重Roll提示（常驻图标旁·不弹窗·不教学·不替玩家做事） */
export const RECONCILE_ROLL_HINT = {
    ui提示: '出现错误，请「重 Roll」',
    重Roll说明: '点击重 Roll 图标重新生成本拍叙事',
};
/**
 * 对账闸（M2.5/M2.6/M2.7 三层）分级失败处理统一出口。
 *
 * 判定路径: 确定性·依赖 CHINESE_NUMBER_RULE_VERSION（进指纹·'中文数字解析规则版'）
 * 切片降级: 不在此层（组装层·不进指纹）
 */
export function runReconcileGate(narrative, proposal, retryNarrative, context) {
    const ruleVersion = CHINESE_NUMBER_RULE_VERSION;
    // ── 首次判定 ───────────────────────────────────────────────────────────────────
    const first = gateCoverage(narrative, proposal, context);
    if (first.covered) {
        return { status: 'covered', finalCoverage: first, ruleVersion };
    }
    // ── 语义拦截（reason 有值）→ 即时硬拒（不可解析·不重试）───────────────────────────
    if (first.reason !== undefined) {
        return {
            status: 'hard_rejected',
            finalCoverage: first,
            rollHint: RECONCILE_ROLL_HINT,
            ruleVersion,
        };
    }
    // ── 金额漏项（reason 未定义）→ 单次纠偏重试（可解析歧义）────────────────────────────
    if (retryNarrative === undefined) {
        return {
            status: 'retried_failed',
            finalCoverage: first,
            rollHint: RECONCILE_ROLL_HINT,
            ruleVersion,
        };
    }
    const retried = gateCoverage(retryNarrative, proposal, context);
    if (retried.covered) {
        return { status: 'retried_covered', finalCoverage: retried, ruleVersion };
    }
    // 重试仍失败 → 降级·附重Roll提示
    const degradedResult = retried.covered
        ? retried
        : { ...retried, degraded: true };
    return {
        status: 'retried_failed',
        finalCoverage: degradedResult,
        rollHint: RECONCILE_ROLL_HINT,
        ruleVersion,
    };
}
