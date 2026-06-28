// B5 · K5 约束取严 merge（多 intervention_pack 叠加·纯函数·接 9e1c830）
//
// 永久契约（拍板 2026-06-17）：
//   约束类 op（clamp/lock）跨包取最严——
//     clamp 数值取 min（上限越低越严）；DSL 串后载覆盖（defer B6·需 DSL 求值器）。
//     lock 一旦任一包置位即保留（不可解）；首包 value 定版；max_delta 取 min。
//   内容类 op（set/add/sub）按确定性载入序后载覆盖（最后一个包的 value 胜出）。
//   max_delta 跨全部 op 始终取 min（它是约束，不随内容后载而松）。
//   同 path 不同 op 各自独立归并，互不影响。
//   输出按 (path, op) Unicode 码点序排列（确定性·禁 localeCompare）。
//   纯函数·零副作用·无随机·无时钟。
//
// 红线：本文件不 import rng/hashPresetFingerprint/gate/fingerprintManifest
// B6 defer：接入导入闸/运行时管线 fire；DSL 串 clamp 语义取严（需 DSL 求值器）
// TODO(B6-Step5)：导入闸接入时消费 preset.ts per_key_策略 声明；当前全局取严语义不变。
export const K5_DELTA_OPS = ['set', 'add', 'sub', 'clamp', 'lock'];
// Build an entry, omitting max_delta when undefined (exactOptionalPropertyTypes guard).
function makeEntry(path, op, value, max_delta) {
    return max_delta !== undefined
        ? { path, op, value, max_delta }
        : { path, op, value };
}
// max_delta is always a constraint: take min, never relax.
function mergeMaxDelta(a, b) {
    if (a === undefined)
        return b;
    if (b === undefined)
        return a;
    return Math.min(a, b);
}
/**
 * Merge delta lists from multiple intervention packs (K5·6.52).
 *
 * - Constraint ops (clamp, lock): take strictest across packs.
 * - Content ops (set, add, sub): last-writer-wins in load order.
 * - max_delta: always take min regardless of op.
 * - packs are consumed in the order given; pass them in deterministic load order
 *   (from B1 modLoadOrder / Kahn topological sort).
 */
export function mergeInterventionDeltas(packsInLoadOrder) {
    // Map key = "${path}\0${op}" — null byte cannot appear in valid path/op strings.
    const merged = new Map();
    for (const pack of packsInLoadOrder) {
        for (const delta of pack) {
            const key = `${delta.path}\0${delta.op}`;
            const existing = merged.get(key);
            if (delta.op === 'lock') {
                if (existing === undefined) {
                    // 首次置位：保存此包的 value
                    merged.set(key, makeEntry(delta.path, 'lock', delta.value, delta.max_delta));
                }
                else {
                    // 已置位：lock 不可解，仅更新 max_delta（取 min）
                    const md = mergeMaxDelta(existing.max_delta, delta.max_delta);
                    merged.set(key, makeEntry(existing.path, 'lock', existing.value, md));
                }
            }
            else if (delta.op === 'clamp') {
                if (existing === undefined) {
                    merged.set(key, makeEntry(delta.path, 'clamp', delta.value, delta.max_delta));
                }
                else {
                    // 数值 clamp：取 min（上限越低越严）
                    // DSL 串或混合类型：后载覆盖（defer B6 DSL 求值器实现真正取严）
                    let mergedValue;
                    if (typeof delta.value === 'number' && typeof existing.value === 'number') {
                        mergedValue = Math.min(existing.value, delta.value);
                    }
                    else {
                        mergedValue = delta.value; // last-writer-wins for string DSL
                    }
                    const md = mergeMaxDelta(existing.max_delta, delta.max_delta);
                    merged.set(key, makeEntry(delta.path, 'clamp', mergedValue, md));
                }
            }
            else {
                // Content ops (set, add, sub): last-writer-wins for value;
                // max_delta always takes min (constraint, never relaxed).
                const md = mergeMaxDelta(existing?.max_delta, delta.max_delta);
                merged.set(key, makeEntry(delta.path, delta.op, delta.value, md));
            }
        }
    }
    // Sort by (path, op) in Unicode code point order for deterministic output.
    const result = [...merged.values()];
    result.sort((a, b) => {
        if (a.path < b.path)
            return -1;
        if (a.path > b.path)
            return 1;
        if (a.op < b.op)
            return -1;
        if (a.op > b.op)
            return 1;
        return 0;
    });
    return result;
}
