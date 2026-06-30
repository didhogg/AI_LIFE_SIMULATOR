/**
 * H1 账面量安全钳制 — Ring 0, pure functions, no side effects.
 * 第⑤闸入账前 clamp；越软顶 = clamp + 返回 exceeded 标志供调用方广播 ⚠。
 * 不调用平台 Math 超越函数（禁③）；整数/边界比较用 v1.max。
 */
import { v1 } from './fixed.js';
/**
 * 单字段账面量入账前钳制（第⑤闸）。
 *
 * 优先序（越严越优先）：hardHi > hi（软顶）> lo（硬底）。
 * exceeded = 触发了软顶或硬顶（两者都需广播 ⚠）。
 *
 * @param amount  原始入账值
 * @param lo      硬底（无广播；缺省设为 -Infinity 表示不限）
 * @param hi      软顶（越顶触发 exceeded + ⚠）
 * @param label   字段路径标签，透传给调用方
 * @param hardHi  硬顶（比软顶更严·不要求 >= hi；超过即钳制+exceeded）
 */
export function clampLedger(amount, lo, hi, label, hardHi) {
    if (hardHi !== undefined && amount > hardHi) {
        return { value: hardHi, exceeded: true, ceiling: hardHi, label };
    }
    if (amount > hi) {
        return { value: hi, exceeded: true, ceiling: hi, label };
    }
    // Hard floor — no broadcast; v1.max avoids direct Math call
    const value = v1.max(amount, lo);
    return { value, exceeded: false, ceiling: undefined, label };
}
/**
 * 年化增长率预警。
 *
 * 若 |rate| 超过 threshold，返回可直接记录 / 广播的 ⚠ 字符串；否则返回 null。
 *
 * @param rate       年化增长率（小数；0.5 = 50%/年）
 * @param label      字段路径标签
 * @param threshold  警戒线（缺省 1.0 = 100%/年）
 */
export function warnAnnualRate(rate, label, threshold = 1.0) {
    const absRate = rate < 0 ? -rate : rate;
    if (absRate > threshold) {
        return `⚠ 年化增长率越警戒线 [${label}]: ${(rate * 100).toFixed(2)}% > ${(threshold * 100).toFixed(2)}%`;
    }
    return null;
}
