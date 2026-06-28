// P7-6a · 6.54 跨域资金一次性结账 / 解封补结区间 / 跨域同拍序键
//
// 多域时间两律（蓝图 6.54）:
//   律 X: 全局时刻轴唯一真相（一切到期/排序/重放的唯一主键·各域纪元分钟=派生展示量）
//   律 Y: 域比率离散换算（只在埋点/兑换/展示三离散时刻结账）
//
// 三元定序键格式: "{globalTick:12d}:{domainId}:{seedId}"
//   → 纯字符串字典序即得稳定全序（globalTick 左补零·保单调性）
//
// 红线: 禁 Date.now / Math.random / 裸 JSON.stringify / localeCompare
import { resolveFormula, type FormulaResolveConfig } from './formulaRegistry.js';

// ── 三元定序键（跨域同拍序键·D3·6.54）──────────────────────────────────────────

export interface TriTickKey {
  globalTick: number;   // 全局拍号（纪元分钟整数·唯一时间真相主键）
  domainId:   string;   // 域 ID（mod 命名空间同机制）
  seedId:     string;   // 种子/动词实例 id（唯一消歧）
}

/**
 * 生成跨域同拍序键。
 * 字典序 = globalTick 主序·domainId 次序·seedId 末序。
 * globalTick 左补零至 12 位·支持 ±999 亿分钟（10 万年历法范围足量）。
 */
export function makeTriTickKey({ globalTick, domainId, seedId }: TriTickKey): string {
  const tickPart = globalTick >= 0
    ? String(globalTick).padStart(12, '0')
    : '-' + String(-globalTick).padStart(11, '0');
  return `${tickPart}:${domainId}:${seedId}`;
}

/**
 * 比较两个三元定序键（稳定全序·禁 localeCompare）。
 * 返回 <0 / 0 / >0。
 */
export function compareTriTickKeys(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** 对三元定序键数组排序（原地·稳定·纯字符串序）。*/
export function sortByTriTickKey(keys: string[]): string[] {
  return keys.slice().sort(compareTriTickKeys);
}

// ── 封存域补结区间（D1/D6·6.54）─────────────────────────────────────────────────

/** 封存域解封补结区间描述（律 Y 离散结账锚点）*/
export interface SupplementInterval {
  domainId:    string;  // 封存域 ID
  sealedAt:    number;  // 封存时纪元分钟（律 X 全局时刻）
  unsealedAt:  number;  // 解封时纪元分钟（律 X 全局时刻）
  durationMin: number;  // 封存跨度（≥ 0·律 Y 结账用）
}

/**
 * 计算解封补结区间。
 * 封存=封存时刻结账·解封=解封时刻再结一次；中间跨度 = durationMin。
 */
export function computeSupplementInterval(
  domainId:   string,
  sealedAt:   number,
  unsealedAt: number,
): SupplementInterval {
  const durationMin = Math.max(0, unsealedAt - sealedAt);
  return { domainId, sealedAt, unsealedAt, durationMin };
}

// ── 跨域资金一次性结账（D1·6.54）────────────────────────────────────────────────

/** 单条域内资产快照（用于补结计算）*/
export interface DomainAssetEntry {
  entityKey:  string;
  domainId?:  string;   // 资产域籍（缺省=母域）
  amount:     number;   // 本位币数量（负值=负债）
  annualRate: number;   // 年利率（0 = 无利息·律 Y 仅在结账时刻计算）
}

/** 一次性结账结果条目 */
export interface CrossDomainSettlement {
  entityKey:   string;
  domainId:    string;
  principal:   number;  // 本金
  interest:    number;  // 封存期间利息（正=收益·负=成本）
  totalDelta:  number;  // principal + interest（落账增量）
  reason:      string;  // 审计原因串
}

export interface CrossDomainOneShot {
  domainId:    string;
  durationMin: number;
  settlements: CrossDomainSettlement[];
}

const MINUTES_PER_YEAR = 518400; // 12 × 43200（同 time.ts·不跨 import·默认值与 formulaRegistry 同步）

/**
 * 跨域资金一次性结账（封存域解封时调用）。
 *
 * 算法（律 Y 离散换算）:
 *   interest = principal × annualRate × (durationMin / MINUTES_PER_YEAR)
 *
 * 仅结算 domainId 匹配（或未声明域籍的母域资产在跨域上下文中视为需要结算）的条目。
 * 纯函数·无 IO·无副作用。
 */
export function crossDomainOneShot(
  interval: SupplementInterval,
  assets:   readonly DomainAssetEntry[],
  formulaConfig?: FormulaResolveConfig,
): CrossDomainOneShot {
  const { domainId, durationMin } = interval;
  const _yearMin = resolveFormula('cross_domain_year_minutes', formulaConfig);
  const yearFraction = durationMin / _yearMin;
  const settlements: CrossDomainSettlement[] = [];

  for (const asset of assets) {
    // 域籍匹配：明确声明 domainId 或未声明（母域视为目标域）
    if (asset.domainId !== undefined && asset.domainId !== domainId) continue;
    const interest = asset.amount * asset.annualRate * yearFraction;
    const totalDelta = asset.amount + interest;
    settlements.push({
      entityKey:  asset.entityKey,
      domainId,
      principal:  asset.amount,
      interest,
      totalDelta,
      reason:     `跨域补结(${domainId})·封存${durationMin}分钟·利率${asset.annualRate}`,
    });
  }

  return { domainId, durationMin, settlements };
}
