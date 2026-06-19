// P7-4e V1/V6 txn 组级原子提交
// 到达序 · 拍首快照预求值 · 半组失败全组回滚（all-or-nothing）

import type { SliceBalances } from './state.js';
import type { LineageTransfer } from '../engine/ticket.js';
import { commitWithLineage } from './commit.js';
import type { FlowRecord } from './commit.js';

/** V1/V6 事务组 — 拍首快照预求值 + 到达序 */
export interface TxnGroup {
  groupId:         string;
  transfers:       LineageTransfer[];
  arrivalOrder:    number;                   // 到达序（升序先结算）
  preEvalSnapshot: Record<string, number>;   // 拍首账本快照（预求值基线）
}

/**
 * 到达序排序（升序）：先到先结算（节拍公平 + 确定性处理顺序）。
 */
export function sortByArrivalOrder(groups: TxnGroup[]): TxnGroup[] {
  return [...groups].sort((a, b) => a.arrivalOrder - b.arrivalOrder);
}

/**
 * V1/V6 txn 组级原子提交（P7-4e）：
 * - 拍首快照预求值：用 preEvalSnapshot 做预验（消除并发读-修改-写竞争）
 * - all-or-nothing：任一条目预验失败 → 整组不落账（全组回滚）
 * - 预验全通过 → commitWithLineage（Z3 血统 + 6.67 幂等 + 全退保护）
 */
export function commitTxnGroup(
  group:           TxnGroup,
  balances:        SliceBalances,
  committedEvents: Set<string>,
): FlowRecord[] {
  // 拍首快照预求值（不修改 balances·仅验证可行性）
  const preview = new Map(Object.entries(group.preEvalSnapshot));
  for (const t of group.transfers) {
    const avail = preview.get(t.from) ?? 0;
    if (avail < t.amount) {
      throw new Error(
        `TxnGroup ${group.groupId}: ${t.from} 拍首余额=${avail} < 请求=${t.amount}·全组回滚`,
      );
    }
    preview.set(t.from, avail - t.amount);
    preview.set(t.to, (preview.get(t.to) ?? 0) + t.amount);
  }
  // 预验全通过 → 原子执行（commitWithLineage 含 Z3+6.67 全退）
  return commitWithLineage(group.transfers, balances, committedEvents);
}
