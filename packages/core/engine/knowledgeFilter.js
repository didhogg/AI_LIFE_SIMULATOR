/**
 * 知情过滤（∩ 窗）。
 *
 * 返回 povEntityKey 可见的秘密子集：
 *   - 知情方：返回 { 母题, 严重度, 暴露度 }（$谜底 永不输出）
 *   - 非知情方：条目完全不返回（existence-opaque）
 *
 * 知情判定：知情名单[i].对象 === povEntityKey（字面匹配·MVP）
 */
export function filterSecretsForPOV(secrets, povEntityKey) {
    const result = {};
    for (const [id, secret] of Object.entries(secrets)) {
        if (secret.知情名单.some(e => e.对象 === povEntityKey)) {
            result[id] = {
                母题: secret.母题,
                严重度: secret.严重度,
                暴露度: secret.暴露度,
            };
        }
    }
    return result;
}
/**
 * 检查指定实体是否知晓指定秘密（知情名单字面匹配·MVP）。
 */
export function entityKnowsSecret(secret, entityKey) {
    return secret.知情名单.some(e => e.对象 === entityKey);
}
