// C2 混沌猴事件调度器 — 纯函数，零副作用，零 Math.random
// 相同 seed → 相同事件序列（跨机器逐位恒等）
import * as prand from 'pure-rand';
// ── 权重表（总和 = 100）────────────────────────────────────────────────────────
const KINDS_WEIGHTS = [
    ['swipe-storm', 24],
    ['meta-write', 20],
    ['failure-inject', 16],
    ['fork', 8],
    ['dropout', 12],
    ['aohp-render', 5],
    ['effect-inject', 5],
    ['irreversible-call', 4],
    ['proxy-check', 3],
    ['tmp-snapshot-check', 3],
];
const TOTAL_WEIGHT = 100; // must equal sum of KINDS_WEIGHTS weights
function pickKind(roll) {
    let acc = 0;
    for (const [kind, w] of KINDS_WEIGHTS) {
        acc += w;
        if (roll < acc)
            return kind;
    }
    return 'dropout';
}
/**
 * 生成确定性事件序列。
 * 相同 seed → 相同输出（pure-rand xorshift128+，无平台随机源）。
 * 事件按 tick 升序排列。
 */
export function scheduleEvents(opts) {
    const { totalTicks, maxEventsPerTick, seed } = opts;
    const rng = prand.xorshift128plus(seed >>> 0);
    const events = [];
    for (let tick = 0; tick < totalTicks; tick++) {
        const count = prand.unsafeUniformIntDistribution(0, maxEventsPerTick, rng);
        for (let i = 0; i < count; i++) {
            const kindRoll = prand.unsafeUniformIntDistribution(0, TOTAL_WEIGHT - 1, rng);
            const kind = pickKind(kindRoll);
            const payload = prand.unsafeUniformIntDistribution(0, 0x7fffffff, rng);
            events.push({ tick, kind, payload });
        }
    }
    return events;
}
