// P7-5d L-21: LLM 重要度分创建即冻结·进指纹·永不重算
// 冻结纪律：配 Z5 工单冻结机制·创建时写 权重_冻结=true·后续写保护
//
// 「进指纹」口径（无需新增 BUNDLE_MEMBER）：
//   冻结分值是 effect 包 delta 内容的一部分 →
//   经 computeEffectPackHash(pack) → content_hash 通道 →
//   聚合生效中内容包集哈希 → hashPresetFingerprint.生效中内容包集哈希（已在 PRESET_FIELDS）
//
// 红线：不 import rng.ts / gate.ts / fixed.ts

/** 冻结写入结果（权重_冻结 永远为 true） */
export interface ImportanceFreezeResult {
  /** 冻结后的权重值 (0-100) */
  readonly 权重: number;
  /** 冻结标志：创建后永久 true·禁止后续覆写 */
  readonly 权重_冻结: true;
}

/** 包含重要度字段的记忆条目最小形状 */
export interface FreezableMemoryEntry {
  权重?: number;
  权重_冻结?: boolean;
}

/**
 * L-21: 创建记忆条目重要度分并立即冻结。
 *
 * 只允许在记忆条目「创建时」调用一次；创建后永不重算。
 * 已冻结（权重_冻结=true）时调用 → 抛出 L-21 不可逆错误。
 * 分值超出 [0,100] → 自动 clamp（防御性）。
 *
 * @param currentEntry 当前记忆条目（只读·读取冻结状态）
 * @param newScore     LLM 赋予的重要度分（[0,100]）
 */
export function freezeImportanceScore(
  currentEntry: FreezableMemoryEntry,
  newScore: number,
): ImportanceFreezeResult {
  if (currentEntry.权重_冻结) {
    throw new Error(
      `L-21 违规: 记忆重要度分已冻结（当前值: ${currentEntry.权重 ?? 50}），禁止重算`,
    );
  }
  const clamped = Math.max(0, Math.min(100, Math.round(newScore)));
  return { 权重: clamped, 权重_冻结: true };
}

/**
 * L-21 守卫：断言条目重要度分已冻结。
 * 未冻结 → throw（创建流程漏调 freezeImportanceScore）。
 *
 * @param entry    待检查的记忆条目
 * @param memoryId 记忆ID（仅用于错误诊断）
 */
export function assertImportanceFrozen(
  entry: FreezableMemoryEntry,
  memoryId: string,
): void {
  if (!entry.权重_冻结) {
    throw new Error(
      `L-21 守卫: 记忆「${memoryId}」重要度分未冻结（权重: ${entry.权重 ?? 50}）——创建流程须先调 freezeImportanceScore`,
    );
  }
}

/**
 * 安全读取已冻结重要度分。
 * 未冻结时返回 defaultValue（fail-open·不抛）。
 */
export function readFrozenScore(
  entry: FreezableMemoryEntry,
  defaultValue = 50,
): number {
  if (!entry.权重_冻结) return defaultValue;
  return entry.权重 ?? defaultValue;
}
