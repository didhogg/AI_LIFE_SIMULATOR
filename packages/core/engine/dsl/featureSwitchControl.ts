// 功能开关三层 resolver（仿 resolveEffectivePredicate·aiPredControl.ts）
// 纯函数·确定性·零 import·fail-safe
// 三层优先级（高→低）：玩家override > 作者出厂默认 > 中性回退
// 六禁：禁 Date.now/new Date/Math.random/window/document/localeCompare

/**
 * 从三层控制解析功能开关有效值（纯函数·确定性·无副作用）。
 *
 * 优先级规则：
 *   ① 玩家override表有键 → 使用玩家值（最高主权）
 *   ② 有作者出厂默认 → 使用作者值
 *   ③ 无任何配置 → 返回中性回退（fail-safe）
 *
 * @param 键          功能开关键名（与功能开关表字段名一致）
 * @param 中性         无任何配置时的 fail-safe 回退值
 * @param 作者默认     内容包/preset 出厂种子（undefined=未配置）
 * @param 玩家override $玩家偏好.功能开关override表（undefined=玩家未设置）
 */
export function resolveEffectiveSwitch<T>(
  键: string,
  中性: T,
  作者默认: T | undefined,
  玩家override: Readonly<Record<string, unknown>> | undefined,
): T {
  const override = 玩家override?.[键];
  if (override !== undefined) return override as T;
  if (作者默认 !== undefined) return 作者默认;
  return 中性;
}
