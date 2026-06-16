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
