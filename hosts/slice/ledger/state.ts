// M1 slice 级账本 — 每实体余额 Map
// 注：RootSchema 货币系统.账户 = 主角单账户，不含 NPC；
//     M1 slice 在宿主层自维护 per-entity 余额，M3 存档时再桥接回 RootState。
export type SliceBalances = Map<string, number>; // entity_key → 文钱余额

export function initBalances(entries: Record<string, number>): SliceBalances {
  return new Map(Object.entries(entries));
}

export function getBalance(balances: SliceBalances, entityKey: string): number {
  return balances.get(entityKey) ?? 0;
}

export function snapshotBalances(balances: SliceBalances): Record<string, number> {
  return Object.fromEntries(balances);
}
