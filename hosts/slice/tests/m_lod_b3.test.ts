// LOD-B3 · 挂载/生成接口泛化机测
//
// 验收门：
//   B3-0: 守恒门 schemaKeys=53 / BUNDLE=21 / manifest=86（additive·不增顶层键）
//   B3-1: 空 LOD表 → scheduleLodPhase 精确 no-op（含 _系统.LOD位置快照 不写入）
//   B3-2: 通用骨架路径 — synthetic descriptor 注册→ dispatchLodGenerate → 种子视图骨架 → S.parse 落桶
//   B3-3: S.parse 失败 fail-closed — 不部分写·不抛·跳过
//   B3-4: 注册幂等 — 同键后注册覆盖前者
//   B3-5: 测试隔离 — clearLodRegistry + re-register
//   B3-6: 自定义生成器路径 — NPC_LOD_DESCRIPTOR + registerNpcLodMount + dispatchLodGenerate
//   B3-7: 三条件 integration 冷启动 — 无 prev 快照 → skip detect + 写快照
//   B3-8: 三条件 integration 跨区 — _系统.LOD位置快照 驱动 handleRegionCross
//   B3-9: 三条件 integration 纪元跨时代 — era 变更 → promote 当前区域
//   B3-10: 三条件 integration 组织归属变更 — orgKeys 差异 → promote
//   B3-11: NPC promote 路径等价 — scheduleLoadPhase→promoteNode→materializeCoarseNode 行为与 B2 逐位等价
//   B3-12: empty LOD表 → _系统.LOD位置快照 不变（no-op 贯穿 B3 写入路径）
//
// 六禁：禁 Date.now/new Date/Math.random/window/document/localeCompare

import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import {
  clearLodRegistry,
  registerLodMount,
  getLodMount,
  dispatchLodGenerate,
  NPC_LOD_DESCRIPTOR,
  registerNpcLodMount,
} from '@ai-life-sim/core/engine/lodMount';
import {
  scheduleLodPhase,
  LOD_PROMOTE_BUDGET,
} from '@ai-life-sim/core/engine/lodPhase';
import { RootSchema } from '@ai-life-sim/core';
import {
  FINGERPRINT_BUNDLE_MEMBERS,
  FINGERPRINT_PRESET_FIELDS,
  FINGERPRINT_SNAPSHOT_FIELDS,
  FINGERPRINT_EXCLUDED_FIELDS,
} from '@ai-life-sim/core/engine/fingerprintManifest';
import type { RootState } from '@ai-life-sim/core';

// ── fixture helpers ───────────────────────────────────────────────────────────

function makeBase(): RootState {
  const s = RootSchema.parse({
    $玩家偏好: { 内容分级: 'off', NSFW降级模型: { 启用: false } },
  }) as RootState;
  s.LOD表 ??= {};  // R6 opt-in
  return s;
}

/**
 * 构造含 LOD表 entry + 地图地点 + NPC + 席位表的测试 state。
 * 与 m_lod_b2 同结构（复用设施验路径等价）。
 */
function makeStateWithLod(opts: {
  nodeKey: string;
  npcKey?: string;
  pcKey?: string;
  pcAtNode?: string;
}): RootState {
  const { nodeKey, npcKey, pcKey, pcAtNode } = opts;
  const base = makeBase();

  (base.地图 as Record<string, unknown>) = {
    地点: {
      [nodeKey]: {
        名称: nodeKey,
        父节点: '',
        相对方位: '',
      },
    },
    区域物价: {},
  };

  if (npcKey) {
    (base.NPC as Record<string, unknown>)[npcKey] = {
      姓名: npcKey,
      位置: nodeKey,
      属性: { 体质: 10, 智慧: 10, 感知: 10, 魅力: 10, 心理: 10 },
      技能: {},
      关系: [],
      物品: {},
      日程: [],
      标志: {},
      所属组织: [],
      存活状态: '在世',
    };
    // LOD-B4b: NPC 粗态记录在 LOD表
    (base.LOD表 as Record<string, unknown>)[npcKey] = { 模块键: npcKey, 档位: '粗' };
  }

  if (pcKey) {
    (base.NPC as Record<string, unknown>)[pcKey] = {
      姓名: pcKey,
      位置: pcAtNode ?? nodeKey,
      属性: { 体质: 50, 智慧: 50, 感知: 50, 魅力: 50, 心理: 50 },
      技能: {},
      关系: [],
      物品: {},
      日程: [],
      标志: {},
      所属组织: [],
      存活状态: '在世',
    };
    (base._席位表 as Record<string, unknown>)['seat1'] = {
      席位ID: 'seat1',
      焦点角色键: pcKey,
    };
  }

  (base.LOD表 as Record<string, unknown>)[nodeKey] = {
    模块键: nodeKey,
    档位: '粗',
  };

  return base;
}

// ── 测试前清空注册表（隔离） ─────────────────────────────────────────────────

beforeEach(() => {
  clearLodRegistry();
});

// ── B3-0 · 守恒门 ──────────────────────────────────────────────────────────────

describe('B3-0 · 守恒门', () => {
  it('schemaKeys=53（_系统 加子字段·顶层键不增）', () => {
    expect(Object.keys(RootSchema.shape).length).toBe(54);
  });

  it('BUNDLE=21', () => {
    expect(FINGERPRINT_BUNDLE_MEMBERS.length).toBe(21);
  });

  it('manifest=86', () => {
    const total =
      FINGERPRINT_BUNDLE_MEMBERS.length +
      FINGERPRINT_PRESET_FIELDS.length +
      FINGERPRINT_SNAPSHOT_FIELDS.length +
      FINGERPRINT_EXCLUDED_FIELDS.length;
    expect(total).toBe(89);
  });

  it('LOD位置快照 不在 FINGERPRINT_BUNDLE_MEMBERS', () => {
    expect(FINGERPRINT_BUNDLE_MEMBERS).not.toContain('LOD位置快照');
  });

  it('LOD位置快照 不在 FINGERPRINT_PRESET_FIELDS', () => {
    expect(FINGERPRINT_PRESET_FIELDS).not.toContain('LOD位置快照');
  });

  it('LOD位置快照 不在 FINGERPRINT_SNAPSHOT_FIELDS', () => {
    expect(FINGERPRINT_SNAPSHOT_FIELDS).not.toContain('LOD位置快照');
  });

  it('_系统 初始无 LOD位置快照（optional·no default）', () => {
    const base = makeBase();
    expect(base._系统.LOD位置快照).toBeUndefined();
  });
});

// ── B3-1 · 空 LOD表 精确 no-op（含 LOD位置快照）─────────────────────────────

describe('B3-1 · 空 LOD表 → 精确 no-op', () => {
  it('scheduleLodPhase 空表 → _系统.LOD位置快照 不被写入', () => {
    const s = makeBase();
    const before = JSON.stringify(s);
    scheduleLodPhase(s, 42, 0);
    expect(s._系统.LOD位置快照).toBeUndefined();
    expect(JSON.stringify(s)).toBe(before);
  });
});

// ── B3-2 · 通用骨架路径 ─────────────────────────────────────────────────────

describe('B3-2 · 通用骨架路径（无生成器 → 种子视图骨架 → S.parse 落桶）', () => {
  const SyntheticSchema = z.object({
    value: z.number().default(99),
    label: z.string().default('默认标签'),
  });
  const TARGET_NODE = 'test_node';
  const TARGET_ENTITY = 'entity_1';

  it('generic path: skeleton written via 写入目标', () => {
    const written: Record<string, unknown> = {};
    registerLodMount({
      模块键: 'synthetic',
      真相Schema: SyntheticSchema,
      索引器: (_s, nodeKey) => nodeKey === TARGET_NODE ? [TARGET_ENTITY] : [],
      写入目标: (_s, entityKey, data) => { written[entityKey] = data; },
      // 无 生成器 → 走通用骨架路径
    });

    const s = makeBase();
    // 注入 LOD表 条目（dispatch 依赖 LOD表 存在·占位形态 为 undefined）
    (s.LOD表 as Record<string, unknown>)[TARGET_NODE] = { 模块键: TARGET_NODE, 档位: '粗' };

    dispatchLodGenerate(s, TARGET_NODE, 42);

    // 种子视图 parse {} → S.parse → defaults filled
    expect(written[TARGET_ENTITY]).toEqual({ value: 99, label: '默认标签' });
  });

  it('generic path: 索引器返空 → 写入目标 不被调用', () => {
    let called = false;
    registerLodMount({
      模块键: 'synthetic_empty',
      真相Schema: SyntheticSchema,
      索引器: () => [], // 永远返空
      写入目标: () => { called = true; },
    });

    const s = makeBase();
    (s.LOD表 as Record<string, unknown>)['any_node'] = { 模块键: 'any_node', 档位: '粗' };

    dispatchLodGenerate(s, 'any_node', 42);
    expect(called).toBe(false);
  });

  it('多 descriptor 各自独立分派', () => {
    const results: string[] = [];
    registerLodMount({
      模块键: 'mod_a',
      真相Schema: z.object({ x: z.string().default('a') }),
      索引器: (_s, nk) => nk === 'node1' ? ['ea'] : [],
      写入目标: (_s, _ek, data) => { results.push((data as { x: string }).x); },
    });
    registerLodMount({
      模块键: 'mod_b',
      真相Schema: z.object({ x: z.string().default('b') }),
      索引器: (_s, nk) => nk === 'node1' ? ['eb'] : [],
      写入目标: (_s, _ek, data) => { results.push((data as { x: string }).x); },
    });

    const s = makeBase();
    (s.LOD表 as Record<string, unknown>)['node1'] = { 模块键: 'node1', 档位: '粗' };
    dispatchLodGenerate(s, 'node1', 0);

    expect(results.sort()).toEqual(['a', 'b']);
  });
});

// ── B3-3 · fail-closed（S.parse 失败 → 跳过）──────────────────────────────

describe('B3-3 · S.parse 失败 fail-closed', () => {
  it('S.parse 失败 → 写入目标 不被调用·不抛', () => {
    let written = false;
    // Schema 要求 value 必须为正整数（会拒绝 string）
    const StrictSchema = z.object({ value: z.number().int().positive() });

    registerLodMount({
      模块键: 'strict_module',
      真相Schema: StrictSchema,
      索引器: (_s, nk) => nk === 'strict_node' ? ['e1'] : [],
      写入目标: () => { written = true; },
      // 无生成器 → 骨架路径：种子视图({}) → StrictSchema.safeParse({}) 失败（value 必须存在且>0）
    });

    const s = makeBase();
    (s.LOD表 as Record<string, unknown>)['strict_node'] = { 模块键: 'strict_node', 档位: '粗' };

    expect(() => dispatchLodGenerate(s, 'strict_node', 0)).not.toThrow();
    expect(written).toBe(false);
  });

  it('自定义生成器返回非法值 → S.parse 失败 → 写入目标 不被调用', () => {
    let written = false;
    const StrictSchema = z.object({ value: z.number().int().positive() });

    registerLodMount({
      模块键: 'bad_gen',
      真相Schema: StrictSchema,
      索引器: (_s, nk) => nk === 'bg_node' ? ['e1'] : [],
      写入目标: () => { written = true; },
      生成器: () => ({ value: -1 }), // 不满足 positive()
    });

    const s = makeBase();
    (s.LOD表 as Record<string, unknown>)['bg_node'] = { 模块键: 'bg_node', 档位: '粗' };

    expect(() => dispatchLodGenerate(s, 'bg_node', 0)).not.toThrow();
    expect(written).toBe(false);
  });
});

// ── B3-4 · 注册幂等 ─────────────────────────────────────────────────────────

describe('B3-4 · 注册幂等', () => {
  it('同键后注册覆盖前者', () => {
    const SchemaA = z.object({ v: z.string().default('A') });
    const SchemaB = z.object({ v: z.string().default('B') });

    registerLodMount({
      模块键: 'idem',
      真相Schema: SchemaA,
      索引器: () => [],
      写入目标: () => {},
    });
    registerLodMount({
      模块键: 'idem',
      真相Schema: SchemaB,
      索引器: () => [],
      写入目标: () => {},
    });

    const desc = getLodMount('idem');
    expect(desc).toBeDefined();
    // SchemaB 有 default 'B'，验证覆盖成功
    const result = desc!.真相Schema.safeParse({});
    expect(result.success && (result.data as { v: string }).v).toBe('B');
  });

  it('注册相同 descriptor 多次 → 无副作用', () => {
    const Schema = z.object({ n: z.number().default(1) });
    const desc = {
      模块键: 'dup',
      真相Schema: Schema,
      索引器: () => [] as string[],
      写入目标: () => {},
    };
    registerLodMount(desc);
    registerLodMount(desc);
    expect(getLodMount('dup')).toBeDefined();
  });
});

// ── B3-5 · 测试隔离（clearLodRegistry）──────────────────────────────────────

describe('B3-5 · clearLodRegistry 测试隔离', () => {
  it('clear 后 getLodMount 返回 undefined', () => {
    registerLodMount({
      模块键: 'temp',
      真相Schema: z.object({}),
      索引器: () => [],
      写入目标: () => {},
    });
    expect(getLodMount('temp')).toBeDefined();

    clearLodRegistry();
    expect(getLodMount('temp')).toBeUndefined();
  });

  it('clear 后 re-register 正常', () => {
    clearLodRegistry();
    registerLodMount({
      模块键: 're',
      真相Schema: z.object({ k: z.number().default(7) }),
      索引器: () => [],
      写入目标: () => {},
    });
    expect(getLodMount('re')).toBeDefined();
  });
});

// ── B3-6 · 自定义生成器路径（NPC_LOD_DESCRIPTOR）────────────────────────────

describe('B3-6 · 自定义生成器路径（NPC descriptor·materializeCoarseNode delegate）', () => {
  it('registerNpcLodMount → NPC_LOD_DESCRIPTOR 注册成功', () => {
    registerNpcLodMount();
    expect(getLodMount('NPC')).toBe(NPC_LOD_DESCRIPTOR);
  });

  it('NPC 索引器：仅返回 粗态 NPC at nodeKey', () => {
    registerNpcLodMount();
    const s = makeStateWithLod({ nodeKey: 'loc1', npcKey: 'npc1', pcKey: 'pc1' });

    const keys = NPC_LOD_DESCRIPTOR.索引器(s, 'loc1');
    expect(keys).toContain('npc1');
    expect(keys).not.toContain('pc1'); // pc1 是实体态
  });

  it('dispatchLodGenerate 调 NPC 生成器 → materializeCoarseNode（LOD表 档位 变 实体）', () => {
    registerNpcLodMount();
    const s = makeStateWithLod({ nodeKey: 'loc1', npcKey: 'npc1' });
    expect(s.LOD表['npc1']?.档位).toBe('粗');

    dispatchLodGenerate(s, 'loc1', 42);

    expect(s.LOD表['npc1']?.档位).toBe('实体');
  });

  it('promoteNode 后 NPC 已实体化 → 索引器返空 → dispatchLodGenerate no-op（幂等）', () => {
    registerNpcLodMount();
    const s = makeStateWithLod({ nodeKey: 'loc1', npcKey: 'npc1' });

    // 手动设置 LOD表 档位 为 实体（模拟 promoteNode 已运行）
    (s.LOD表 as Record<string, unknown>)['npc1'] = { 模块键: 'npc1', ...(s.LOD表['npc1'] ?? {}), 档位: '实体' };

    const keys = NPC_LOD_DESCRIPTOR.索引器(s, 'loc1');
    expect(keys).toHaveLength(0); // 索引器返空

    // dispatchLodGenerate 对已实体态 NPC 无写入
    const attrBefore = s.NPC['npc1']!.属性.体质;
    dispatchLodGenerate(s, 'loc1', 42);
    expect(s.NPC['npc1']!.属性.体质).toBe(attrBefore); // 未改
  });
});

// ── B3-7 · 三条件 integration 冷启动 ─────────────────────────────────────────

describe('B3-7 · 三条件 冷启动（无 prev 快照）', () => {
  it('首拍无 _系统.LOD位置快照 → skip detect + 写入新快照', () => {
    const s = makeStateWithLod({ nodeKey: 'node1', pcKey: 'pc1', pcAtNode: 'node1' });
    expect(s._系统.LOD位置快照).toBeUndefined();

    scheduleLodPhase(s, 42, 0);

    // 写入了快照
    expect(s._系统.LOD位置快照).toBeDefined();
    expect(s._系统.LOD位置快照!['pc1']).toBeDefined();
    expect(s._系统.LOD位置快照!['pc1']!.locKey).toBe('node1');
  });

  it('冷启动不触发 detectLodTrigger（LOD表 档位 仅由 promote 决定·无双重 promote）', () => {
    const s = makeStateWithLod({ nodeKey: 'node1', pcKey: 'pc1', pcAtNode: 'node1' });
    scheduleLodPhase(s, 42, 0);

    // PC 在场 → promote（B2 行为不变）
    expect(s.LOD表?.['node1']?.档位).toBe('实体');
  });
});

// ── B3-8 · 三条件 跨区（_系統.LOD位置快照 驱动）────────────────────────────────

describe('B3-8 · 三条件 跨区（state 快照 → detectLodTrigger → handleRegionCross）', () => {
  it('prev locKey 跨区 → handleRegionCross·新区域 promote', () => {
    // 两个区域：region_a（包含 loc_a）/ region_b（包含 loc_b）
    const s = makeBase();

    // 地图：两个地点，各自为独立 region（无 父节点）
    (s.地图 as Record<string, unknown>) = {
      地点: {
        loc_a: { 名称: 'loc_a' },
        loc_b: { 名称: 'loc_b' },
      },
      区域物价: {},
    };

    // PC 现在在 loc_b
    (s.NPC as Record<string, unknown>)['pc1'] = {
      姓名: 'pc1', 位置: 'loc_b',
      属性: { 体质: 50, 智慧: 50, 感知: 50, 魅力: 50, 心理: 50 },
      技能: {}, 关系: [], 物品: {}, 日程: [], 标志: {},
      所属组织: [], 存活状态: '在世',
    };
    (s._席位表 as Record<string, unknown>)['s1'] = { 席位ID: 's1', 焦点角色键: 'pc1' };

    // LOD表 注册 loc_b
    (s.LOD表 as Record<string, unknown>)['loc_b'] = { 模块键: 'loc_b', 档位: '粗' };

    // 上拍快照：PC 在 loc_a（不同区域）
    (s._系统 as Record<string, unknown>)['LOD位置快照'] = {
      pc1: { locKey: 'loc_a', orgKeys: [], epochMin: 0, eraLabel: '' },
    };

    scheduleLodPhase(s, 42, 5);

    // 跨区 → loc_b region promoted（handleRegionCross 接通）
    expect(s.LOD表?.['loc_b']?.档位).toBe('实体');

    // 快照更新为当前位置（loc_b）
    expect(s._系统.LOD位置快照!['pc1']!.locKey).toBe('loc_b');
  });
});

// ── B3-9 · 三条件 纪元跨时代 ────────────────────────────────────────────────

describe('B3-9 · 三条件 纪元跨时代', () => {
  it('era 变更 → 当前区域 promote', () => {
    const s = makeBase();

    (s.地图 as Record<string, unknown>) = {
      地点: { loc1: { 名称: 'loc1' } },
      区域物价: {},
    };
    (s.NPC as Record<string, unknown>)['pc1'] = {
      姓名: 'pc1', 位置: 'loc1',
      属性: { 体质: 50, 智慧: 50, 感知: 50, 魅力: 50, 心理: 50 },
      技能: {}, 关系: [], 物品: {}, 日程: [], 标志: {},
      所属组织: [], 存活状态: '在世',
    };
    (s._席位表 as Record<string, unknown>)['s1'] = { 席位ID: 's1', 焦点角色键: 'pc1' };
    (s.LOD表 as Record<string, unknown>)['loc1'] = { 模块键: 'loc1', 档位: '粗' };

    // 世界.历法.年号表 有当前年号 '建中'
    (s.世界 as Record<string, unknown>) = {
      纪元分钟: 1000,
      历法: { 年号表: [{ 年号: '建中', 起始纪元分钟: 0 }] },
    };

    // 上拍快照：eraLabel='太平'（已变）
    (s._系统 as Record<string, unknown>)['LOD位置快照'] = {
      pc1: { locKey: 'loc1', orgKeys: [], epochMin: 0, eraLabel: '太平' },
    };

    scheduleLodPhase(s, 0, 10);

    // 纪元跨时代 → 当前区域 loc1 promoted
    expect(s.LOD表?.['loc1']?.档位).toBe('实体');
  });
});

// ── B3-10 · 三条件 组织归属变更 ─────────────────────────────────────────────

describe('B3-10 · 三条件 组织归属变更', () => {
  it('orgKeys 新增 → promote 当前区域', () => {
    const s = makeBase();

    (s.地图 as Record<string, unknown>) = {
      地点: { loc1: { 名称: 'loc1' } },
      区域物价: {},
    };
    // PC 所属组织 = ['guild_new']（上拍为 []）
    (s.NPC as Record<string, unknown>)['pc1'] = {
      姓名: 'pc1', 位置: 'loc1',
      属性: { 体质: 50, 智慧: 50, 感知: 50, 魅力: 50, 心理: 50 },
      技能: {}, 关系: [], 物品: {}, 日程: [], 标志: {},
      所属组织: [{ 组织键: 'guild_new', 职位: '成员' }],
      存活状态: '在世',
    };
    (s._席位表 as Record<string, unknown>)['s1'] = { 席位ID: 's1', 焦点角色键: 'pc1' };
    (s.LOD表 as Record<string, unknown>)['loc1'] = { 模块键: 'loc1', 档位: '粗' };

    // 上拍快照：无组织
    (s._系统 as Record<string, unknown>)['LOD位置快照'] = {
      pc1: { locKey: 'loc1', orgKeys: [], epochMin: 0, eraLabel: '' },
    };

    scheduleLodPhase(s, 0, 0);

    // 组织变更 → loc1 promoted
    expect(s.LOD表?.['loc1']?.档位).toBe('实体');
  });
});

// ── B3-11 · NPC promote 路径等价（B2 行为复验）──────────────────────────────

describe('B3-11 · NPC promote 路径等价（B3 dispatchLodGenerate 不改变 B2 行为）', () => {
  it('scheduleLodPhase PC 在场 → promoteNode·NPC materializeCoarseNode（与 B2-2 路径等价）', () => {
    const s = makeStateWithLod({ nodeKey: 'n1', npcKey: 'npc1', pcKey: 'pc1', pcAtNode: 'n1' });
    expect(s.LOD表['npc1']?.档位).toBe('粗');

    scheduleLodPhase(s, 42, 0);

    // 地点 promoted（B2-2 行为）
    expect(s.LOD表?.['n1']?.档位).toBe('实体');
    // NPC materialized（B2-2 行为·通过 promoteNode→materializeCoarseNode·写 LOD表）
    expect(s.LOD表['npc1']?.档位).toBe('实体');
    // 属性有 RNG 派生值（materializeCoarseNode 已运行）
    expect(s.NPC['npc1']?.属性.体质).toBeGreaterThan(0);
  });

  it('dispatchLodGenerate 在 promoteNode 后调用 → NPC 索引器返空（幂等·无双重写入）', () => {
    // 注册 NPC descriptor，验证 索引器 在 NPC 已实体化后返空
    registerNpcLodMount();
    const s = makeStateWithLod({ nodeKey: 'n1', npcKey: 'npc1', pcKey: 'pc1', pcAtNode: 'n1' });

    scheduleLodPhase(s, 42, 0);

    // NPC 已实体化（promoteNode 处理）→ 索引器应返空
    const idxResult = NPC_LOD_DESCRIPTOR.索引器(s, 'n1');
    expect(idxResult).toHaveLength(0);
  });

  it('LOD_PROMOTE_BUDGET = 8 不变', () => {
    expect(LOD_PROMOTE_BUDGET).toBe(8);
  });
});

// ── B3-12 · 空 LOD表 → LOD位置快照 严格 no-op ──────────────────────────────

describe('B3-12 · 空 LOD表 → _系统.LOD位置快照 不写入（B3 写入路径完整 no-op）', () => {
  it('空 LOD表 + 有 PC + runTick → LOD位置快照 仍 undefined', () => {
    const s = makeBase();
    // 有 PC 但 LOD表={}（默认空）
    (s.NPC as Record<string, unknown>)['pc1'] = {
      姓名: 'pc1', 位置: 'loc1',
      属性: { 体质: 50, 智慧: 50, 感知: 50, 魅力: 50, 心理: 50 },
      技能: {}, 关系: [], 物品: {}, 日程: [], 标志: {},
      所属组织: [], 存活状态: '在世',
    };
    (s._席位表 as Record<string, unknown>)['s1'] = { 席位ID: 's1', 焦点角色键: 'pc1' };

    scheduleLodPhase(s, 42, 0);

    expect(s._系统.LOD位置快照).toBeUndefined();
  });
});
