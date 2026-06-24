import { assertConservation } from './conservation.js';
import { getNetAsset } from './netAsset.js';
import { decayStep } from './time.js';
import { fixedPow } from './math/fixed.js';
import { runProposalGate } from './proposal/index.js';
import { deriveVerbDelta } from './proposal/verbDelta.js';
import { executeActionOption } from './aohpExecutor.js';
// ── 环形缓冲上限 ──────────────────────────────────────────────────────────────
const TICK_LOG_MAX = 8;
// ── 涟漪参数 ──────────────────────────────────────────────────────────────────
const RIPPLE_DECAY = 0.5; // 二跳强度乘子（一跳强度 × 信任/100 × RIPPLE_DECAY）
const RIPPLE_MIN = 1; // 低于此阈值不写入认知档案（防噪）
const REL_RIPPLE_THRESHOLD = 50; // Phase 6 关系触发：|强度|×信任/100 达此阈值才发射
// ── 空间层参数（G1·区域图距离 + 人口密度调制 + 场景传播系数） ─────────────────────
const REGION_HOP_DECAY = 0.7; // 跨区域每跳衰减乘子（确定性常量）
const SPATIAL_FACTOR_MIN = 0.1; // 空间因子下界（防近零）
const SPATIAL_FACTOR_MAX = 1.5; // 空间因子上界（密集区加成上限）
// 人口规模字符串 → 密度调制系数（目标区越密 → 传播越广）
const POPULATION_DENSITY_FACTOR = {
    '超大型': 1.3,
    '大型': 1.2,
    '中型': 1.0,
    '小型': 0.85,
    '微型': 0.7,
};
// G1 场景传播系数（广场↑ / 密室↓）：目标所在地点的社交开放度 → 二跳强度乘子
// 仅二跳生效（一跳=同地·社交开放度对在场目击者无衰减·因子恒 1）
const SCENE_PROPAGATION_COEFF = {
    '高': 1.3, // 广场效应：高社交开放度→事件可见度放大→二跳传播增强
    '中': 1.0, // 默认：中等社交开放度→因子恒 1（退化不变式）
    '低': 0.7, // 密室效应：低社交开放度→事件私密性→二跳传播衰减
};
// ── 结算序 ────────────────────────────────────────────────────────────────────
export const SETTLEMENT_PHASES = [
    '日程结算',
    '事件种子萌发',
    '阈值触发',
    '日期触发',
    '标志触发',
    '关系触发',
    '提案落账', // additive: injected AOHP envelope → five-gate pipeline → 落账守恒
    '死亡感知发射', // C2-4: 提案落账后扫描新亡 actor → emitRipple → Phase 8 传播
    '衰减批',
    '涟漪传播',
    '媒介拍末取材', // E4·6.55: 涟漪先落账后·媒介通道（书信/信使等）在拍末采样·然后进原子提交
    '原子提交',
];
// ── 主入口 ────────────────────────────────────────────────────────────────────
/**
 * Run one tick of the settlement engine.
 * Pure function: same (state, input) → same TickResult, no I/O.
 */
export function runTick(state, input) {
    // [1] 入口深拷 — 全部操作在 s 上进行，不回写 state
    // let: 提案落账 阶段注入成功时 s 替换为 runProposalGate 产出的新状态
    let s = structuredClone(state);
    // [3] 幂等检查 — tickId 已全量结算则直接返回
    if (s._系统.已结算标记[input.tickId]?.即时分量 === 1) {
        return { state: s, settledPhases: [], matureSeeds: [] };
    }
    const spanMin = input.spanMinutes ?? (s.世界?._本拍跨度 ?? 43200);
    const nowEpochMin = s.世界?.纪元分钟 ?? 0;
    // C2-4 拍前已故集合（原始 state 快照·防跨拍重复发射死亡涟漪）
    const priorDeadSet = new Set(Object.entries(state.NPC)
        .filter(([, npc]) => npc.存活状态 === '已故')
        .map(([k]) => k));
    // 拍前 Σ净值快照（原子提交守恒基线）
    // 使用原始 state 账户计算（不随 s 替换漂移·注入落账后 Phase9 用 s.货币系统?.账户 校验）
    const preAccounts = state.货币系统?.账户;
    const preNetAsset = preAccounts && Object.keys(preAccounts).length > 0
        ? Object.values(preAccounts).reduce((sum, acct) => sum + getNetAsset(acct), 0)
        : null;
    const settledPhases = [];
    const matureSeeds = [];
    let proposalGateResult;
    // 确保 marker 条目存在
    if (!s._系统.已结算标记[input.tickId]) {
        s._系统.已结算标记[input.tickId] = { 即时分量: 0, 延时分量: {} };
    }
    // let: 注入成功后 phaseMap 随 s 切换，确保后续 runPhase 标记写入新状态
    let phaseMap = s._系统.已结算标记[input.tickId].延时分量;
    /** 分量幂等包装：分量已结算则跳过；否则执行 fn 后标记 */
    function runPhase(phase, fn) {
        if (phaseMap[phase] === 1)
            return;
        fn();
        phaseMap[phase] = 1;
        settledPhases.push(phase);
    }
    // ── [2] 结算序 ─────────────────────────────────────────────────────────────
    // Phase 1 · 日程结算（stub — 日程处理器 P0-7）
    runPhase('日程结算', () => {
        // TODO(P0-7): fire 日程 action queue → effect pipeline
    });
    // Phase 2 · 事件种子萌发 — D4: 纪元分钟成熟锚
    runPhase('事件种子萌发', () => {
        const seeds = s.$隐藏记忆库?.延时种子 ?? {};
        for (const [key, seed] of Object.entries(seeds)) {
            if (seed.已结算标记 === 1)
                continue; // 已成熟（种子级幂等）
            // D4: 成熟日 = 0 → 立即成熟哨兵；否则比较全局时刻（纪元分钟）
            const matured = seed.成熟日 === 0 || seed.成熟日 <= nowEpochMin;
            if (matured) {
                seed.已结算标记 = 1;
                matureSeeds.push(key);
                // TODO(P0-7 F-a): generate event from mature seed via effect pack loader
            }
        }
    });
    // Phase 3–5 · 三类触发扫描（stub — P0-7+）
    runPhase('阈值触发', () => {
        // TODO(P0-7): scan threshold triggers
    });
    runPhase('日期触发', () => {
        // TODO(P0-7): scan date triggers (epoch-minute anchors)
    });
    runPhase('标志触发', () => {
        // TODO(P0-7): scan flag triggers
    });
    // Phase 6 · 关系触发 — G1a 发射端：|强度|×信任/100 ≥ REL_RIPPLE_THRESHOLD 的关系推候选涟漪
    // C2-3: 全体 actor 均可发射（不仅 PC）；emit factFragment 载荷（有锚·关系维度）
    runPhase('关系触发', () => {
        const tickNumber = s._tick?.拍计数 ?? 0;
        for (const [npcKey, npc] of Object.entries(s.NPC)) {
            for (const rel of npc.关系) {
                if (!rel.对象键)
                    continue;
                const score = Math.abs(rel.强度) * (rel.信任 / 100);
                if (score < REL_RIPPLE_THRESHOLD)
                    continue;
                const 量级 = Math.min(100, Math.round(score));
                emitRipple(s.$涟漪候选, rel.对象键, {
                    标签: rel.类型 || '关系',
                    极性: rel.极性 || '中',
                    强度: 量级,
                    可见性: '公开',
                    来源拍号: tickNumber,
                    有锚布尔: true,
                    factFragment: {
                        主体: npcKey,
                        维度: '关系',
                        Δ方向: rel.极性 === '负' ? -1 : 1,
                        客体: rel.对象键,
                        量级,
                    },
                });
            }
        }
    });
    // Phase 提案落账 · additive 注入入口 — 两路合一 → 五道闸 → 落账守恒
    // 纪律：严禁旁路任何闸·零 RNG·零 Date.now·不改 gate/conservation/computeDelta 函数体。
    // 路径优先级：optionSetInput(player_option) > injectedEnvelope(player_freetext)
    // s 替换后 phaseMap 同步重绑，保证后续 runPhase 标记写入新状态。
    {
        const INJECT_PHASE = '提案落账';
        if (!phaseMap[INJECT_PHASE]) {
            // 确定本拍有效 envelope
            let effectiveEnvelope;
            if (input.optionSetInput !== undefined) {
                // player_option 路径：runTick 内调 executeActionOption → 得 envelope(provenance='player_option')
                const execResult = executeActionOption(input.optionSetInput);
                if (execResult.matched && !execResult.downgrade && execResult.envelope) {
                    effectiveEnvelope = execResult.envelope;
                }
                // downgrade → effectiveEnvelope 保持 undefined，跳过五道闸·不写账
            }
            else if (input.injectedEnvelope !== undefined) {
                // player_freetext 路径（既有行为）
                effectiveEnvelope = input.injectedEnvelope;
            }
            if (effectiveEnvelope !== undefined) {
                const seatId = input.injectedSeatId ?? '__aohp__';
                // 若 host 未提供 injectedPacks，从 envelope 内部派生 K5 Δ（verb→Δ 路由）
                const packs = input.injectedPacks !== undefined
                    ? input.injectedPacks
                    : deriveVerbDelta(effectiveEnvelope, s, seatId);
                const gateResult = runProposalGate(effectiveEnvelope, s, seatId, input.injected授权源 ?? '玩家确认', packs);
                proposalGateResult = gateResult;
                if (gateResult.ok) {
                    // gateResult.state = structuredClone(s) + K5 deltas applied.
                    // Rebind s and phaseMap so subsequent runPhase calls target the new state.
                    s = gateResult.state;
                    phaseMap = s._系统.已结算标记[input.tickId].延时分量;
                }
            }
            phaseMap[INJECT_PHASE] = 1;
            settledPhases.push(INJECT_PHASE);
        }
    }
    // Phase 死亡感知发射 · C2-4: 扫描本拍新亡 actor → 向同地点在场目击者发射「生命」维度涟漪
    // 全 actor：PC 与 NPC 同路径；死者本身不入中继（propagateRipple 死者防护 obs1 guard）
    runPhase('死亡感知发射', () => {
        const tickNumber = s._tick?.拍计数 ?? 0;
        for (const [actorKey, npc] of Object.entries(s.NPC)) {
            if (npc.存活状态 !== '已故')
                continue;
            if (priorDeadSet.has(actorKey))
                continue; // 拍前即已故·跳过（防重复发射）
            const deadLoc = npc.位置 ?? '';
            emitRipple(s.$涟漪候选, actorKey, {
                标签: npc.死因 || '死亡', // 上下文派生：死因未登记退化 '死亡'（禁写死）
                极性: '中', // 中立事实性事件
                强度: 100,
                可见性: '公开',
                来源拍号: tickNumber,
                有锚布尔: true,
                factFragment: {
                    主体: actorKey,
                    维度: '生命',
                    Δ方向: -1,
                    量级: 100,
                    ...(deadLoc ? { 场景: deadLoc } : {}),
                },
            });
        }
    });
    // Phase 7 · 衰减批 — 三处共用 decayStep（印象/意象/记忆·L-13 统一累加器）
    runPhase('衰减批', () => {
        // 认知档案印象衰减（decayStep 统一实现·禁第二实现）
        for (const observerRec of Object.values(s.认知档案)) {
            for (const targetRec of Object.values(observerRec)) {
                for (const imp of targetRec.印象) {
                    if (imp.衰减速率 > 0) {
                        imp.强度 = decayStep(imp.强度, imp.衰减速率, spanMin);
                    }
                }
                // 剔除衰减至 0 的条目
                targetRec.印象 = targetRec.印象.filter(imp => imp.强度 > 0);
            }
        }
        // NPC 公共意象衰减（decayStep 统一实现）
        for (const npc of Object.values(s.NPC)) {
            for (const img of npc.意象) {
                if (img.衰减速率 > 0) {
                    img.强度 = decayStep(img.强度, img.衰减速率, spanMin);
                }
            }
            npc.意象 = npc.意象.filter(img => img.强度 > 0);
        }
        // L-13: 记忆召回权重 recency 衰减（0.995/拍·调用方传入·fixedPow 确定性·禁 Math.pow）
        const MEMORY_RECENCY_RATE = 0.995;
        for (const mem of s.工作记忆 ?? []) {
            if (mem.权重 > 0) {
                mem.权重 = decayStep(mem.权重, 0, 0, MEMORY_RECENCY_RATE);
            }
        }
        for (const mem of s.长期归档 ?? []) {
            if (mem.权重 > 0) {
                mem.权重 = decayStep(mem.权重, 0, 0, MEMORY_RECENCY_RATE);
            }
        }
    });
    // Phase 8 · 涟漪传播 — 2-hop BFS × 衰减 × 知情过滤 × 取 max 防环
    runPhase('涟漪传播', () => {
        propagateRipple(s, nowEpochMin);
    });
    // Phase 8.5 · 媒介拍末取材 — E4·6.55: 涟漪先落账后·媒介通道拍末采样落账
    // 纪律：涟漪传播（Phase 8）必须在媒介取材前完结，保证媒介读取已含涟漪结果。
    runPhase('媒介拍末取材', () => {
        // TODO(P0-7 E1/E2): 遍历媒介登记表·按 E1 读取落账 / E2 书信双宿主在途态 规格取材
        // stub: 媒介通道在此时刻采样·待 E1/E2 consumer 就位后实装
    });
    // Phase 9 · 原子提交 — 守恒验证 + 时钟推进 + tick_log + 全量结算标记
    runPhase('原子提交', () => {
        // 守恒断言：使用当前 s.货币系统?.账户（注入落账后账面可能已变动）
        // preNetAsset 从原始 state 账户计算·注入前后净值之和须恒等（SINK 平衡）
        const postAccounts = s.货币系统?.账户;
        if (postAccounts && preNetAsset !== null) {
            assertConservation(postAccounts, preNetAsset, getNetAsset);
        }
        // 世界时钟推进（纪元分钟·全局时刻轴）
        if (s.世界) {
            s.世界.纪元分钟 = nowEpochMin + spanMin;
            s.世界.周期数 = (s.世界.周期数 ?? 0) + 1;
        }
        // 拍计数推进（步数序号·仅悔棋/重掷专用·禁折算时长）
        if (s._tick) {
            s._tick.拍计数 = (s._tick.拍计数 ?? 0) + 1;
        }
        // tick_log 环形缓冲追加（上限 TICK_LOG_MAX）
        const logEntry = {
            tick_id: input.tickId,
            拍计数: s._tick?.拍计数 ?? 0,
            结果摘要: `phases:${settledPhases.length} seeds:${matureSeeds.length}`,
            系数组指纹: s._tick?.难度系数组指纹 ?? '',
        };
        s._系统.tick_log.push(logEntry);
        if (s._系统.tick_log.length > TICK_LOG_MAX) {
            s._系统.tick_log = s._系统.tick_log.slice(-TICK_LOG_MAX);
        }
        // 全量结算标记（幂等门控·下次同 tickId 直接返回）
        s._系统.已结算标记[input.tickId].即时分量 = 1;
    });
    return {
        state: s,
        settledPhases,
        matureSeeds,
        ...(proposalGateResult !== undefined ? { proposalGateResult } : {}),
    };
}
/** 给定地点键，沿父节点链（最多 16 层）找最近「区域级」祖先节点键；含自身。 */
function locRegion(locKey, locs) {
    let cur = locKey;
    for (let d = 0; d < 16; d++) {
        const loc = locs[cur];
        if (!loc)
            return undefined;
        if (loc.类别 === '区域级')
            return cur;
        if (!loc.父节点)
            return undefined;
        cur = loc.父节点;
    }
    return undefined;
}
/**
 * 从全量 地点.相邻 推导区域级无向邻接图。
 * 若两个地点的相邻边两端解析到不同区域，则添加一条区域间边（双向）。
 */
function buildRegionGraph(locs) {
    const graph = new Map();
    for (const [locKey, loc] of Object.entries(locs)) {
        const src = locRegion(locKey, locs);
        if (!src)
            continue;
        if (!graph.has(src))
            graph.set(src, new Set());
        for (const adj of loc.相邻) {
            if (!adj.目标 || adj.目标 === locKey)
                continue;
            const dst = locRegion(adj.目标, locs);
            if (!dst || dst === src)
                continue;
            graph.get(src).add(dst);
            if (!graph.has(dst))
                graph.set(dst, new Set());
            graph.get(dst).add(src);
        }
    }
    return graph;
}
/** BFS 求区域图最短跳数；不可达返回 -1。使用数组下标代替 shift() 防 O(n²)。 */
function bfsRegionHops(from, to, graph) {
    if (from === to)
        return 0;
    const visited = new Set([from]);
    const queue = [[from, 0]];
    let qi = 0;
    while (qi < queue.length) {
        const [cur, hops] = queue[qi++];
        const neighbors = graph.get(cur);
        if (!neighbors)
            continue;
        for (const nxt of neighbors) {
            if (nxt === to)
                return hops + 1;
            if (!visited.has(nxt)) {
                visited.add(nxt);
                queue.push([nxt, hops + 1]);
            }
        }
    }
    return -1;
}
/**
 * 计算二跳空间衰减因子：区域图跳数 × 人口密度调制（目标区域）。
 *
 * 退化条件（无图 / 无区域 / 同区域 / 不可达）均返回 1，完全保持 G1a 传播值。
 * TODO(G2): 传播媒介维度（口耳/信件/布告/谣言网络）此处占位 ×1，G2 接线。
 */
function computeSpatialFactor(targetRegion, obs2Loc, locs, graph) {
    if (!targetRegion || !graph || !obs2Loc)
        return 1;
    const obs2Region = locRegion(obs2Loc, locs);
    if (!obs2Region || obs2Region === targetRegion)
        return 1;
    const hops = bfsRegionHops(targetRegion, obs2Region, graph);
    if (hops <= 0)
        return 1;
    const hopFactor = fixedPow(REGION_HOP_DECAY, hops);
    const density = POPULATION_DENSITY_FACTOR[locs[targetRegion]?.人口规模 ?? ''] ?? 1.0;
    return Math.min(SPATIAL_FACTOR_MAX, Math.max(SPATIAL_FACTOR_MIN, hopFactor * density));
}
/**
 * 涟漪传播：读 $涟漪候选 → 写认知档案 → 清空 $涟漪候选
 *
 * 一手在场（目标 NPC 所在地点的其他 NPC）→ 沿 关系 边二跳×衰减×信任×空间因子×场景系数
 * covert（可见性='隐秘'）= 一跳/二跳均不落印象（走 fact 自带门·零印象）
 * 取 max：同 (observer, target, 标签, 极性) 已有印象则取强度较大值（防回路膨胀）
 * 空间因子（G1）：同区域/无图退化=1；跨区域 = REGION_HOP_DECAY^hops × 密度调制
 * 场景传播系数（G1·二跳）：目标地点 社交开放度 高→1.3 / 中→1.0 / 低→0.7
 */
function propagateRipple(s, nowEpochMin) {
    const pending = s.$涟漪候选;
    if (!pending || Object.keys(pending).length === 0)
        return;
    const npcs = s.NPC;
    const locs = s.地图.地点;
    const hasMap = Object.keys(locs).length > 0;
    // 每次 propagateRipple 调用构建一次区域图（本拍内地图不变·复用安全）
    const regionGraph = hasMap ? buildRegionGraph(locs) : undefined;
    for (const [targetKey, impressions] of Object.entries(pending)) {
        for (const imp of impressions) {
            const covert = imp.可见性 === '隐秘';
            const targetLoc = npcs[targetKey]?.位置 ?? '';
            // 目标区域（供 computeSpatialFactor 二跳计算复用）
            const targetRegion = hasMap && targetLoc ? locRegion(targetLoc, locs) : undefined;
            // 场景传播系数（G1·二跳·目标地点社交开放度·无图/无地点退化=1.0）
            const targetLocEntry = hasMap && targetLoc ? locs[targetLoc] : undefined;
            const sceneCoeff = SCENE_PROPAGATION_COEFF[targetLocEntry?.社交开放度 ?? '中'] ?? 1.0;
            // 一跳：目标所在地点的在场 NPC（不含目标自身）
            const presentKeys = targetLoc
                ? Object.entries(npcs)
                    .filter(([k, npc]) => k !== targetKey && npc.位置 === targetLoc)
                    .map(([k]) => k)
                : [];
            for (const obs1 of presentKeys) {
                if (covert)
                    continue; // covert 走 fact 自带门，一跳/二跳均不落印象
                if (npcs[obs1]?.存活状态 === '已故')
                    continue; // 死者防护：已故 actor 停中继且不接收印象
                writeImpressionMax(s.认知档案, obs1, targetKey, {
                    标签: imp.标签,
                    极性: imp.极性,
                    强度: imp.强度,
                    来源: `tick:${imp.来源拍号}`,
                    获知时间: nowEpochMin,
                    衰减速率: 0,
                    来源类型: '一手观测',
                    ...(imp.factFragment !== undefined ? { factFragment: imp.factFragment } : {}),
                });
                // 二跳：一跳观察者的 关系 连接（不在场）；场景系数 × 空间因子 × 衰减 × 信任
                const obs1Npc = npcs[obs1];
                if (!obs1Npc)
                    continue;
                for (const rel of obs1Npc.关系) {
                    const obs2 = rel.对象键;
                    if (!obs2 || obs2 === targetKey || presentKeys.includes(obs2))
                        continue;
                    const obs2Loc = npcs[obs2]?.位置 ?? '';
                    const sfactor = computeSpatialFactor(targetRegion, obs2Loc, locs, regionGraph);
                    const strength2 = imp.强度 * RIPPLE_DECAY * (rel.信任 / 100) * sfactor * sceneCoeff;
                    if (strength2 < RIPPLE_MIN)
                        continue;
                    writeImpressionMax(s.认知档案, obs2, targetKey, {
                        标签: imp.标签,
                        极性: imp.极性,
                        强度: strength2,
                        来源: `听闻自:${obs1}`,
                        获知时间: nowEpochMin,
                        衰减速率: 0,
                        来源类型: '二手转述',
                        ...(imp.factFragment !== undefined ? { factFragment: imp.factFragment } : {}),
                    });
                }
            }
        }
    }
    // 清空已处理的涟漪候选
    s.$涟漪候选 = {};
}
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
function writeImpressionMax(认知, observerKey, targetKey, entry) {
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
