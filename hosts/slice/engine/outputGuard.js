// P0-8 Batch 3: N-4 输出侧软拒检测（接 Batch 2 软拒/重Roll 通道）
//
// 玩家主权铁律（拍板④）:
//   - 不自动重生（调用方不得在检出后自动重试）
//   - 不替玩家选（仅提示·由玩家操作）
//   - 不抬 token 预算
//
// UX（拍板④ UX 约束）:
//   - rollHint 用于重Roll图标旁常驻静态提示
//   - 不主动弹窗·不主动教学·不替玩家做事
//
// 依赖: detectSoftReject（softReject.ts·确定性规则·输入=LLM输出·结果仅驱动 rollHint UX·不进指纹）
import { detectSoftReject, SOFT_REJECT_RULE_VERSION } from '@ai-life-sim/core/engine/softReject';
/** 输出侧软拒重Roll提示（常驻图标旁·不弹窗·不教学·不替玩家做事） */
export const OUTPUT_GUARD_ROLL_HINT = {
    ui提示: '出现错误，请「重 Roll」',
    重Roll说明: '点击重 Roll 图标重新生成本拍叙事',
};
/**
 * N-4 输出侧软拒检测（LLM 输出 → 通道复用）。
 *
 * 对 LLM 返回的叙事文本执行 detectSoftReject() 检测。
 * 通过 → { status: 'passed' }
 * 检出 → { status: 'soft_rejected', rollHint }（复用 Batch 2 重Roll通道）
 *
 * 玩家主权: 不自动重生·不替玩家选·不抬 token 预算
 * UX: rollHint 仅用于图标旁常驻静态文字·不主动弹窗·不教玩家做事
 *
 * @param narrative  LLM 返回的叙事文本（原始输出·未经截断）
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
