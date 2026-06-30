// C2 混沌猴不变量检查器 — 六条不变量（I1~I6）
// 状态对象可序列化（Map/Set 在 checkpoint 接口中展开为数组）
export function makeInvariantState(initialGen = 'gen-0') {
    return {
        routeRegistry: new Map(),
        genHistory: [initialGen],
        currentGeneration: initialGen,
        settledMarks: new Set(),
    };
}
// ── I1: 单写（single writer）──────────────────────────────────────────────────
// 同一世代内，同一 tickId 只能写入一次路由；后续写入必须与首次完全相同。
export function assertI1(state, tickId, route, seed, tick) {
    const key = `${state.currentGeneration}:${tickId}`;
    const rec = { ...route, generation: state.currentGeneration };
    const existing = state.routeRegistry.get(key);
    if (!existing) {
        state.routeRegistry.set(key, rec);
        return null;
    }
    if (existing.routedVia !== rec.routedVia || existing.modelKey !== rec.modelKey) {
        return {
            invariant: 'I1',
            seed,
            tick,
            detail: `单写违反: tickId=${tickId} gen=${state.currentGeneration} ` +
                `已有=${existing.routedVia} 新写=${rec.routedVia}`,
        };
    }
    return null;
}
// ── I2: 账本守恒（ledger conservation）──────────────────────────────────────
// routeRegistry 只增不减；注册表大小严格单调不减。
export function assertI2(prevSize, currentSize, seed, tick) {
    if (currentSize < prevSize) {
        return {
            invariant: 'I2',
            seed,
            tick,
            detail: `账本守恒违反: 注册表从 ${prevSize} 缩到 ${currentSize}`,
        };
    }
    return null;
}
// ── I3: 路由冻结（route freeze = N-1）────────────────────────────────────────
// 同拍多次读取已冻结路由，三字段逐字节恒等。
export function assertI3(state, tickId, route, seed, tick) {
    const key = `${state.currentGeneration}:${tickId}`;
    const existing = state.routeRegistry.get(key);
    if (!existing)
        return null; // 尚未写入，I1 负责首次写入
    if (existing.routedVia !== route.routedVia ||
        existing.modelKey !== route.modelKey ||
        existing.explicitReason !== route.explicitReason) {
        return {
            invariant: 'I3',
            seed,
            tick,
            detail: `路由冻结违反: tickId=${tickId} 冻结=${existing.routedVia} 返回=${route.routedVia}`,
        };
    }
    return null;
}
// ── I4: 世代单调（generation monotonicity = AA1）──────────────────────────────
// 世代号只能向前递进（fork），不能回退到历史世代。
export function assertI4(state, newGeneration, seed, tick) {
    if (newGeneration === state.currentGeneration)
        return null;
    // 检查是否回退到历史世代
    if (state.genHistory.includes(newGeneration)) {
        return {
            invariant: 'I4',
            seed,
            tick,
            detail: `世代单调违反: 回退到 ${newGeneration}（历史: ${state.genHistory.join('->')}）`,
        };
    }
    state.genHistory.push(newGeneration);
    state.currentGeneration = newGeneration;
    return null;
}
// ── I5: 结账一致（close-account consistency）──────────────────────────────────
// 结账标记集只增不减；标记一旦写入不得移除。
export function assertI5Add(state, markKey) {
    state.settledMarks.add(markKey);
}
export function assertI5Monotone(prevSize, state, seed, tick) {
    if (state.settledMarks.size < prevSize) {
        return {
            invariant: 'I5',
            seed,
            tick,
            detail: `结账标记缩减: ${prevSize} → ${state.settledMarks.size}`,
        };
    }
    return null;
}
// ── I6: 指纹可重放（fingerprint replayability）────────────────────────────────
// hashPresetFingerprint 是纯函数：相同输入两次调用输出逐位恒等。
export function assertI6(computeA, computeB, seed, tick) {
    const a = computeA();
    const b = computeB();
    if (a !== b) {
        return {
            invariant: 'I6',
            seed,
            tick,
            detail: `指纹非确定性: ${a} ≠ ${b}`,
        };
    }
    return null;
}
