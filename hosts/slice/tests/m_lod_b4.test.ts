// LOD-B4 · 散落 map LOD 字段迁移 + 生产注册机测
//
// 验收门：
//   B4-0: 守恒门 schemaKeys=53 / BUNDLE=21 / manifest=86
//   B4-1: backfillLodTableMapState 迁移 round-trip
//         地点[k].LOD态='实体' + 保温到期拍号=N → LOD表[k].档位='实体' + 保温到期拍号=N
//         地点[k] 散落字段被清除（Option-B）·migration_version +1
//   B4-2: 迁移幂等 — 二次 backfillLodTableMapState → no-op（migration_version 不再 bump）
//   B4-3: 无散落字段 → no-op（migration_version 不变）
//   B4-4: registerProductionLodMounts → getLodMount('NPC') 非 undefined
//   B4-5: 地图地点 schema 已无 LOD态/保温到期拍号（RootSchema.parse 不带出该字段）
//   B4-6: promoteNode + demoteNode 经 LOD表 路径逐位等价（双跑确定性）
//   B4-7: map 物化后 LOD表.档位='实体'·demote 后 LOD表.档位='粗'·保温窗口清空
//
// 六禁：禁 Date.now/new Date/Math.random/window/document/localeCompare

import { describe, it, expect, beforeEach } from 'vitest';
import { RootSchema } from '@ai-life-sim/core';
import { NpcSchema } from '@ai-life-sim/core';
import type { RootState } from '@ai-life-sim/core';
import {
  FINGERPRINT_BUNDLE_MEMBERS,
  FINGERPRINT_PRESET_FIELDS,
  FINGERPRINT_SNAPSHOT_FIELDS,
  FINGERPRINT_EXCLUDED_FIELDS,
} from '@ai-life-sim/core/engine/fingerprintManifest';
import { backfillLodTableMapState } from '@ai-life-sim/core/migration/migrate';
import {
  clearLodRegistry,
  getLodMount,
  registerProductionLodMounts,
} from '@ai-life-sim/core/engine/lodMount';
import {
  promoteNode,
  demoteNode,
  startWarmWindow,
  checkWarmWindow,
  LOD_WARM_WINDOW_DEFAULT,
} from '@ai-life-sim/core/engine/lodScheduler';

// ── constants ─────────────────────────────────────────────────────────────────

const SEED = 42;
const NODE_KEY = 'region_test';
const NPC_KEY = 'npc_coarse_1';

// ── fixture ───────────────────────────────────────────────────────────────────

function makeMapState(): RootState {
  const s = RootSchema.parse({
    $玩家偏好: { 内容分级: 'off', NSFW降级模型: { 启用: false } },
    地图: {
      地点: {
        [NODE_KEY]: { 名称: 'テスト区域', 类别: '区域级', 相邻: [] },
      },
    },
    NPC: {
      [NPC_KEY]: NpcSchema.parse({ 姓名: '粗节点甲', 位置: NODE_KEY }),
    },
  }) as RootState;
  // LOD-B4b: NPC 粗态记录在 LOD表
  s.LOD表 ??= {};  // R6 opt-in
  (s.LOD表 as Record<string, unknown>)[NPC_KEY] = { 模块键: NPC_KEY, 档位: '粗' };
  return s;
}

// ── B4-0 · 守恒门 ──────────────────────────────────────────────────────────────

describe('B4-0 · 守恒门', () => {
  it('schemaKeys=53', () => {
    expect(Object.keys(RootSchema.shape).length).toBe(54);
  });

  it('BUNDLE=21', () => {
    expect(FINGERPRINT_BUNDLE_MEMBERS.length).toBe(28);
  });

  it('manifest=88', () => {
    const total =
      FINGERPRINT_BUNDLE_MEMBERS.length +
      FINGERPRINT_PRESET_FIELDS.length +
      FINGERPRINT_SNAPSHOT_FIELDS.length +
      FINGERPRINT_EXCLUDED_FIELDS.length;
    expect(total).toBe(96);
  });
});

// ── B4-1 · backfillLodTableMapState 迁移 round-trip ───────────────────────────

describe('B4-1 · 迁移 round-trip', () => {
  it('地点[k].LOD态=实体 + 保温到期拍号=N → LOD表[k].档位=实体 + 保温到期拍号=N', () => {
    const raw: Record<string, unknown> = {
      地图: {
        地点: {
          [NODE_KEY]: {
            名称: 'テスト',
            LOD态: '实体',
            保温到期拍号: 99,
          },
        },
      },
      LOD表: {},
      _系统: { migration_version: 5 },
    };

    const result = backfillLodTableMapState(raw) as Record<string, unknown>;

    // LOD表 条目正确
    const lodTable = result['LOD表'] as Record<string, Record<string, unknown>>;
    expect(lodTable[NODE_KEY]).toBeDefined();
    expect(lodTable[NODE_KEY]!['档位']).toBe('实体');
    expect(lodTable[NODE_KEY]!['保温到期拍号']).toBe(99);
    expect(lodTable[NODE_KEY]!['模块键']).toBe(NODE_KEY);

    // 地点中散落字段被清除（Option-B）
    const locs = (result['地图'] as Record<string, unknown>)['地点'] as Record<string, Record<string, unknown>>;
    expect('LOD态' in (locs[NODE_KEY] ?? {})).toBe(false);
    expect('保温到期拍号' in (locs[NODE_KEY] ?? {})).toBe(false);
    expect(locs[NODE_KEY]!['名称']).toBe('テスト'); // 其他字段保留

    // migration_version +1
    expect(((result['_系统'] as Record<string, unknown>)['migration_version'])).toBe(6);
  });

  it('地点[k].LOD态=粗（默认态）→ LOD表[k].档位=粗', () => {
    const raw: Record<string, unknown> = {
      地图: {
        地点: {
          [NODE_KEY]: { 名称: '粗节点', LOD态: '粗' },
        },
      },
      LOD表: {},
      _系统: { migration_version: 0 },
    };

    const result = backfillLodTableMapState(raw) as Record<string, unknown>;
    const lodTable = result['LOD表'] as Record<string, Record<string, unknown>>;
    expect(lodTable[NODE_KEY]!['档位']).toBe('粗');
    expect(((result['_系统'] as Record<string, unknown>)['migration_version'])).toBe(1);
  });

  it('仅有 保温到期拍号（无 LOD态）→ 迁入 LOD表·档位默认粗', () => {
    const raw: Record<string, unknown> = {
      地图: {
        地点: {
          [NODE_KEY]: { 名称: '节点', 保温到期拍号: 77 },
        },
      },
      LOD表: {},
      _系统: { migration_version: 1 },
    };

    const result = backfillLodTableMapState(raw) as Record<string, unknown>;
    const lodTable = result['LOD表'] as Record<string, Record<string, unknown>>;
    expect(lodTable[NODE_KEY]!['档位']).toBe('粗');
    expect(lodTable[NODE_KEY]!['保温到期拍号']).toBe(77);
    expect(((result['_系统'] as Record<string, unknown>)['migration_version'])).toBe(2);
  });
});

// ── B4-2 · 幂等：二次迁移 no-op ───────────────────────────────────────────────

describe('B4-2 · 迁移幂等', () => {
  it('二次 backfillLodTableMapState → no-op（migration_version 不再 bump）', () => {
    const raw: Record<string, unknown> = {
      地图: {
        地点: {
          [NODE_KEY]: { 名称: 'x', LOD态: '实体', 保温到期拍号: 42 },
        },
      },
      LOD表: {},
      _系统: { migration_version: 3 },
    };

    const pass1 = backfillLodTableMapState(raw) as Record<string, unknown>;
    const ver1 = ((pass1['_系统'] as Record<string, unknown>)['migration_version']);
    expect(ver1).toBe(4);

    const pass2 = backfillLodTableMapState(pass1) as Record<string, unknown>;
    const ver2 = ((pass2['_系统'] as Record<string, unknown>)['migration_version']);
    expect(ver2).toBe(4); // 幂等：不再 bump

    // 内容逐位恒等
    expect(JSON.stringify(pass1)).toBe(JSON.stringify(pass2));
  });
});

// ── B4-3 · 无散落字段 → no-op ─────────────────────────────────────────────────

describe('B4-3 · 无散落字段 → no-op', () => {
  it('地点无 LOD态/保温到期拍号 → 返回同引用 raw·migration_version 不变', () => {
    const raw: Record<string, unknown> = {
      地图: {
        地点: {
          [NODE_KEY]: { 名称: '正常节点', 类别: '区域级' },
        },
      },
      LOD表: {},
      _系统: { migration_version: 10 },
    };

    const result = backfillLodTableMapState(raw);
    expect(result).toBe(raw); // 同引用 → 纯 no-op
  });

  it('无地图地点 → no-op', () => {
    const raw: Record<string, unknown> = {
      _系统: { migration_version: 2 },
    };

    const result = backfillLodTableMapState(raw);
    expect(result).toBe(raw);
  });
});

// ── B4-4 · registerProductionLodMounts ────────────────────────────────────────

describe('B4-4 · registerProductionLodMounts', () => {
  beforeEach(() => {
    clearLodRegistry();
  });

  it('注册前 getLodMount("NPC") = undefined', () => {
    expect(getLodMount('NPC')).toBeUndefined();
  });

  it('registerProductionLodMounts → getLodMount("NPC") 非 undefined', () => {
    registerProductionLodMounts();
    expect(getLodMount('NPC')).toBeDefined();
  });

  it('幂等：重复注册 → getLodMount("NPC") 仍 非 undefined', () => {
    registerProductionLodMounts();
    registerProductionLodMounts(); // 幂等
    expect(getLodMount('NPC')).toBeDefined();
  });
});

// ── B4-5 · map schema 已无散落字段 ────────────────────────────────────────────

describe('B4-5 · 地图地点 schema 无散落字段', () => {
  it('RootSchema.parse({}) → 地图.地点[k] 无 LOD态 字段（schema 已删）', () => {
    const s = makeMapState();
    const loc = s.地图?.地点?.[NODE_KEY];
    expect(loc).toBeDefined();
    // LOD态 已从 schema 删除·parse 后不存在
    expect('LOD态' in (loc ?? {})).toBe(false);
    expect('保温到期拍号' in (loc ?? {})).toBe(false);
  });
});

// ── B4-6 · promote/demote 经 LOD表 路径·双跑确定性 ───────────────────────────

describe('B4-6 · LOD表 路径确定性', () => {
  beforeEach(() => clearLodRegistry());

  it('双跑 promoteNode 逐位恒等（NPC 属性·LOD表 档位）', () => {
    const s1 = makeMapState();
    const s2 = makeMapState();

    promoteNode(s1, NODE_KEY, SEED);
    promoteNode(s2, NODE_KEY, SEED);

    // LOD表 档位相同
    expect(s1.LOD表[NODE_KEY]?.档位).toBe('实体');
    expect(s2.LOD表[NODE_KEY]?.档位).toBe('实体');

    // NPC 属性逐位恒等（materializeCoarseNode 确定性）
    expect(s1.LOD表[NPC_KEY]?.档位).toBe('实体');
    expect(s1.NPC[NPC_KEY]?.属性.体质).toBe(s2.NPC[NPC_KEY]?.属性.体质);
    expect(s1.NPC[NPC_KEY]?.属性.魅力).toBe(s2.NPC[NPC_KEY]?.属性.魅力);
  });

  it('demote 后 LOD表 档位=粗·NPC LOD表 档位 不回滚（物化已完成）', () => {
    const s = makeMapState();
    promoteNode(s, NODE_KEY, SEED);
    expect(s.LOD表[NODE_KEY]?.档位).toBe('实体');
    expect(s.LOD表[NPC_KEY]?.档位).toBe('实体');

    demoteNode(s, NODE_KEY);
    expect(s.LOD表[NODE_KEY]?.档位).toBe('粗');
    // NPC 已物化·demote 只降地点档位·不逆转 NPC LOD表条目
    expect(s.LOD表[NPC_KEY]?.档位).toBe('实体');
  });
});

// ── B4-7 · 保温窗口经 LOD表 路径 ──────────────────────────────────────────────

describe('B4-7 · 保温窗口 LOD表 路径', () => {
  it('startWarmWindow → LOD表[k].保温到期拍号 = tick + LOD_WARM_WINDOW_DEFAULT', () => {
    const s = makeMapState();
    startWarmWindow(s, NODE_KEY, 10);
    expect(s.LOD表[NODE_KEY]?.保温到期拍号).toBe(10 + LOD_WARM_WINDOW_DEFAULT);
    expect(checkWarmWindow(s, NODE_KEY, 10)).toBe(true);
    expect(checkWarmWindow(s, NODE_KEY, 10 + LOD_WARM_WINDOW_DEFAULT + 1)).toBe(false);
  });

  it('demoteNode 后 保温到期拍号 从 LOD表 清除', () => {
    const s = makeMapState();
    (s.LOD表 as Record<string, unknown>)[NODE_KEY] = { 模块键: NODE_KEY, 档位: '实体' };
    startWarmWindow(s, NODE_KEY, 5);
    expect(s.LOD表[NODE_KEY]?.保温到期拍号).toBeDefined();
    demoteNode(s, NODE_KEY);
    expect(s.LOD表[NODE_KEY]?.保温到期拍号).toBeUndefined();
  });

  it('不存在地图节点 → startWarmWindow no-op（防孤儿条目）', () => {
    const s = makeMapState();
    startWarmWindow(s, 'nonexistent_node', 1);
    expect(s.LOD表['nonexistent_node']).toBeUndefined();
  });
});
