// P0-7 梯队1 · getNetAsset（单币种 MVP）
// 口径拍板：持有[基准币种] + 储蓄[基准币种] + 存货估值(类别='存货'·数量×成本价)
//           + _应收 − _应付（约定库解析金额·MVP defer = 0）
// _费用 不进（报表流·防与 sink 双扣）；其余币种 legs defer
import type { 账户Type } from '@ai-life-sim/core';

export const BASE_CURRENCY = '文';

export function getNetAsset(acct: 账户Type): number {
  const 持有val = acct.持有[BASE_CURRENCY] ?? 0;
  const 储蓄val = acct.储蓄[BASE_CURRENCY] ?? 0;
  const 存货估值 = acct.资产
    .filter(a => a.类别 === '存货')
    .reduce((s, a) => s + a.数量 * a.成本价, 0);
  // _应收/_应付 金额回约定库解析；约定库未实装，MVP 占位 0
  return 持有val + 储蓄val + 存货估值;
}
