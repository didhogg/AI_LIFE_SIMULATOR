// verbDelta — 变量驱动翻译底座（R9第三轮·E-2·零位置反向·零守恒职责）
// 读 envelope.提案批（array）→ 每条目: 目标引用(全路径) + 数值槽(带符号整数)
// → 一条 K5DeltaEntry per 条目（正=add·负=sub）
//
// 规则（三条·无分叉）：
//   1. 目标引用=全状态路径；数值槽带符号（正→add·负→sub·0/undefined→no-op）
//   2. 非数值路径/路径不存在→可观测no-op（跳过该条目）
//   3. 守恒由闸④(tick.ts Phase9 assertConservation)负责·translator零守恒职责·零位置反向
//
// 方向由各条目数值槽符号决定（记账AI吐出）·translator只读不推导
function getAtPath(obj, path) {
    let cur = obj;
    for (const seg of path.split('.')) {
        if (seg === '')
            return undefined;
        if (cur === null || typeof cur !== 'object' || Array.isArray(cur))
            return undefined;
        cur = cur[seg];
    }
    return cur;
}
function makeEntry(path, 数值) {
    if (!Number.isInteger(数值) || 数值 === 0)
        return null;
    const op = 数值 > 0 ? 'add' : 'sub';
    return { path, op, value: Math.abs(数值) };
}
export function deriveVerbDelta(envelope, state, _seatId) {
    const 提案批 = envelope.提案批;
    if (提案批.length === 0)
        return [];
    const stateObj = state;
    const entries = [];
    for (const 提案 of 提案批) {
        const targetPath = 提案.目标引用;
        const 数值 = 提案.数值槽;
        if (!targetPath || 数值 === undefined)
            continue;
        const currentVal = getAtPath(stateObj, targetPath);
        if (typeof currentVal !== 'number')
            continue;
        const entry = makeEntry(targetPath, 数值);
        if (entry !== null)
            entries.push(entry);
    }
    if (entries.length === 0)
        return [];
    return [entries];
}
