// C2 混沌猴不变量检查器 — 六条不变量（I1~I6）
// 状态对象可序列化（Map/Set 在 checkpoint 接口中展开为数组）

// ── 类型定义 ─────────────────────────────────────────────────────────────────

export type InvariantId = 'I1' | 'I2' | 'I3' | 'I4' | 'I5' | 'I6';

/** 路由记录（随首次写入冻结；序列化安全） */
export interface RouteRecord {
  readonly routedVia: string;
  readonly modelKey: string | null;
  readonly explicitReason: string;
  readonly generation: string;
}

/** 不变量违反报告（含最小可复现种子+拍号） */
export interface InvariantViolation {
  readonly invariant: InvariantId;
  readonly seed: number;
  readonly tick: number;
  readonly detail: string;
}

/** 不变量状态（在 harness 中跨拍累积） */
export interface InvariantState {
  /** key = `${generation}:${tickId}` → 该世代内首次冻结的路由 */
  routeRegistry: Map<string, RouteRecord>;
  /** 世代历史（单调递增·fork 时 append） */
  genHistory: string[];
  /** 当前世代号 */
  currentGeneration: string;
  /** I5 结账标记集（只增不减） */
  settledMarks: Set<string>;
}

export function makeInvariantState(initialGen = 'gen-0'): InvariantState {
  return {
    routeRegistry: new Map(),
    genHistory: [initialGen],
    currentGeneration: initialGen,
    settledMarks: new Set(),
  };
}

// ── I1: 单写（single writer）──────────────────────────────────────────────────
// 同一世代内，同一 tickId 只能写入一次路由；后续写入必须与首次完全相同。
export function assertI1(
  state: InvariantState,
  tickId: string,
  route: Omit<RouteRecord, 'generation'>,
  seed: number,
  tick: number,
): InvariantViolation | null {
  const key = `${state.currentGeneration}:${tickId}`;
  const rec: RouteRecord = { ...route, generation: state.currentGeneration };
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
export function assertI2(
  prevSize: number,
  currentSize: number,
  seed: number,
  tick: number,
): InvariantViolation | null {
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
export function assertI3(
  state: InvariantState,
  tickId: string,
  route: Omit<RouteRecord, 'generation'>,
  seed: number,
  tick: number,
): InvariantViolation | null {
  const key = `${state.currentGeneration}:${tickId}`;
  const existing = state.routeRegistry.get(key);
  if (!existing) return null; // 尚未写入，I1 负责首次写入
  if (
    existing.routedVia !== route.routedVia ||
    existing.modelKey !== route.modelKey ||
    existing.explicitReason !== route.explicitReason
  ) {
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
export function assertI4(
  state: InvariantState,
  newGeneration: string,
  seed: number,
  tick: number,
): InvariantViolation | null {
  if (newGeneration === state.currentGeneration) return null;
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
export function assertI5Add(state: InvariantState, markKey: string): void {
  state.settledMarks.add(markKey);
}

export function assertI5Monotone(
  prevSize: number,
  state: InvariantState,
  seed: number,
  tick: number,
): InvariantViolation | null {
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
export function assertI6(
  computeA: () => string,
  computeB: () => string,
  seed: number,
  tick: number,
): InvariantViolation | null {
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
