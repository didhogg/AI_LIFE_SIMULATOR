// L-15 · 物品/角色三态不可逆状态机谓词（纯函数·零副作用·零 import）
// 复用 patchInvariant.ts 结构：纯谓词·外部不变量·不接触 engine/stateMachine.ts
// 红线：本文件不 import rng/hashPresetFingerprint/gate/fingerprintManifest/zod/schema
/**
 * 判定角色存活状态转移合法性（L-15·不可逆状态机）。
 * - from=undefined → 创建（新实体·无前态·合法）
 * - 已故→在世 仅在 hasRevivalFlag=true 时合法（转域续命边授权令牌）
 * - 已故→失踪：不合法（已故是终态，无法回退为失踪）
 * - 同态写（from===to，含 已故→已故）：合法（幂等）
 */
export function isLegalCharTransition(from, to, opts) {
    if (from === undefined)
        return true;
    if (from === '在世' && (to === '失踪' || to === '已故'))
        return true;
    if (from === '失踪' && (to === '在世' || to === '已故'))
        return true;
    if (from === '已故' && to === '在世')
        return opts.hasRevivalFlag;
    if (from === to)
        return true;
    return false;
}
/**
 * 判定物品状态转移合法性（L-15·不可逆状态机）。
 * - from=undefined → 创建（新实体·合法）
 * - 销毁→* 一律不合法（含 销毁→销毁 同态写；销毁是终态·不可复原）
 * - 持有/遗失 同态写：合法（幂等）
 */
export function isLegalItemTransition(from, to) {
    if (from === undefined)
        return true;
    if (from === '销毁')
        return false;
    if (from === '持有' && (to === '遗失' || to === '销毁'))
        return true;
    if (from === '遗失' && (to === '持有' || to === '销毁'))
        return true;
    if (from === to)
        return true;
    return false;
}
