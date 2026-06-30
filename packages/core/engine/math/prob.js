/**
 * H4 概率域夹逼 — Ring 0, pure functions, no side effects.
 *
 * 所有判定概率在进入判定骰前 clamp 至 [p_最小, p_最大]（数值住预设）。
 * 小概率事件稳定式复用 fixed.ts stableProb，避免 1-(1-p)^n 取消误差。
 *
 * 不调用平台 Math 超越函数（禁③）；clamp 用 v1.clamp，stableProb 已在 fixed.ts。
 */
import { v1, stableProb } from './fixed.js';
/**
 * 概率域夹逼：将 p 钳制至 [pMin, pMax]。
 *
 * @param p     原始概率（0~1）
 * @param pMin  下界（住预设·如 0.0001 = 0.01%）
 * @param pMax  上界（住预设·如 0.9999 = 99.99%）
 * @returns     钳制后的概率，严格 ∈ [pMin, pMax]
 */
export function clampProb(p, pMin, pMax) {
    return v1.clamp(p, pMin, pMax);
}
/**
 * 稳定式：P(至少1次·n 期·每期概率 p) = 1 − (1−p)^n。
 *
 * 直接从 fixed.ts 重导出供上层使用，无需直接 import fixed.ts。
 * 用于替代不稳定的 1 − (1−p)^n 直接计算（小 p 时前者产生严重取消误差）。
 */
export { stableProb };
