// LOD-B5 · NPC LOD 迁移 round-trip + 三态真值表 + 双路径等价 + soak
//
// 验收门：
//   B5-0: backfillLodTableNpcState 迁移 round-trip（粗/实体各一 + 幂等 no-op + 无字段同引用）
//   B5-1: 老存档同含 LOD态(地图)+LOD档位(NPC) → 双段迁移·migration_version +2
//   B5-2: 三态真值表（undefined/粗/实体） — isCoarseNode / triggerLodGate / promoteNode NPC guard
//   B5-3: 双路径等价（triggerLodGate vs 直接 materializeCoarseNode + LOD表写入）
//   B5-4: soak ≥50 拍（promote→warmWindow→tryDemote no-op×3→expired demote→re-promote）
//   B5-5: 迁移往返幂等（JSON 逐位恒等·二次不再 bump version）
//
// 六禁：禁 Date.now/new Date/Math.random/window/document/localeCompare
// 红线：gate.ts/rng.ts/conservation.ts/computeDelta.ts/fixed.ts 函数体零 diff

import { describe, it, expect } from 'vitest';
import { RootSchema, NpcSchema } from '@ai-life-sim/core';
import type { RootState } from '@ai-life-sim/core';
import { backfillLodTableNpcState, backfillLodTableMapState } from '@ai-life-sim/core/migration/migrate';
import {
  materializeCoarseNode,
  triggerLodGate,
  isCoarseNode,
} from '@ai-life-sim/core/engine/lodEngine';
import {
  promoteNode,
  tryDemoteNode,
  startWarmWindow,
  LOD_WARM_WINDOW_DEFAULT,
} from '@ai-life-sim/core/engine/lodScheduler';

// ── 常量 ──────────────────────────────────────────────────────────────────────

const SEED = 42;
const NPC_KEY = 'npc_b5_test';
const NPC_KEY_2 = 'npc_b5_test_2';
const LOC_KEY = 'region_b5';

// ── fixture ───────────────────────────────────────────────────────────────────

/** 最小 raw 存档·含 NPC.LOD档位（迁移前形态） */
function makeRawWithLodField(
  npcKey: string,
  lodState: '粗' | '实体',
  migrationVersion = 0,
): Record<string, unknown> {
  return {
    NPC: {
      [npcKey]: { 姓名: '测试NPC', 位置: LOC_KEY, LOD档位: lodState },
    },
    LOD表: {},
    _系统: { migration_version: migrationVersion },
  };
}

/** 已迁移 raw（无 LOD档位）*/
function makeRawNoLodField(npcKey: string, migrationVersion = 1): Record<string, unknown> {
  return {
    NPC: {
      [npcKey]: { 姓名: '测试NPC', 位置: LOC_KEY },
    },
    LOD表: { [npcKey]: { 模块键: npcKey, 档位: '粗' } },
    _系统: { migration_version: migrationVersion },
  };
}

/** 构建 RootState 含一个地点节点 + 一个粗节点 NPC */
function makeLocState(): RootState {
  const s = RootSchema.parse({
    地图: {
      地点: {
        [LOC_KEY]: { 名称: 'B5区域', 类别: '区域级', 相邻: [] },
      },
    },
    NPC: {
      [NPC_KEY]: NpcSchema.parse({ 姓名: 'B5-NPC', 位置: LOC_KEY }),
    },
  }) as RootState;
  (s.LOD表 as Record<string, unknown>)[NPC_KEY] = { 模块键: NPC_KEY, 档位: '粗' };
  return s;
}

// ── B5-0 · backfillLodTableNpcState 迁移 round-trip ───────────────────────────

describe('B5-0 · backfillLodTableNpcState 迁移 round-trip', () => {
  it('NPC 粗态 round-trip：LOD档位=粗 → LOD表[k].档位=粗·NPC 无 LOD档位·version +1', () => {
    const raw = makeRawWithLodField(NPC_KEY, '粗', 10);
    const result = backfillLodTableNpcState(raw) as Record<string, unknown>;

    // LOD表 条目正确
    const lodTable = result['LOD表'] as Record<string, Record<string, unknown>>;
    expect(lodTable[NPC_KEY]).toBeDefined();
    expect(lodTable[NPC_KEY]!['档位']).toBe('粗');
    expect(lodTable[NPC_KEY]!['模块键']).toBe(NPC_KEY);

    // NPC 中 LOD档位 已删除（Option-B）
    const npcRec = result['NPC'] as Record<string, Record<string, unknown>>;
    expect('LOD档位' in npcRec[NPC_KEY]!).toBe(false);
    expect(npcRec[NPC_KEY]!['姓名']).toBe('测试NPC'); // 其他字段保留

    // migration_version +1
    expect(((result['_系统'] as Record<string, unknown>)['migration_version'])).toBe(11);
  });

  it('NPC 实体态 round-trip：LOD档位=实体 → LOD表[k].档位=实体·NPC 无 LOD档位·version +1', () => {
    const raw = makeRawWithLodField(NPC_KEY, '实体', 5);
    const result = backfillLodTableNpcState(raw) as Record<string, unknown>;

    const lodTable = result['LOD表'] as Record<string, Record<string, unknown>>;
    expect(lodTable[NPC_KEY]!['档位']).toBe('实体');

    const npcRec = result['NPC'] as Record<string, Record<string, unknown>>;
    expect('LOD档位' in npcRec[NPC_KEY]!).toBe(false);

    expect(((result['_系统'] as Record<string, unknown>)['migration_version'])).toBe(6);
  });

  it('二次迁移 no-op：JSON 逐位恒等·migration_version 不再 bump', () => {
    const raw = makeRawWithLodField(NPC_KEY, '粗', 0);
    const pass1 = backfillLodTableNpcState(raw) as Record<string, unknown>;
    const ver1 = (pass1['_系统'] as Record<string, unknown>)['migration_version'];
    expect(ver1).toBe(1);

    const pass2 = backfillLodTableNpcState(pass1) as Record<string, unknown>;
    const ver2 = (pass2['_系统'] as Record<string, unknown>)['migration_version'];
    expect(ver2).toBe(1); // 幂等：不再 bump

    expect(JSON.stringify(pass1)).toBe(JSON.stringify(pass2)); // 逐位恒等
  });

  it('无 LOD档位 字段 → 返回同引用 raw', () => {
    const raw = makeRawNoLodField(NPC_KEY);
    const result = backfillLodTableNpcState(raw);
    expect(result).toBe(raw); // 同引用 → 纯 no-op
  });

  it('NPC 记录为空 → 返回同引用 raw', () => {
    const raw: Record<string, unknown> = {
      NPC: {},
      LOD表: {},
      _系统: { migration_version: 3 },
    };
    const result = backfillLodTableNpcState(raw);
    expect(result).toBe(raw);
  });
});

// ── B5-1 · 老存档同含 LOD态+LOD档位 → 双段迁移·version +2 ──────────────────────

describe('B5-1 · 老存档双段迁移', () => {
  it('地图地点含 LOD态 + NPC含 LOD档位 → 顺序两段都跑·migration_version +2', () => {
    const raw: Record<string, unknown> = {
      地图: {
        地点: {
          [LOC_KEY]: { 名称: '老存档区域', LOD态: '实体', 保温到期拍号: 99 },
        },
      },
      NPC: {
        [NPC_KEY]: { 姓名: '老存档NPC', 位置: LOC_KEY, LOD档位: '粗' },
      },
      LOD表: {},
      _系统: { migration_version: 7 },
    };

    // 模拟生产管线：先 map 迁移·再 NPC 迁移
    const afterMap = backfillLodTableMapState(raw) as Record<string, unknown>;
    expect(((afterMap['_系统'] as Record<string, unknown>)['migration_version'])).toBe(8);

    const afterNpc = backfillLodTableNpcState(afterMap) as Record<string, unknown>;
    expect(((afterNpc['_系统'] as Record<string, unknown>)['migration_version'])).toBe(9);

    // 两段均写入 LOD表
    const lodTable = afterNpc['LOD表'] as Record<string, Record<string, unknown>>;
    expect(lodTable[LOC_KEY]!['档位']).toBe('实体');
    expect(lodTable[LOC_KEY]!['保温到期拍号']).toBe(99);
    expect(lodTable[NPC_KEY]!['档位']).toBe('粗');

    // NPC 中 LOD档位 已清除
    const npcRec = afterNpc['NPC'] as Record<string, Record<string, unknown>>;
    expect('LOD档位' in npcRec[NPC_KEY]!).toBe(false);

    // 地图地点散落字段已清除
    const locs = (afterNpc['地图'] as Record<string, unknown>)['地点'] as Record<string, Record<string, unknown>>;
    expect('LOD态' in locs[LOC_KEY]!).toBe(false);
    expect('保温到期拍号' in locs[LOC_KEY]!).toBe(false);
  });
});

// ── B5-2 · 三态真值表 ──────────────────────────────────────────────────────────
//
// LOD表[k] 三种状态对 isCoarseNode / triggerLodGate guard / promoteNode NPC guard 的行为：
//   undefined → isCoarse=false · triggerLodGate skip · promoteNode NPC skip
//   '粗'      → isCoarse=true  · triggerLodGate 物化 · promoteNode NPC 物化
//   '实体'    → isCoarse=false · triggerLodGate skip · promoteNode NPC skip

describe('B5-2 · 三态真值表', () => {
  // isCoarseNode
  it('isCoarseNode: LOD表[k]=undefined → false', () => {
    const s = makeLocState();
    delete (s.LOD表 as Record<string, unknown>)[NPC_KEY]; // 清除条目
    expect(isCoarseNode(s, NPC_KEY)).toBe(false);
  });

  it('isCoarseNode: LOD表[k].档位=粗 → true', () => {
    const s = makeLocState();
    // makeLocState 已设置 LOD表[NPC_KEY].档位='粗'
    expect(isCoarseNode(s, NPC_KEY)).toBe(true);
  });

  it('isCoarseNode: LOD表[k].档位=实体 → false', () => {
    const s = makeLocState();
    (s.LOD表 as Record<string, unknown>)[NPC_KEY] = { 模块键: NPC_KEY, 档位: '实体' };
    expect(isCoarseNode(s, NPC_KEY)).toBe(false);
  });

  // triggerLodGate guard
  it('triggerLodGate: LOD表[k]=undefined → skip（不物化·NPC 属性不变）', () => {
    const s = makeLocState();
    delete (s.LOD表 as Record<string, unknown>)[NPC_KEY];
    const attrBefore = { ...s.NPC[NPC_KEY]!.属性 };
    triggerLodGate(s, [NPC_KEY], SEED);
    // 属性未变（未物化）
    expect(s.NPC[NPC_KEY]!.属性.体质).toBe(attrBefore.体质);
    expect(s.LOD表[NPC_KEY]).toBeUndefined(); // 未写 LOD表
  });

  it('triggerLodGate: LOD表[k].档位=粗 → 物化·LOD表档位=实体', () => {
    const s = makeLocState();
    // NPC 属性在 materialize 前是 default（=0）
    expect(s.LOD表[NPC_KEY]?.档位).toBe('粗');
    triggerLodGate(s, [NPC_KEY], SEED);
    expect(s.LOD表[NPC_KEY]?.档位).toBe('实体');
    // 属性已被写入（非全零）
    const attr = s.NPC[NPC_KEY]!.属性;
    expect(attr.体质 + attr.智慧 + attr.感知 + attr.魅力 + attr.心理).toBeGreaterThan(0);
  });

  it('triggerLodGate: LOD表[k].档位=实体 → skip（不物化·LOD表不变）', () => {
    const s = makeLocState();
    (s.LOD表 as Record<string, unknown>)[NPC_KEY] = { 模块键: NPC_KEY, 档位: '实体' };
    const attrBefore = { ...s.NPC[NPC_KEY]!.属性 };
    triggerLodGate(s, [NPC_KEY], SEED);
    expect(s.LOD表[NPC_KEY]?.档位).toBe('实体');
    expect(s.NPC[NPC_KEY]!.属性.体质).toBe(attrBefore.体质); // 未变
  });

  // promoteNode NPC guard（通过 promoteNode 触发内层 NPC 物化）
  it('promoteNode NPC: LOD表[npcKey]=undefined → NPC 不物化（地点促升）', () => {
    const s = makeLocState();
    // 清除 NPC 的 LOD表条目（位置=LOC_KEY 仍在地图里）
    delete (s.LOD表 as Record<string, unknown>)[NPC_KEY];
    const attrBefore = { ...s.NPC[NPC_KEY]!.属性 };
    promoteNode(s, LOC_KEY, SEED); // 促升地点
    // NPC 属性未变（guard: LOD表[npcKey]?.档位 === '粗' → false for undefined）
    expect(s.NPC[NPC_KEY]!.属性.体质).toBe(attrBefore.体质);
    expect(s.LOD表[NPC_KEY]).toBeUndefined(); // NPC 条目未创建
  });

  it('promoteNode NPC: LOD表[npcKey].档位=粗 → 物化·LOD表[npcKey].档位=实体', () => {
    const s = makeLocState();
    // NPC 已有 LOD表[NPC_KEY].档位='粗'（makeLocState 设置）
    promoteNode(s, LOC_KEY, SEED);
    expect(s.LOD表[NPC_KEY]?.档位).toBe('实体');
    const attr = s.NPC[NPC_KEY]!.属性;
    expect(attr.体质 + attr.智慧 + attr.感知 + attr.魅力 + attr.心理).toBeGreaterThan(0);
  });

  it('promoteNode NPC: LOD表[npcKey].档位=实体 → skip（NPC 属性不重写）', () => {
    const s = makeLocState();
    // 先物化一次（设 NPC LOD表 = 实体 + 属性已有值）
    (s.LOD表 as Record<string, unknown>)[NPC_KEY] = { 模块键: NPC_KEY, 档位: '实体' };
    s.NPC[NPC_KEY]!.属性.体质 = 77; // 模拟已物化值
    promoteNode(s, LOC_KEY, SEED);
    // 不重写·仍为 77
    expect(s.NPC[NPC_KEY]!.属性.体质).toBe(77);
  });
});

// ── B5-3 · 双路径等价 ─────────────────────────────────────────────────────────
//
// Path A: 直接 materializeCoarseNode + 写 LOD表
// Path B: triggerLodGate（内部调用 materializeCoarseNode + 写 LOD表）
// 相同 seed + 相同 NPC 键 → 5 属性逐位恒等 + LOD表档位='实体'

describe('B5-3 · 双路径等价', () => {
  it('triggerLodGate vs 直接 materializeCoarseNode → 5 属性逐位恒等', () => {
    // Path A: direct
    const sA = makeLocState();
    materializeCoarseNode(sA, NPC_KEY, SEED);
    sA.LOD表[NPC_KEY]!.档位 = '实体';

    // Path B: via triggerLodGate
    const sB = makeLocState();
    triggerLodGate(sB, [NPC_KEY], SEED);

    // 两路径属性逐位恒等
    expect(sA.NPC[NPC_KEY]!.属性.体质).toBe(sB.NPC[NPC_KEY]!.属性.体质);
    expect(sA.NPC[NPC_KEY]!.属性.智慧).toBe(sB.NPC[NPC_KEY]!.属性.智慧);
    expect(sA.NPC[NPC_KEY]!.属性.感知).toBe(sB.NPC[NPC_KEY]!.属性.感知);
    expect(sA.NPC[NPC_KEY]!.属性.魅力).toBe(sB.NPC[NPC_KEY]!.属性.魅力);
    expect(sA.NPC[NPC_KEY]!.属性.心理).toBe(sB.NPC[NPC_KEY]!.属性.心理);

    // LOD表 档位均为实体
    expect(sA.LOD表[NPC_KEY]?.档位).toBe('实体');
    expect(sB.LOD表[NPC_KEY]?.档位).toBe('实体');
  });

  it('promoteNode vs triggerLodGate：NPC 属性逐位恒等·LOD表档位相同', () => {
    // promoteNode 内层物化 NPC（NPC位置=LOC_KEY·地点在地图里）
    const sA = makeLocState();
    promoteNode(sA, LOC_KEY, SEED);

    // triggerLodGate 直接物化 NPC
    const sB = makeLocState();
    triggerLodGate(sB, [NPC_KEY], SEED);

    expect(sA.NPC[NPC_KEY]!.属性.体质).toBe(sB.NPC[NPC_KEY]!.属性.体质);
    expect(sA.NPC[NPC_KEY]!.属性.智慧).toBe(sB.NPC[NPC_KEY]!.属性.智慧);
    expect(sA.LOD表[NPC_KEY]?.档位).toBe('实体');
    expect(sB.LOD表[NPC_KEY]?.档位).toBe('实体');
  });
});

// ── B5-4 · soak ≥50 拍 ────────────────────────────────────────────────────────
//
// 每拍序列（窗口=3）：promote(T) → startWarmWindow(T) → tryDemote(T+1…T+3, no-op)
//                    → tryDemote(T+4, expired → demote) → 循环
//
// 10 轮 × 5 拍 = 50 拍

describe('B5-4 · soak ≥50 拍', () => {
  it('promote→warmWindow→tryDemote×3(no-op)→expired demote → 10 轮不崩溃·最终 LOD表 档位=粗', () => {
    const s = makeLocState();
    const WARM = LOD_WARM_WINDOW_DEFAULT; // 3
    const ROUNDS = 10; // 10 × 5 = 50 ticks

    let tick = 0;
    for (let round = 0; round < ROUNDS; round++) {
      // 步骤 1: promote
      promoteNode(s, LOC_KEY, SEED);
      expect(s.LOD表[LOC_KEY]?.档位).toBe('实体');

      // 步骤 2: startWarmWindow
      startWarmWindow(s, LOC_KEY, tick);
      const expiry = s.LOD表[LOC_KEY]?.保温到期拍号;
      expect(expiry).toBe(tick + WARM);

      // 步骤 3: tryDemote 在窗口内（no-op × WARM 次）
      for (let i = 1; i <= WARM; i++) {
        tryDemoteNode(s, LOC_KEY, tick + i);
        expect(s.LOD表[LOC_KEY]?.档位).toBe('实体'); // 仍实体
      }

      // 步骤 4: tryDemote 超窗 → demote
      tick += WARM + 1; // T+4（超出 T+3 的窗口）
      tryDemoteNode(s, LOC_KEY, tick);
      expect(s.LOD表[LOC_KEY]?.档位).toBe('粗');
      expect(s.LOD表[LOC_KEY]?.保温到期拍号).toBeUndefined();

      tick += 1; // 准备下一轮
    }

    // 50 拍完成·最终为粗（tryDemote 后）
    expect(s.LOD表[LOC_KEY]?.档位).toBe('粗');
  });

  it('NPC 在 soak 中物化一次后保持实体（不被 tryDemoteNode 回滚）', () => {
    const s = makeLocState();
    // 初始 NPC LOD表 = 粗
    expect(s.LOD表[NPC_KEY]?.档位).toBe('粗');

    // 第一轮：promote LOC_KEY → 物化 NPC
    promoteNode(s, LOC_KEY, SEED);
    expect(s.LOD表[NPC_KEY]?.档位).toBe('实体'); // NPC 已物化

    startWarmWindow(s, LOC_KEY, 0);
    // tryDemote 只操作 LOC_KEY·不逆转 NPC LOD表
    for (let tick = 1; tick <= 20; tick++) {
      tryDemoteNode(s, LOC_KEY, tick);
    }

    // NPC 的 LOD表档位始终为实体（物化已完成·demote 只降地点）
    expect(s.LOD表[NPC_KEY]?.档位).toBe('实体');
  });
});

// ── B5-5 · 迁移往返幂等 ───────────────────────────────────────────────────────
//
// 任意迁移后的 raw，再次跑迁移管线 → JSON 逐位恒等·migration_version 不再 bump。

describe('B5-5 · 迁移往返幂等', () => {
  it('双 NPC 各有 LOD档位 → 迁移后 JSON 逐位恒等·二次不再 bump', () => {
    const raw: Record<string, unknown> = {
      NPC: {
        [NPC_KEY]: { 姓名: 'A', 位置: LOC_KEY, LOD档位: '粗' },
        [NPC_KEY_2]: { 姓名: 'B', 位置: LOC_KEY, LOD档位: '实体' },
      },
      LOD表: {},
      _系统: { migration_version: 20 },
    };

    const pass1 = backfillLodTableNpcState(raw) as Record<string, unknown>;
    expect(((pass1['_系统'] as Record<string, unknown>)['migration_version'])).toBe(21);

    const lodTable = pass1['LOD表'] as Record<string, Record<string, unknown>>;
    expect(lodTable[NPC_KEY]!['档位']).toBe('粗');
    expect(lodTable[NPC_KEY_2]!['档位']).toBe('实体');

    // 二次迁移：JSON 逐位恒等
    const pass2 = backfillLodTableNpcState(pass1) as Record<string, unknown>;
    expect(JSON.stringify(pass1)).toBe(JSON.stringify(pass2));
    expect(((pass2['_系统'] as Record<string, unknown>)['migration_version'])).toBe(21);
  });

  it('迁移后 RootSchema.parse 成功·NPC 无 LOD档位 字段', () => {
    const raw = makeRawWithLodField(NPC_KEY, '粗', 0);
    const migrated = backfillLodTableNpcState(raw) as Record<string, unknown>;

    // 补充 RootSchema 必要字段后可 parse
    const full = {
      ...migrated,
      地图: { 地点: { [LOC_KEY]: { 名称: '区域', 类别: '区域级', 相邻: [] } } },
    };
    expect(() => RootSchema.parse(full)).not.toThrow();

    const parsed = RootSchema.parse(full);
    // parse 后 NPC 无 LOD档位
    expect('LOD档位' in (parsed.NPC[NPC_KEY] ?? {})).toBe(false);
  });
});
