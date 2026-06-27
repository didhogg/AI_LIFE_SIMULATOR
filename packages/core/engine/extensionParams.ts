// P9-2 · 扩展参数 实例校验器 + 默认值播种（纯函数·确定性·Ring 0·六禁）
// 六禁：禁 Date.now/new Date/Math.random/localeCompare/裸JSON.stringify/NFC平台normalize
// 纯函数：无 I/O·无副作用·无随机·无时间·无全局态·同输入恒同输出
import type { 变量字段声明Type, 变量模板Type } from '../schema/commonEntry.js';

/** 单键类型校验（fail-closed·类型不匹配 = false） */
export function validateExtensionEntry(
  value: unknown,
  decl: 变量字段声明Type,
): boolean {
  if (decl.类型 === '数字')  return typeof value === 'number';
  if (decl.类型 === '字符串') return typeof value === 'string';
  if (decl.类型 === '布尔')  return typeof value === 'boolean';
  return false; // unknown 类型枚举 → fail-closed（schema 已保证三元闭集·此分支防御用）
}

export interface ExtensionViolation {
  key: string;
  expected: string; // 声明模板 `类型`
  got: string;      // typeof value
}

/**
 * 按声明模板校验 扩展参数 实例值（闸①形状·fail-closed）。
 * 只校验 扩展参数 中已有且在模板中声明的键；未在模板中声明的键不报违规（白名单由 P9-3 管）。
 * 返回违规列表；空数组 = 全通过。
 */
export function validateExtensionParams(
  扩展参数: Readonly<Record<string, unknown>>,
  变量模板: 变量模板Type,
): ExtensionViolation[] {
  const violations: ExtensionViolation[] = [];
  for (const [key, value] of Object.entries(扩展参数)) {
    if (!Object.prototype.hasOwnProperty.call(扩展参数, key)) continue;
    if (!Object.prototype.hasOwnProperty.call(变量模板, key)) continue; // 未声明键跳过
    const decl = 变量模板[key];
    if (!decl) continue;
    if (!validateExtensionEntry(value, decl)) {
      violations.push({ key, expected: decl.类型, got: typeof value });
    }
  }
  return violations;
}

/**
 * 按声明模板默认值 seed 扩展参数缺省键（幂等·已有键不覆盖·无 RNG·确定性）。
 * 字符串/布尔型照常 seed 进实例（持久化）——P9-3 决定是否投影入 DSL ctx。
 * 原地修改传入的 扩展参数 对象。
 */
export function seedExtensionParams(
  扩展参数: Record<string, number | string | boolean>,
  变量模板: 变量模板Type,
): void {
  for (const [varKey, decl] of Object.entries(变量模板)) {
    if (!Object.prototype.hasOwnProperty.call(变量模板, varKey)) continue;
    if (Object.prototype.hasOwnProperty.call(扩展参数, varKey)) continue; // 已有值不覆盖
    扩展参数[varKey] = decl.默认值;
  }
}
