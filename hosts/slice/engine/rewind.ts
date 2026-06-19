// M3 悔棋·回滚到拍前快照版本
// 全局回滚计数器 +1（写入存档头·永不被快照还原·结构性阻止骰子农场）
import type { SliceBalances } from '../ledger/state.js';
import { bumpSalt } from './archive.js';
import type { MinArchiveHeader } from './archive.js';
import type { SnapshotRingBuffer, SliceTickLog, ObservationEntry, PendingHit } from './snapshot.js';

export interface RewindUnit {
  balances:         SliceBalances;
  tick:             number;
  tick_log:         SliceTickLog[];
  observationTable: ObservationEntry[];  // P7-4b: 还原拍前观测值表
  pendingQueue:     PendingHit[];        // P7-4b: 还原拍前挂起命中队列
  header:           MinArchiveHeader;   // 全局回滚计数器已 +1（不还原）
}

/**
 * 悔棋到 ring buffer 第 index 条快照（0 = 最旧，size-1 = 最近一次拍前快照）。
 * 全局回滚计数器 +1：不随回滚还原，阻止骰子农场。
 */
export function rewindTick(
  ring:   SnapshotRingBuffer,
  index:  number,
  header: MinArchiveHeader,
): RewindUnit {
  const snap = ring.get(index);
  if (snap === undefined) {
    throw new Error(`悔棋索引越界: index=${index}，ring.size=${ring.size}`);
  }

  return {
    balances:         new Map(Object.entries(snap.balances)) as SliceBalances,
    tick:             snap.tick,
    tick_log:         [...snap.tick_log],
    observationTable: [...snap.observationTable],  // P7-4b: 还原拍前观测值表（防漂移）
    pendingQueue:     [...snap.pendingQueue],       // P7-4b: 还原拍前挂起命中队列（防漂移）
    header:           bumpSalt(header),            // 全局回滚计数器 +1，不回滚
  };
}
