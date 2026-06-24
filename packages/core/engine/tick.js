import { assertConservation } from './conservation.js';
import { getNetAsset } from './netAsset.js';
import { decayStep } from './time.js';
import { fixedPow, fixedExp } from './math/fixed.js';
import { rngFor } from './rng.js';
import { runProposalGate } from './proposal/index.js';
import { deriveVerbDelta } from './proposal/verbDelta.js';
import { executeActionOption } from './aohpExecutor.js';
// ── 环形缓冲上限 ──────────────────────────────────────────────────────────────
const TICK_LOG_MAX = 8;
// ── 涟漪参数 ──────────────────────────────────────────────────────────────────
const RIPPLE_DECAY = 0.5; // 二跳强度乘子（一跳强度 × 信任/100 × RIPPLE_DECAY）
const RIPPLE_MIN = 1; // 低于此阈值不写入认知档案（防噪）
const REL_RIPPLE_THRESHOLD = 50; // Phase 6 关系触发：|强度|×信任/100 达此阈值才发射
// ── C2-5 感知消费参数 ──────────────────────────────────────────────────────────
/** 编年史公共知识阈值：factFragment.量级 ≥ 此值且有一手观测者才入 _编年史。exported for lodEngine. */
export const CHRONICLE_PUBLIC_THRESHOLD = 50;
/** 情绪维度映射表（由 factFragment.维度+Δ方向派生·禁写死标签名） */
const EMOTION_DIMENSION_MAP = {
    '生命': { pos: '震惊', neg: '悲恸', coeff: 1.0 },
    '关系': { pos: '信任感', neg: '警惕', coeff: 0.5 },
};
/** 二手转述淡化系数（fixedExp(-ln2)≈0.5·确定性·no Math.exp） */
const INDIRECT_APPRAISAL_FACTOR = fixedExp(-0.6931471805599453);
/** 未知维度默认情绪强度系数 */
const UNKNOWN_DIM_COEFF = 0.3;
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
// ── G2-1 全动力学参数（SEIR×IC×LT · Granovetter78 · Centola-Macy · Bass stub）──────
// HOP_DECAY alias — preserves backward compat with RIPPLE_DECAY (same numeric value)
const HOP_DECAY = RIPPLE_DECAY; // 0.5 per hop distortion decay
// IC 边类型速率（Independent Cascade · 边类型→基础传播率 [0,1]）
// 规则：icEdgeProb(type, trust=100) = 1.0 for any type → trust=100 恒确定性通过（向后兼容）
const EDGE_TYPE_IC_RATE = {
    '亲人': 1.0, '伴侣': 1.0, '恋人': 1.0, '配偶': 1.0,
    '友人': 1.0, '旧友': 1.0, '老友': 1.0, '挚友': 1.0, '闺蜜': 1.0,
    '相识': 0.7, '熟人': 0.7, '邻居': 0.65,
    '点头之交': 0.4, '路人': 0.35,
    '桥接': 0.4,
};
const IC_RATE_DEFAULT = 0.8; // unknown type fallback
// 复杂传播标签集（Centola-Macy）：需要 W ≥ θ_i 条桥才能采纳
// 简单传播（默认）：单条通过的桥即可（W ≥ 1）
const COMPLEX_CONTAGION_LABELS = new Set([
    '思想传播', '行为改变', '身份转变', '政治观点', '信仰转变',
    '革命动员', '集体行动', '范式转移',
]);
// Bass 扩散参数（G2-1 stub 默认零·G2-2 通过 TickInput.bassP/bassQ 喂值）
// p=0 外部系数（媒介/告示广播项接线点）；q=0 口碑系数（Word-of-Mouth 接线点）
// 运行时由 TickInput.bassP/bassQ 覆盖；缺省保持零·向后兼容 G2-1 所有现有测试
const BASS_P_DEFAULT = 0.0; // fallback when TickInput.bassP undefined
const BASS_Q_DEFAULT = 0.0; // fallback when TickInput.bassQ undefined
// ── G2-2 传播系数参数 ─────────────────────────────────────────────────────────
/** 资源紧张度对传播的最大抑制系数（紧张度100 → 传播强度×(1-0.5)=0.5） */
const RESOURCE_SUPPRESSION_MAX = 0.5;
/** 组织信道广播衰减（与 HOP_DECAY 同量纲·每次组织中继再乘一次） */
const ORG_CHANNEL_DECAY = HOP_DECAY; // 0.5 — 组织信道中继强度折半
// ── G2-3 S2 矫诏真伪门参数 ────────────────────────────────────────────────────
/** 矫诏消息（伪诏）官方信道可信度折半系数（G2-3 S2·硬编·非 preset 可配） */
const FAKE_EDICT_CREDIBILITY_FACTOR = 0.5;
// ── G2-3 S3 SEIR 冲突吸收参数 ─────────────────────────────────────────────────
/** 接收者已有对立真印象的强度阈值（≥此值视为 SEIR R态·已免疫） */
const SEIR_CONFLICT_ABSORPTION_THRESHOLD = 30;
/** 矫诏消息遭遇 R态 接收者时的冲突吸收衰减系数 */
const SEIR_CONFLICT_ABSORPTION_FACTOR = 0.5;
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
    '感知情绪化', // C2-5: 认知档案本拍新 factFragment → NPC.情绪栈 appraisal
    '编年史入册', // C2-5: 公共 factFragment（≥1 一手观测·量级≥阈值）→ 全局._编年史
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
    // Phase 8 · 涟漪传播 — G2-1 全动力学 SEIR×IC×LT × Centola-Macy × Bass stub
    runPhase('涟漪传播', () => {
        const rngSeed = s.$存档种子 ?? 0;
        const rngTick = s._tick?.拍计数 ?? 0;
        const rngSalt = s._存档头?.全局回滚计数器 ?? 0;
        propagateRipple(s, nowEpochMin, rngSeed, rngTick, rngSalt, input.bassP ?? BASS_P_DEFAULT, // G2-2: Bass 外部点火系数
        input.bassQ ?? BASS_Q_DEFAULT);
    });
    // Phase 感知情绪化 · C2-5: 扫认知档案本拍新印象 → 含 factFragment 的条目映射为情绪栈 Δ
    // 维度/Δ方向派生情绪名·取 max 防回路·二手转述 INDIRECT_APPRAISAL_FACTOR 淡化（确定性）
    runPhase('感知情绪化', () => {
        applyAppraisal(s, nowEpochMin);
    });
    // Phase 编年史入册 · C2-5: 公共知识 factFragment（≥1 一手观测·量级≥阈值）→ 全局._编年史
    // covert 事件 propagateRipple 已滤（无一手观测→自然零命中·知情门天然生效）
    runPhase('编年史入册', () => {
        appendToChronicle(s, nowEpochMin);
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
// ── G2-1 动力学辅助函数 ──────────────────────────────────────────────────────
/**
 * IC 边概率（Independent Cascade · Granovetter78 边类型×信任调制）。
 *
 * 公式：rate + (trust/100) × (1 − rate)
 * 不变式：trust=100 时恒 1.0（对任意 rate）→ 确定性通过（向后兼容 G1a 所有现有测试）。
 * trust=0 时 = rate（纯边类型下界）。
 */
function icEdgeProb(relType, trust) {
    const rate = EDGE_TYPE_IC_RATE[relType] ?? IC_RATE_DEFAULT;
    return rate + (trust / 100) * (1 - rate);
}
/**
 * 判定是否为「复杂传播」内容（Centola-Macy 复杂传播·需多桥）。
 * 简单传播（默认）= 单条通过桥即可；复杂传播 = 须 W ≥ θ_i 条独立桥。
 */
function isComplexContagion(label, ff) {
    if (COMPLEX_CONTAGION_LABELS.has(label))
        return true;
    if (ff?.维度 && COMPLEX_CONTAGION_LABELS.has(ff.维度))
        return true;
    return false;
}
/**
 * 派生 NPC 异质阈值计数 θ_i（Granovetter78·整数·不写 schema）。
 *
 * 使用 体质 作为「信息阻力」代理（高体质→更保守→更高阈值）。
 * 返回值表示：复杂采纳需要的最少独立桥数。
 * 默认体质=10 → θ_i=2；体质=1 → θ_i=1；体质≥15 → θ_i=3。
 */
function deriveThresholdCount(npc) {
    const 体质 = npc?.属性?.['体质'] ?? 10;
    if (体质 <= 4)
        return 1;
    if (体质 <= 12)
        return 2;
    return 3;
}
/**
 * Bass 扩散放大因子（G2-2 接线）。
 * 公式：1 + pExt + qWom × F(t)
 * pExt=0, qWom=0 → factor=1.0（无影响·向后兼容 G2-1 所有现有测试）。
 */
function bassFactor(pExt, qWom, knownFraction) {
    return 1.0 + pExt + qWom * knownFraction;
}
/**
 * 资源紧张度 → 传播抑制因子（G2-2）。
 * 取目标地点所在「区域级」祖先节点的 区域资源紧张度（[0,100]）。
 * 紧张度 0 → factor=1.0；紧张度 100 → factor=1-RESOURCE_SUPPRESSION_MAX=0.5。
 * 无区域 / 无字段 → 1.0（不抑制·兼容现有所有测试）。
 */
function computeResourceFactor(locKey, locs) {
    if (!locKey)
        return 1.0;
    const region = locRegion(locKey, locs);
    if (!region)
        return 1.0;
    const tension = locs[region]?.区域资源紧张度 ?? 0;
    const suppression = (tension / 100) * RESOURCE_SUPPRESSION_MAX;
    return Math.max(1.0 - suppression, 1.0 - RESOURCE_SUPPRESSION_MAX);
}
/**
 * 组织信道：收集某组织所有在职且存活成员键（排除 excludeKeys）。
 */
function getOrgMemberKeys(npcs, orgKey, excludeKeys) {
    const result = [];
    for (const [k, npc] of Object.entries(npcs)) {
        if (excludeKeys.has(k))
            continue;
        if (npc.存活状态 === '已故')
            continue;
        if (npc.所属组织.some(o => o.组织键 === orgKey))
            result.push(k);
    }
    return result;
}
// ── G2-3 S1 组织层级辅助（层级延迟·子组织扩散） ───────────────────────────────────
/**
 * G2-3 S1: 从 组织关系网 的 层级/隶属 边构建父→子有向图。
 * A组织 = 下级（子）；B组织 = 上级（父）。
 * 默认 fixture 无此类边 → 空图 → S1 路径完全跳过 → 0 重定基。
 */
function buildOrgChildGraph(orgNet) {
    const children = new Map();
    for (const edge of Object.values(orgNet)) {
        if (edge.边类型 !== '层级' && edge.边类型 !== '隶属')
            continue;
        const parent = edge.B组织;
        const child = edge.A组织;
        if (!parent || !child || parent === child)
            continue;
        if (!children.has(parent))
            children.set(parent, new Set());
        children.get(parent).add(child);
    }
    return children;
}
/**
 * G2-3 S1: BFS 求从 rootOrg 出发可达的所有子组织及层级深度（depth=0 = rootOrg 自身）。
 * 有环时以首次到达深度为准（无重访·确定性）。
 */
function bfsOrgHierarchyDepths(rootOrg, childGraph) {
    const depths = new Map([[rootOrg, 0]]);
    if (!childGraph.has(rootOrg))
        return depths; // fast path: 无子组织
    const queue = [[rootOrg, 0]];
    let qi = 0;
    while (qi < queue.length) {
        const [cur, d] = queue[qi++];
        for (const child of (childGraph.get(cur) ?? [])) {
            if (!depths.has(child)) {
                depths.set(child, d + 1);
                queue.push([child, d + 1]);
            }
        }
    }
    return depths;
}
/**
 * G2-3 S3: SEIR 冲突吸收因子。
 * 矫诏=true 消息到达已有「对立真印象」（极性反转·强度≥阈值）的接收者时进一步衰减。
 * 对应 SEIR R态（已免疫·Recovered）对反向信息的天然阻抗。
 * 非矫诏消息直接返回 1.0（零影响·向后兼容·仅矫诏路径消费）。
 */
function computeConflictAbsorption(archive, obsKey, targetKey, imp) {
    if (imp.矫诏 !== true)
        return 1.0;
    const oppositePolarity = imp.极性 === '正' ? '负' : imp.极性 === '负' ? '正' : '';
    if (!oppositePolarity)
        return 1.0;
    const existingImps = archive[obsKey]?.[targetKey]?.印象 ?? [];
    const hasStrongOpposing = existingImps.some(e => e.标签 === imp.标签 && e.极性 === oppositePolarity && e.强度 >= SEIR_CONFLICT_ABSORPTION_THRESHOLD);
    return hasStrongOpposing ? SEIR_CONFLICT_ABSORPTION_FACTOR : 1.0;
}
/**
 * 涟漪传播（G2-2 全动力学）：读 $涟漪候选 → 写认知档案 → 清空 $涟漪候选
 *
 * 跳 1（一手在场）：目标地点在场 NPC 直接目击 → 确定性写入（不变·与 G1a 完全一致）。
 * 跳 2（口耳相传）：SEIR×IC×LT×Centola-Macy 全动力学（G2-1 不变）。
 * 跳 3（组织信道·G2-2）：跳1观测者所属组织的其他成员 → 忠诚度调制·确定性·官方信道。
 *   - 传播力 ⊥ 真实性（内容真伪在叙事层·引擎仅传播）。
 *   - TODO(G2-3): 层级延迟（沿 层级/隶属 边跳数 × delay）；当前同拍交付。
 * 跳 4（Bass 外部点火·G2-2）：pExt>0 时媒体广播独立触发所有未覆盖 NPC。
 *   - 触发概率：pExt（[0,1]·seeded·逐 NPC 独立滚）。
 *   - 写入强度：imp.强度 × HOP_DECAY（同二跳量级）。
 *   - pExt=0 → 此阶段跳过（向后兼容·G2-1 所有测试不受影响）。
 * 资源抑制：二跳/三跳/四跳强度均乘 computeResourceFactor（一跳确定性不受影响）。
 * covert（可见性='隐秘'）= 全跳跳过。
 * 取 max 防环（同 G1a 不变）。
 */
function propagateRipple(s, nowEpochMin, seed, nowTick, rerollSalt, pExt, // G2-2: Bass 外部点火系数（TickInput.bassP）；0 = 无媒体广播
bassQ) {
    const pending = s.$涟漪候选;
    if (!pending || Object.keys(pending).length === 0)
        return;
    const npcs = s.NPC;
    const locs = s.地图.地点;
    const hasMap = Object.keys(locs).length > 0;
    const regionGraph = hasMap ? buildRegionGraph(locs) : undefined;
    // G2-3 S1: 组织层级图（一次性构建·default fixture 无 层级/隶属 边 → 空图 → S1 路径跳过）
    const orgChildGraph = buildOrgChildGraph(s.组织关系网);
    // Global round index for IC channel disambiguation (one shared counter per propagateRipple call)
    let icRound = 0;
    for (const [targetKey, impressions] of Object.entries(pending)) {
        for (const imp of impressions) {
            const covert = imp.可见性 === '隐秘';
            const targetLoc = npcs[targetKey]?.位置 ?? '';
            const targetRegion = hasMap && targetLoc ? locRegion(targetLoc, locs) : undefined;
            const targetLocEntry = hasMap && targetLoc ? locs[targetLoc] : undefined;
            const sceneCoeff = SCENE_PROPAGATION_COEFF[targetLocEntry?.社交开放度 ?? '中'] ?? 1.0;
            // ── 跳 1：一手在场目击（与 G1a 完全一致·不走 IC·确定性）────────────────
            const presentKeys = targetLoc
                ? Object.entries(npcs)
                    .filter(([k, npc]) => k !== targetKey && npc.位置 === targetLoc)
                    .map(([k]) => k)
                : [];
            for (const obs1 of presentKeys) {
                if (covert)
                    continue;
                if (npcs[obs1]?.存活状态 === '已故')
                    continue;
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
            }
            if (covert)
                continue; // 隐秘 → 后续各跳同样跳过
            // 资源抑制因子（G2-2·目标地点区域·二跳+组织信道+Bass点火均适用）
            const resourceFactor = computeResourceFactor(targetLoc, locs);
            // Bass F(t)：当前拍开始前已知该标签的 NPC 比例（G2-2·从 认知档案 读取）
            let knownFraction = 0.0;
            if (pExt > 0 || bassQ > 0) {
                const liveNpcCount = Object.values(npcs).filter(n => n.存活状态 !== '已故').length;
                if (liveNpcCount > 0) {
                    let knownCount = 0;
                    for (const [obsKey, targetMap] of Object.entries(s.认知档案)) {
                        const archEntry = targetMap[targetKey];
                        if (!archEntry)
                            continue;
                        if (archEntry.印象.some(i => i.标签 === imp.标签)) {
                            if (npcs[obsKey]?.存活状态 !== '已故')
                                knownCount++;
                        }
                    }
                    knownFraction = knownCount / liveNpcCount;
                }
            }
            const bf = bassFactor(pExt, bassQ, knownFraction);
            // ── 跳 2：口耳相传（IC×LT×Centola-Macy · seeded）─────────────────────
            // 是否为复杂传播（Centola-Macy）
            const complex = isComplexContagion(imp.标签, imp.factFragment);
            // 收集所有 obs1→obs2 桥候选：obs2Key → [{obs1Key, strength2}]
            const hop2Map = new Map();
            for (const obs1 of presentKeys) {
                if (npcs[obs1]?.存活状态 === '已故')
                    continue;
                const obs1Npc = npcs[obs1];
                if (!obs1Npc)
                    continue;
                for (const rel of obs1Npc.关系) {
                    const obs2 = rel.对象键;
                    if (!obs2 || obs2 === targetKey || presentKeys.includes(obs2))
                        continue;
                    if (npcs[obs2]?.存活状态 === '已故')
                        continue;
                    const obs2Loc = npcs[obs2]?.位置 ?? '';
                    const sfactor = computeSpatialFactor(targetRegion, obs2Loc, locs, regionGraph);
                    const strength2 = imp.强度 * HOP_DECAY * (rel.信任 / 100) * sfactor * sceneCoeff * bf * resourceFactor;
                    if (strength2 < RIPPLE_MIN)
                        continue;
                    const bucket = hop2Map.get(obs2) ?? [];
                    bucket.push({ obs1, strength2, relType: rel.类型, trust: rel.信任 });
                    hop2Map.set(obs2, bucket);
                }
            }
            // IC 检定 + LT 聚合 + Centola-Macy 门槛
            const hop2Covered = new Set(); // G2-2: 跳2已覆盖键（供跳3/4排重）
            for (const [obs2, candidates] of hop2Map) {
                // IC 检定：每条桥独立概率触发
                const passing = [];
                for (const cand of candidates) {
                    const prob = icEdgeProb(cand.relType, cand.trust);
                    if (prob >= 1.0) {
                        // trust=100（或极高信任强类型）→ 确定性通过·不消耗 RNG
                        passing.push({ obs1: cand.obs1, strength2: cand.strength2 });
                    }
                    else {
                        // seeded IC 检定（channel 四元组·独立通道不混）
                        const roll = rngFor(seed, nowTick, `涟漪:IC:${cand.obs1}:${obs2}:${imp.标签}`, rerollSalt, icRound++);
                        if (roll < prob * 100) {
                            passing.push({ obs1: cand.obs1, strength2: cand.strength2 });
                        }
                    }
                }
                // 桥宽 W = 通过 IC 检定的独立路径数
                const W = passing.length;
                // LT 门槛（Centola-Macy）
                if (complex) {
                    const θi = deriveThresholdCount(npcs[obs2]);
                    if (W < θi)
                        continue; // 未达复杂传播阈值 → 不写入
                }
                else {
                    if (W === 0)
                        continue; // 简单传播：至少一桥通过
                }
                // 取最强通过路径写入（取 max 防环由 writeImpressionMax 保障）
                let best = passing[0];
                for (const p of passing) {
                    if (p.strength2 > best.strength2)
                        best = p;
                }
                writeImpressionMax(s.认知档案, obs2, targetKey, {
                    标签: imp.标签,
                    极性: imp.极性,
                    强度: best.strength2,
                    来源: `听闻自:${best.obs1}`,
                    获知时间: nowEpochMin,
                    衰减速率: 0,
                    来源类型: '二手转述',
                    ...(imp.factFragment !== undefined ? { factFragment: imp.factFragment } : {}),
                });
                hop2Covered.add(obs2);
            }
            // ── 跳 3：组织信道（G2-2·官方信道·沿 所属组织 广播·忠诚度调制）─────────
            // 跳1观测者所属的每个组织 → 组织内其他成员均收到广播（同拍交付·确定性）。
            // 传播力 ⊥ 真实性（内容可信度/narrativeFrame 在叙事层·此处仅传播强度）。
            // G2-3 S2: 矫诏=true → FAKE_EDICT_CREDIBILITY_FACTOR 折半·来源标注 (矫诏)。
            // G2-3 S3: 矫诏=true + 接收者已有对立真印象(R态) → 额外 SEIR_CONFLICT_ABSORPTION_FACTOR。
            // G2-3 S1: 层级延迟 → 子组织成员按深度概率性接收（orgChildGraph.size=0 完全跳过·0重定基）。
            const presentSet = new Set(presentKeys);
            const orgCovered = new Set(); // 组织信道已写入键（防重）
            const fakeEdict = imp.矫诏 === true; // G2-3 S2
            const fakeFactor = fakeEdict ? FAKE_EDICT_CREDIBILITY_FACTOR : 1.0;
            for (const obs1 of presentKeys) {
                if (npcs[obs1]?.存活状态 === '已故')
                    continue;
                const obs1Npc = npcs[obs1];
                if (!obs1Npc)
                    continue;
                for (const orgMembership of obs1Npc.所属组织) {
                    const orgKey = orgMembership.组织键;
                    const orgExclude = new Set([...presentSet, targetKey, ...hop2Covered, ...orgCovered]);
                    const members = getOrgMemberKeys(npcs, orgKey, orgExclude);
                    for (const memKey of members) {
                        // 忠诚度调制（$真实值 [0-100]；缺省 50）
                        const loyalty = npcs[memKey]?.忠诚[orgKey]?.$真实值 ?? 50;
                        // G2-3 S3: 冲突吸收（非矫诏消息直接 1.0·零影响·向后兼容）
                        const conflictFactor = computeConflictAbsorption(s.认知档案, memKey, targetKey, imp);
                        const orgStrength = imp.强度 * ORG_CHANNEL_DECAY * (loyalty / 100) * resourceFactor * fakeFactor * conflictFactor;
                        if (orgStrength < RIPPLE_MIN)
                            continue;
                        writeImpressionMax(s.认知档案, memKey, targetKey, {
                            标签: imp.标签,
                            极性: imp.极性,
                            强度: orgStrength,
                            来源: fakeEdict ? `组织传达(矫诏):${orgKey}` : `组织传达:${orgKey}`,
                            获知时间: nowEpochMin,
                            衰减速率: 0,
                            来源类型: '二手转述',
                            ...(imp.factFragment !== undefined ? { factFragment: imp.factFragment } : {}),
                        });
                        orgCovered.add(memKey);
                    }
                    // ── G2-3 S1: 层级延迟 — 子组织成员按深度概率性接收 ─────────────────
                    // 仅在有 层级/隶属 边时激活（orgChildGraph.size=0 完全跳过·default fixture→0重定基）。
                    // P(receive_this_tick) = 100/(depth+1)：depth=1→50%·depth=2→33%·depth=3→25%。
                    // seeded RNG（通道键含 subOrgKey 区分）·icRound 仅在此分支递增。
                    if (orgChildGraph.size > 0) {
                        const subOrgDepths = bfsOrgHierarchyDepths(orgKey, orgChildGraph);
                        for (const [subOrgKey, depth] of subOrgDepths) {
                            if (depth === 0)
                                continue; // depth=0 = 直属成员，已在上方处理
                            const subExclude = new Set([...presentSet, targetKey, ...hop2Covered, ...orgCovered]);
                            const subMembers = getOrgMemberKeys(npcs, subOrgKey, subExclude);
                            for (const subMemKey of subMembers) {
                                // 确定性延迟检定（seeded·P = 100/(depth+1)）
                                const rollBound = 100 / (depth + 1);
                                const roll = rngFor(seed, nowTick, `涟漪:org:delay:${subMemKey}:${targetKey}:${imp.标签}:${orgKey}`, rerollSalt, icRound++);
                                if (roll >= rollBound)
                                    continue; // 本拍未到达
                                const subLoyalty = npcs[subMemKey]?.忠诚[orgKey]?.$真实值 ?? 50;
                                const subConflictFactor = computeConflictAbsorption(s.认知档案, subMemKey, targetKey, imp);
                                const subOrgStrength = imp.强度 * ORG_CHANNEL_DECAY * (subLoyalty / 100) * resourceFactor * fakeFactor * subConflictFactor;
                                if (subOrgStrength < RIPPLE_MIN)
                                    continue;
                                writeImpressionMax(s.认知档案, subMemKey, targetKey, {
                                    标签: imp.标签,
                                    极性: imp.极性,
                                    强度: subOrgStrength,
                                    来源: fakeEdict
                                        ? `组织层级传达(矫诏):${orgKey}→${subOrgKey}`
                                        : `组织层级传达:${orgKey}→${subOrgKey}`,
                                    获知时间: nowEpochMin,
                                    衰减速率: 0,
                                    来源类型: '二手转述',
                                    ...(imp.factFragment !== undefined ? { factFragment: imp.factFragment } : {}),
                                });
                                orgCovered.add(subMemKey);
                            }
                        }
                    }
                }
            }
            // ── 跳 4：Bass 外部点火（G2-2·媒体广播·pExt>0 时对未覆盖 NPC 独立滚）─────
            // 仅在 pExt>0 时激活（pExt=0 完全跳过·向后兼容 G2-1 所有现有测试）。
            // 触发概率 = pExt（每 NPC 独立·seeded·不混 hop2 / hop3 通道）。
            if (pExt > 0) {
                const bassExclude = new Set([
                    ...presentSet, targetKey, ...hop2Covered, ...orgCovered,
                ]);
                for (const [npcKey, npc] of Object.entries(npcs)) {
                    if (bassExclude.has(npcKey))
                        continue;
                    if (npc.存活状态 === '已故')
                        continue;
                    // seeded 独立点火检定
                    const roll = rngFor(seed, nowTick, `涟漪:Bass:${npcKey}:${imp.标签}`, rerollSalt, icRound++);
                    const triggerProb = Math.min(pExt, 1.0) * 100;
                    if (roll >= triggerProb)
                        continue;
                    const bassStrength = imp.强度 * HOP_DECAY * resourceFactor;
                    if (bassStrength < RIPPLE_MIN)
                        continue;
                    writeImpressionMax(s.认知档案, npcKey, targetKey, {
                        标签: imp.标签,
                        极性: imp.极性,
                        强度: bassStrength,
                        来源: `媒体广播:${targetKey}`,
                        获知时间: nowEpochMin,
                        衰减速率: 0,
                        来源类型: '二手转述',
                        ...(imp.factFragment !== undefined ? { factFragment: imp.factFragment } : {}),
                    });
                }
            }
        }
    }
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
// ── C2-5 感知消费引擎 ──────────────────────────────────────────────────────────
/**
 * 情绪栈回写（appraisal）：扫认知档案本拍新印象（获知时间===nowEpochMin·含 factFragment）
 * → 按维度/Δ方向派生情绪名 → 写 NPC.情绪栈（取 max·防回路膨胀）。
 * 二手转述 INDIRECT_APPRAISAL_FACTOR 淡化（fixedExp(-ln2)≈0.5·确定性·no Math.exp）。
 */
function applyAppraisal(s, nowEpochMin) {
    for (const [observerKey, targetMap] of Object.entries(s.认知档案)) {
        const npc = s.NPC[observerKey];
        if (!npc)
            continue;
        for (const cogEntry of Object.values(targetMap)) {
            for (const imp of cogEntry.印象) {
                if (!imp.factFragment)
                    continue;
                if (imp.获知时间 !== nowEpochMin)
                    continue;
                const ff = imp.factFragment;
                const dimEntry = EMOTION_DIMENSION_MAP[ff.维度];
                const dimCoeff = dimEntry?.coeff ?? UNKNOWN_DIM_COEFF;
                // 情绪名/极性由 factFragment.维度+Δ方向派生（禁写死标签名）
                const emotionName = dimEntry
                    ? (ff.Δ方向 >= 0 ? dimEntry.pos : dimEntry.neg)
                    : imp.标签;
                const polarity = dimEntry
                    ? (ff.Δ方向 >= 0 ? '正' : '负')
                    : imp.极性;
                // 淡化：二手转述走 INDIRECT_APPRAISAL_FACTOR（fixedExp 确定性口径）
                const directFactor = imp.来源类型 === '一手观测' ? 1.0 : INDIRECT_APPRAISAL_FACTOR;
                const intensity = Math.min(100, Math.round(ff.量级 * dimCoeff * directFactor));
                if (intensity <= 0)
                    continue;
                // 取 max 防回路膨胀（同情绪名已有条目→仅在强度更高时更新）
                const existing = npc.情绪栈.find(e => e.情绪名 === emotionName);
                if (existing) {
                    if (intensity > existing.数值) {
                        existing.数值 = intensity;
                        existing.来源 = imp.来源;
                    }
                }
                else {
                    npc.情绪栈.push({
                        情绪名: emotionName,
                        极性: polarity,
                        数值: intensity,
                        影响: [],
                        到期: 0,
                        来源: imp.来源,
                        可叠加: false,
                    });
                }
            }
        }
    }
}
/**
 * 编年史入册：扫认知档案本拍新印象中公共 factFragment
 * （来源类型='一手观测' + 量级≥CHRONICLE_PUBLIC_THRESHOLD）→ 去重后追加 全局._编年史。
 * covert 事件 propagateRipple 已过滤（无一手观测→天然零命中·知情门自动生效）。
 * 序号单调递增（M3_FORWARD_ONLY 守卫·引擎直写 _ 前缀字段·不走 computeDelta）。
 */
function appendToChronicle(s, nowEpochMin) {
    const 编年史 = s.全局?._编年史;
    if (!编年史)
        return;
    const publicEvents = new Map();
    for (const targetMap of Object.values(s.认知档案)) {
        for (const cogEntry of Object.values(targetMap)) {
            for (const imp of cogEntry.印象) {
                if (!imp.factFragment)
                    continue;
                if (imp.获知时间 !== nowEpochMin)
                    continue;
                if (imp.来源类型 !== '一手观测')
                    continue;
                const ff = imp.factFragment;
                if (ff.量级 < CHRONICLE_PUBLIC_THRESHOLD)
                    continue;
                const evKey = `${ff.主体}:${ff.维度}`;
                if (!publicEvents.has(evKey)) {
                    publicEvents.set(evKey, {
                        主体: ff.主体, 维度: ff.维度, Δ方向: ff.Δ方向,
                        量级: ff.量级,
                        ...(ff.客体 !== undefined ? { 客体: ff.客体 } : {}),
                        ...(ff.场景 !== undefined ? { 场景: ff.场景 } : {}),
                    });
                }
            }
        }
    }
    if (publicEvents.size === 0)
        return;
    let seqMax = 编年史.length > 0
        ? 编年史.reduce((m, e) => Math.max(m, e.序号), 0)
        : 0;
    for (const ev of publicEvents.values()) {
        const dir = ev.Δ方向 < 0 ? '降' : '升';
        const 标题 = ev.客体
            ? `${ev.主体}→${ev.客体}·${ev.维度}${dir}`
            : `${ev.主体}·${ev.维度}${dir}`;
        const 结果摘要行 = ev.客体
            ? `${ev.主体} 与 ${ev.客体} 发生${ev.维度}维度事件·量级${ev.量级}`
            : `${ev.主体} 发生${ev.维度}维度事件·量级${ev.量级}`;
        编年史.push({
            序号: ++seqMax,
            时间: nowEpochMin,
            标题,
            结果摘要行,
            关联实体键: ev.客体 ? [ev.主体, ev.客体] : [ev.主体],
            重要等级: '重要',
        });
    }
}
export function writeImpressionMax(认知, observerKey, targetKey, entry) {
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
