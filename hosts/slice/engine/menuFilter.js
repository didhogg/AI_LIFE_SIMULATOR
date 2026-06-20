// P0-8 Batch 4: 菜单生成前知情过滤
//
// 核心原则：越权选项根本不生成（非生成后隐藏）
//   → 复用 Batch 1 filterSecretsForPOV 前置闸（唯一正典实现·禁第二实现）
//   → 越权/失效选项 → 复用 Batch 3 对账闸/软拒通道（重Roll提示·玩家主权·常驻图标·不弹窗）
//
// 玩家主权铁律：失败不自动重生·不替玩家选·不升 token 预算（与 reconcileGate/outputGuard 同律）
import { filterSecretsForPOV } from '@ai-life-sim/core/engine/knowledgeFilter';
/** 菜单越权/失效选项重Roll提示 */
export const MENU_FILTER_ROLL_HINT = {
    ui提示: '选项不可用，请「重 Roll」',
    重Roll说明: '点击重 Roll 图标重新生成本拍选项',
};
// ── 过滤函数 ───────────────────────────────────────────────────────────────────
/**
 * 菜单生成前知情过滤（M4 前置闸·Batch 4 接线）。
 *
 * 执行顺序：
 *   1. filterSecretsForPOV(state.全局.秘密库, povEntityKey) → 可见秘密集
 *   2. 遍历候选选项：有 secretRef 且不在可见集 → denied；否则 → permitted
 *   3. denied 非空 → 附 MENU_FILTER_ROLL_HINT（复用 Batch 3 软拒通道）
 *
 * 正确性边界：
 *   - 不在场景中存在的实体目标（非秘密相关）的过滤属调用方职责（本函数仅过滤秘密知情）
 *   - 若候选项无 secretRef → 无条件 permitted（调用方确保动词/实体已合法）
 *
 * @param candidates  候选菜单选项列表（生成前·未经 filterSecretsForPOV 的原始列表）
 * @param state       当前世界状态
 * @param povEntityKey POV 实体键（通常为主角 pcKey）
 */
export function filterMenuCandidates(candidates, state, povEntityKey) {
    const rawSecrets = (state.全局?.秘密库 ?? {});
    const visibleSecrets = filterSecretsForPOV(rawSecrets, povEntityKey);
    const permitted = [];
    const denied = [];
    for (const candidate of candidates) {
        if (candidate.secretRef !== undefined && !(candidate.secretRef in visibleSecrets)) {
            // 越权：POV 实体不知晓该秘密 → 根本不生成
            denied.push(candidate);
        }
        else {
            permitted.push(candidate);
        }
    }
    if (denied.length > 0) {
        return { permitted, denied, rollHint: MENU_FILTER_ROLL_HINT };
    }
    return { permitted, denied };
}
