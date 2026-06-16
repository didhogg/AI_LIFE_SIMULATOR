// M2 d20 检定薄壳 — 复用 rngFor + saltFromArchiveHeader（禁 Math.random）
// 口径：chk_persuade_credit → 1d20 + 魅力(6) ≥ DC(12)（testdemo.md §4.5）
// 通道前缀 "检定:xxx" 遵 rng.ts 通道命名规范
import { rngFor, saltFromArchiveHeader } from '@ai-life-sim/core/engine/rng';
import type { MinArchiveHeader } from './archive.js';

export interface D20CheckResult {
  rawU:      number;  // rngFor 原始值 [0,99]
  diceRoll:  number;  // 映射后的 d20 面值 [1,20]
  attrBonus: number;  // 属性加成
  total:     number;  // diceRoll + attrBonus
  dc:        number;
  success:   boolean;
  salt:      number;  // 本次使用的 全局回滚计数器（写入 tick_log.盐值）
}

/**
 * 跑一次 d20 检定（即掷）。
 * @param seed       存档头全局种子
 * @param tickCount  锚拍号（从 _tick.拍计数 读取）
 * @param recipeKey  配方键（如 "chk_persuade_credit"）
 * @param attrBonus  属性加成（1-10 口径，如 魅力=6）
 * @param dc         成功门槛（如 DC=12）
 * @param header     最小存档头（提供 全局回滚计数器 作为盐）
 */
export function runD20Check(
  seed:      number,
  tickCount: number,
  recipeKey: string,
  attrBonus: number,
  dc:        number,
  header:    MinArchiveHeader,
): D20CheckResult {
  const salt   = saltFromArchiveHeader(header);
  const rawU   = rngFor(seed, tickCount, `检定:${recipeKey}`, salt);
  // 均匀映射 [0,99] → d20 [1,20]
  const diceRoll = Math.floor(rawU / 5) + 1;
  const total    = diceRoll + attrBonus;
  return { rawU, diceRoll, attrBonus, total, dc, success: total >= dc, salt };
}
