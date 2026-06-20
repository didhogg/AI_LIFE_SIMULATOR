// P0-8 Batch 3: N-4 输出侧软拒检测（接 Batch 2 软拒/重Roll 通道）
import { detectSoftReject, SOFT_REJECT_RULE_VERSION } from '@ai-life-sim/core/engine/softReject';
/** 输出侧软拒重Roll提示（常驻图标旁·不弹窗·不教学·不替玩家做事） */
export const OUTPUT_GUARD_ROLL_HINT = {
    ui提示: '出现错误，请「重 Roll」',
    重Roll说明: '点击重 Roll 图标重新生成本拍叙事',
};
/**
 * N-4 输出侧软拒检测（LLM 输出 → 通道复用）。
 *
 * 玩家主权: 不自动重生·不替玩家选·不抬 token 预算
 * UX: rollHint 仅用于图标旁常驻静态文字·不主动弹窗·不教玩家做事
 */
export function runOutputGuard(narrative) {
    const ruleVersion = SOFT_REJECT_RULE_VERSION;
    const result = detectSoftReject(narrative);
    if (!result.detected) {
        return { status: 'passed', ruleVersion };
    }
    return {
        status: 'soft_rejected',
        ruleVersion,
        rollHint: OUTPUT_GUARD_ROLL_HINT,
        detail: {
            matchedKeyword: result.matchedKeyword,
            heuristicReason: result.heuristicReason,
        },
    };
}
