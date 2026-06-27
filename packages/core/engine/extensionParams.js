/** 单键类型校验（fail-closed·类型不匹配 = false） */
export function validateExtensionEntry(value, decl) {
    if (decl.类型 === '数字')
        return typeof value === 'number';
    if (decl.类型 === '字符串')
        return typeof value === 'string';
    if (decl.类型 === '布尔')
        return typeof value === 'boolean';
    return false; // unknown 类型枚举 → fail-closed（schema 已保证三元闭集·此分支防御用）
}
/**
 * 按声明模板校验 扩展参数 实例值（闸①形状·fail-closed）。
 * 只校验 扩展参数 中已有且在模板中声明的键；未在模板中声明的键不报违规（白名单由 P9-3 管）。
 * 返回违规列表；空数组 = 全通过。
 */
export function validateExtensionParams(扩展参数, 变量模板) {
    const violations = [];
    for (const [key, value] of Object.entries(扩展参数)) {
        if (!Object.prototype.hasOwnProperty.call(扩展参数, key))
            continue;
        if (!Object.prototype.hasOwnProperty.call(变量模板, key))
            continue; // 未声明键跳过
        const decl = 变量模板[key];
        if (!decl)
            continue;
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
export function seedExtensionParams(扩展参数, 变量模板) {
    for (const [varKey, decl] of Object.entries(变量模板)) {
        if (!Object.prototype.hasOwnProperty.call(变量模板, varKey))
            continue;
        if (Object.prototype.hasOwnProperty.call(扩展参数, varKey))
            continue; // 已有值不覆盖
        扩展参数[varKey] = decl.默认值;
    }
}
