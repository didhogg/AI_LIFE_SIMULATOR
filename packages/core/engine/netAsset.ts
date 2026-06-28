// getNetAsset — C1-aware net asset computation (P7-4e / 梯队4)
//
// C1 closure: _应收/_负债 are now resolved via 约定库 when 全局 is provided.
//   • String-literal 标的: parsed as Number (simple case)
//   • DSL v1.0 object 标的: deferred (returns 0, P2)
//   • Without 全局: backward-compatible (same as pre-C1 behavior)
//
// 单一真相源：core 权威·hosts/slice/ledger/netAsset.ts 重导出此实现。
import type { 账户Type } from '../schema/economy.js';
import type { 全局Type, 约定库条目Type } from '../schema/secret.js';

export const BASE_CURRENCY = '文';

/**
 * Net asset for a single account.
 *
 * Formula: 持有[BASE] + 储蓄[BASE] + Σ存货·成本价 + Σ_应收 − Σ_负债
 *
 * C1: when `全局` is provided, _应收 and _负债 are resolved via 约定库.
 *     Each record value is a covenant key → look up 全局.约定库[key].条款[0].标的.
 *     String-literal 标的 that parses to a finite number is used; otherwise 0.
 *     DSL v1.0 expression objects are deferred (return 0).
 *
 * baseCurrency: optional override; defaults to BASE_CURRENCY ('文'). Pass
 *   state.货币系统?.基准币种 (via buildCurrencyRegistry) for custom-currency worlds.
 */
export function getNetAsset(acct: 账户Type, 全局?: 全局Type, baseCurrency?: string): number {
  const bc = baseCurrency ?? BASE_CURRENCY;
  const 持有 = acct.持有[bc] ?? 0;
  const 储蓄 = acct.储蓄[bc] ?? 0;
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

/**
 * Resolve the face-value of a covenant's first term.
 * String literal → parse as Number (finite → use; else 0).
 * DSL v1.0 object → 0 (deferred, P2).
 * No covenant / no terms / no 标的 → 0.
 */
function resolveCovenantAmount(cov: 约定库条目Type | undefined): number {
  if (!cov || cov.条款.length === 0) return 0;
  const 标的 = cov.条款[0]?.标的;
  if (!标的) return 0;
  if (typeof 标的 === 'string') {
    const n = Number(标的);
    return Number.isFinite(n) ? n : 0;
  }
  // DSL v1.0 object { v: '1.0', expr: string } — defer to P2
  return 0;
}
