// 币种单位注册表 — derives canonical currency unit config from 货币系统 world state.
//
// Design: single source of truth for which unit strings are "canonical" in this world.
// Mod authors declare their world's currency in 货币系统.币种定义[基准币种].别称;
// the engine reads this once and threads it to aohp / netAsset / reconcile gate.
//
// Default fallback = { baseCurrency:'文', canonicalUnits:{'文','文钱'} }
//   → zero rebase: all existing golden vectors remain bit-for-bit identical.
//
// Pure function — no Math.random, no Date.now, no platform Math transcendentals.

import type { 货币系统Type } from '../schema/economy.js';

export interface CurrencyRegistry {
  /** Primary canonical unit (e.g. '文', '灵石', 'credit'). */
  baseCurrency: string;
  /** baseCurrency + all declared aliases for this currency. */
  canonicalUnits: ReadonlySet<string>;
  /** Characters used in the regex for the unconfirmed-unit detection segment. */
  unconfirmedUnitChars: string;
}

/** Default registry when 货币系统 is unconfigured or 基准币种 is empty (zero rebase). */
export const DEFAULT_CURRENCY_REGISTRY: CurrencyRegistry = {
  baseCurrency: '文',
  canonicalUnits: new Set(['文', '文钱']),
  unconfirmedUnitChars: '块两贯吊元圆枚银铜钱',
};

/**
 * Derive the currency unit registry from 货币系统 world state.
 *
 * Rules:
 *   - 基准币种 empty / not set      → DEFAULT_CURRENCY_REGISTRY (zero rebase)
 *   - 基准币种 = '文', no 别称      → same as default (zero rebase)
 *   - 基准币种 = '文', 别称 present → use declared aliases only (replaces default ['文钱'])
 *   - 基准币种 = custom             → {baseCurrency} + declared 别称
 */
export function buildCurrencyRegistry(货币系统?: 货币系统Type): CurrencyRegistry {
  const baseCurrency = 货币系统?.基准币种;
  if (!baseCurrency) return DEFAULT_CURRENCY_REGISTRY;

  const def = 货币系统.币种定义[baseCurrency];
  const canonicalUnits = new Set([baseCurrency]);

  if (def?.别称 && def.别称.length > 0) {
    for (const alias of def.别称) {
      if (alias) canonicalUnits.add(alias);
    }
  } else if (baseCurrency === '文') {
    // Default alias for the standard Chinese coin (zero rebase)
    canonicalUnits.add('文钱');
  }

  return {
    baseCurrency,
    canonicalUnits,
    unconfirmedUnitChars: DEFAULT_CURRENCY_REGISTRY.unconfirmedUnitChars,
  };
}
