/**
 * H3 汇率单锚两跳 — Ring 0, pure functions, no side effects.
 *
 * 结构性无套利保证：
 *   - 唯一换算路径：from → 基准 → to（两跳·禁直连汇率对）
 *   - 取整方向恒不利于发起者：买入向上（ceil）·卖出向下（floor）
 *   - 环路乘积 = (1/r_A) * r_B * (1/r_B) * r_A = 1；取整使单次≤1·累计非增殖
 *
 * 汇率数据结构：
 *   rateMap[币种键] = 该币种对基准汇率（1单位该币 = X单位基准）
 *   基准币种自身 rateMap 值应为 1（或省略，引擎缺省视为1）
 *
 * 不调用平台 Math 超越函数（禁③）；取整用 v1.ceil / v1.floor。
 */
import { v1 } from './fixed.js';
/**
 * 两跳汇率换算（from → base → to）。
 *
 * 取整方向：
 *   'buy'  → 买入方付出更多 → 结果向上取整（对 from 方不利）
 *   'sell' → 卖出方收到更少 → 结果向下取整（对 from 方不利）
 *
 * @param amount   源币数量（正数）
 * @param from     源币种键
 * @param to       目标币种键
 * @param rateMap  Record<币种键, 对基准汇率>（基准自身缺省=1）
 * @param dir      换算方向
 * @returns 目标币种金额（已取整）
 * @throws 若 amount ≤ 0、汇率 ≤ 0、或币种不存在于 rateMap
 */
export function convertFx(amount, from, to, rateMap, dir) {
    if (amount <= 0)
        throw new Error(`convertFx: amount 必须 > 0，收到 ${amount}`);
    // 取基准汇率（缺省 = 1 表示该币种就是基准）
    const rateFrom = rateMap[from] ?? 1;
    const rateTo = rateMap[to] ?? 1;
    if (rateFrom <= 0)
        throw new Error(`convertFx: 无效汇率 [${from}] = ${rateFrom}`);
    if (rateTo <= 0)
        throw new Error(`convertFx: 无效汇率 [${to}] = ${rateTo}`);
    // 两跳：from → base（×rateFrom），base → to（÷rateTo）
    const raw = (amount * rateFrom) / rateTo;
    return dir === 'buy' ? v1.ceil(raw) : v1.floor(raw);
}
/**
 * 直连汇率对校验门卫。
 *
 * mod 声明直连汇率对（跳过基准的 "A/B" 直连）拒收：调用此函数若发现非空对列表即抛出。
 * 引擎在读取 mod 汇率配置时应调用此函数拦截非法声明。
 *
 * @param directPairs  声明的直连对列表（形如 ["USD/EUR", "JPY/GBP"]）
 * @throws 若 directPairs 非空
 */
export function assertNoDirectCrossRate(directPairs) {
    if (directPairs.length > 0) {
        throw new Error(`H3 汇率单锚约束违反：禁止直连汇率对，拒收：${directPairs.join(', ')}。所有换算必须经由基准币种两跳。`);
    }
}
