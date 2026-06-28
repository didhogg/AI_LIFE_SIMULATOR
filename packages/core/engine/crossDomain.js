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
import { fixedPow } from './math/fixed.js';
import { resolveFormula } from './formulaRegistry.js';
/**
 * 生成跨域同拍序键。
 * 字典序 = globalTick 主序·domainId 次序·seedId 末序。
 * globalTick 左补零至 12 位·支持 ±999 亿分钟（10 万年历法范围足量）。
 */
export function makeTriTickKey({ globalTick, domainId, seedId }) {
    const tickPart = globalTick >= 0
        ? String(globalTick).padStart(12, '0')
        : '-' + String(-globalTick).padStart(11, '0');
    return `${tickPart}:${domainId}:${seedId}`;
}
/**
 * 比较两个三元定序键（稳定全序·禁 localeCompare）。
 * 返回 <0 / 0 / >0。
 */
export function compareTriTickKeys(a, b) {
    if (a < b)
        return -1;
    if (a > b)
        return 1;
    return 0;
}
/** 对三元定序键数组排序（原地·稳定·纯字符串序）。*/
export function sortByTriTickKey(keys) {
    return keys.slice().sort(compareTriTickKeys);
}
/**
 * 计算解封补结区间。
 * 封存=封存时刻结账·解封=解封时刻再结一次；中间跨度 = durationMin。
 */
export function computeSupplementInterval(domainId, sealedAt, unsealedAt) {
    const durationMin = Math.max(0, unsealedAt - sealedAt);
    return { domainId, sealedAt, unsealedAt, durationMin };
}
/**
 * 跨域资金一次性结账（封存域解封时调用）。
 *
 * 算法（律 Y 离散换算）:
 *   interest = principal × annualRate × (durationMin / cross_domain_year_minutes)
 *
 * 仅结算 domainId 匹配（或未声明域籍的母域资产在跨域上下文中视为需要结算）的条目。
 * 纯函数·无 IO·无副作用。
 */
export function crossDomainOneShot(interval, assets, formulaConfig) {
    const { domainId, durationMin } = interval;
    const _yearMin = resolveFormula('cross_domain_year_minutes', formulaConfig);
    const yearFraction = durationMin / _yearMin;
    const growthExp = resolveFormula('cross_domain_growth_exponent', formulaConfig);
    const settlements = [];
    for (const asset of assets) {
        // 域籍匹配：明确声明 domainId 或未声明（母域视为目标域）
        if (asset.domainId !== undefined && asset.domainId !== domainId)
            continue;
        // growthExp=1（缺省单利）走直接乘·避免 fixedExp(fixedLn(x)) 近似误差·0 重定基
        const interest = asset.amount * asset.annualRate * (growthExp === 1 ? yearFraction : fixedPow(yearFraction, growthExp));
        const totalDelta = asset.amount + interest;
        settlements.push({
            entityKey: asset.entityKey,
            domainId,
            principal: asset.amount,
            interest,
            totalDelta,
            reason: `跨域补结(${domainId})·封存${durationMin}分钟·利率${asset.annualRate}`,
        });
    }
    return { domainId, durationMin, settlements };
}
