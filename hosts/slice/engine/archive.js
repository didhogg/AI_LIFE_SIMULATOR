import { CHINESE_NUMBER_RULE_VERSION } from '@ai-life-sim/core/engine/text/chineseNumber';
import { SOFT_REJECT_RULE_VERSION } from '@ai-life-sim/core/engine/softReject';
export function createArchiveHeader(seed = 42) {
    return { seed, 全局回滚计数器: 0 };
}
// 重掷时调用（不回滚，结构性阻止骰子农场）
export function bumpSalt(h) {
    return { ...h, 全局回滚计数器: h.全局回滚计数器 + 1 };
}
// ── D4 demo 用 · 完整存档头（P0-9 前哨 · additive-only · 不改 MinArchiveHeader）──────
export const ARCHIVE_RULE_VERSION = 3;
const AOHP_SEMANTIC_KEY_VERSION = 1;
export function createFullArchiveHeader(seed = 42) {
    return {
        seed,
        全局回滚计数器: 0,
        RULE_VERSION: ARCHIVE_RULE_VERSION,
        中文数字解析规则版: CHINESE_NUMBER_RULE_VERSION,
        软拒规则版: SOFT_REJECT_RULE_VERSION,
        AOHP语义键版: AOHP_SEMANTIC_KEY_VERSION,
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
        中文数字解析规则版: CHINESE_NUMBER_RULE_VERSION,
        软拒规则版: SOFT_REJECT_RULE_VERSION,
        AOHP语义键版: AOHP_SEMANTIC_KEY_VERSION,
        schemaKeys: 52,
    };
}
