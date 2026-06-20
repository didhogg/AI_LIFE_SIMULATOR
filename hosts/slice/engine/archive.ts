// M2 最小存档头 — 全局回滚计数器（盐源）
// 口径：盐源规范 R5 — rngFor 的 rerollSalt 必须来自此计数器
// M3 正式存档接线后替换为 RootState._存档头
export interface MinArchiveHeader {
  seed: number;               // 存档级全局 RNG 种子（开局锁定）
  全局回滚计数器: number;      // 每次重掷 +1；不随快照回滚还原（农骰防护）
}

export function createArchiveHeader(seed: number = 42): MinArchiveHeader {
  return { seed, 全局回滚计数器: 0 };
}

// 重掷时调用（不回滚，结构性阻止骰子农场）
export function bumpSalt(h: MinArchiveHeader): MinArchiveHeader {
  return { ...h, 全局回滚计数器: h.全局回滚计数器 + 1 };
}

// ── D4 demo 用 · 完整存档头（P0-9 前哨 · additive-only · 不改 MinArchiveHeader）──────
// RULE_VERSION=3 = B3/B4 后新格式（含中文数字/软拒/AOHP 规则版本快照）
// P0-9 迁移侦察：旧存档 MinArchiveHeader 加载时缺失这些字段 → migrateToFullArchiveHeader 补全

export const ARCHIVE_RULE_VERSION = 3 as const;

export interface FullArchiveHeader extends MinArchiveHeader {
  /** 存档格式版本 (3 = B3/B4 后新格式) */
  RULE_VERSION: typeof ARCHIVE_RULE_VERSION;
  /** B3 中文数字解析规则版 (CHINESE_NUMBER_RULE_VERSION=2·reconcile gate 进指纹) */
  中文数字解析规则版: number;
  /** B3 软拒规则版 (SOFT_REJECT_RULE_VERSION=1·outputGuard 判定) */
  软拒规则版: number;
  /** B4 AOHP 语义键版 (option_id 格式版本) */
  AOHP语义键版: number;
  /** schema 键数量快照 (schemaKeys=52·P0-9 迁移侦察用) */
  schemaKeys: number;
}

export function createFullArchiveHeader(seed: number = 42): FullArchiveHeader {
  return {
    seed,
    全局回滚计数器: 0,
    RULE_VERSION: ARCHIVE_RULE_VERSION,
    中文数字解析规则版: 2,  // CHINESE_NUMBER_RULE_VERSION
    软拒规则版: 1,          // SOFT_REJECT_RULE_VERSION
    AOHP语义键版: 1,
    schemaKeys: 52,
  };
}

/** 旧 MinArchiveHeader → FullArchiveHeader（P0-9 迁移侦察·幂等·保留 seed 和计数器） */
export function migrateToFullArchiveHeader(h: MinArchiveHeader | FullArchiveHeader): FullArchiveHeader {
  if ('RULE_VERSION' in h && h.RULE_VERSION === ARCHIVE_RULE_VERSION) return h as FullArchiveHeader;
  return {
    ...h,
    RULE_VERSION: ARCHIVE_RULE_VERSION,
    中文数字解析规则版: 2,
    软拒规则版: 1,
    AOHP语义键版: 1,
    schemaKeys: 52,
  };
}
