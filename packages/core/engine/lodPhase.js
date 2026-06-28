// LOD-B2 · LOD 调度相位（tick registry 模型·dormant→active）
// 纯函数·确定性·Ring 0·六禁：禁 Date.now/new Date/Math.random/window/document/localeCompare
//
// P4-6  scheduleLodPhase  — registry 驱动·promote/demote/三条件接通
//
// 架构注：
//   LOD表（顶层·B1 additive）= 注册表（决定哪些节点受 LOD 治理）
//   散落字段（地図.地点[k].LOD态 / NPC[k].LOD档位 / 地点.保温到期拍号）= 实际状态（B4 再迁移）
//   B2 不迁移散落字段·不写 LOD表 条目字段·仅驱动现有 scheduler 函数
import { locRegion, computeResourceFactor } from './tick.js';
import { promoteNode, tryDemoteNode, handleRegionCross, detectLodTrigger, } from './lodScheduler.js';
import { dispatchLodGenerate } from './lodMount.js';
import { evalPredStr } from './dsl/eval.js';
import { computeRelativeDrift } from './economyEngine.js';
// ── §四·6 定稿常量 ───────────────────────────────────────────────────────────
/** promote 每拍硬上限（§四·6 定稿值·seeded 排序后取前 N） */
export const LOD_PROMOTE_BUDGET = 8;
/** 条件④ 连续偏离拍数门槛（§四·6 定稿值 N=3） */
export const LOD_DRIFT_N = 3;
/** 敏感度缩放下限（漂移率乘子·sens=-1 → ×0.5·防过度钝化） */
const DRIFT_SENS_LO = 0.5;
/** 敏感度缩放上限（漂移率乘子·sens=+1 → ×1.5·防过度放大） */
const DRIFT_SENS_HI = 1.5;
// ── LOD-B2.5 · 辅助纯函数 ────────────────────────────────────────────────────
/**
 * 从 模块绑定策略 中解析节点的敏感度（纯·只读）。
 * key '*' = 全模块默认；per-module key 优先；缺省 = 0（无 bias）。
 * 结果 clamp 至 [-1,1]。
 */
export function resolveSensitivity(preset, nodeKey) {
    const strategy = preset?.模块绑定策略;
    if (!strategy)
        return 0;
    const perModule = strategy[nodeKey]?.敏感度;
    if (perModule !== undefined)
        return Math.max(-1, Math.min(1, perModule));
    const global = strategy['*']?.敏感度;
    if (global !== undefined)
        return Math.max(-1, Math.min(1, global));
    return 0;
}
/**
 * 从 模块绑定策略 中解析节点的触发谓词（纯·只读）。
 * per-module key 优先；'*' = 全模块默认；两者均无 → undefined（条件④ fail-closed·不参与）。
 */
export function resolveTriggerPred(preset, nodeKey) {
    const strategy = preset?.模块绑定策略;
    if (!strategy)
        return undefined;
    const perModule = strategy[nodeKey]?.触发谓词;
    if (perModule !== undefined)
        return perModule;
    return strategy['*']?.触发谓词;
}
/**
 * 构造 LOD 触发谓词专用 DslContext（纯·只读·排外路径）。
 * 命名空间：全局（拍计数/纪元分钟）· LOD态（粗=0/实体=1）· 漂移（资源紧张度·sensMultiplier 缩放）。
 * NPC 命名空间（属性/技能/账户/自定义变量）不注入（LOD 节点=地点键·非 NPC）。
 * 漂移.资源紧张度 = computeRelativeDrift(currentFactor, baseline) × clamp(1+sens×0.5, LO, HI)
 * baseline=undefined（首拍）→ 漂移=0（谓词 fail-closed）。
 */
function buildLodDriftCtx(state, nodeKey, locs, baseline, sensitivity) {
    const 全局 = {
        拍计数: state._tick?.拍计数 ?? 0,
        纪元分钟: state.世界?.纪元分钟 ?? 0,
    };
    const LOD态Rec = {};
    if (state.LOD表) {
        for (const [k, entry] of Object.entries(state.LOD表)) {
            if (entry !== null && typeof entry === 'object') {
                LOD态Rec[k] = entry.档位 === '实体' ? 1 : 0;
            }
        }
    }
    const curFactor = computeResourceFactor(nodeKey, locs);
    const rawDrift = baseline !== undefined ? computeRelativeDrift(curFactor, baseline) : 0;
    const sensMultiplier = Math.max(DRIFT_SENS_LO, Math.min(DRIFT_SENS_HI, 1 + sensitivity * 0.5));
    const 漂移 = { 资源紧张度: rawDrift * sensMultiplier };
    return { 全局, LOD态: LOD态Rec, 漂移 };
}
/**
 * 确定性节点排序键（djb2 变体·seed × tick × nodeKey·六禁合规）。
 * 只用于 seeded 排序，不作 RNG draw，不入指纹。
 */
export function seededSortKey(seed, tick, nodeKey) {
    let h = ((seed ^ tick) >>> 0);
    for (let i = 0; i < nodeKey.length; i++) {
        h = (((h << 5) + h) ^ nodeKey.charCodeAt(i)) >>> 0;
    }
    return h;
}
// ── 主入口 ────────────────────────────────────────────────────────────────────
/**
 * LOD 调度相位（registry 模型·B2.5 动态阈值 + seeded 排序 + 条件④）。
 * 由 tick.ts runPhase('LOD调度') 调用；亦可由单元测试直接调用。
 *
 * @param s            当前（已 structuredClone）RootState（in-place 修改）
 * @param rngSeed      存档级 RNG 种子（s.$存档种子 ?? 0）
 * @param currentTick  当前拍计数（s._tick?.拍计数 ?? 0）
 * @param prevLocCtxs  前一拍实体位置上下文（三条件 detectLodTrigger 用）；
 *                     tick 正路传 undefined → 三条件路径退化为 no-op（无跨拍历史存储·B3+）
 * @param preset       玩法预设（可选·缺省=退化 no-op）
 */
export function scheduleLodPhase(s, rngSeed, currentTick, prevLocCtxs, preset) {
    // ── 双保险 guard：空 LOD表 → 提前 return·零 state 写·零 RNG draw ──────
    if (Object.keys(s.LOD表).length === 0)
        return;
    const locs = s.地图?.地点 ?? {};
    const nowEpochMin = s.世界?.纪元分钟 ?? 0;
    // ── 当前年号标签 ─────────────────────────────────────────────────────────
    const curEraLabel = resolveEraLabel(s.世界?.历法?.年号表 ?? [], nowEpochMin);
    // ── PC 键集（from _席位表·焦点角色键） ──────────────────────────────────
    const pcKeys = new Set(Object.values(s._席位表 ?? {})
        .map(seat => seat.焦点角色键)
        .filter((k) => typeof k === 'string' && k.length > 0));
    // PC → 当前地点键映射
    const pcLocMap = new Map();
    for (const pcKey of pcKeys) {
        const locKey = s.NPC[pcKey]?.位置;
        if (locKey)
            pcLocMap.set(pcKey, locKey);
    }
    // ── B3: state-based prevLocCtxs（参数优先·兼 B2 测试·无参时读 _系统 快照）──
    const effectivePrevLocCtxs = prevLocCtxs ??
        (s._系统?.LOD位置快照
            ? new Map(Object.entries(s._系统.LOD位置快照).map(([k, v]) => [
                k,
                {
                    locKey: v.locKey ?? '',
                    orgKeys: v.orgKeys ?? [],
                    epochMin: v.epochMin ?? 0,
                    eraLabel: v.eraLabel ?? '',
                },
            ]))
            : undefined);
    const promoteCandidates = [];
    // 非 PC-present 节点的 drift 计数更新（延迟写，避免 pass 1 中途污染 LOD表）
    const driftCounterUpdates = [];
    for (const nodeKey of Object.keys(s.LOD表)) {
        if (!locs[nodeKey])
            continue; // LOD-B4b: NPC 键跳过
        const nodeRegion = locRegion(nodeKey, locs) ?? nodeKey;
        const sortKey = seededSortKey(rngSeed, currentTick, nodeKey);
        // PC 在场检测
        let pcPresent = false;
        for (const [, pcLocKey] of pcLocMap) {
            const pcRegion = locRegion(pcLocKey, locs) ?? pcLocKey;
            if (pcLocKey === nodeKey || pcRegion === nodeRegion) {
                pcPresent = true;
                break;
            }
        }
        if (pcPresent) {
            promoteCandidates.push({ nodeKey, sortKey });
            // 促升时重置漂移计数和基线（节点进入实体态·重建基线）
            const entry = s.LOD表[nodeKey];
            if (entry) {
                driftCounterUpdates.push({
                    nodeKey,
                    newCount: 0,
                    newBaseline: computeResourceFactor(nodeKey, locs),
                });
            }
        }
        else {
            // 条件④：谓词驱动连续偏离计数（仅更新计数·不推 promoteCandidates）
            const entry = s.LOD表[nodeKey];
            if (!entry)
                continue;
            const baseline = entry.漂移基线值;
            const currentCount = entry.连续偏离计数 ?? 0;
            let newCount;
            let newBaseline;
            if (baseline === undefined) {
                // 首拍：初始化基线值，漂移=0，计数=0
                newBaseline = computeResourceFactor(nodeKey, locs);
                newCount = 0;
            }
            else {
                // 谓词驱动：作者声明触发轴（fail-closed：无谓词 → false → 归零）
                const triggerPred = resolveTriggerPred(preset, nodeKey);
                if (triggerPred) {
                    const sensitivity = resolveSensitivity(preset, nodeKey);
                    const ctx = buildLodDriftCtx(s, nodeKey, locs, baseline, sensitivity);
                    // 真/假二值·无滞回区间
                    newCount = evalPredStr(triggerPred, ctx) ? currentCount + 1 : 0;
                }
                else {
                    newCount = 0; // 无触发谓词·条件④ 不参与该节点
                }
            }
            driftCounterUpdates.push({
                nodeKey,
                newCount,
                ...(newBaseline !== undefined ? { newBaseline } : {}),
            });
        }
    }
    // ── B2.5 · Pass 2: seeded 排序 + 预算截断（≤8）──────────────────────────
    promoteCandidates.sort((a, b) => a.sortKey - b.sortKey);
    const toPromote = promoteCandidates.slice(0, LOD_PROMOTE_BUDGET);
    const promotedSet = new Set(toPromote.map(c => c.nodeKey));
    // ── Pass 3: 应用 drift 计数更新（批量写，避免 pass 1 中途读到脏状态）──────
    for (const { nodeKey, newCount, newBaseline } of driftCounterUpdates) {
        const entry = s.LOD表[nodeKey];
        if (!entry)
            continue;
        if (newCount === 0) {
            delete entry.连续偏离计数;
        }
        else {
            entry.连续偏离计数 = newCount;
        }
        if (newBaseline !== undefined) {
            entry.漂移基线值 = newBaseline;
        }
    }
    // ── Pass 4: 执行 promote / demote（所有候选均来自 PC 在场·无 drift 候选）──
    for (const { nodeKey } of toPromote) {
        promoteNode(s, nodeKey, rngSeed);
        dispatchLodGenerate(s, nodeKey, rngSeed); // B3: lodMount seam
        // 促升后重置偏离计数（重新开始漂移监测）
        const entry = s.LOD表[nodeKey];
        if (entry) {
            delete entry.连续偏离计数;
            entry.漂移基线值 = computeResourceFactor(nodeKey, locs);
        }
    }
    // 未促升节点 → tryDemoteNode
    for (const nodeKey of Object.keys(s.LOD表)) {
        if (!locs[nodeKey])
            continue;
        if (!promotedSet.has(nodeKey)) {
            tryDemoteNode(s, nodeKey, currentTick, preset);
        }
    }
    // ── 三条件接通（含条件④）：detectLodTrigger → handleRegionCross / promote ──
    if (effectivePrevLocCtxs) {
        let triggerPromoteCount = toPromote.length; // 计入已用预算
        for (const [pcKey, prevCtx] of effectivePrevLocCtxs) {
            const pcLocKey = pcLocMap.get(pcKey);
            if (!pcLocKey)
                continue;
            const pcOrgKeys = (s.NPC[pcKey]?.所属组织 ?? []).map(o => o.组织键);
            const curCtx = {
                locKey: pcLocKey,
                orgKeys: pcOrgKeys,
                epochMin: nowEpochMin,
                eraLabel: curEraLabel,
                // B2.5 条件④: 注入 PC 当前位置节点的连续偏离计数（已由 pass 3 写回 LOD表）
                consecutiveDriftCount: s.LOD表[pcLocKey]?.连续偏离计数 ?? 0,
            };
            const result = detectLodTrigger(s, prevCtx, curCtx);
            if (!result.triggered)
                continue;
            if (triggerPromoteCount >= LOD_PROMOTE_BUDGET)
                continue; // 预算已耗尽
            if (result.condition === '跨区') {
                handleRegionCross(s, prevCtx.locKey, curCtx.locKey, rngSeed, currentTick, preset);
                triggerPromoteCount++;
            }
            else if (result.condition === '纪元跨时代' ||
                result.condition === '组织归属变更') {
                const region = locRegion(curCtx.locKey, locs) ?? curCtx.locKey;
                promoteNode(s, region, rngSeed);
                triggerPromoteCount++;
            }
            else if (result.condition === '连续偏离') {
                // 条件④ 触发：promote PC 当前区域 + 重置偏离计数
                const region = locRegion(curCtx.locKey, locs) ?? curCtx.locKey;
                promoteNode(s, region, rngSeed);
                triggerPromoteCount++;
                const lodEntry = s.LOD表[pcLocKey];
                if (lodEntry) {
                    delete lodEntry.连续偏离计数;
                    lodEntry.漂移基线值 = computeResourceFactor(pcLocKey, locs);
                }
            }
        }
    }
    // ── B3: 写 LOD位置快照 到 _系统（冷启动首拍亦写·供下拍读 prev）──────────
    if (pcLocMap.size > 0) {
        const newSnapshot = {};
        for (const [pcKey, pcLocKey] of pcLocMap) {
            const pcOrgKeys = (s.NPC[pcKey]?.所属组织 ?? []).map(o => o.组织键);
            newSnapshot[pcKey] = {
                locKey: pcLocKey,
                orgKeys: pcOrgKeys,
                epochMin: nowEpochMin,
                eraLabel: curEraLabel,
            };
        }
        s._系统.LOD位置快照 = newSnapshot;
    }
}
// ── 内部辅助 ──────────────────────────────────────────────────────────────────
/** 从年号表（按 起始纪元分钟 升序）推导当前年号标签；无匹配返回 ''。 */
function resolveEraLabel(年号表, nowEpochMin) {
    let label = '';
    for (const entry of 年号表) {
        if (entry.起始纪元分钟 <= nowEpochMin) {
            label = entry.年号;
        }
    }
    return label;
}
