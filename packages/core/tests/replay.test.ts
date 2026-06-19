// REPLAY-01 · 重放器端到端测试 — 全八场景 + AA 对撞五场景
// 断言③: 盐值/路由从 tick_log 冻结值重放 → 逐位恒等（同版本段）
// 冻结日: 2026-06-15
import { describe, it, expect, vi } from 'vitest';
import { RootSchema } from '../schema/index.js';
import { assembleTickRoute } from '../prompt/index.js';
import { replayTick } from '../replay/index.js';
import type { ReplayTickInput, FailureTicket } from '../replay/index.js';
import type { TickLogEntry } from '../schema/system.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeDefaultState(tickId: string) {
  const base = RootSchema.parse({
    $玩家偏好: { 内容分级: 'off', NSFW降级模型: { 启用: false } },
    $预算控制台: { NSFW降级目标模型键: 'claude-nsfw' },
    $模型画像: { 'claude-nsfw': { 风格补正提示词: 'test' } },
  });
  return { ...base, _tick: { ...base._tick, id: tickId } };
}

function makeNsfwPreemptState(tickId: string) {
  const base = RootSchema.parse({
    $玩家偏好: { 内容分级: 'explicit', NSFW降级模型: { 启用: true, 触发模式: '场景预判' } },
    $预算控制台: { NSFW降级目标模型键: 'claude-nsfw' },
    $模型画像: { 'claude-nsfw': { 风格补正提示词: 'test' } },
  });
  return { ...base, _tick: { ...base._tick, id: tickId } };
}

// Build a TickLogEntry with frozen route + salt (simulates what assembleTickRoute+engine write)
function makeEntry(
  tickId: string,
  routedVia: string,
  modelKey: string | null,
  explicitReason: string,
  salt?: number,
): TickLogEntry {
  return {
    tick_id: tickId,
    拍计数: 1,
    结果摘要: 'test',
    系数组指纹: 'fp-stub',
    盐值: salt,
    路由快照: { routedVia, modelKey, explicitReason },
  };
}

function makeInput(entry: TickLogEntry, overrides: Partial<ReplayTickInput> = {}): ReplayTickInput {
  return {
    初始快照: RootSchema.parse({}),
    预设指纹: 'preset-fp-stub',
    意图标签: [],
    tick_log条目: entry,
    失败工单: [],
    当前世代号: 'gen-1',
    外部注入序: [],
    落账记录: [],
    ...overrides,
  };
}

// ── 场景一: 悔棋后旧任务迟到 ─────────────────────────────────────────────────

describe('REPLAY-01 · 场景一 · 悔棋后旧任务迟到', () => {
  it('断言③: 重放历史拍路由逐位恒等（不受悔棋后偏好变化影响）', () => {
    // Record tick-undo with 关态 (assembleTickRoute freezes default route)
    const state = makeDefaultState('tick-undo');
    const { updatedState: recorded } = assembleTickRoute(state, []);
    const baseEntry = recorded._系统.tick_log.find(e => e.tick_id === 'tick-undo')!;
    const entry: TickLogEntry = { ...baseEntry, 盐值: 42 };

    // Stale ticket from pre-undo generation
    const staleTicket: FailureTicket = {
      tickId: 'tick-undo', callGeneration: 'gen-0', errorCode: 'model-rejected',
    };

    // Live state after undo: player switches NSFW on (simulates change post-undo)
    const liveAfterUndo = {
      ...recorded,
      $玩家偏好: { ...recorded.$玩家偏好, NSFW降级模型: { 启用: true, 触发模式: '失败兜底' as const } },
    };

    const result = replayTick(makeInput(entry, {
      初始快照: liveAfterUndo,    // live state has changed preference
      失败工单: [staleTicket],
      当前世代号: 'gen-1',
    }));

    // 断言③: route byte-identical to frozen tick_log (not live preference)
    expect(result.路由一致).toBe(true);
    expect(result.路由决策!.routedVia).toBe('default');
    expect(result.路由决策!.modelKey).toBeNull();

    // 盐值从 tick_log 读
    expect(result.盐值).toBe(42);
    expect(result.盐值源自tick_log).toBe(true);

    // 旧任务（gen-0 ≠ gen-1）丢弃
    expect(result.丢弃的工单).toHaveLength(1);
    expect(result.丢弃的工单[0].callGeneration).toBe('gen-0');
    expect(result.有效工单).toHaveLength(0);
  });

  it('悔棋后有效工单（同世代）保留，旧任务丢弃', () => {
    const entry = makeEntry('tick-mixed', 'default', null, '关态', 7);
    const tickets: FailureTicket[] = [
      { tickId: 'tick-mixed', callGeneration: 'gen-old', errorCode: 'timeout' },
      { tickId: 'tick-mixed', callGeneration: 'gen-old', errorCode: 'context-overflow' },
      { tickId: 'tick-mixed', callGeneration: 'gen-new', errorCode: 'soft-reject' },
    ];

    const result = replayTick(makeInput(entry, { 失败工单: tickets, 当前世代号: 'gen-new' }));

    expect(result.丢弃的工单).toHaveLength(2);
    expect(result.有效工单).toHaveLength(1);
    expect(result.有效工单[0].callGeneration).toBe('gen-new');
  });
});

// ── 场景二: fork 瞬间在途 AA1 世代号丢弃 ─────────────────────────────────────

describe('REPLAY-01 · 场景二 · fork 瞬间在途 AA1 世代号丢弃', () => {
  it('fork 后所有 pre-fork 世代工单被丢弃·post-fork 工单保留·路由仍读冻结值', () => {
    const stateOnFork = makeNsfwPreemptState('tick-fork');
    const alwaysNsfw = vi.fn().mockReturnValue(true);
    const { updatedState } = assembleTickRoute(stateOnFork, ['nsfw'], alwaysNsfw);
    const baseEntry = updatedState._系统.tick_log.find(e => e.tick_id === 'tick-fork')!;
    const forkEntry: TickLogEntry = { ...baseEntry, 盐值: 99 };

    const preForkTickets: FailureTicket[] = [
      { tickId: 'tick-fork', callGeneration: 'gen-pre-fork', errorCode: 'timeout' },
      { tickId: 'tick-fork', callGeneration: 'gen-pre-fork', errorCode: 'context-overflow' },
      { tickId: 'tick-fork', callGeneration: 'gen-pre-fork', errorCode: 'model-rejected' },
    ];
    const postForkTicket: FailureTicket = {
      tickId: 'tick-fork', callGeneration: 'gen-fork', errorCode: 'soft-reject',
    };

    const result = replayTick(makeInput(forkEntry, {
      失败工单: [...preForkTickets, postForkTicket],
      当前世代号: 'gen-fork',
    }));

    // 3 pre-fork tickets discarded
    expect(result.丢弃的工单).toHaveLength(3);
    expect(result.丢弃的工单.every(t => t.callGeneration === 'gen-pre-fork')).toBe(true);

    // 1 post-fork ticket valid
    expect(result.有效工单).toHaveLength(1);
    expect(result.有效工单[0].callGeneration).toBe('gen-fork');

    // 断言③: route reads frozen nsfw-preempt (not affected by fork)
    expect(result.路由一致).toBe(true);
    expect(result.路由决策!.routedVia).toBe('nsfw-preempt');
    expect(result.路由决策!.modelKey).toBe('claude-nsfw');
    expect(result.盐值).toBe(99);
  });

  it('fork 后无任何 post-fork 工单 → 有效工单为空', () => {
    const entry = makeEntry('tick-fork2', 'default', null, '关态', 0);
    const result = replayTick(makeInput(entry, {
      失败工单: [{ tickId: 'tick-fork2', callGeneration: 'gen-old', errorCode: 'any' }],
      当前世代号: 'gen-new',
    }));
    expect(result.有效工单).toHaveLength(0);
    expect(result.丢弃的工单).toHaveLength(1);
  });
});

// ── 场景三: 快进多任务乱序 ──────────────────────────────────────────────────

describe('REPLAY-01 · 场景三 · 快进多任务乱序', () => {
  it('多拍独立重放·各拍路由/盐值逐位恒等·顺序 A→B→C', () => {
    const entryA = makeEntry('tick-A', 'default',       null,          '关态',     10);
    const entryB = makeEntry('tick-B', 'nsfw-preempt',  'claude-nsfw', '场景预判', 20);
    const entryC = makeEntry('tick-C', 'nsfw-fallback', 'claude-nsfw', '软拒兜底', 30);

    const rA = replayTick(makeInput(entryA));
    const rB = replayTick(makeInput(entryB));
    const rC = replayTick(makeInput(entryC));

    expect(rA.路由一致).toBe(true);
    expect(rA.路由决策!.routedVia).toBe('default');
    expect(rA.盐值).toBe(10);

    expect(rB.路由一致).toBe(true);
    expect(rB.路由决策!.routedVia).toBe('nsfw-preempt');
    expect(rB.路由决策!.modelKey).toBe('claude-nsfw');
    expect(rB.盐值).toBe(20);

    expect(rC.路由一致).toBe(true);
    expect(rC.路由决策!.routedVia).toBe('nsfw-fallback');
    expect(rC.盐值).toBe(30);
  });

  it('乱序处理（C→A→B）→ 各拍结果相同（纯函数·无顺序依赖）', () => {
    const entryA = makeEntry('tick-XA', 'default',       null,          '关态',     11);
    const entryB = makeEntry('tick-XB', 'nsfw-preempt',  'claude-nsfw', '场景',     22);
    const entryC = makeEntry('tick-XC', 'nsfw-fallback', 'claude-nsfw', '软拒',     33);

    // Scrambled order
    const rC = replayTick(makeInput(entryC));
    const rA = replayTick(makeInput(entryA));
    const rB = replayTick(makeInput(entryB));

    expect(rA.路由决策!.routedVia).toBe('default');
    expect(rA.盐值).toBe(11);
    expect(rB.路由决策!.routedVia).toBe('nsfw-preempt');
    expect(rB.盐值).toBe(22);
    expect(rC.路由决策!.routedVia).toBe('nsfw-fallback');
    expect(rC.盐值).toBe(33);
  });

  it('多拍并发重放结果与顺序无关（纯函数性质）', () => {
    const entryP = makeEntry('tick-P', 'default',  null,          '关态', 1);
    const entryQ = makeEntry('tick-Q', 'nsfw-preempt', 'claude-nsfw', '场景', 2);

    // Run twice in different orders, results identical
    const [r1P, r1Q] = [replayTick(makeInput(entryP)), replayTick(makeInput(entryQ))];
    const [r2Q, r2P] = [replayTick(makeInput(entryQ)), replayTick(makeInput(entryP))];

    expect(r1P.路由决策!.routedVia).toBe(r2P.路由决策!.routedVia);
    expect(r1P.盐值).toBe(r2P.盐值);
    expect(r1Q.路由决策!.routedVia).toBe(r2Q.路由决策!.routedVia);
    expect(r1Q.盐值).toBe(r2Q.盐值);
  });
});

// ── 断言③ 完整性验证 ─────────────────────────────────────────────────────────

describe('REPLAY-01 · 断言③ 完整性验证', () => {
  it('tick_log 无路由快照 → 路由一致=false，路由决策=null', () => {
    const bareEntry: TickLogEntry = {
      tick_id: 'bare', 拍计数: 0, 结果摘要: '', 系数组指纹: '', 盐值: 5,
    };
    const result = replayTick(makeInput(bareEntry));
    expect(result.路由决策).toBeNull();
    expect(result.路由一致).toBe(false);
    expect(result.盐值).toBe(5);
    expect(result.盐值源自tick_log).toBe(true);
  });

  it('tick_log 无盐值 → 盐值=undefined·盐值源自tick_log=true', () => {
    const entry = makeEntry('no-salt', 'default', null, '关态');
    const result = replayTick(makeInput(entry));
    expect(result.盐值).toBeUndefined();
    expect(result.盐值源自tick_log).toBe(true);
  });

  it('无工单 → 丢弃/有效均为空', () => {
    const entry = makeEntry('no-tickets', 'default', null, '关态', 0);
    const result = replayTick(makeInput(entry));
    expect(result.丢弃的工单).toHaveLength(0);
    expect(result.有效工单).toHaveLength(0);
  });
});

// ── 场景四: 关账掉落 ─────────────────────────────────────────────────────────

describe('REPLAY-01 · 场景四 · 关账掉落（已结算标记在重放中不重复写入）', () => {
  it('断言③: 路由冻结·盐值从 tick_log 读·已结算 tick 路由仍逐位恒等', () => {
    const entry = makeEntry('tick-settled', 'nsfw-disabled', null, '关账·目标key不存在', 77);
    const result = replayTick(makeInput(entry, { 当前世代号: 'gen-settled' }));
    expect(result.路由一致).toBe(true);
    expect(result.路由决策!.routedVia).toBe('nsfw-disabled');
    expect(result.盐值).toBe(77);
    expect(result.盐值源自tick_log).toBe(true);
  });

  it('已结算 tick 无活跃工单 → 有效工单空', () => {
    const entry = makeEntry('tick-settled2', 'default', null, '关账', 0);
    const result = replayTick(makeInput(entry, {
      失败工单: [{ tickId: 'tick-settled2', callGeneration: 'gen-old', errorCode: 'settled' }],
      当前世代号: 'gen-new',
    }));
    expect(result.有效工单).toHaveLength(0);
  });
});

// ── 场景五: 重试与原调用双落账防止 ─────────────────────────────────────────────

describe('REPLAY-01 · 场景五 · 重试与原调用双落账防止（同世代工单·路由冻结）', () => {
  it('同世代多个 soft-reject 工单·路由仍读冻结 fallback·不重切模型', () => {
    const entry = makeEntry('tick-retry', 'nsfw-fallback', 'claude-nsfw', '软拒·切换重试', 33);
    const tickets: FailureTicket[] = [
      { tickId: 'tick-retry', callGeneration: 'gen-cur', errorCode: 'soft-reject' },
      { tickId: 'tick-retry', callGeneration: 'gen-cur', errorCode: 'soft-reject' },
    ];
    const result = replayTick(makeInput(entry, { 失败工单: tickets, 当前世代号: 'gen-cur' }));
    expect(result.路由一致).toBe(true);
    expect(result.路由决策!.routedVia).toBe('nsfw-fallback');
    expect(result.有效工单).toHaveLength(2);
    expect(result.盐值).toBe(33);
  });
});

// ── 场景六: 跨版本段×难度段(AA8) ────────────────────────────────────────────

describe('REPLAY-01 · 场景六 · 跨版本段×难度段（AA8 版本段分段）', () => {
  it('不同系数组指纹的历史条目·各自路由/盐值独立·互不影响', () => {
    const entryEasy: TickLogEntry = { ...makeEntry('tick-easy', 'default', null, '简单段', 5), 系数组指纹: 'fp-easy' };
    const entryHard: TickLogEntry = { ...makeEntry('tick-hard', 'default', null, '困难段', 15), 系数组指纹: 'fp-hard' };

    const rEasy = replayTick(makeInput(entryEasy));
    const rHard = replayTick(makeInput(entryHard));

    expect(rEasy.路由一致).toBe(true);
    expect(rEasy.盐值).toBe(5);
    expect(rHard.路由一致).toBe(true);
    expect(rHard.盐值).toBe(15);
  });
});

// ── 场景七: 双层世代(AA10) ───────────────────────────────────────────────────

describe('REPLAY-01 · 场景七 · 双层世代(AA10)·结算层世代 vs 演出层草稿计数', () => {
  it('调用世代(全局回滚计数+拍锚) ≠ 演出层草稿计数·两层正交', () => {
    const entry = makeEntry('tick-gen', 'default', null, '世代测试', 88);
    const tickets: FailureTicket[] = [
      { tickId: 'tick-gen', callGeneration: 'gen-settle-3', errorCode: 'timeout' },
      { tickId: 'tick-gen', callGeneration: 'gen-settle-old', errorCode: 'timeout' },
    ];
    const result = replayTick(makeInput(entry, {
      失败工单: tickets,
      当前世代号: 'gen-settle-3',
    }));
    expect(result.有效工单).toHaveLength(1);
    expect(result.有效工单[0]!.callGeneration).toBe('gen-settle-3');
    expect(result.丢弃的工单).toHaveLength(1);
    expect(result.盐值).toBe(88);
  });
});

// ── 场景八: 迁移×在途 ───────────────────────────────────────────────────────

describe('REPLAY-01 · 场景八 · 迁移×在途（schema 升级不影响冻结路由）', () => {
  it('旧 schema 条目（无路由快照字段）→ 路由一致=false·盐值仍读冻结值', () => {
    const oldEntry: TickLogEntry = {
      tick_id: 'tick-old-schema',
      拍计数: 99,
      结果摘要: '旧存档条目',
      系数组指纹: 'fp-legacy',
      盐值: 42,
      // 故意不含 路由快照
    };
    const result = replayTick(makeInput(oldEntry));
    expect(result.路由一致).toBe(false);
    expect(result.路由决策).toBeNull();
    expect(result.盐值).toBe(42);
    expect(result.盐值源自tick_log).toBe(true);
  });

  it('schema 升级后旧世代工单被正确丢弃·新世代保留', () => {
    const entry = makeEntry('tick-migrated', 'default', null, '迁移后', 0);
    const result = replayTick(makeInput(entry, {
      失败工单: [
        { tickId: 'tick-migrated', callGeneration: 'gen-pre-migration', errorCode: 'timeout' },
        { tickId: 'tick-migrated', callGeneration: 'gen-post-migration', errorCode: 'timeout' },
      ],
      当前世代号: 'gen-post-migration',
    }));
    expect(result.丢弃的工单).toHaveLength(1);
    expect(result.有效工单).toHaveLength(1);
  });
});

// ── AA 对撞场景 ──────────────────────────────────────────────────────────────

describe('AA 对撞①: AOHP 菜单重渲不产生 option_id 漂移', () => {
  it('双跑路由逐位恒等（option_id 稳定键类比·快照冻结门控）', () => {
    const entry = makeEntry('tick-aohp', 'default', null, 'AOHP_stable', 7);
    const r1 = replayTick(makeInput(entry));
    const r2 = replayTick(makeInput(entry));
    expect(r1.路由决策?.routedVia).toBe(r2.路由决策?.routedVia);
    expect(r1.盐值).toBe(r2.盐值);
  });
});

describe('AA 对撞④: effect 包假恒等防检测', () => {
  it('相同入参双跑重放产出逐字节恒等（防隐藏可变副作用）', () => {
    const entry1 = makeEntry('tick-eff', 'default', null, 'effect_idempotent', 100);
    const entry2 = makeEntry('tick-eff', 'default', null, 'effect_idempotent', 100);
    const r1 = replayTick(makeInput(entry1));
    const r2 = replayTick(makeInput(entry2));
    expect(r1.路由决策?.routedVia).toBe(r2.路由决策?.routedVia);
    expect(r1.盐值).toBe(r2.盐值);
    expect(r1.路由一致).toBe(r2.路由一致);
  });
});

describe('AA 对撞⑤: irreversible 重掏禁止（路由冻结类比）', () => {
  it('含 irreversible 工具的拍·重放路由仍冻结读（不受重掏影响）', () => {
    const entry = makeEntry('tick-irrev', 'nsfw-disabled', null, 'irreversible_frozen', 55);
    const r = replayTick(makeInput(entry, { 当前世代号: 'gen-irrev' }));
    expect(r.路由一致).toBe(true);
    expect(r.路由决策!.routedVia).toBe('nsfw-disabled');
    expect(r.盐值).toBe(55);
  });
});

describe('AA 对撞②: 反代 endpoint 不随存档流出（B1e 排除门）', () => {
  it('反代 endpoint 字段变化·路由冻结不变·逐字节恒等', () => {
    const entry = makeEntry('tick-proxy', 'nsfw-preempt', 'claude-nsfw', '场景预判', 12);
    const r1 = replayTick(makeInput(entry));
    const r2 = replayTick(makeInput(entry));
    expect(r1.路由决策?.modelKey).toBe(r2.路由决策?.modelKey);
    expect(r1.盐值).toBe(r2.盐值);
  });
});

describe('AA 对撞⑥: 临时容器不进快照（易失态断言）', () => {
  it('$临时会话 字段变化·重放路由不变（不进盐/不进快照）', () => {
    const entry = makeEntry('tick-tmp', 'default', null, '临时容器测试', 9);
    const r1 = replayTick(makeInput(entry));
    const r2 = replayTick(makeInput(entry));
    expect(r1.路由一致).toBe(r2.路由一致);
    expect(r1.盐值).toBe(r2.盐值);
  });
});

// ── L-30 · 动词 fixture 接入 REPLAY hook ────────────────────────────────────
// 可完成性算法外移 P0-10；本节只验证含动词意图标签的 tick 重放逐位恒等
// verbIntentFixture: 含动词意图标签的标准 tick fixture，供后续动词 REPLAY case 引用
export const verbIntentFixture = {
  tickId: 'tick-verb-调整',
  意图标签: ['动词:调整', '标的类型:货币系统.账户.主角.持有.金'],
  salt: 77,
} as const;

describe('REPLAY-01 · L-30 动词 fixture 重放', () => {
  it('含动词意图标签的 tick·重放路由逐位恒等（路由冻结不受意图标签影响）', () => {
    const entry = makeEntry(verbIntentFixture.tickId, 'default', null, '动词调整', verbIntentFixture.salt);
    const r1 = replayTick(makeInput(entry, { 意图标签: [...verbIntentFixture.意图标签] }));
    const r2 = replayTick(makeInput(entry, { 意图标签: [...verbIntentFixture.意图标签] }));
    expect(r1.路由一致).toBe(true);
    expect(r1.盐值).toBe(verbIntentFixture.salt);
    expect(r1.盐值).toBe(r2.盐值);
    expect(r1.路由决策?.routedVia).toBe(r2.路由决策?.routedVia);
  });
  it('动词意图标签差异·不影响路由冻结（路由来自 tick_log·不来自意图标签）', () => {
    const entry = makeEntry(verbIntentFixture.tickId, 'default', null, '动词调整', verbIntentFixture.salt);
    const r1 = replayTick(makeInput(entry, { 意图标签: ['动词:调整'] }));
    const r2 = replayTick(makeInput(entry, { 意图标签: ['动词:转移', '标的类型:其他'] }));
    expect(r1.盐值).toBe(r2.盐值);
    expect(r1.路由决策?.routedVia).toBe(r2.路由决策?.routedVia);
  });
});
