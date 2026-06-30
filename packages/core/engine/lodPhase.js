// LOD-B2 · LOD 调度相位（tick registry 模型·dormant→active）
// 纯函数·确定性·Ring 0·六禁：禁 Date.now/new Date/Math.random/window/document/localeCompare
//
// P4-6  scheduleLodPhase  — registry 驱动·promote/demote/三条件接通
//
// 架构注：
//   LOD表（顶层·B1 additive）= 注册表（决定哪些节点受 LOD 治理）
//   散落字段（地図.地点[k].LOD态 / NPC[k].LOD档位 / 地点.保温到期拍号）= 实际状态（B4 再迁移）
//   B2 不迁移散落字段·不写 LOD表 条目字段·仅驱动现有 scheduler 函数
//
// 条件④ 漂移触发设计（opt-in 铁律）：
//   作者不声明触发条件 → resolveLodPredicate → null → 实体永全态·不评估·不 demote
//   Tier A: 触发谓词（完整 DSL 谓词串）
//   Tier B: 监测轴 + 触发阈值（合成 '漂移.{监测轴} {触发阈值}'）
//   轴值经 LOD挂载注册表[模块键].读数值轴 读取（零 switch·零枚举）
//   漂移 = computeRelativeDrift(cur, baseline[轴])·原始小数·不 ×100
import { locRegion } from './tick.js';
import { promoteNode, tryDemoteNode, handleRegionCross, detectLodTrigger, } from './lodScheduler.js';
import { dispatchLodGenerate, getLodMount } from './lodMount.js';
import { evalPredStr } from './dsl/eval.js';
import { computeRelativeDrift } from './economyEngine.js';
import { resolveEffectivePredicate, readGlobalDslSwitch } from './dsl/aiPredControl.js';
// ── §四·6 定稿常量 ───────────────────────────────────────────────────────────
/** promote 每拍硬上限（§四·6 定稿值·seeded 排序后取前 N） */
export const LOD_PROMOTE_BUDGET = 8;
/** 条件④ 连续偏离拍数门槛（§四·6 定稿值 N=3） */
export const LOD_DRIFT_N = 3;
// ── LOD-B2 opt-in 谓词解析 ────────────────────────────────────────────────────
/**
 * 从漂移绑定策略单条目解析 LOD 触发谓词（纯·三态 Tier A/B/null）。
 * Tier A: 有 触发谓词 → 直接返回。
 * Tier B: 有 监测轴 AND 触发阈值 → 合成 '漂移.{监测轴} {触发阈值}'。
 * 否则 → null（实体永远全态·不参与漂移评估·不 demote）。
 */
export function resolveLodPredicate(策略) {
    if (!策略)
        return null;
    if (策略.触发谓词)
        return 策略.触发谓词;
    if (策略.监测轴 && 策略.触发阈值)
        return `漂移.${策略.监测轴} ${策略.触发阈值}`;
    return null;
}
// ── LOD-B2 泛型轴解析辅助 ────────────────────────────────────────────────────
/**
 * 从 DSL 谓词串中提取 漂移.<轴名> 路径的轴名集合（去重·纯）。
 * 用于确定 buildLodDriftCtx 需要填充哪些漂移命名空间键。
 */
function extractDriftAxes(predStr) {
    const re = /漂移\.([\p{L}\p{N}_]+)/gu;
    const axes = [];
    let m;
    while ((m = re.exec(predStr)) !== null) {
        if (m[1])
            axes.push(m[1]);
    }
    return [...new Set(axes)];
}
/**
 * 经 LOD挂载注册表[模块键].读数值轴 读取 nodeKey 对应轴值（零 switch·注册表驱动·纯）。
 * 未注册模块/无 reader/轴未定义 → undefined（fail-closed·调用方视为漂移=0）。
 */
function resolveAxisValue(s, nodeKey, axis) {
    const 模块键 = s.LOD表?.[nodeKey]?.模块键;
    if (!模块键)
        return undefined;
    return getLodMount(模块键)?.读数值轴?.(s, nodeKey, axis);
}
// ── LOD-B2.5 · 辅助纯函数 ────────────────────────────────────────────────────
/**
 * 构造 LOD 触发谓词专用 DslContext（纯·只读·排外路径）。
 * 命名空间：全局（拍计数/纪元分钟）· LOD态（粗=0/实体=1）· 漂移（各轴值）。
 * 轴值 = computeRelativeDrift(resolveAxisValue(...), baseline[轴])·原始小数·不 ×100。
 * baseline 缺/轴解析不到 → 漂移[轴]=0（fail-closed·谓词不触发）。
 */
function buildLodDriftCtx(state, nodeKey, axes, baselines) {
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
    const 漂移 = {};
    for (const axis of axes) {
        const baseline = baselines?.[axis];
        if (baseline === undefined) {
            漂移[axis] = 0; // 无基线 → fail-closed
        }
        else {
            const curVal = resolveAxisValue(state, nodeKey, axis) ?? baseline;
            漂移[axis] = computeRelativeDrift(curVal, baseline);
        }
    }
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
 * LOD 调度相位（registry 模型·B2 opt-in 漂移 + seeded 排序 + 条件④）。
 * 由 tick.ts runPhase('LOD调度') 调用；亦可由单元测试直接调用。
 *
 * @param s            当前（已 structuredClone）RootState（in-place 修改）
 * @param rngSeed      存档级 RNG 种子（s.$存档种子 ?? 0）
 * @param currentTick  当前拍计数（s._tick?.拍计数 ?? 0）
 * @param prevLocCtxs  前一拍实体位置上下文（三条件 detectLodTrigger 用）；
 *                     tick 正路传 undefined → 三条件路径退化为 no-op（无跨拍历史存储·B3+）
 * @param driftStrategy  漂移触发策略（可选·缺省=不参与漂移·实体永全态·归宿 LOD 模块·C-2）
 */
export function scheduleLodPhase(s, rngSeed, currentTick, prevLocCtxs, driftStrategy) {
    // ── 双保险 guard：空 LOD表 → 提前 return·零 state 写·零 RNG draw ──────
    if (Object.keys(s.LOD表 ?? {}).length === 0)
        return;
    if (!s.LOD表)
        return; // TypeScript narrowing (logically unreachable after above guard)
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
    // ── AI 谓词控制层（预计算·整拍常量）────────────────────────────────────
    const _aiState = s['$AI创作状态'];
    const _aiGlobal = readGlobalDslSwitch(s._系统?.功能开关表 ?? {});
    const promoteCandidates = [];
    const driftCounterUpdates = [];
    for (const nodeKey of Object.keys(s.LOD表 ?? {})) {
        const sortKey = seededSortKey(rngSeed, currentTick, nodeKey);
        const nodeRegion = locRegion(nodeKey, locs) ?? nodeKey;
        // PC 在场检测
        let pcPresent = false;
        for (const [, pcLocKey] of pcLocMap) {
            const pcRegion = locRegion(pcLocKey, locs) ?? pcLocKey;
            if (pcLocKey === nodeKey || pcRegion === nodeRegion) {
                pcPresent = true;
                break;
            }
        }
        // 解析有效谓词（Tier A / Tier B / null = 不参与）
        const rawStrat = driftStrategy?.[nodeKey] ?? driftStrategy?.['*'];
        const rawPred = resolveLodPredicate(rawStrat);
        if (pcPresent) {
            promoteCandidates.push({ nodeKey, sortKey });
            // 促升时重置漂移计数和基线（节点进入实体态·重建基线）
            const entry = s.LOD表[nodeKey];
            if (entry) {
                if (rawPred !== null) {
                    const axes = extractDriftAxes(rawPred);
                    const newBaseline = {};
                    for (const axis of axes) {
                        const val = resolveAxisValue(s, nodeKey, axis);
                        if (val !== undefined)
                            newBaseline[axis] = val;
                    }
                    driftCounterUpdates.push({ nodeKey, newCount: 0, newBaseline });
                }
                else {
                    driftCounterUpdates.push({ nodeKey, newCount: 0 });
                }
            }
        }
        else {
            // 非 PC-present：条件④ opt-in 漂移计数更新
            const entry = s.LOD表[nodeKey];
            if (!entry)
                continue;
            const baselines = entry.漂移基线值;
            const currentCount = entry.连续偏离计数 ?? 0;
            let newCount;
            let newBaseline;
            if (rawPred === null) {
                // 无触发声明 → 不参与漂移·归零任何旧计数（清理残余）
                newCount = 0;
            }
            else {
                const axes = extractDriftAxes(rawPred);
                if (!baselines || Object.keys(baselines).length === 0) {
                    // 首拍或基线缺失：初始化 per-axis 基线·漂移=0→fail-closed
                    newCount = 0;
                    if (axes.length > 0) {
                        const initBaseline = {};
                        for (const axis of axes) {
                            const val = resolveAxisValue(s, nodeKey, axis);
                            if (val !== undefined)
                                initBaseline[axis] = val;
                        }
                        if (Object.keys(initBaseline).length > 0)
                            newBaseline = initBaseline;
                    }
                }
                else {
                    // AI override 凌驾（仅当 rawPred 非 null）
                    const activePred = resolveEffectivePredicate(`lod:${nodeKey}`, rawPred, _aiGlobal, undefined, // LOD 无作者底线控制表
                    _aiState?.条目AI控制表, _aiState?.谓词override表);
                    // 构造 DslContext 并评估谓词（真+1/假→归零·无滞回）
                    const ctx = buildLodDriftCtx(s, nodeKey, axes, baselines);
                    newCount = evalPredStr(activePred, ctx) ? currentCount + 1 : 0;
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
    // ── Pass 4: 执行 promote / demote（所有候选均来自 PC 在场）────────────────
    for (const { nodeKey } of toPromote) {
        promoteNode(s, nodeKey, rngSeed);
        dispatchLodGenerate(s, nodeKey, rngSeed); // B3: lodMount seam
        // 促升后重置偏离计数 + 重建基线
        const entry = s.LOD表[nodeKey];
        if (entry) {
            delete entry.连续偏离计数;
            const rawStrat = driftStrategy?.[nodeKey] ?? driftStrategy?.['*'];
            const pred = resolveLodPredicate(rawStrat);
            if (pred !== null) {
                const axes = extractDriftAxes(pred);
                if (axes.length > 0) {
                    const newBaseline = {};
                    for (const axis of axes) {
                        const val = resolveAxisValue(s, nodeKey, axis);
                        if (val !== undefined)
                            newBaseline[axis] = val;
                    }
                    if (Object.keys(newBaseline).length > 0)
                        entry.漂移基线值 = newBaseline;
                }
            }
            else {
                delete entry.漂移基线值;
            }
        }
    }
    // 未促升节点 → tryDemoteNode（地图地点节点·非 locs 节点由父区域管理·不独立 demote）
    for (const nodeKey of Object.keys(s.LOD表 ?? {})) {
        if (!locs[nodeKey])
            continue; // NPC/org LOD条目由 dispatchLodGenerate 管理·不独立 demote
        if (!promotedSet.has(nodeKey)) {
            tryDemoteNode(s, nodeKey, currentTick);
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
                handleRegionCross(s, prevCtx.locKey, curCtx.locKey, rngSeed, currentTick);
                triggerPromoteCount++;
            }
            else if (result.condition === '纪元跨时代' ||
                result.condition === '组织归属变更') {
                const region = locRegion(curCtx.locKey, locs) ?? curCtx.locKey;
                promoteNode(s, region, rngSeed);
                triggerPromoteCount++;
            }
            else if (result.condition === '连续偏离') {
                // 条件④ 触发：promote PC 当前区域 + 重置偏离计数 + 重建基线
                const region = locRegion(curCtx.locKey, locs) ?? curCtx.locKey;
                promoteNode(s, region, rngSeed);
                triggerPromoteCount++;
                const lodEntry = s.LOD表[pcLocKey];
                if (lodEntry) {
                    delete lodEntry.连续偏离计数;
                    const rawStrat = driftStrategy?.[pcLocKey] ?? driftStrategy?.['*'];
                    const pred = resolveLodPredicate(rawStrat);
                    if (pred !== null) {
                        const axes = extractDriftAxes(pred);
                        if (axes.length > 0) {
                            const newBaseline = {};
                            for (const axis of axes) {
                                const val = resolveAxisValue(s, pcLocKey, axis);
                                if (val !== undefined)
                                    newBaseline[axis] = val;
                            }
                            if (Object.keys(newBaseline).length > 0)
                                lodEntry.漂移基线值 = newBaseline;
                        }
                    }
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
