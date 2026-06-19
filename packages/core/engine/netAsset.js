// getNetAsset — C1-aware net asset computation (P7-4e)
export const BASE_CURRENCY = '文';

/**
 * Net asset for a single account.
 * C1: when 全局 is provided, _应收/_负债 resolved via 约定库 (string-literal legs only).
 */
export function getNetAsset(acct, 全局) {
  const 持有 = acct.持有[BASE_CURRENCY] ?? 0;
  const 储蓄 = acct.储蓄[BASE_CURRENCY] ?? 0;
  const 存货  = acct.资产
    .filter(a => a.类别 === '存货')
    .reduce((s, a) => s + a.数量 * a.成本价, 0);

  let 应收额 = 0;
  let 应付额 = 0;
  if (全局) {
    for (const covenantKey of Object.values(acct._应收)) {
      应收额 += resolveCovenantAmount(全局.约定库[covenantKey]);
    }
    for (const covenantKey of Object.values(acct._负债)) {
      应付额 += resolveCovenantAmount(全局.约定库[covenantKey]);
    }
  }

  return 持有 + 储蓄 + 存货 + 应收额 - 应付额;
}

function resolveCovenantAmount(cov) {
  if (!cov || cov.条款.length === 0) return 0;
  const 标的 = cov.条款[0]?.标的;
  if (!标的) return 0;
  if (typeof 标的 === 'string') {
    const n = Number(标的);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}
