// P7-5f K-a: Q批 约定库写入口 + V3 写入口侧
// Q1 创建约定 / Q2 修改约定 / Q4 追加条款 / Q6 解除约定
// V3 写入口: verbWriteToTargets（接 expandVerbTarget() 结果）
//
// 约定库口径: 全局.约定库 record（C1 netAsset 已接·约定条款[0].标的 → Number）
// 纪律：V3 谓词求值侧待 DSL parser（defer P2）·本梯队只接写入口
// 红线：不 import rng.ts / gate.ts / fixed.ts
// ── Q1: 创建约定 ──────────────────────────────────────────────────────────────
/**
 * Q1: 在约定库中创建新约定条目。
 * 幂等保护：key 已存在时抛出（禁覆盖·防双落账·请用 Q2 修改）。
 */
export function covenantCreate(library, key, entry) {
    if (Object.prototype.hasOwnProperty.call(library, key)) {
        throw new Error(`Q1: 约定「${key}」已存在，禁止覆盖（修改请用 covenantUpdate）`);
    }
    return { ...library, [key]: entry };
}
// ── Q2: 修改约定 ──────────────────────────────────────────────────────────────
/**
 * Q2: 修改现有约定条目（浅合并 patch）。
 * key 不存在时抛出（防幽灵写入·请用 Q1 创建）。
 * 已解除的约定仍可修改（审计用途·不阻断）。
 */
export function covenantUpdate(library, key, patch) {
    if (!Object.prototype.hasOwnProperty.call(library, key)) {
        throw new Error(`Q2: 约定「${key}」不存在（创建请用 covenantCreate）`);
    }
    const merged = {
        ...library[key],
        ...patch,
        条款: patch.条款 ?? library[key].条款,
    };
    return { ...library, [key]: merged };
}
// ── Q4: 追加条款（append-only·M3 forward-only 语义） ─────────────────────────
/**
 * Q4: 为约定追加条款（append-only·条款序号不可逆递增）。
 * M3 forward-only 语义：条款列表只增不减（序号为天然有序键）。
 * key 不存在时抛出；已解除的约定禁止追加条款。
 */
export function covenantAppendTerm(library, key, term) {
    if (!Object.prototype.hasOwnProperty.call(library, key)) {
        throw new Error(`Q4: 约定「${key}」不存在`);
    }
    const existing = library[key];
    if (existing.已解除) {
        throw new Error(`Q4: 约定「${key}」已解除，禁止追加条款`);
    }
    return {
        ...library,
        [key]: { ...existing, 条款: [...existing.条款, term] },
    };
}
// ── Q6: 解除约定（软删除） ───────────────────────────────────────────────────
/**
 * Q6: 软删除约定（审计追踪·不物理删除 key）。
 * 在条目上写 `已解除: true`·后续 Q4 追加条款时会被拦截。
 * 幂等：已解除的约定再次解除不报错（已是最终态）。
 */
export function covenantRelease(library, key) {
    if (!Object.prototype.hasOwnProperty.call(library, key)) {
        throw new Error(`Q6: 约定「${key}」不存在，无法解除`);
    }
    // 幂等：已解除则直接返回原 library
    if (library[key].已解除)
        return library;
    return { ...library, [key]: { ...library[key], 已解除: true } };
}
// ── V3 写入口侧 ──────────────────────────────────────────────────────────────
/**
 * V3 写入口侧: 将动词效果顺序写入字典序展开后的所有目标。
 *
 * 契约：
 *   · 纯函数（accumulator pattern）；调用方在进入前已完成 structuredClone。
 *   · 遍历顺序 = expandedTargets 传入序（= Unicode 码点序，由 expandVerbTarget 保证）。
 *   · expandedTargets 为空时返回原 state（空转不变）。
 *
 * @param expandedTargets expandVerbTarget() 的输出（已排序·只读）
 * @param writer           对单目标的写入函数（纯函数·禁副作用）
 * @param state            初始状态（拍前快照副本）
 */
export function verbWriteToTargets(expandedTargets, writer, state) {
    let result = state;
    for (const key of expandedTargets) {
        result = writer(result, key);
    }
    return result;
}
