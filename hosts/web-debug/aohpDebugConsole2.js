// G1b3b · AOHP 调试控制台 · 锦上添花批
//
// 功能 1-2, 7（C1: POV切换 + 关系网拓扑图 + PC面板/状态树/地图缩略图）
// 功能 3-6（C2: 全局快照 + 增量视图 + 动作序列回放 + 快照比对）
//
// 铁律:
//   - 全部代码落 web-debug 宿主层，不进指纹，core 宿主无关
//   - core 函数体零改动（runTick / filterSecretsForPOV / 等只调用）
//   - 对 state 只读 + 经合法 API 驱动；不在 UI 层私写 core state
//   - 黄金向量/指纹84/schemaKeys52 全恒等；tsc/lint 新增 0；test 净增
//   - 禁 Date.now / Math.random / localeCompare / 裸 JSON.stringify（判定面）
//   - exactOptionalPropertyTypes=true: optional 字段条件展开
import { runTick } from '@ai-life-sim/core/engine/tick';
import { filterSecretsForPOV, } from '@ai-life-sim/core/engine/knowledgeFilter';
import { PHASE6_THRESHOLD } from './aohpDebugConsole.js';
/**
 * POV 检视 — 经 filterSecretsForPOV 返回可见秘密集 + 认知档案投影。
 *
 * existence-opaque：非知情方连秘密存在性都不可见（结果中完全不出现）。
 * 并排对比请用 comparePOVs。
 */
export function povInspect(state, povEntityKey) {
    const secrets = state.全局?.秘密库 ?? {};
    const visible = filterSecretsForPOV(secrets, povEntityKey);
    const allCount = Object.keys(secrets).length;
    const archiveByPov = state.认知档案?.[povEntityKey] ?? {};
    const cognitiveProjection = {};
    for (const [tgt, entry] of Object.entries(archiveByPov)) {
        cognitiveProjection[tgt] = {
            了解度: entry.了解度,
            impressionCount: entry.印象.length,
        };
    }
    return {
        povEntityKey,
        visibleSecrets: visible,
        visibleSecretIds: Object.keys(visible),
        hiddenSecretCount: allCount - Object.keys(visible).length,
        cognitiveTargetKeys: Object.keys(archiveByPov),
        cognitiveProjection,
    };
}
/**
 * 并排对比两个 POV 看同一世界的差异（fact / 认知档案交集）。
 *
 * 用途：直观验证 access/covert gate（covert secret 只对持门者可见）。
 */
export function comparePOVs(state, entityA, entityB) {
    const secrets = state.全局?.秘密库 ?? {};
    const visA = filterSecretsForPOV(secrets, entityA);
    const visB = filterSecretsForPOV(secrets, entityB);
    const aIds = new Set(Object.keys(visA));
    const bIds = new Set(Object.keys(visB));
    const archiveA = state.认知档案?.[entityA] ?? {};
    const archiveB = state.认知档案?.[entityB] ?? {};
    const aTargets = new Set(Object.keys(archiveA));
    const bTargets = new Set(Object.keys(archiveB));
    return {
        entityA,
        entityB,
        onlyA: [...aIds].filter(id => !bIds.has(id)),
        onlyB: [...bIds].filter(id => !aIds.has(id)),
        both: [...aIds].filter(id => bIds.has(id)),
        cognitiveOnlyA: [...aTargets].filter(k => !bTargets.has(k)),
        cognitiveOnlyB: [...bTargets].filter(k => !aTargets.has(k)),
    };
}
/**
 * 从 state.NPC[*].关系[] 构建关系网拓扑图。
 *
 * - score ≥ PHASE6_THRESHOLD → isHighlighted=true（涟漪可触发边）
 * - score < PHASE6_THRESHOLD → 弱边（淡显）
 * - 无向图去重：正则对键（字典序小的在前）防止同一边出现两次
 * - 不使用 localeCompare（确定性六禁）
 */
export function buildRelationGraph(state) {
    const nodes = [];
    const edgesMap = new Map();
    for (const [key, npc] of Object.entries(state.NPC)) {
        const orgKeys = npc.所属组织
            .map(o => o.组织键)
            .filter((k) => !!k);
        nodes.push({
            key,
            name: npc.姓名,
            ...(npc.位置 ? { location: npc.位置 } : {}),
            orgKeys,
            cluster: orgKeys[0] ?? npc.位置 ?? key,
        });
        for (const rel of npc.关系) {
            if (!rel.对象键)
                continue;
            // 正则对键：ASCII 字符比较（不用 localeCompare）
            const a = key < rel.对象键 ? key : rel.对象键;
            const b = key < rel.对象键 ? rel.对象键 : key;
            const pairKey = `${a}\x00${b}`;
            if (!edgesMap.has(pairKey)) {
                const score = Math.abs(rel.强度) * (rel.信任 / 100);
                edgesMap.set(pairKey, {
                    from: key,
                    to: rel.对象键,
                    strength: rel.强度,
                    trust: rel.信任,
                    score,
                    type: rel.类型,
                    isHighlighted: score >= PHASE6_THRESHOLD,
                });
            }
        }
    }
    const edges = [...edgesMap.values()];
    return {
        nodes,
        edges,
        highlightedEdgeCount: edges.filter(e => e.isHighlighted).length,
        weakEdgeCount: edges.filter(e => !e.isHighlighted).length,
    };
}
/**
 * 主角状态面板 — 关键状态字段的高密度摘要。
 *
 * 只读：不修改 state；不调用 Date.now / Math.random。
 */
export function buildPCPanel(state, pcKey) {
    const npc = state.NPC[pcKey];
    if (!npc)
        throw new Error(`[buildPCPanel] '${pcKey}' 不在 state.NPC`);
    const currencies = {};
    const acct = state.货币系统?.账户?.[pcKey];
    if (acct) {
        for (const [ccy, amt] of Object.entries(acct.持有)) {
            currencies[ccy] = amt;
        }
    }
    const archiveByPc = state.认知档案?.[pcKey] ?? {};
    const knownSecretIds = [];
    for (const [id, secret] of Object.entries(state.全局?.秘密库 ?? {})) {
        if (secret.知情名单.some(e => e.对象 === pcKey)) {
            knownSecretIds.push(id);
        }
    }
    const _attr = npc.属性 ?? { 体质: 10, 智慧: 10, 感知: 10, 魅力: 10, 心理: 10 };
    const _der = npc.派生 ?? { HP: 100, HP上限: 100, 精力: 100, 精力上限: 100, 颜值: 50 };
    return {
        pcKey,
        name: npc.姓名,
        ...(npc.位置 ? { location: npc.位置 } : {}),
        attributes: {
            体质: _attr.体质,
            智慧: _attr.智慧,
            感知: _attr.感知,
            魅力: _attr.魅力,
            心理: _attr.心理,
        },
        hp: _der.HP,
        hpMax: _der.HP上限,
        energy: _der.精力,
        energyMax: _der.精力上限,
        currencies,
        relationsCount: npc.关系.length,
        cognitiveTargets: Object.keys(archiveByPc).length,
        knownSecretIds,
    };
}
/**
 * 可折叠状态树 — 世界状态结构化概览。
 *
 * 不做 deep stringify（确定性六禁之「裸 JSON.stringify」仅限判定面；
 * 此处为显示层·仅用 label 字符串·安全）。
 */
export function buildStateTree(state) {
    const npcEntries = Object.entries(state.NPC);
    const archive = state.认知档案 ?? {};
    const secrets = state.全局?.秘密库 ?? {};
    const locations = state.地图?.地点 ?? {};
    const accounts = state.货币系统?.账户 ?? {};
    return {
        label: '世界状态',
        children: [
            {
                label: `拍号: ${state._tick?.拍计数 ?? 0}`,
                value: state._tick?.拍计数 ?? 0,
            },
            {
                label: `NPC (${npcEntries.length})`,
                collapsed: false,
                children: npcEntries.map(([key, npc]) => ({
                    label: `${key} · ${npc.姓名}`,
                    collapsed: true,
                    children: [
                        { label: `位置: ${npc.位置 || '—'}` },
                        { label: `关系边: ${npc.关系.length}` },
                        { label: `HP: ${npc.派生?.HP ?? 100} / ${npc.派生?.HP上限 ?? 100}` },
                        { label: `精力: ${npc.派生?.精力 ?? 100} / ${npc.派生?.精力上限 ?? 100}` },
                        {
                            label: `所属组织: ${npc.所属组织.map(o => o.组织键).join(', ') || '无'}`,
                        },
                    ],
                })),
            },
            {
                label: `地图 (${Object.keys(locations).length} 地点)`,
                collapsed: true,
                children: Object.entries(locations).map(([k, loc]) => ({
                    label: `${k}: ${loc.名称} [${loc.类别}·${loc.大小}]`,
                })),
            },
            {
                label: `认知档案 (${Object.keys(archive).length} 观察者)`,
                collapsed: true,
                children: Object.entries(archive).map(([obs, targets]) => ({
                    label: `${obs} → ${Object.keys(targets).length} 目标`,
                    collapsed: true,
                    children: Object.entries(targets).map(([tgt, entry]) => ({
                        label: `${tgt}: 了解度=${entry.了解度} 印象=${entry.印象.length}条`,
                    })),
                })),
            },
            {
                label: `秘密库 (${Object.keys(secrets).length})`,
                collapsed: true,
                children: Object.entries(secrets).map(([id, s]) => ({
                    label: `${id}: 母题=${s.母题} 暴露度=${s.暴露度} 知情×${s.知情名单.length}`,
                })),
            },
            {
                label: '货币系统',
                collapsed: false,
                children: Object.entries(accounts).map(([entity, acct]) => ({
                    label: `${entity}: ${Object.entries(acct.持有)
                        .map(([c, a]) => `${a}${c}`)
                        .join(', ')}`,
                })),
            },
        ],
    };
}
/**
 * 地图缩略图 — 渲染 map.ts 区域 + LOD 状态灰显占位（LOD 待 G7）。
 *
 * npcCount = 当前 tick 内各地点的 NPC 数（从 NPC.位置 统计）。
 * LOD 字段 lodStatus='placeholder'：明确标注未实现，不假装已有。
 */
export function buildMapThumbnail(state) {
    const locations = state.地图?.地点 ?? {};
    const npcsByLoc = new Map();
    for (const npc of Object.values(state.NPC)) {
        if (npc.位置) {
            npcsByLoc.set(npc.位置, (npcsByLoc.get(npc.位置) ?? 0) + 1);
        }
    }
    return {
        locations: Object.entries(locations).map(([key, loc]) => ({
            key,
            name: loc.名称,
            category: loc.类别,
            size: loc.大小,
            npcCount: npcsByLoc.get(key) ?? 0,
            lodStatus: 'placeholder',
        })),
        totalLocations: Object.keys(locations).length,
        lodSystemStatus: 'NOT_IMPLEMENTED',
    };
}
/**
 * 全局状态快照 — 将当前 state 关键字段序列化为可读快照。
 *
 * 用于: 保存至 SnapshotStore / 两拍之间 diff / 回放后验证。
 */
export function takeStateSnapshot(state, label = 'snapshot') {
    const graph = buildRelationGraph(state);
    const archive = state.认知档案 ?? {};
    const tickCount = state._tick?.拍计数 ?? 0;
    const worldTime = `纪元第${tickCount * 30}日（第${tickCount + 1}拍）`;
    let totalImpressions = 0;
    for (const targetMap of Object.values(archive)) {
        for (const entry of Object.values(targetMap)) {
            totalImpressions += entry.印象.length;
        }
    }
    const rippleCandidates = state['$涟漪候选'];
    const rippleCandidateTargets = rippleCandidates && typeof rippleCandidates === 'object'
        ? Object.keys(rippleCandidates).length
        : 0;
    const currencyAccounts = {};
    for (const [entity, acct] of Object.entries(state.货币系统?.账户 ?? {})) {
        currencyAccounts[entity] = { ...acct.持有 };
    }
    return {
        label,
        tickCount,
        worldTime,
        npcCount: Object.keys(state.NPC).length,
        locationCount: Object.keys(state.地图?.地点 ?? {}).length,
        secretCount: Object.keys(state.全局?.秘密库 ?? {}).length,
        totalRelationEdges: graph.edges.length,
        highlightedRelationEdges: graph.highlightedEdgeCount,
        rippleCandidateTargets,
        cognitiveObserverCount: Object.keys(archive).length,
        totalCognitiveImpressions: totalImpressions,
        currencyAccounts,
    };
}
/**
 * 增量视图 — 将 TickDiffResult[] 聚合成「本拍发生了什么」时间线。
 *
 * 复用 G1b3a runTickWithDiff 已有 diff 结构，避免重写。
 */
export function buildIncrementalView(diffs) {
    return diffs.map(d => {
        const newImpressions = d.cognitiveChanges.filter(c => c.isNew).length;
        const strengthIncrease = d.cognitiveChanges.filter(c => !c.isNew).length;
        const parts = [];
        if (d.cognitiveChanges.length > 0)
            parts.push(`认知变更×${d.cognitiveChanges.length}`);
        if (d.relationHits.length > 0)
            parts.push(`关系触发×${d.relationHits.length}`);
        if (d.resourceChanges.length > 0)
            parts.push(`资源变化×${d.resourceChanges.length}`);
        return {
            tickId: d.tickId,
            cognitiveChangesCount: d.cognitiveChanges.length,
            newImpressions,
            strengthIncreases: strengthIncrease,
            relationHitsCount: d.relationHits.length,
            resourceChangesCount: d.resourceChanges.length,
            summary: parts.length > 0 ? parts.join(' · ') : '（本拍无变化）',
        };
    });
}
/**
 * 动作序列记录器 — 记录 option_id 序列 + 起始 seed；
 * replay() 重放产出逐位恒等 state（同序列 + 同 seed → 同 state）。
 *
 * 确定性保证：tickId = `debug:rec:<seed>:tick:<n>`，n = 记录时的拍计数。
 * 物理隔离：不调用 Date.now / Math.random。
 */
export class ActionRecorder {
    seed;
    baseState;
    currentState;
    _actions;
    constructor(seed, state) {
        this.seed = seed;
        this.baseState = structuredClone(state);
        this.currentState = structuredClone(state);
        this._actions = [];
    }
    /**
     * 记录一次 option_id 并推进一拍（使用确定性 tickId）。
     * 返回推进后的 state（深拷贝·不暴露内部引用）。
     */
    record(optionId) {
        const tickCount = this.currentState._tick?.拍计数 ?? this._actions.length;
        const tickId = `debug:rec:${this.seed}:tick:${tickCount}`;
        const result = runTick(structuredClone(this.currentState), { tickId });
        this._actions.push({ tickCount, optionId, tickId });
        this.currentState = result.state;
        return structuredClone(this.currentState);
    }
    getActions() { return [...this._actions]; }
    getCurrentState() { return structuredClone(this.currentState); }
    /**
     * 从基态确定性重放序列中所有 tickId → 逐位恒等 state。
     *
     * 逐位恒等断言：同 seed + 同 actions → JSON.stringify(replay()) === JSON.stringify(replay())
     */
    replay() {
        let st = structuredClone(this.baseState);
        for (const action of this._actions) {
            st = runTick(structuredClone(st), { tickId: action.tickId }).state;
        }
        return st;
    }
    /** 导出为可序列化对象（供存档/测试）*/
    exportSequence() {
        return { seed: this.seed, actions: [...this._actions] };
    }
}
/**
 * 快照存储 — 保存多个命名快照，任选两个做结构化 diff。
 *
 * diff 比较：遍历 StateSnapshot 所有字段（JSON 深比较）。
 * label 不参与 diff（仅作名称标识）。
 */
export class SnapshotStore {
    snapshots;
    constructor() {
        this.snapshots = new Map();
    }
    /** 保存 state 快照（覆盖同名快照）；renderParams 为可选 $meta 渲染参数，不进指纹 */
    save(label, state, renderParams) {
        const snap = takeStateSnapshot(state, label);
        if (renderParams !== undefined) {
            snap.$metaRenderParams = renderParams;
        }
        this.snapshots.set(label, snap);
        return snap;
    }
    /** 取已保存的快照（不存在则 undefined） */
    get(label) {
        return this.snapshots.get(label);
    }
    /** 已保存快照名列表 */
    list() {
        return [...this.snapshots.keys()];
    }
    /**
     * 两快照结构化 diff。
     *
     * 比较 StateSnapshot 各字段（跳过 label）；
     * 货币账户用 JSON 深比较（显示层·非判定面·安全）。
     */
    compare(labelA, labelB) {
        const a = this.snapshots.get(labelA);
        const b = this.snapshots.get(labelB);
        if (!a)
            throw new Error(`[SnapshotStore] 快照 '${labelA}' 不存在`);
        if (!b)
            throw new Error(`[SnapshotStore] 快照 '${labelB}' 不存在`);
        const changedFields = [];
        const skipFields = new Set(['label', 'worldTime', '$metaRenderParams']);
        for (const field of Object.keys(a)) {
            if (skipFields.has(field))
                continue;
            const va = a[field];
            const vb = b[field];
            if (JSON.stringify(va) !== JSON.stringify(vb)) {
                changedFields.push({ field, before: va, after: vb });
            }
        }
        const semanticLabels = {
            tickCount: '拍号变化',
            totalCognitiveImpressions: '认知档案变化',
            totalRelationEdges: '关系图变化',
            currencyAccounts: '资源变化',
            highlightedRelationEdges: '关系触发边变化',
        };
        const parts = [];
        for (const f of changedFields) {
            const lbl = semanticLabels[f.field];
            if (lbl)
                parts.push(lbl);
        }
        return {
            labelA,
            labelB,
            changedFields,
            summary: parts.length > 0 ? parts.join(' · ') : '（无变化）',
        };
    }
}
/**
 * 将所有 NPC 按 位置 分组；无位置归入「（无位置）」。
 * 每节点含 orgKeys + 知情秘密数（供 A1 节点明细分组渲染）。
 */
export function groupNodesByLocation(state) {
    const secrets = state.全局?.秘密库 ?? {};
    const groups = new Map();
    for (const [key, npc] of Object.entries(state.NPC)) {
        const loc = npc.位置 || '（无位置）';
        if (!groups.has(loc)) {
            groups.set(loc, { location: loc, nodes: [] });
        }
        const orgKeys = npc.所属组织
            .map(o => o.组织键)
            .filter((k) => !!k);
        const knownSecretCount = Object.values(secrets).filter(s => s.知情名单.some(e => e.对象 === key)).length;
        groups.get(loc).nodes.push({ key, name: npc.姓名, orgKeys, knownSecretCount });
    }
    return [...groups.values()];
}
/**
 * 计算关系边跨拍强度增减 delta。
 * pair key = ASCII 字典序小的端点在前（与 buildRelationGraph 保持一致）。
 * 仅处理当前图中存在的边；prev 中消失的边忽略（显示层不处理消亡边）。
 */
export function buildEdgeDelta(prevEdges, currEdges) {
    const prevMap = new Map();
    for (const e of prevEdges) {
        const a = e.from < e.to ? e.from : e.to;
        const b = e.from < e.to ? e.to : e.from;
        prevMap.set(`${a}\x00${b}`, { strength: e.strength, score: e.score });
    }
    const result = new Map();
    for (const e of currEdges) {
        const a = e.from < e.to ? e.from : e.to;
        const b = e.from < e.to ? e.to : e.from;
        const pk = `${a}\x00${b}`;
        const prev = prevMap.get(pk);
        result.set(pk, {
            strengthDelta: prev !== undefined ? e.strength - prev.strength : 0,
            scoreDelta: prev !== undefined ? e.score - prev.score : 0,
        });
    }
    return result;
}
/**
 * 计算 POV 实体的五轴人格投影（调试用·纯只读）。
 *
 * 投影值 = clamp(真值 + bias, 0, 100)
 * bias   = round((relDepth×0.3 + disguise×0.5) × selfKnowledge/100)
 *
 * 典型情况（无自我认知条目·无伪装特质·无自身关系边）→ bias=0 → 投影=真值。
 * 不改 state · 不调 runTick · 不进指纹。
 */
export function computePovPersonalityProjection(state, entityKey) {
    const npc = state.NPC[entityKey];
    if (!npc)
        throw new Error(`[computePovPersonalityProjection] '${entityKey}' not in NPC`);
    const trueAxes = npc.性格五轴 ?? { 开放: 50, 尽责: 50, 外向: 50, 宜人: 50, 神经质: 50 };
    // 知情程度：认知档案[self][self].了解度（通常 0·NPC 一般不自我观察）
    const archiveBySelf = state.认知档案?.[entityKey] ?? {};
    const selfKnowledge = archiveBySelf[entityKey]?.了解度 ?? 0;
    // 伪装度：特质库中 类别=伪装/欺骗 的最大强度
    const disguiseDegree = Object.values(npc.特质).reduce((mx, t) => (t.类别 === '伪装' || t.类别 === '欺骗') ? Math.max(mx, t.强度) : mx, 0);
    // 关系深度：自身关系列表中对自身的边强度绝对值（通常不存在 → 0）
    const selfRel = npc.关系.find(r => r.对象键 === entityKey);
    const relDepth = selfRel ? Math.abs(selfRel.强度) : 0;
    // bias = round((relDepth×0.3 + disguise×0.5) × selfKnowledge/100)
    // 所有因子为 0 时 bias=0 → 投影=真值（测试覆盖此路径）
    const bias = Math.round((relDepth * 0.3 + disguiseDegree * 0.5) * (selfKnowledge / 100));
    const clamp = (v) => Math.max(0, Math.min(100, v));
    const makeAxis = (v) => ({
        true: v,
        projected: clamp(v + bias),
        bias,
    });
    return {
        开放: makeAxis(trueAxes.开放),
        尽责: makeAxis(trueAxes.尽责),
        外向: makeAxis(trueAxes.外向),
        宜人: makeAxis(trueAxes.宜人),
        神经质: makeAxis(trueAxes.神经质),
        totalBias: bias,
    };
}
/**
 * 构建详细角色面板 — 枚举 NPC schema 全部可显示字段。
 * 以 entityKey 为 POV 过滤秘密（filterSecretsForPOV）。
 * 只读；不调用 Date.now / Math.random。
 */
export function buildActorPanel(state, entityKey) {
    const npc = state.NPC[entityKey];
    if (!npc)
        throw new Error(`[buildActorPanel] '${entityKey}' 不在 state.NPC`);
    const secrets = state.全局?.秘密库 ?? {};
    const visibleSecrets = filterSecretsForPOV(secrets, entityKey);
    const currencies = {};
    const acct = state.货币系统?.账户?.[entityKey];
    if (acct) {
        for (const [ccy, amt] of Object.entries(acct.持有)) {
            currencies[ccy] = amt;
        }
    }
    const archiveByEntity = state.认知档案?.[entityKey] ?? {};
    const 认知概览 = Object.entries(archiveByEntity).map(([tgt, entry]) => ({
        目标键: tgt,
        了解度: entry.了解度,
        印象数: entry.印象.length,
        姓名知识: entry.姓名知识,
    }));
    const _attr = npc.属性 ?? { 体质: 10, 智慧: 10, 感知: 10, 魅力: 10, 心理: 10 };
    const _der = npc.派生 ?? { HP: 100, HP上限: 100, 精力: 100, 精力上限: 100, 颜值: 50 };
    const _ap = npc.行动点 ?? { 当前: 15, 上限: 15 };
    const _ocean = npc.性格五轴 ?? { 开放: 50, 尽责: 50, 外向: 50, 宜人: 50, 神经质: 50 };
    const _rep = npc.声誉 ?? { 人望: 0, 知名度: 0, 极性: '', 标签: '' };
    const _goal = npc.目标 ?? { 长期: [], 短期: [] };
    return {
        entityKey,
        name: npc.姓名,
        称呼: npc.称呼,
        性别: npc.性别,
        种族: npc.种族,
        存活状态: npc.存活状态,
        位置: npc.位置,
        背景: npc.背景,
        称号: npc.称号,
        头衔: [...npc.头衔],
        业力: npc.业力,
        attributes: {
            体质: _attr.体质,
            智慧: _attr.智慧,
            感知: _attr.感知,
            魅力: _attr.魅力,
            心理: _attr.心理,
        },
        派生: {
            HP: _der.HP,
            HP上限: _der.HP上限,
            精力: _der.精力,
            精力上限: _der.精力上限,
            颜值: _der.颜值,
        },
        行动点: { 当前: _ap.当前, 上限: _ap.上限 },
        性格五轴: {
            开放: _ocean.开放,
            尽责: _ocean.尽责,
            外向: _ocean.外向,
            宜人: _ocean.宜人,
            神经质: _ocean.神经质,
        },
        声誉: {
            人望: _rep.人望,
            知名度: _rep.知名度,
            极性: _rep.极性,
            标签: _rep.标签,
        },
        情绪栈: npc.情绪栈.map(e => ({
            情绪名: e.情绪名,
            极性: e.极性,
            数值: e.数值,
            来源: e.来源,
        })),
        状态标签: Object.entries(npc.状态标签).map(([key, v]) => ({ key, 来源: v.来源 })),
        特质: Object.entries(npc.特质).map(([key, v]) => ({ key, 类别: v.类别, 强度: v.强度 })),
        技能: Object.entries(npc.技能).map(([key, v]) => ({
            key,
            熟练度: v.熟练度,
            等级: v.等级,
            类别: v.类别,
        })),
        关系: npc.关系.map(r => ({
            对象键: r.对象键,
            类型: r.类型,
            强度: r.强度,
            信任: r.信任,
            极性: r.极性,
        })),
        所属组织: npc.所属组织.map(o => ({ 组织键: o.组织键, 职务: o.职务 })),
        信念: Object.entries(npc.信念).map(([key, v]) => ({
            key,
            类型: v.类型,
            虔诚或认同: v.虔诚或认同,
        })),
        currencies,
        物品: Object.entries(npc.物品).map(([key, v]) => ({
            key,
            数量: v.数量,
            类别: v.类别,
            重要级别: v.重要级别,
        })),
        目标: { 长期: [..._goal.长期], 短期: [..._goal.短期] },
        认知概览,
        可见秘密ID: Object.keys(visibleSecrets),
        记忆: npc.记忆.map(m => ({
            摘要: m.摘要,
            重要度: m.重要度,
            情绪色彩: m.情绪色彩,
        })),
        意象: npc.意象.map(i => ({
            标签: i.标签,
            情绪色彩: i.情绪色彩,
            强度: i.强度,
        })),
    };
}
// ── console 输出工具（供 main 演示） ──────────────────────────────────────────────
function hr2(title) {
    console.log(`\n${'─'.repeat(62)}`);
    console.log(`  ${title}`);
    console.log('─'.repeat(62));
}
function printPovInspect(r) {
    console.log(`  POV='${r.povEntityKey}'`);
    console.log(`    可见秘密: ${r.visibleSecretIds.join(', ') || '（无）'}`);
    console.log(`    隐藏秘密数（existence-opaque）: ${r.hiddenSecretCount}`);
    console.log(`    认知目标数: ${r.cognitiveTargetKeys.length}`);
    for (const [tgt, proj] of Object.entries(r.cognitiveProjection)) {
        console.log(`      → ${tgt}: 了解度=${proj.了解度} 印象×${proj.impressionCount}`);
    }
}
function printRelationGraph(g) {
    console.log(`  节点数: ${g.nodes.length}  边数: ${g.edges.length}`);
    console.log(`  高亮边(score≥${PHASE6_THRESHOLD}): ${g.highlightedEdgeCount}  弱边: ${g.weakEdgeCount}`);
    for (const e of g.edges) {
        const mark = e.isHighlighted ? '★' : '·';
        console.log(`  ${mark} ${e.from} ─[${e.type} ${e.strength}×${e.trust}/100=${e.score.toFixed(1)}]→ ${e.to}`);
    }
}
// ── 主函数（独立演示·不影响测试） ─────────────────────────────────────────────────
import { buildWorld, PC, NPC_WANG, SAVE_SEED } from '../slice/fixture/world.js';
import { buildDebugFixtureMedium, } from './fixtures/debugFixtures.js';
import { runTickWithDiff } from './aohpDebugConsole.js';
async function main() {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║   G1b3b · AOHP 调试控制台 · 锦上添花批                      ║');
    console.log('║   POV切换·关系网图·PC面板·快照比对·动作回放                  ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    const state = buildWorld();
    // ── 功能 1: POV 切换 ──────────────────────────────────────────────────────
    hr2('NPC 视角（POV）切换（功能 1）');
    console.log('\n  PC POV:');
    printPovInspect(povInspect(state, PC));
    console.log('\n  NPC_WANG POV:');
    printPovInspect(povInspect(state, NPC_WANG));
    const cmp = comparePOVs(state, PC, NPC_WANG);
    console.log(`\n  并排对比 A=${cmp.entityA} / B=${cmp.entityB}:`);
    console.log(`    只有A可见: ${cmp.onlyA.join(', ') || '无'}`);
    console.log(`    只有B可见: ${cmp.onlyB.join(', ') || '无'}`);
    console.log(`    双方均可见: ${cmp.both.join(', ') || '无'}`);
    console.log(`    认知差: A多=${cmp.cognitiveOnlyA.join(',') || '无'} B多=${cmp.cognitiveOnlyB.join(',') || '无'}`);
    // ── 功能 2: 关系网拓扑图 ──────────────────────────────────────────────────
    hr2('关系网拓扑图（功能 2）- 基础 fixture');
    printRelationGraph(buildRelationGraph(state));
    hr2('关系网拓扑图（功能 2）- 大陆 fixture（Phase6 可见边）');
    const medState = buildDebugFixtureMedium();
    printRelationGraph(buildRelationGraph(medState));
    // ── 功能 7: PC 状态面板 ────────────────────────────────────────────────────
    hr2('主角状态面板（功能 7）');
    const panel = buildPCPanel(state, PC);
    console.log(`  ${panel.pcKey} (${panel.name})`);
    console.log(`  位置: ${panel.location ?? '—'}`);
    console.log(`  HP: ${panel.hp}/${panel.hpMax}  精力: ${panel.energy}/${panel.energyMax}`);
    console.log(`  属性: ${Object.entries(panel.attributes).map(([k, v]) => `${k}=${v}`).join(' ')}`);
    console.log(`  货币: ${Object.entries(panel.currencies).map(([c, a]) => `${a}${c}`).join(', ')}`);
    console.log(`  关系边: ${panel.relationsCount}  认知目标: ${panel.cognitiveTargets}`);
    console.log(`  已知秘密: ${panel.knownSecretIds.join(', ') || '无'}`);
    // ── 功能 7: 地图缩略图 ────────────────────────────────────────────────────
    hr2('地图缩略图（功能 7）');
    const map = buildMapThumbnail(medState);
    console.log(`  地点总数: ${map.totalLocations}  LOD状态: ${map.lodSystemStatus}（待 G7）`);
    for (const loc of map.locations) {
        console.log(`  [${loc.key}] ${loc.name} [${loc.category}·${loc.size}]  NPC×${loc.npcCount}  LOD=${loc.lodStatus}`);
    }
    // ── 功能 3: 全局快照 ──────────────────────────────────────────────────────
    hr2('全局状态快照（功能 3）');
    const snap0 = takeStateSnapshot(state, 'tick0');
    console.log(`  tickCount=${snap0.tickCount}  NPC=${snap0.npcCount}  边=${snap0.totalRelationEdges}`);
    console.log(`  认知观察者=${snap0.cognitiveObserverCount}  印象=${snap0.totalCognitiveImpressions}`);
    // ── 功能 4: 增量视图 ──────────────────────────────────────────────────────
    hr2('增量视图（功能 4）');
    const diffs = [
        runTickWithDiff(state, `debug:${SAVE_SEED}:tick:0`),
        runTickWithDiff(medState, `debug:200:tick:0`),
    ];
    for (const entry of buildIncrementalView(diffs)) {
        console.log(`  [${entry.tickId}] ${entry.summary}`);
        console.log(`    新印象×${entry.newImpressions} 强度增×${entry.strengthIncreases} 关系触发×${entry.relationHitsCount}`);
    }
    // ── 功能 5: 动作序列记录与回放 ─────────────────────────────────────────────
    hr2('动作序列记录与回放（功能 5）');
    const rec = new ActionRecorder(SAVE_SEED, state);
    rec.record('对话:npc_wang');
    rec.record('对话:npc_hong');
    const replayState = rec.replay();
    const identical = JSON.stringify(rec.getCurrentState()) === JSON.stringify(replayState);
    console.log(`  记录 ${rec.getActions().length} 步动作`);
    console.log(`  重放逐位恒等: ${identical ? '✅' : '❌'}`);
    // ── 功能 6: 快照比对 ──────────────────────────────────────────────────────
    hr2('快照保存与比对（功能 6）');
    const store = new SnapshotStore();
    store.save('before', state);
    const afterState = rec.getCurrentState();
    store.save('after', afterState);
    const diff = store.compare('before', 'after');
    console.log(`  快照 diff [before vs after]:`);
    console.log(`  摘要: ${diff.summary}`);
    console.log(`  变更字段数: ${diff.changedFields.length}`);
    for (const f of diff.changedFields.slice(0, 5)) {
        console.log(`    ${f.field}: ${JSON.stringify(f.before)} → ${JSON.stringify(f.after)}`);
    }
    console.log(`\n${'═'.repeat(62)}`);
    console.log('  G1b3b 调试控制台完成');
    console.log(`  POV切换 ✅  关系网图 ✅  PC面板/状态树/地图缩略图 ✅`);
    console.log(`  全局快照 ✅  增量视图 ✅  动作回放 ✅  快照比对 ✅`);
    console.log('═'.repeat(62));
}
// 仅在 Node.js 直接执行时运行（浏览器导入时 window 存在 → 跳过）
if (typeof window === 'undefined') {
    main().catch(e => {
        console.error('[aohpDebugConsole2] 未捕获异常:', e);
        process.exit(1);
    });
}
