// getNetAsset — single-currency MVP (梯队1/C1 口径)
export const BASE_CURRENCY = '文';
/**
 * Net asset for a single account (single-currency MVP).
 * Formula: 持有[BASE_CURRENCY] + 储蓄[BASE_CURRENCY] + Σ(资产[类别='存货'].数量×成本价)
 * Excluded: _费用 (report flow) | _应收/_应付 (C1 defer — DSL resolver pending)
 */
export function getNetAsset(acct) {
    const 持有 = acct.持有[BASE_CURRENCY] ?? 0;
    const 储蓄 = acct.储蓄[BASE_CURRENCY] ?? 0;
    const 存货 = acct.资产
        .filter(a => a.类别 === '存货')
        .reduce((s, a) => s + a.数量 * a.成本价, 0);
    // TODO(C1): add _应收 − _应付 via 约定库 DSL resolver when available
    return 持有 + 储蓄 + 存货;
}
