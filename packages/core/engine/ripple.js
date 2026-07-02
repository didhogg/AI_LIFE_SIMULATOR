/**
 * 向 $涟漪候选 缓冲追加一条候选条目。
 * Phase 6 (关系触发) 和外部调用方（server.ts 动作处理）均可通过此接口发射。
 * 纯本地副作用：仅写传入的 pending 对象（runTick structuredClone 隔离）。
 */
export function emitRipple(pending, targetKey, entry) {
    const bucket = pending[targetKey];
    if (bucket) {
        bucket.push(entry);
    }
    else {
        pending[targetKey] = [entry];
    }
}
export function writeImpressionMax(认知, observerKey, targetKey, entry) {
    if (!认知[observerKey])
        认知[observerKey] = {};
    if (!认知[observerKey][targetKey]) {
        认知[observerKey][targetKey] = { 了解度: 0, 误差表: {}, 印象: [], 时效: 0, 姓名知识: '已知姓名' };
    }
    const 印象 = 认知[observerKey][targetKey].印象;
    const existing = 印象.find(i => i.标签 === entry.标签 && i.极性 === entry.极性);
    if (existing) {
        // 取 max 防循环膨胀；更新 factFragment（若有）
        if (entry.强度 > existing.强度) {
            existing.强度 = entry.强度;
            existing.来源 = entry.来源;
            existing.获知时间 = entry.获知时间;
            if (entry.factFragment !== undefined)
                existing.factFragment = entry.factFragment;
        }
    }
    else {
        印象.push(entry);
    }
}
