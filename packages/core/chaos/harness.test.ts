// C2 混沌猴万拍 harness — 闸二第 6 轮
// 10000 拍确定性运行；六条不变量每拍校验；检查点存取；确定性门控；黄金向量
//
// 禁: Math.random / Math.{pow,sqrt} / localeCompare / JSON.stringify(裸) / Date 墙钟
// LLM 调用全部 mock：harness 只编排现有 API，不发起真实 LLM 请求
import { describe, it, expect } from 'vitest';
import * as prand from 'pure-rand';
import { scheduleEvents } from './scheduler.js';
import type { EventKind, ScheduledEvent } from './scheduler.js';
import {
  makeInvariantState,
  assertI1, assertI2, assertI3, assertI4, assertI5Add, assertI5Monotone, assertI6,
} from './invariants.js';
import type { InvariantViolation, RouteRecord } from './invariants.js';
import { RootSchema } from '../schema/index.js';
import type { RootState } from '../schema/index.js';
import { assembleTickRoute } from '../prompt/index.js';
import { hashPresetFingerprint } from '../engine/rng.js';
import { canonicalize } from '../engine/text/canonicalize.js';

// ── 常量 ────────────────────────────────────────────────────────────────────

const TOTAL_TICKS = 10_000;
const MAX_EVENTS_PER_TICK = 3;

// 黄金向量 — 首次 pnpm test 后用实际值替换
// 格式: fnv1a32(canonicalize(runDigest(seed))) → 8 位 hex
// 黄金向量更新: 对撞批 5 事件类型加入调度器权重表后重新锁定
const GOLDEN_SEED_1 = '5c1d0233';
const GOLDEN_SEED_2 = '63b3e729';
const GOLDEN_SEED_3 = 'db10d5c7';

// ── 本地 FNV-1a 32（禁止引入外部哈希库·符合六禁）────────────────────────────

function fnv1a32hex(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// ── Checkpoint（可序列化）──────────────────────────────────────────────────

interface HarnessCheckpoint {
  genCounter: number;
  currentGeneration: string;
  genHistory: string[];
  routeRegistryEntries: Array<[string, RouteRecord]>; // sorted
  settledMarksArr: string[];                           // sorted
  eventCounts: Record<EventKind, number>;
  violations: InvariantViolation[];
}

interface HarnessRunResult {
  checkpoint: HarnessCheckpoint;
  totalEvents: number;
  /** fnv1a32(canonicalize(sorted routeRegistry entries)) */
  routeChecksum: string;
}

// ── 基底状态（每拍重置 _tick；tick_log 在 assembleTickRoute 时生成） ──────────

const BASE_STATE: RootState = RootSchema.parse({
  $玩家偏好: { 内容分级: 'off', NSFW降级模型: { 启用: false } },
});

function makeTickState(tickId: string, tick: number): RootState {
  // 每拍使用 fresh tick_log=[] 避免跨拍 O(n²) 增长；
  // 拍内多次 assembleTickRoute 通过 updatedState 传递 tick_log（N-1 冻结）
  return {
    ...BASE_STATE,
    _tick: { id: tickId, 拍计数: tick, 难度系数组指纹: '' },
  };
}

// ── 核心 harness 运行函数 ────────────────────────────────────────────────────

function runHarness(
  seed: number,
  startTick: number,
  endTick: number,
  resumeFrom?: HarnessCheckpoint,
): HarnessRunResult {
  // 恢复或初始化状态
  let genCounter = resumeFrom?.genCounter ?? 0;
  const invState = makeInvariantState(resumeFrom?.currentGeneration ?? 'gen-0');
  if (resumeFrom) {
    for (const [k, v] of resumeFrom.routeRegistryEntries) invState.routeRegistry.set(k, v);
    invState.genHistory.splice(0, invState.genHistory.length, ...resumeFrom.genHistory);
    for (const m of resumeFrom.settledMarksArr) invState.settledMarks.add(m);
  }

  const eventCounts: Record<EventKind, number> = resumeFrom
    ? { ...resumeFrom.eventCounts }
    : { 'swipe-storm': 0, 'meta-write': 0, 'failure-inject': 0, 'fork': 0, 'dropout': 0,
        'aohp-render': 0, 'effect-inject': 0, 'irreversible-call': 0, 'proxy-check': 0, 'tmp-snapshot-check': 0 };

  const violations: InvariantViolation[] = resumeFrom ? [...resumeFrom.violations] : [];

  // 预生成 0..endTick 全部事件（startTick 前的跳过）
  const allEvents = scheduleEvents({ totalTicks: endTick, maxEventsPerTick: MAX_EVENTS_PER_TICK, seed });

  // 按拍分组（避免每拍 O(n) filter）
  const eventsByTick = new Map<number, ScheduledEvent[]>();
  for (const ev of allEvents) {
    if (ev.tick < startTick) continue;
    const arr = eventsByTick.get(ev.tick);
    if (arr) arr.push(ev);
    else eventsByTick.set(ev.tick, [ev]);
  }

  let totalEvents = resumeFrom ? Object.values(resumeFrom.eventCounts).reduce((a, b) => a + b, 0) : 0;
  let prevRegistrySize = invState.routeRegistry.size;
  let prevSettledSize = invState.settledMarks.size;

  // fingerprint 参数模板（I6 确定性检验用）
  const fpSnap = {
    难度系数组: {} as unknown,
    判定骰型: 100 as const,
    暴击映射: '关' as const,
    钳制表: {} as unknown,
    预设数值面域上下界: [] as unknown,
  };

  for (let tick = startTick; tick < endTick; tick++) {
    const tickId = `tick-${tick}`;
    let tickState = makeTickState(tickId, tick);
    const tickEvents = eventsByTick.get(tick) ?? [];
    totalEvents += tickEvents.length;

    for (const event of tickEvents) {
      eventCounts[event.kind]++;

      switch (event.kind) {
        case 'swipe-storm': {
          // N-1: 首次调用写入路由快照；第二次调用读冻结值（场景检测器只跑一次）
          const { decision: d1, updatedState: s1 } = assembleTickRoute(tickState, []);
          tickState = s1;
          const { decision: d2 } = assembleTickRoute(tickState, []);

          // I1: 首次写入注册表（后续写入须与首次恒等）
          const route: Omit<RouteRecord, 'generation'> = {
            routedVia: d1.routedVia,
            modelKey: d1.modelKey,
            explicitReason: d1.explicitReason,
          };
          const v1 = assertI1(invState, tickId, route, seed, tick);
          if (v1) violations.push(v1);

          // I3: 第二次 swipe 返回值与冻结值逐字节恒等
          const route2: Omit<RouteRecord, 'generation'> = {
            routedVia: d2.routedVia,
            modelKey: d2.modelKey,
            explicitReason: d2.explicitReason,
          };
          const v3 = assertI3(invState, tickId, route2, seed, tick);
          if (v3) violations.push(v3);
          break;
        }

        case 'meta-write': {
          // I5: 写入结账标记（只增不减）
          assertI5Add(invState, `${tick}:meta-${event.payload}`);
          break;
        }

        case 'failure-inject': {
          // N-4 模拟注入：payload 决定注入类型（harness 不调用真实 LLM）
          // 不产生不变量状态变化；event.payload 已被调度器确定性生成
          break;
        }

        case 'fork': {
          // AA1: 世代号向前递进（I4 单调性）
          genCounter++;
          const newGen = `gen-${genCounter}`;
          const v4 = assertI4(invState, newGen, seed, tick);
          if (v4) violations.push(v4);
          break;
        }

        case 'dropout': {
          // F3: 超时/掉线（本层不改变不变量状态）
          break;
        }

        case 'aohp-render': {
          // 对撞① AOHP 菜单重渲·option_id 漂移压测（stub·接线 P0-6）
          break;
        }

        case 'effect-inject': {
          // 对撞④ effect 包注入·假恒等检测（stub·接线 P0-6）
          break;
        }

        case 'irreversible-call': {
          // 对撞⑤ irreversible 工具调用·冻结载荷门控（stub·接线 P0-6）
          break;
        }

        case 'proxy-check': {
          // 对撞② 反代端点变更·指纹排除门控（stub·接线 P0-6）
          break;
        }

        case 'tmp-snapshot-check': {
          // 对撞⑥ 临时容器状态·不进快照断言（stub·接线 P0-6）
          break;
        }
      }
    }

    // I2: 每拍末尾核查账本守恒
    const v2 = assertI2(prevRegistrySize, invState.routeRegistry.size, seed, tick);
    if (v2) violations.push(v2);
    prevRegistrySize = invState.routeRegistry.size;

    // I5: 每拍末尾核查结账标记单调性
    const v5 = assertI5Monotone(prevSettledSize, invState, seed, tick);
    if (v5) violations.push(v5);
    prevSettledSize = invState.settledMarks.size;

    // I6: 每 1000 拍核查指纹纯函数确定性（避免全拍校验拖慢测试）
    if (tick % 1000 === 0) {
      const fpArgs = { 判定面整包: `bundle-${seed}-${tick}`, 生效中内容包集哈希: '', snapshot: fpSnap };
      const v6 = assertI6(
        () => hashPresetFingerprint(fpArgs),
        () => hashPresetFingerprint(fpArgs),
        seed,
        tick,
      );
      if (v6) violations.push(v6);
    }
  }

  // 构建路由校验和（sorted → canonical → fnv1a32）
  const registryEntries = [...invState.routeRegistry.entries()];
  registryEntries.sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  const routeChecksum = fnv1a32hex(canonicalize(registryEntries));

  const settledMarksArr = [...invState.settledMarks];
  settledMarksArr.sort((a, b) => a < b ? -1 : a > b ? 1 : 0);

  return {
    checkpoint: {
      genCounter,
      currentGeneration: invState.currentGeneration,
      genHistory: [...invState.genHistory],
      routeRegistryEntries: registryEntries,
      settledMarksArr,
      eventCounts: { ...eventCounts },
      violations: [...violations],
    },
    totalEvents,
    routeChecksum,
  };
}

// ── 黄金向量计算 ─────────────────────────────────────────────────────────────

function computeGoldenHex(seed: number): string {
  const { checkpoint, routeChecksum } = runHarness(seed, 0, TOTAL_TICKS);
  const digest = {
    seed,
    routeChecksum,
    routeRegistrySize: checkpoint.routeRegistryEntries.length,
    finalGeneration: checkpoint.currentGeneration,
    totalViolations: checkpoint.violations.length,
  };
  return fnv1a32hex(canonicalize(digest));
}

// ── 事件分布辅助 ─────────────────────────────────────────────────────────────

function eventDistribution(counts: Record<EventKind, number>): string {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return Object.entries(counts)
    .map(([k, v]) => `${k}=${v}(${total > 0 ? ((v / total) * 100).toFixed(1) : '0'}%)`)
    .join(' ');
}

// ── 测试套件 ─────────────────────────────────────────────────────────────────

describe('C2 混沌猴 harness — 10000 拍确定性运行', () => {

  it('10000 拍连跑·六条不变量全部通过（seed=42）', () => {
    const { checkpoint } = runHarness(42, 0, TOTAL_TICKS);

    // 如有违反·打印最小可复现信息后 fail
    if (checkpoint.violations.length > 0) {
      const v = checkpoint.violations[0]!;
      throw new Error(
        `不变量 ${v.invariant} 在 seed=${v.seed} tick=${v.tick} 违反：${v.detail}`,
      );
    }

    expect(checkpoint.violations).toHaveLength(0);
    // 验证全部事件类型均有覆盖
    expect(checkpoint.eventCounts['swipe-storm']).toBeGreaterThan(0);
    expect(checkpoint.eventCounts['meta-write']).toBeGreaterThan(0);
    expect(checkpoint.eventCounts['failure-inject']).toBeGreaterThan(0);
    expect(checkpoint.eventCounts['fork']).toBeGreaterThan(0);
    expect(checkpoint.eventCounts['dropout']).toBeGreaterThan(0);
    expect(checkpoint.eventCounts['aohp-render']).toBeGreaterThan(0);
    expect(checkpoint.eventCounts['effect-inject']).toBeGreaterThan(0);
    expect(checkpoint.eventCounts['irreversible-call']).toBeGreaterThan(0);
    expect(checkpoint.eventCounts['proxy-check']).toBeGreaterThan(0);
    expect(checkpoint.eventCounts['tmp-snapshot-check']).toBeGreaterThan(0);
  });

  it('事件分布·十类事件权重符合预期（swipe≈24%·meta≈20%·fail≈16%·fork≈8%·drop≈12%）', () => {
    const { checkpoint } = runHarness(42, 0, TOTAL_TICKS);
    const counts = checkpoint.eventCounts;
    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    expect(total).toBeGreaterThan(0);

    const pct = (k: EventKind) => (counts[k] / total) * 100;

    // 各类比例在期望权重 ±5% 内（xorshift128+ 收敛速度快·10000 拍足够）
    expect(pct('swipe-storm')).toBeGreaterThan(19);
    expect(pct('swipe-storm')).toBeLessThan(29);
    expect(pct('meta-write')).toBeGreaterThan(15);
    expect(pct('meta-write')).toBeLessThan(25);
    expect(pct('failure-inject')).toBeGreaterThan(11);
    expect(pct('failure-inject')).toBeLessThan(21);
    expect(pct('fork')).toBeGreaterThan(3);
    expect(pct('fork')).toBeLessThan(13);
    expect(pct('dropout')).toBeGreaterThan(7);
    expect(pct('dropout')).toBeLessThan(17);
    // 五个对撞批事件（权重各 3-5%）
    expect(pct('aohp-render')).toBeGreaterThan(0);
    expect(pct('effect-inject')).toBeGreaterThan(0);
    expect(pct('irreversible-call')).toBeGreaterThan(0);
    expect(pct('proxy-check')).toBeGreaterThan(0);
    expect(pct('tmp-snapshot-check')).toBeGreaterThan(0);

    // 打印分布（方便 CI log 追踪）
    console.info('[chaos] 事件分布:', eventDistribution(counts));
  });

  it('检查点存取·从 5000 拍中途恢复·最终校验和与全量跑一致', () => {
    // 完整跑
    const fullRun = runHarness(42, 0, TOTAL_TICKS);

    // 跑到 5000 拍截止，导出检查点
    const partialRun = runHarness(42, 0, TOTAL_TICKS / 2);
    const cp = partialRun.checkpoint;

    // 从检查点恢复，继续跑 5000→10000
    const resumedRun = runHarness(42, TOTAL_TICKS / 2, TOTAL_TICKS, cp);

    // 最终路由校验和与全量跑逐位恒等
    expect(resumedRun.routeChecksum).toBe(fullRun.routeChecksum);
    // 无新增违反
    expect(resumedRun.checkpoint.violations).toHaveLength(fullRun.checkpoint.violations.length);
    // 路由注册表大小一致
    expect(resumedRun.checkpoint.routeRegistryEntries.length)
      .toBe(fullRun.checkpoint.routeRegistryEntries.length);
  });

  it('检查点可序列化·round-trip 后状态恒等', () => {
    const { checkpoint: cp } = runHarness(1, 0, 100);
    // 模拟序列化/反序列化（canonicalize → JSON.parse — 在 canonicalize 内部，已符合六禁）
    const serialized = canonicalize(cp);
    const restored = JSON.parse(serialized) as HarnessCheckpoint;

    // round-trip 后继续跑剩余拍，结果与未中断的全量跑一致
    const fullRun = runHarness(1, 0, 200);
    const resumedRun = runHarness(1, 100, 200, restored);

    expect(resumedRun.routeChecksum).toBe(fullRun.routeChecksum);
  });

  it('确定性门控·同种子双跑·routeChecksum 逐位恒等', () => {
    const r1 = runHarness(42, 0, TOTAL_TICKS);
    const r2 = runHarness(42, 0, TOTAL_TICKS);
    expect(r1.routeChecksum).toBe(r2.routeChecksum);
    // canonicalize(checkpoint) 也逐位恒等
    expect(canonicalize(r1.checkpoint)).toBe(canonicalize(r2.checkpoint));
  });

  it('确定性门控·不同种子产生不同 routeChecksum', () => {
    const r1 = runHarness(1, 0, TOTAL_TICKS);
    const r2 = runHarness(2, 0, TOTAL_TICKS);
    const r3 = runHarness(3, 0, TOTAL_TICKS);
    expect(r1.routeChecksum).not.toBe(r2.routeChecksum);
    expect(r2.routeChecksum).not.toBe(r3.routeChecksum);
    expect(r1.routeChecksum).not.toBe(r3.routeChecksum);
  });

  it('黄金向量·种子 1/2/3 hex 值固定（RNG 序列锁定回归门）', () => {
    const g1 = computeGoldenHex(1);
    const g2 = computeGoldenHex(2);
    const g3 = computeGoldenHex(3);
    // 如果这里 fail，说明 scheduleEvents / assembleTickRoute / hashPresetFingerprint
    // 的输出发生了变化 — 需要审计变更后更新黄金值
    expect(g1).toBe(GOLDEN_SEED_1);
    expect(g2).toBe(GOLDEN_SEED_2);
    expect(g3).toBe(GOLDEN_SEED_3);
  });

  it('I1 单写·同拍两次 swipe 路由一致·注册表无冲突条目', () => {
    // 专项验证：10 拍内全部打 swipe-storm，检查 I1 无违反
    // 手动构造调度序列（不用 scheduleEvents，直接打桩）
    const invState = makeInvariantState();
    const violations: InvariantViolation[] = [];

    for (let tick = 0; tick < 10; tick++) {
      const tickId = `tick-${tick}`;
      let tickState = makeTickState(tickId, tick);

      const { decision: d1, updatedState: s1 } = assembleTickRoute(tickState, []);
      tickState = s1;
      const { decision: d2 } = assembleTickRoute(tickState, []);

      const route: Omit<RouteRecord, 'generation'> = {
        routedVia: d1.routedVia, modelKey: d1.modelKey, explicitReason: d1.explicitReason,
      };
      const v1 = assertI1(invState, tickId, route, 0, tick);
      if (v1) violations.push(v1);

      // d1 和 d2 必须完全相同（N-1 冻结）
      expect(d1.routedVia).toBe(d2.routedVia);
      expect(d1.modelKey).toBe(d2.modelKey);
      expect(d1.explicitReason).toBe(d2.explicitReason);
    }

    expect(violations).toHaveLength(0);
    expect(invState.routeRegistry.size).toBe(10);
  });

  it('I4 世代单调·fork 序列只向前递增·不回退', () => {
    const invState = makeInvariantState('gen-0');
    const violations: InvariantViolation[] = [];

    // 正向 fork: gen-0 → gen-1 → gen-2 → gen-3
    for (let i = 1; i <= 3; i++) {
      const v = assertI4(invState, `gen-${i}`, 0, i);
      if (v) violations.push(v);
    }
    expect(violations).toHaveLength(0);
    expect(invState.currentGeneration).toBe('gen-3');

    // 尝试回退到 gen-1 → I4 违反
    const vReg = assertI4(invState, 'gen-1', 0, 99);
    expect(vReg).not.toBeNull();
    expect(vReg?.invariant).toBe('I4');
  });

  it('I2 账本守恒·注册表只增不减·shrink 立即报告违反', () => {
    // 正常增长：无违反
    expect(assertI2(0, 5, 0, 0)).toBeNull();
    expect(assertI2(5, 5, 0, 0)).toBeNull(); // 持平也 OK
    // 缩减：违反
    const v = assertI2(5, 4, 0, 0);
    expect(v).not.toBeNull();
    expect(v?.invariant).toBe('I2');
  });

  it('I6 指纹可重放·相同入参两次输出逐位恒等', () => {
    const fpArgs = {
      判定面整包: 'test-bundle',
      生效中内容包集哈希: 'hash-x',
      snapshot: {
        难度系数组: { attr: 1 } as unknown,
        判定骰型: 100 as const,
        暴击映射: '关' as const,
        钳制表: {} as unknown,
        预设数值面域上下界: [] as unknown,
      },
    };
    const v6 = assertI6(
      () => hashPresetFingerprint(fpArgs),
      () => hashPresetFingerprint(fpArgs),
      0, 0,
    );
    expect(v6).toBeNull(); // 无违反
  });

  // ── 调度器单元测试 ──────────────────────────────────────────────────────────

  it('scheduleEvents·相同 seed 两次调用逐位恒等', () => {
    const a = scheduleEvents({ totalTicks: 100, maxEventsPerTick: 3, seed: 7 });
    const b = scheduleEvents({ totalTicks: 100, maxEventsPerTick: 3, seed: 7 });
    expect(canonicalize(a)).toBe(canonicalize(b));
  });

  it('scheduleEvents·不同 seed 产生不同序列', () => {
    const a = scheduleEvents({ totalTicks: 100, maxEventsPerTick: 3, seed: 1 });
    const b = scheduleEvents({ totalTicks: 100, maxEventsPerTick: 3, seed: 2 });
    expect(canonicalize(a)).not.toBe(canonicalize(b));
  });

  it('scheduleEvents·事件 tick 字段有序递增（不降序）', () => {
    const events = scheduleEvents({ totalTicks: 50, maxEventsPerTick: 3, seed: 42 });
    let prev = -1;
    for (const ev of events) {
      expect(ev.tick).toBeGreaterThanOrEqual(prev);
      prev = ev.tick;
    }
  });

  it('scheduleEvents·所有 payload ≥ 0（正整数确定性子种子）', () => {
    const events = scheduleEvents({ totalTicks: 100, maxEventsPerTick: 3, seed: 99 });
    for (const ev of events) {
      expect(ev.payload).toBeGreaterThanOrEqual(0);
    }
  });

  it('scheduleEvents·maxEventsPerTick=0 → 空序列', () => {
    const events = scheduleEvents({ totalTicks: 100, maxEventsPerTick: 0, seed: 1 });
    expect(events).toHaveLength(0);
  });

  it('scheduleEvents·totalTicks=0 → 空序列', () => {
    const events = scheduleEvents({ totalTicks: 0, maxEventsPerTick: 3, seed: 1 });
    expect(events).toHaveLength(0);
  });
});
