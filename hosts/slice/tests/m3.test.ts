// M3 存档/悔棋/重放最小闭环
// ① 存读往返（正常 + 坏校验和→拒载·fail-closed）
// ② 悔棋后重放：tick_log 冻结盐值→逐位恒等（同一拍重放=原结果）
// ③ live 偏好改动不漂移路由（N-2·悔棋/重放期间改 NSFW 开关·旧拍路由不变）
// ④ 关账态门规：非空闲态写盘被拒
// 测试剧本：拍6（悔棋）+ 拍7（关账存档→整段重放逐位恒等）
import { describe, it, expect } from 'vitest';
import {
  SnapshotRingBuffer,
  computeChecksum,
  serializeArchive,
  deserializeArchive,
  assertClosedAccount,
  RING_K,
} from '../engine/snapshot.js';
import type { SliceSnapshot, SliceTickLog, TickLifecycleState } from '../engine/snapshot.js';
import { rewindTick } from '../engine/rewind.js';
import { createArchiveHeader } from '../engine/archive.js';
import { initBalances, snapshotBalances } from '../ledger/state.js';
import { runD20Check } from '../engine/check.js';
import { RootSchema } from '@ai-life-sim/core';
import { replayTick } from '@ai-life-sim/core/replay';
import type { ReplayTickInput } from '@ai-life-sim/core/replay';

const SEED        = 42;
const RECIPE_KEY  = 'chk_persuade_credit';
const ATTR_BONUS  = 6;
const DC          = 12;

// ── ① 存读往返 ────────────────────────────────────────────────────────────────

describe('M3 ① 存读往返', () => {
  const snap: SliceSnapshot = {
    tick: 5,
    balances: { pc_linjiu: 28, npc_wang: 200, npc_hong: 2 },
    tick_log: [],
    observationTable: [],
    pendingQueue: [],
  };

  it('正常往返：序列化→反序列化→快照主体一致', () => {
    const raw    = serializeArchive(snap);
    const loaded = deserializeArchive(raw);
    expect(loaded.tick).toBe(5);
    expect(loaded.balances).toEqual(snap.balances);
    expect(loaded.tick_log).toEqual([]);
  });

  it('坏校验和→拒载并报错（fail-closed·不崩不静默）', () => {
    const raw    = serializeArchive(snap);
    const parsed = JSON.parse(raw) as { checksum: string; body: SliceSnapshot };
    parsed.checksum = 'deadbeef';
    expect(() => deserializeArchive(JSON.stringify(parsed))).toThrow('存档校验和不符');
  });

  it('格式非法（无 checksum）→拒载', () => {
    expect(() => deserializeArchive('{"body":{}}')).toThrow('存档格式非法');
  });

  it('格式非法（无 body）→拒载', () => {
    expect(() => deserializeArchive('{"checksum":"abc"}')).toThrow('存档格式非法');
  });

  it('非 JSON 字符串→拒载', () => {
    expect(() => deserializeArchive('not-json')).toThrow('存档解析失败');
  });

  it('null→拒载', () => {
    expect(() => deserializeArchive('null')).toThrow('存档格式非法');
  });

  it('校验和双跑恒等（canonicalize 键序稳定·防假阳性）', () => {
    const c1 = computeChecksum(snap);
    const c2 = computeChecksum(snap);
    expect(c1).toBe(c2);
    expect(c1).toHaveLength(8); // FNV-1a 8位hex
  });

  it('快照体任意字段变化→校验和不同', () => {
    const snap2: SliceSnapshot = { ...snap, tick: 99 };
    const snap3: SliceSnapshot = {
      ...snap,
      balances: { ...snap.balances, npc_wang: 999 },
    };
    expect(computeChecksum(snap)).not.toBe(computeChecksum(snap2));
    expect(computeChecksum(snap)).not.toBe(computeChecksum(snap3));
  });

  it('键序不同但内容相同→校验和相同（canonicalize 防键序漂移）', () => {
    // canonicalize 对键排序，两种构造顺序应产生同一校验和
    const a: SliceSnapshot = {
      tick: 1, balances: { b_entity: 10, a_entity: 20 },
      tick_log: [], observationTable: [], pendingQueue: [],
    };
    const b: SliceSnapshot = {
      tick: 1, balances: { a_entity: 20, b_entity: 10 },
      tick_log: [], observationTable: [], pendingQueue: [],
    };
    expect(computeChecksum(a)).toBe(computeChecksum(b));
  });

  it('tick_log 内含路由快照→正常往返', () => {
    const snapWithLog: SliceSnapshot = {
      tick: 3,
      balances: { pc: 10 },
      tick_log: [{
        tick_id: 'tick-03', 拍计数: 3, 结果摘要: '检定', 系数组指纹: '',
        盐值: 7,
        路由快照: { routedVia: 'default', modelKey: null, explicitReason: '关态' },
      }],
      observationTable: [],
      pendingQueue: [],
    };
    const loaded = deserializeArchive(serializeArchive(snapWithLog));
    const entry  = loaded.tick_log[0];
    expect(entry?.路由快照?.routedVia).toBe('default');
    expect(entry?.盐值).toBe(7);
  });
});

// ── Ring Buffer ────────────────────────────────────────────────────────────────

describe('M3 Ring Buffer（容量 K）', () => {
  const makeSnap = (t: number): SliceSnapshot => ({
    tick: t, balances: {}, tick_log: [], observationTable: [], pendingQueue: [],
  });

  it(`默认容量 RING_K=${RING_K}`, () => {
    const ring = new SnapshotRingBuffer();
    for (let i = 1; i <= RING_K + 1; i++) ring.push(makeSnap(i));
    expect(ring.size).toBe(RING_K);
    expect(ring.get(0)!.tick).toBe(2);          // 1 被淘汰
    expect(ring.getLast()!.tick).toBe(RING_K + 1);
  });

  it('容量 K=3：超出后淘汰最旧', () => {
    const ring = new SnapshotRingBuffer(3);
    ring.push(makeSnap(10)); ring.push(makeSnap(20)); ring.push(makeSnap(30));
    expect(ring.size).toBe(3);
    ring.push(makeSnap(40));
    expect(ring.size).toBe(3);
    expect(ring.get(0)!.tick).toBe(20);
    expect(ring.get(1)!.tick).toBe(30);
    expect(ring.getLast()!.tick).toBe(40);
  });

  it('空 ring → get() / getLast() 返回 undefined', () => {
    const ring = new SnapshotRingBuffer();
    expect(ring.size).toBe(0);
    expect(ring.get(0)).toBeUndefined();
    expect(ring.getLast()).toBeUndefined();
  });

  it('all() 返回只读顺序快照列表', () => {
    const ring = new SnapshotRingBuffer(3);
    ring.push(makeSnap(1)); ring.push(makeSnap(2));
    expect(ring.all().map(s => s.tick)).toEqual([1, 2]);
  });
});

// ── ④ 关账态门规 ──────────────────────────────────────────────────────────────

describe('M3 ④ 关账态门规', () => {
  it.each([
    '结算中', '等待呈现', '等待选择', '关账中',
  ] as TickLifecycleState[])('非关账态"%s"→assertClosedAccount 抛出', (state) => {
    expect(() => assertClosedAccount(state)).toThrow('关账态门规');
  });

  it('"空闲"→assertClosedAccount 通过（不抛出）', () => {
    expect(() => assertClosedAccount('空闲')).not.toThrow();
  });

  it('非空闲态写盘被拒·快照不落入 ring（原子保护）', () => {
    const ring = new SnapshotRingBuffer();
    const snap: SliceSnapshot = {
      tick: 3, balances: {}, tick_log: [], observationTable: [], pendingQueue: [],
    };

    // 模拟半拍中间态写盘被拒
    const attemptWrite = (state: TickLifecycleState) => {
      assertClosedAccount(state);  // throws if not 空闲
      ring.push(snap);             // 永远不到达
    };

    expect(() => attemptWrite('结算中')).toThrow('关账态门规');
    expect(ring.size).toBe(0);    // ring 未被写入

    // 只有 空闲 才写入成功
    expect(() => attemptWrite('空闲')).not.toThrow();
    expect(ring.size).toBe(1);
  });
});

// ── 拍6 悔棋剧本 ──────────────────────────────────────────────────────────────

describe('M3 拍6 悔棋剧本', () => {
  it('② 悔棋后重放：冻结盐值→D20 结果逐位恒等', () => {
    const header0  = createArchiveHeader(SEED);   // 全局回滚计数器 = 0
    const balances = initBalances({ pc_linjiu: 30, npc_wang: 200 });
    const ring     = new SnapshotRingBuffer();
    const tickLog: SliceTickLog[] = [];

    // 拍6 前·关账态→写入拍前快照
    assertClosedAccount('空闲');
    ring.push({
      tick: 6,
      balances:         snapshotBalances(balances),
      tick_log:         [...tickLog],
      observationTable: [],
      pendingQueue:     [],
    });

    // 运行拍6（D20 检定）
    const check6 = runD20Check(SEED, 6, RECIPE_KEY, ATTR_BONUS, DC, header0);
    tickLog.push({
      tick_id:    'tick-m3-06',
      拍计数:     6,
      结果摘要:   `检定: ${check6.success ? '成功' : '失败'}`,
      系数组指纹: '',
      盐值:       check6.salt,   // = header0.全局回滚计数器 = 0
    });

    // 悔棋：回滚到拍6前快照，全局回滚计数器 +1（不还原）
    const rewound = rewindTick(ring, ring.size - 1, header0);
    expect(rewound.header.全局回滚计数器).toBe(1);          // 计数器 +1
    expect(rewound.tick).toBe(6);                            // 恢复到拍6
    expect(Object.fromEntries(rewound.balances)).toEqual(
      { pc_linjiu: 30, npc_wang: 200 },                     // 账本回滚
    );
    expect(rewound.tick_log).toHaveLength(0);                // tick_log 回到拍6前

    // 重放拍6（replayTick 从 tick_log 冻结盐值读·不读 live 全局回滚计数器）
    const entry6 = tickLog[0]!;
    const replayInput: ReplayTickInput = {
      初始快照:  RootSchema.parse({}),
      预设指纹:  '',
      意图标签:  [],
      tick_log条目: entry6,
      失败工单:  [],
      当前世代号: 'gen-1',
      外部注入序: [],
      落账记录:  [],
    };
    const replayResult = replayTick(replayInput);

    // 断言：盐值从 tick_log 读（=0），非悔棋后的 live 计数器（=1）
    expect(replayResult.盐值).toBe(check6.salt);     // frozen = 0
    expect(replayResult.盐值).not.toBe(rewound.header.全局回滚计数器); // ≠ 1
    expect(replayResult.盐值源自tick_log).toBe(true);

    // 使用冻结盐值重跑 D20→逐位恒等
    const frozenHeader = { seed: SEED, 全局回滚计数器: replayResult.盐值! };
    const check6Replay = runD20Check(SEED, 6, RECIPE_KEY, ATTR_BONUS, DC, frozenHeader);
    expect(check6Replay.rawU).toBe(check6.rawU);
    expect(check6Replay.diceRoll).toBe(check6.diceRoll);
    expect(check6Replay.success).toBe(check6.success);
  });

  it('③ live NSFW 偏好变动不漂移路由（N-2）', () => {
    // 已有冻结路由快照的 tick_log 条目（routedVia=default）
    const entry6: SliceTickLog = {
      tick_id: 'tick-m3-06-route', 拍计数: 6, 结果摘要: 'test', 系数组指纹: '',
      盐值: 5,
      路由快照: { routedVia: 'default', modelKey: null, explicitReason: '关态·默认路由' },
    };

    // 悔棋后玩家改成"场景预判"NSFW（live 偏好变化）
    const liveState = RootSchema.parse({
      $玩家偏好: {
        内容分级: 'explicit',
        NSFW降级模型: { 启用: true, 触发模式: '场景预判' },
      },
      $预算控制台: { NSFW降级目标模型键: 'claude-nsfw' },
      $模型画像: { 'claude-nsfw': { 风格补正提示词: 'test' } },
    });

    const result = replayTick({
      初始快照:  liveState,      // live 状态已改偏好
      预设指纹:  '',
      意图标签:  [],
      tick_log条目: entry6,      // 冻结路由=default
      失败工单:  [],
      当前世代号: 'gen-1',
      外部注入序: [],
      落账记录:  [],
    });

    // 路由读冻结值·不读 live 偏好（N-2 保证）
    expect(result.路由一致).toBe(true);
    expect(result.路由决策!.routedVia).toBe('default');
    expect(result.路由决策!.modelKey).toBeNull();
    expect(result.盐值).toBe(5);
  });

  it('全局回滚计数器永不随悔棋还原（骰子农场防护·多次悔棋累积）', () => {
    const header = createArchiveHeader(SEED);
    const ring   = new SnapshotRingBuffer();
    const makeSnap = (): SliceSnapshot => ({
      tick: 6, balances: {}, tick_log: [], observationTable: [], pendingQueue: [],
    });

    ring.push(makeSnap());
    const rw1 = rewindTick(ring, 0, header);
    expect(rw1.header.全局回滚计数器).toBe(1);

    ring.push(makeSnap());
    const rw2 = rewindTick(ring, ring.size - 1, rw1.header);
    expect(rw2.header.全局回滚计数器).toBe(2);  // 累积不回滚

    ring.push(makeSnap());
    const rw3 = rewindTick(ring, ring.size - 1, rw2.header);
    expect(rw3.header.全局回滚计数器).toBe(3);  // 继续累积
  });

  it('悔棋索引越界→throw（不静默）', () => {
    const ring   = new SnapshotRingBuffer();
    const header = createArchiveHeader(SEED);
    expect(() => rewindTick(ring, 0, header)).toThrow('悔棋索引越界');
    expect(() => rewindTick(ring, -1, header)).toThrow('悔棋索引越界');
  });

  it('悔棋后账本精确恢复（多实体）', () => {
    const header = createArchiveHeader(SEED);
    const ring   = new SnapshotRingBuffer();
    const originalBalances = { pc_linjiu: 30, npc_wang: 200, npc_hong: 5 };
    ring.push({
      tick: 6, balances: originalBalances,
      tick_log: [], observationTable: [], pendingQueue: [],
    });

    // 模拟拍6 执行了转账
    const rw = rewindTick(ring, 0, header);
    expect(rw.balances.get('pc_linjiu')).toBe(30);
    expect(rw.balances.get('npc_wang')).toBe(200);
    expect(rw.balances.get('npc_hong')).toBe(5);
  });
});

// ── 拍7 关账存档→整段重放逐位恒等 ────────────────────────────────────────────

describe('M3 拍7 关账存档→整段重放', () => {
  it('拍7 关账存档往返 + D20 结果逐位恒等', () => {
    const header  = createArchiveHeader(SEED);
    const balances = initBalances({ pc_linjiu: 28, npc_wang: 200 });
    const ring    = new SnapshotRingBuffer();
    const tickLog: SliceTickLog[] = [];

    // 拍6 已完成，累积一条 tick_log
    tickLog.push({
      tick_id: 'tick-m3-06', 拍计数: 6, 结果摘要: '拍6完成',
      系数组指纹: '', 盐值: 0,
    });

    // 拍7 前·关账态→写拍前快照
    assertClosedAccount('空闲');
    ring.push({
      tick: 7,
      balances:         snapshotBalances(balances),
      tick_log:         [...tickLog],
      observationTable: [],
      pendingQueue:     [],
    });

    // 运行拍7
    const check7 = runD20Check(SEED, 7, RECIPE_KEY, ATTR_BONUS, DC, header);
    tickLog.push({
      tick_id:    'tick-m3-07',
      拍计数:     7,
      结果摘要:   `检定: ${check7.success ? '成功' : '失败'}`,
      系数组指纹: '',
      盐值:       check7.salt,
    });

    // 拍7 关账存档（关账态）
    assertClosedAccount('空闲');
    const finalSnap: SliceSnapshot = {
      tick: 7,
      balances:         snapshotBalances(balances),
      tick_log:         [...tickLog],
      observationTable: [],
      pendingQueue:     [],
    };
    const archived = serializeArchive(finalSnap);

    // 读取存档·校验和通过
    const loaded = deserializeArchive(archived);
    expect(loaded.tick).toBe(7);
    expect(loaded.tick_log).toHaveLength(2);
    expect(loaded.balances).toEqual(snapshotBalances(balances));

    // 重放拍7（读冻结盐值）
    const entry7 = loaded.tick_log.find(e => e.tick_id === 'tick-m3-07')!;
    const replayResult = replayTick({
      初始快照:  RootSchema.parse({}),
      预设指纹:  '',
      意图标签:  [],
      tick_log条目: entry7,
      失败工单:  [],
      当前世代号: 'gen-1',
      外部注入序: [],
      落账记录:  [],
    });
    expect(replayResult.盐值).toBe(check7.salt);
    expect(replayResult.盐值源自tick_log).toBe(true);

    // 冻结盐值→D20 逐位恒等
    const frozenHeader = { seed: SEED, 全局回滚计数器: replayResult.盐值! };
    const check7Replay = runD20Check(SEED, 7, RECIPE_KEY, ATTR_BONUS, DC, frozenHeader);
    expect(check7Replay.rawU).toBe(check7.rawU);
    expect(check7Replay.diceRoll).toBe(check7.diceRoll);
    expect(check7Replay.success).toBe(check7.success);
  });

  it('整段重放·拍6 + 拍7 各自逐位恒等', () => {
    const header = createArchiveHeader(SEED);

    const check6 = runD20Check(SEED, 6, RECIPE_KEY, ATTR_BONUS, DC, header);
    const check7 = runD20Check(SEED, 7, RECIPE_KEY, ATTR_BONUS, DC, header);

    const entry6: SliceTickLog = {
      tick_id: 'tick-seg-06', 拍计数: 6, 结果摘要: '', 系数组指纹: '', 盐值: check6.salt,
      路由快照: { routedVia: 'default', modelKey: null, explicitReason: '关态' },
    };
    const entry7: SliceTickLog = {
      tick_id: 'tick-seg-07', 拍计数: 7, 结果摘要: '', 系数组指纹: '', 盐值: check7.salt,
      路由快照: { routedVia: 'default', modelKey: null, explicitReason: '关态' },
    };

    const r6 = replayTick({
      初始快照: RootSchema.parse({}), 预设指纹: '', 意图标签: [],
      tick_log条目: entry6, 失败工单: [], 当前世代号: 'gen-1',
      外部注入序: [], 落账记录: [],
    });
    const r7 = replayTick({
      初始快照: RootSchema.parse({}), 预设指纹: '', 意图标签: [],
      tick_log条目: entry7, 失败工单: [], 当前世代号: 'gen-1',
      外部注入序: [], 落账记录: [],
    });

    // 两拍路由均一致
    expect(r6.路由一致).toBe(true);
    expect(r7.路由一致).toBe(true);

    // 拍6 逐位恒等
    const h6 = { seed: SEED, 全局回滚计数器: r6.盐值! };
    const rep6 = runD20Check(SEED, 6, RECIPE_KEY, ATTR_BONUS, DC, h6);
    expect(rep6.rawU).toBe(check6.rawU);
    expect(rep6.diceRoll).toBe(check6.diceRoll);

    // 拍7 逐位恒等
    const h7 = { seed: SEED, 全局回滚计数器: r7.盐值! };
    const rep7 = runD20Check(SEED, 7, RECIPE_KEY, ATTR_BONUS, DC, h7);
    expect(rep7.rawU).toBe(check7.rawU);
    expect(rep7.diceRoll).toBe(check7.diceRoll);
  });

  it('坏存档校验和→拒载·不崩（整段重放保护）', () => {
    const snap: SliceSnapshot = {
      tick: 7,
      balances: { pc_linjiu: 28 },
      tick_log: [
        { tick_id: 'tick-m3-07', 拍计数: 7, 结果摘要: '', 系数组指纹: '', 盐值: 0 },
      ],
      observationTable: [],
      pendingQueue: [],
    };
    const raw    = serializeArchive(snap);
    const parsed = JSON.parse(raw) as { checksum: string; body: SliceSnapshot };
    parsed.checksum = '00000000';  // 故意破坏
    expect(() => deserializeArchive(JSON.stringify(parsed))).toThrow('存档校验和不符');
  });
});
