export function createArchiveHeader(seed = 42) {
    return { seed, 全局回滚计数器: 0 };
}
// 重掷时调用（不回滚，结构性阻止骰子农场）
export function bumpSalt(h) {
    return { ...h, 全局回滚计数器: h.全局回滚计数器 + 1 };
}
// ── D4 demo 用 · 完整存档头（P0-9 前哨 · additive-only · 不改 MinArchiveHeader）──────
// RULE_VERSION=3 = B3/B4 后新格式（含中文数字/软拒/AOHP 规则版本快照）
// P0-9 迁移侦察：旧存档 MinArchiveHeader 加载时缺失这些字段 → migrateToFullArchiveHeader 补全
export const ARCHIVE_RULE_VERSION = 3;
export function createFullArchiveHeader(seed = 42) {
    return {
        seed,
        全局回滚计数器: 0,
        RULE_VERSION: ARCHIVE_RULE_VERSION,
        中文数字解析规则版: 2, // CHINESE_NUMBER_RULE_VERSION
        软拒规则版: 1, // SOFT_REJECT_RULE_VERSION
        AOHP语义键版: 1,
        schemaKeys: 52,
    };
}
/** 旧 MinArchiveHeader → FullArchiveHeader（P0-9 迁移侦察·幂等·保留 seed 和计数器） */
export function migrateToFullArchiveHeader(h) {
    if ('RULE_VERSION' in h && h.RULE_VERSION === ARCHIVE_RULE_VERSION)
        return h;
    return {
        ...h,
        RULE_VERSION: ARCHIVE_RULE_VERSION,
        中文数字解析规则版: 2,
        软拒规则版: 1,
        AOHP语义键版: 1,
        schemaKeys: 52,
    };
}
