// P7-4e V1/V6 txn 组级原子提交
import { commitWithLineage } from './commit.js';

export function sortByArrivalOrder(groups) {
  return [...groups].sort((a, b) => a.arrivalOrder - b.arrivalOrder);
}

export function commitTxnGroup(group, balances, committedEvents) {
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
  return commitWithLineage(group.transfers, balances, committedEvents);
}
