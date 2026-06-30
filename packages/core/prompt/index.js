// Gate is computed live on every call — never cached. Condition is hardcoded:
// both 内容分级==='community' AND 允许玩家覆盖===true must hold simultaneously.
function overrideAllowed(state, entry) {
    return state.$玩家偏好?.内容分级 === 'community' && entry.允许玩家覆盖SystemPrompt === true;
}
export function assembleNarrativeCall(baseSystemPrompt, entry, state) {
    const allowed = overrideAllowed(state, entry);
    return {
        systemPrompt: (allowed && entry.玩家SystemPrompt覆盖) ? entry.玩家SystemPrompt覆盖 : baseSystemPrompt,
        assistantPrefill: (allowed && entry.assistant预填) ? entry.assistant预填 : undefined,
    };
}
// ── N-6: 多人模式路由归属口径（P2 接线·P0 仅注释锁定语义）─────────────────────
// 多人下「模型路由归属」= 全局成本/API-key 行为层面的房间级决策，
// ⚠️ 不是 per-seat 各自切模型——每席独立切会导致 API key 暴露给非房主席位、
//    成本核算混乱、并发调用竞争同一 key 配额。
// 正确口径：路由归属降至「房间级共识/房主权」——一个房间一套路由决策，
//   房主席位的 $玩家偏好.NSFW降级模型 对全房间生效，非房主席位无独立路由权。
// 实装见 P2 · 接 C5 per-seat 投影 + MP6 swipe 房主权时再落地。
// P0 本函数签名不含 seatId 参数——接线前禁止任何实装者按 per-seat 各自切误做。
export function selectNarrativeModel(state, opts, keyChecker) {
    const pref = state.$玩家偏好?.NSFW降级模型;
    // 关态：永不切模型（keyChecker 不调用——关态无需 live 校验）
    if (!pref?.启用) {
        return {
            modelKey: null,
            routedVia: 'default',
            explicitReason: 'NSFW降级模型已关闭，恒用当前默认模型；软拒走重roll叙事（同模型·重渲不重判·账本冻结）',
        };
    }
    // 硬约束②: 目标 key 必须在 $模型画像 中已配置（静态配置检查）
    const targetKey = state.$预算控制台?.NSFW降级目标模型键;
    if (!targetKey || !(targetKey in state.$模型画像)) {
        const missing = targetKey ?? '(未设置)';
        return {
            modelKey: null,
            routedVia: 'nsfw-disabled',
            explicitReason: `NSFW降级目标模型键「${missing}」不在$模型画像，开关自动降级为不可用；请在$预算控制台.NSFW降级目标模型键配置有效的provider key`,
        };
    }
    // N-3: 运行时 key 有效性校验（切前 live 校验；失效→降级为关态行为）
    if (keyChecker) {
        const validity = keyChecker(targetKey);
        if (!validity.valid) {
            const failDesc = validity.failReason === 'revoked' ? '已撤销'
                : validity.failReason === 'expired' ? '已过期'
                    : validity.failReason === 'quota_exhausted' ? '额度耗尽'
                        : '失效原因未知';
            return {
                modelKey: null,
                routedVia: 'nsfw-disabled',
                explicitReason: `NSFW降级目标模型键「${targetKey}」key失效已回落（${failDesc}）：降级为关态，软拒走重roll叙事（不切模型）`,
            };
        }
    }
    // 场景预判模式：检测命中即预路由
    if (pref.触发模式 === '场景预判' && opts.scenePredictedNsfw) {
        return {
            modelKey: targetKey,
            routedVia: 'nsfw-preempt',
            explicitReason: `场景预判命中NSFW，预先路由到模型「${targetKey}」（内容分级∈{explicit,community}∧情境标签匹配）`,
        };
    }
    // 失败兜底 / 场景预判未命中但有软拒：切换重试
    if (opts.softRejectDetected) {
        return {
            modelKey: targetKey,
            routedVia: 'nsfw-fallback',
            explicitReason: `软拒/拒答检测命中，因「${pref.触发模式}」切换到模型「${targetKey}」重试`,
        };
    }
    // 无触发条件：使用默认模型
    return {
        modelKey: null,
        routedVia: 'default',
        explicitReason: '未触发NSFW切换条件（无软拒·无场景预判命中），使用默认模型',
    };
}
// ── N-1: 场景检测器（前置·每拍仅跑一次）─────────────────────────────────────
// exported: injectable in tests via assembleTickRoute's sceneDetector param.
// Condition: 内容分级∈{explicit,community} AND intentTags contains an nsfw/explicit marker.
export function isNsfwScene(state, intentTags) {
    const rating = state.$玩家偏好?.内容分级;
    if (rating !== 'explicit' && rating !== 'community')
        return false;
    return intentTags.some(t => t === 'nsfw' || t === 'explicit' || t.includes('-nsfw') || t.includes('-explicit'));
}
// ── N-1: 一拍路由定格 ─────────────────────────────────────────────────────────
// Route is locked on first assembly of a tick and written to _系统.tick_log.
// All same-tick swipes/re-rolls read the frozen snapshot without re-running the
// scene detector or re-calling selectNarrativeModel.
// sceneDetector is injectable so tests can count invocations without module spy tricks.
export function assembleTickRoute(state, intentTags, sceneDetector = isNsfwScene) {
    const tickId = state._tick.id;
    // Return frozen route if already locked for this tick (N-1 idempotency)
    const existing = state._系统.tick_log.find(e => e.tick_id === tickId);
    if (existing?.路由快照) {
        const snap = existing.路由快照;
        return {
            decision: { routedVia: snap.routedVia, modelKey: snap.modelKey, explicitReason: snap.explicitReason },
            updatedState: state,
        };
    }
    // First assembly: scene detector runs exactly once, then route decision is made
    const scenePredictedNsfw = sceneDetector(state, intentTags);
    const decision = selectNarrativeModel(state, { softRejectDetected: false, scenePredictedNsfw });
    const snapshot = { routedVia: decision.routedVia, modelKey: decision.modelKey, explicitReason: decision.explicitReason };
    const newEntry = existing
        ? { ...existing, 路由快照: snapshot }
        : { tick_id: tickId, 拍计数: state._tick.拍计数, 结果摘要: '', 系数组指纹: state._tick.难度系数组指纹, 路由快照: snapshot };
    const newLog = existing
        ? state._系统.tick_log.map(e => e.tick_id === tickId ? newEntry : e)
        : [...state._系统.tick_log, newEntry];
    return { decision, updatedState: { ...state, _系统: { ...state._系统, tick_log: newLog } } };
}
// ── N-2: 重放冻结路由 ─────────────────────────────────────────────────────────
// Reads the route frozen at tick assembly time. Caller must NOT read live state.
// Returns null for pre-N-1 entries (no 路由快照 field) — caller falls back to re-routing.
export function replayRoute(entry) {
    const snap = entry.路由快照;
    if (!snap)
        return null;
    return { routedVia: snap.routedVia, modelKey: snap.modelKey, explicitReason: snap.explicitReason };
}
