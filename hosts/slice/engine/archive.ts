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
// 活常量引用：凡已有权威常量的版本字段一律引常量，杜绝字面量漂移。
// RULE_VERSION=3 = B3/B4 后新格式（含中文数字/软拒/AOHP 规则版本快照）
// P0-9 迁移侦察：旧存档 MinArchiveHeader 加载时缺失这些字段 → migrateToFullArchiveHeader 补全

import { CHINESE_NUMBER_RULE_VERSION } from '@ai-life-sim/core/engine/text/chineseNumber';
import { SOFT_REJECT_RULE_VERSION } from '@ai-life-sim/core/engine/softReject';

export const ARCHIVE_RULE_VERSION = 3 as const;

// AOHP 语义键版：无对应活常量（格式版本由 buildOptionId 实现决定）→ 字面量 1
const AOHP_SEMANTIC_KEY_VERSION = 1 as const;

export interface FullArchiveHeader extends MinArchiveHeader {
  /** 存档格式版本 (3 = B3/B4 后新格式) */
  RULE_VERSION: typeof ARCHIVE_RULE_VERSION;
  /** B3 中文数字解析规则版（CHINESE_NUMBER_RULE_VERSION·reconcile gate 进指纹） */
  中文数字解析规则版: number;
  /** B3 软拒规则版（SOFT_REJECT_RULE_VERSION·outputGuard 判定） */
  软拒规则版: number;
  /** B4 AOHP 语义键版（buildOptionId 格式版本·无活常量→字面量 1） */
  AOHP语义键版: number;
  /** schema 键数量快照（schemaKeys=54·P0-9 迁移侦察用） */
  schemaKeys: number;
}

export function createFullArchiveHeader(seed: number = 42): FullArchiveHeader {
  return {
    seed,
    全局回滚计数器: 0,
    RULE_VERSION: ARCHIVE_RULE_VERSION,
    中文数字解析规则版: CHINESE_NUMBER_RULE_VERSION,  // 活常量·当前=3
    软拒规则版: SOFT_REJECT_RULE_VERSION,              // 活常量·当前=1
    AOHP语义键版: AOHP_SEMANTIC_KEY_VERSION,           // 字面量·无活常量
    schemaKeys: 54,
  };
}

/** 旧 MinArchiveHeader → FullArchiveHeader（P0-9 迁移侦察·幂等·保留 seed 和计数器） */
export function migrateToFullArchiveHeader(h: MinArchiveHeader | FullArchiveHeader): FullArchiveHeader {
  if ('RULE_VERSION' in h && h.RULE_VERSION === ARCHIVE_RULE_VERSION) return h as FullArchiveHeader;
  return {
    ...h,
    RULE_VERSION: ARCHIVE_RULE_VERSION,
    中文数字解析规则版: CHINESE_NUMBER_RULE_VERSION,
    软拒规则版: SOFT_REJECT_RULE_VERSION,
    AOHP语义键版: AOHP_SEMANTIC_KEY_VERSION,
    schemaKeys: 54,
  };
}
