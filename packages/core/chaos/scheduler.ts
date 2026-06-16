// C2 混沌猴事件调度器 — 纯函数，零副作用，零 Math.random
// 相同 seed → 相同事件序列（跨机器逐位恒等）
import * as prand from 'pure-rand';

// ── 事件类型 ─────────────────────────────────────────────────────────────────

/** 混沌事件源（5 原生 + 5 对撞批） */
export type EventKind =
  | 'swipe-storm'          // N-1 路由冻结压测：同拍多次 swipe，断言路由恒等
  | 'meta-write'           // F1 指令组边界写入 + I5 结账标记
  | 'failure-inject'       // N-4 软拒注入（模拟 LLM 软拒响应）
  | 'fork'                 // AA1 世代号递进（I4 单调性）
  | 'dropout'              // F3 超时/掉线切换
  | 'aohp-render'          // 对撞① AOHP 菜单重渲·option_id 漂移压测
  | 'effect-inject'        // 对撞④ effect 包注入·假恒等检测
  | 'irreversible-call'    // 对撞⑤ irreversible 工具调用·冻结载荷门控
  | 'proxy-check'          // 对撞② 反代端点变更·指纹排除门控
  | 'tmp-snapshot-check';  // 对撞⑥ 临时容器状态·不进快照断言

export interface ScheduledEvent {
  readonly tick: number;
  readonly kind: EventKind;
  /** 本事件的参数种子（确定性子随机，由调用方解释） */
  readonly payload: number;
}

// ── 权重表（总和 = 100）────────────────────────────────────────────────────────

const KINDS_WEIGHTS: ReadonlyArray<readonly [EventKind, number]> = [
  ['swipe-storm',         24],
  ['meta-write',          20],
  ['failure-inject',      16],
  ['fork',                 8],
  ['dropout',             12],
  ['aohp-render',          5],
  ['effect-inject',        5],
  ['irreversible-call',    4],
  ['proxy-check',          3],
  ['tmp-snapshot-check',   3],
] as const;

const TOTAL_WEIGHT = 100; // must equal sum of KINDS_WEIGHTS weights

function pickKind(roll: number): EventKind {
  let acc = 0;
  for (const [kind, w] of KINDS_WEIGHTS) {
    acc += w;
    if (roll < acc) return kind;
  }
  return 'dropout';
}

// ── 公开 API ─────────────────────────────────────────────────────────────────

export interface SchedulerOptions {
  readonly totalTicks: number;
  readonly maxEventsPerTick: number; // 每拍最多生成的事件数（均匀分布 [0, max]）
  readonly seed: number;
}

/**
 * 生成确定性事件序列。
 * 相同 seed → 相同输出（pure-rand xorshift128+，无平台随机源）。
 * 事件按 tick 升序排列。
 */
export function scheduleEvents(opts: SchedulerOptions): ReadonlyArray<ScheduledEvent> {
  const { totalTicks, maxEventsPerTick, seed } = opts;
  const rng = prand.xorshift128plus(seed >>> 0);
  const events: ScheduledEvent[] = [];

  for (let tick = 0; tick < totalTicks; tick++) {
    const count = prand.unsafeUniformIntDistribution(0, maxEventsPerTick, rng);
    for (let i = 0; i < count; i++) {
      const kindRoll = prand.unsafeUniformIntDistribution(0, TOTAL_WEIGHT - 1, rng);
      const kind = pickKind(kindRoll);
      const payload = prand.unsafeUniformIntDistribution(0, 0x7fffffff, rng);
      events.push({ tick, kind, payload });
    }
  }

  return events;
}
