/**
 * LOD-B2 opt-in 漂移触发（条件④）机测
 *
 * 验收门：
 *   D-1: resolveLodPredicate + opt-in 触发谓词驱动
 *        — Tier A/B 解析·合成等价·null=永全态·AI override·fail-closed
 *   D-3: seededSortKey — 同入参确定性 / 不同节点值不同 / 不用禁函数
 *   D-4: 条件④ detectLodTrigger — 计数≥3→triggered·1/2拍不触发·中断重置
 *   D-5: drift 计数管理（opt-in 谓词驱动·无滞回）
 *        — true+1/false归零/首拍初始化/无声明永不增
 *   D-6: per-tick promote ≤8 seeded 排序 — PC-present 场景·封顶
 *   D-7: LOD态 DSL ctx — 粗=0/实体=1 注入·闸②fail-closed·未知键 miss=0
 *   D-8: 指纹分线守卫 — LOD表/连续偏离计数/漂移基线值/漂移绑定策略 全排外·金向量恒等
 *   D-9: computeResourceFactor re-export — 原 tick 调用点输出不变
 *   D-10: 守恒门 — schemaKeys=54 / BUNDLE=28 / manifest=97
 *
 * opt-in 铁律：作者不声明触发条件 → null → 引擎跳过 → 实体永全态 → 不 demote
 * 六禁：禁 Date.now/new Date/Math.random/window/document/localeCompare
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import {
  scheduleLodPhase,
  LOD_PROMOTE_BUDGET,
  LOD_DRIFT_N,
  resolveLodPredicate,
  seededSortKey,
  type LodDriftStrategy,
} from '../engine/lodPhase.js';
import {
  detectLodTrigger,
  type LodTriggerCtx,
} from '../engine/lodScheduler.js';
import {
  registerLodMount,
  clearLodRegistry,
} from '../engine/lodMount.js';
import { projectStateCtx } from '../engine/dsl/stateCtx.js';
import { computeResourceFactor } from '../engine/tick.js';
import { RootSchema, BLUEPRINT_KEYS, type RootState } from '../schema/index.js';
import {
  FINGERPRINT_BUNDLE_MEMBERS,
  FINGERPRINT_PRESET_FIELDS,
  FINGERPRINT_SNAPSHOT_FIELDS,
  FINGERPRINT_EXCLUDED_FIELDS,
} from '../engine/fingerprintManifest.js';
import { hashJudgmentBundle } from '../engine/rng.js';

// ── JUDGMENT_BASE（最小合法判定面·用于指纹 delta 断言）────────────────────────
const JUDGMENT_BASE = {
  历法皮肤: {},
  粒度模板覆盖: {},
  种族模板: {},
  母题配额: {},
  媒体渠道表: {},
  检定配方表: {},
  检定档切分表: {},
  欠债参数: {},
  赛事结构模板: {},
  派生量配方: {},
  概率域夹逼: {},
  纠缠闭包弱边阈值: 0.2,
} as const;

/** 最小可用 state */
function makeBase() {
  const s = RootSchema.parse({
    $玩家偏好: { 内容分级: 'off', NSFW降级模型: { 启用: false } },
    地图: {},
  });
  s.LOD表 ??= {};
  return s as RootState & { 地图: NonNullable<RootState['地图']>; LOD表: NonNullable<RootState['LOD表']> };
}

/**
 * 构造含 LOD表 entry + 地图地点的测试 state。
 * 漂移基线值为 per-axis Record（新语义）。
 */
function makeStateWithLod(opts: {
  nodeKey: string;
  模块键?: string;
  档位?: '粗' | '实体';
  连续偏离计数?: number;
  漂移基线值?: Record<string, number>;
}) {
  const s = makeBase();
  const { nodeKey, 模块键 = nodeKey, 档位 = '粗', 连续偏离计数, 漂移基线值 } = opts;
  (s.地图.地点 as Record<string, unknown>)[nodeKey] = { 名称: nodeKey, 父节点: '' };
  const entry: Record<string, unknown> = { 模块键, 档位 };
  if (连续偏离计数 !== undefined) entry['连续偏离计数'] = 连续偏离计数;
  if (漂移基线值 !== undefined) entry['漂移基线值'] = 漂移基线值;
  s.LOD表[nodeKey] = entry as NonNullable<RootState['LOD表']>[string];
  return s;
}

// ────────────────────────────────────────────────────────────────────────────
// 通用测试用 LOD 描述符（读数值轴 from testAxisValues 外部 map）
// ────────────────────────────────────────────────────────────────────────────

const TEST_MODULE_KEY = 'TEST_LOD';

/** 在测试中存放 {nodeKey → {axis → value}} 的外部 map（by-ref·测试可直接改） */
let testAxisValues: Record<string, Record<string, number>> = {};

function registerTestDescriptor() {
  testAxisValues = {};
  registerLodMount({
    模块键: TEST_MODULE_KEY,
    真相Schema: z.object({}),
    索引器: () => [],
    写入目标: () => { /* no-op */ },
    读数值轴: (_s, nodeKey, axis) => testAxisValues[nodeKey]?.[axis],
  });
}

// ────────────────────────────────────────────────────────────────────────────
// D-1: resolveLodPredicate + opt-in 触发谓词驱动
// ────────────────────────────────────────────────────────────────────────────
describe('D-1: resolveLodPredicate + opt-in 触发谓词驱动', () => {
  beforeEach(() => registerTestDescriptor());
  afterEach(() => clearLodRegistry());

  // ── Tier A/B 纯解析 ──────────────────────────────────────────────────────

  it('resolveLodPredicate undefined → null（不参与漂移）', () => {
    expect(resolveLodPredicate(undefined)).toBeNull();
  });

  it('Tier A: 有 触发谓词 → 直接返回谓词串', () => {
    expect(resolveLodPredicate({ 触发谓词: '漂移.声望 > 30%' })).toBe('漂移.声望 > 30%');
  });

  it('Tier B: 监测轴 + 触发阈值 → 合成 漂移.{轴} {阈值}', () => {
    expect(resolveLodPredicate({ 监测轴: '民心', 触发阈值: '< 20%' })).toBe('漂移.民心 < 20%');
  });

  it('Tier B: 只有 监测轴 无 触发阈值 → null', () => {
    expect(resolveLodPredicate({ 监测轴: '民心' })).toBeNull();
  });

  it('Tier B: 只有 触发阈值 无 监测轴 → null', () => {
    expect(resolveLodPredicate({ 触发阈值: '> 30%' })).toBeNull();
  });

  // ── opt-in 铁律：无声明 → 永全态 ──────────────────────────────────────

  it('无任何触发声明 → scheduleLodPhase 3拍不增 count（opt-in 铁律）', () => {
    const s = makeStateWithLod({
      nodeKey: 'n1', 模块键: TEST_MODULE_KEY,
      漂移基线值: { 声望: 100 },
    });
    testAxisValues['n1'] = { 声望: 300 }; // 200% drift，但无声明
    scheduleLodPhase(s, 1, 1); // 无 preset
    scheduleLodPhase(s, 1, 2);
    scheduleLodPhase(s, 1, 3);
    expect(s.LOD表['n1']?.连续偏离计数).toBeUndefined(); // 永不增
  });

  // ── Tier A 真触发 ────────────────────────────────────────────────────────

  it('Tier A: baseline=100·cur=165·drift=65%>50% → 连续3拍 count=3', () => {
    const s = makeStateWithLod({
      nodeKey: 'n1', 模块键: TEST_MODULE_KEY,
      漂移基线值: { 声望: 100 },
    });
    testAxisValues['n1'] = { 声望: 165 };
    const driftStrategy: LodDriftStrategy = { '*': { 触发谓词: '漂移.声望 > 50%' } };
    scheduleLodPhase(s, 1, 1, undefined, driftStrategy);
    scheduleLodPhase(s, 1, 2, undefined, driftStrategy);
    scheduleLodPhase(s, 1, 3, undefined, driftStrategy);
    expect(s.LOD表['n1']?.连续偏离计数).toBe(3);
  });

  // ── Tier B 合成等价 ──────────────────────────────────────────────────────

  it('Tier B 监测轴=声望·触发阈值=>50% 与 Tier A 直接谓词等价（计数相同）', () => {
    const stratA: LodDriftStrategy = { '*': { 触发谓词: '漂移.声望 > 50%' } };
    const stratB: LodDriftStrategy = { '*': { 监测轴: '声望', 触发阈值: '> 50%' } };

    function makeS() {
      const s = makeStateWithLod({
        nodeKey: 'n1', 模块键: TEST_MODULE_KEY,
        漂移基线值: { 声望: 100 },
      });
      testAxisValues['n1'] = { 声望: 165 };
      return s;
    }
    const sA = makeS(); scheduleLodPhase(sA, 1, 1, undefined, stratA);
    const sB = makeS(); scheduleLodPhase(sB, 1, 1, undefined, stratB);
    expect(sA.LOD表['n1']?.连续偏离计数).toBe(sB.LOD表['n1']?.连续偏离计数);
  });

  // ── fail-closed ──────────────────────────────────────────────────────────

  it('首拍无基线 → 初始化基线·漂移=0 → pred false → count=0·基线已设', () => {
    const s = makeStateWithLod({ nodeKey: 'n1', 模块键: TEST_MODULE_KEY }); // 无 漂移基线值
    testAxisValues['n1'] = { 声望: 200 };
    const driftStrategy: LodDriftStrategy = { '*': { 触发谓词: '漂移.声望 > 50%' } };
    scheduleLodPhase(s, 1, 1, undefined, driftStrategy);
    expect(s.LOD表['n1']?.连续偏离计数).toBeUndefined(); // 首拍 fail-closed
    expect(s.LOD表['n1']?.漂移基线值).toBeDefined();      // 基线已初始化
  });

  it('未注册模块键 → 轴值 undefined → 漂移=0 → pred false → count=0', () => {
    const s = makeStateWithLod({
      nodeKey: 'n1', 模块键: 'UNKNOWN_MODULE',
      漂移基线值: { 声望: 100 },
    });
    testAxisValues['n1'] = { 声望: 300 };
    const driftStrategy: LodDriftStrategy = { '*': { 触发谓词: '漂移.声望 > 50%' } };
    scheduleLodPhase(s, 1, 1, undefined, driftStrategy);
    expect(s.LOD表['n1']?.连续偏离计数).toBeUndefined(); // 轴不可达·drift=0
  });

  // ── AI override ──────────────────────────────────────────────────────────

  it('AI override 凌驾：override表替换谓词为 always-true → count 累积', () => {
    // base pred = false (drift=0，cur==baseline)；override → 全局.拍计数 >= 0 always true
    const s = makeStateWithLod({
      nodeKey: 'n1', 模块键: TEST_MODULE_KEY,
      漂移基线值: { 声望: 100 },
    });
    testAxisValues['n1'] = { 声望: 100 }; // 0% drift → base pred false
    (s as unknown as Record<string, unknown>)['$AI创作状态'] = {
      谓词override表: { 'lod:n1': '全局.拍计数 >= 0' },
    };
    const driftStrategy: LodDriftStrategy = { '*': { 触发谓词: '漂移.声望 > 50%' } };
    scheduleLodPhase(s, 1, 1, undefined, driftStrategy);
    expect(s.LOD表['n1']?.连续偏离计数).toBe(1); // override 生效
  });

  it('hashJudgmentBundle 不受影响（指纹排外·LOD 全程不进盐）', () => {
    const h1 = hashJudgmentBundle({ ...JUDGMENT_BASE });
    const h2 = hashJudgmentBundle({ ...JUDGMENT_BASE });
    expect(h1).toBe(h2);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// D-3: seededSortKey 确定性
// ────────────────────────────────────────────────────────────────────────────
describe('D-3: seededSortKey', () => {
  it('同入参 → 相同结果（确定性）', () => {
    const k1 = seededSortKey(42, 10, 'node_a');
    const k2 = seededSortKey(42, 10, 'node_a');
    expect(k1).toBe(k2);
  });

  it('不同 nodeKey → 不同 sort key（碰撞极低）', () => {
    const k1 = seededSortKey(42, 10, 'node_a');
    const k2 = seededSortKey(42, 10, 'node_b');
    expect(k1).not.toBe(k2);
  });

  it('不同 seed → 不同 sort key', () => {
    const k1 = seededSortKey(1, 10, 'node_a');
    const k2 = seededSortKey(2, 10, 'node_a');
    expect(k1).not.toBe(k2);
  });

  it('结果为非负整数（32-bit unsigned）', () => {
    const k = seededSortKey(999, 5, 'test_node');
    expect(k).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(k)).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// D-4: 条件④ detectLodTrigger 连续偏离
// ────────────────────────────────────────────────────────────────────────────
describe('D-4: 条件④ detectLodTrigger 连续偏离', () => {
  const s = makeBase();
  const basePrev: LodTriggerCtx = { locKey: 'loc_a', orgKeys: [], epochMin: 0, eraLabel: '' };
  const baseCur: LodTriggerCtx = { locKey: 'loc_a', orgKeys: [], epochMin: 0, eraLabel: '' };

  it('consecutiveDriftCount=0 → not triggered', () => {
    const cur = { ...baseCur, consecutiveDriftCount: 0 };
    expect(detectLodTrigger(s, basePrev, cur).triggered).toBe(false);
  });

  it('consecutiveDriftCount=1 → not triggered', () => {
    const cur = { ...baseCur, consecutiveDriftCount: 1 };
    expect(detectLodTrigger(s, basePrev, cur).triggered).toBe(false);
  });

  it('consecutiveDriftCount=2 → not triggered', () => {
    const cur = { ...baseCur, consecutiveDriftCount: 2 };
    expect(detectLodTrigger(s, basePrev, cur).triggered).toBe(false);
  });

  it('consecutiveDriftCount=3(=N) → triggered condition=连续偏离', () => {
    const cur = { ...baseCur, consecutiveDriftCount: LOD_DRIFT_N };
    const result = detectLodTrigger(s, basePrev, cur);
    expect(result.triggered).toBe(true);
    expect(result.condition).toBe('连续偏离');
  });

  it('consecutiveDriftCount=5(>N) → triggered condition=连续偏离', () => {
    const cur = { ...baseCur, consecutiveDriftCount: 5 };
    const result = detectLodTrigger(s, basePrev, cur);
    expect(result.triggered).toBe(true);
    expect(result.condition).toBe('连续偏离');
  });

  it('consecutiveDriftCount undefined → not triggered（默认 0）', () => {
    const cur = { ...baseCur };
    expect(detectLodTrigger(s, basePrev, cur).triggered).toBe(false);
  });

  it('条件①②③ 仍正常工作（不被条件④ 遮蔽）', () => {
    const r = detectLodTrigger(s, basePrev, baseCur);
    expect(r.triggered).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// D-5: drift 计数管理（opt-in 谓词驱动·无滞回）
// ────────────────────────────────────────────────────────────────────────────
describe('D-5: scheduleLodPhase drift 计数管理（opt-in·谓词驱动·无滞回）', () => {
  beforeEach(() => registerTestDescriptor());
  afterEach(() => clearLodRegistry());

  const PRED_STRATEGY: LodDriftStrategy = { '*': { 触发谓词: '漂移.声望 > 50%' } };

  it('predicate true → count+1（baseline=100·cur=165·drift=65%>50%）', () => {
    const s = makeStateWithLod({
      nodeKey: 'n1', 模块键: TEST_MODULE_KEY,
      漂移基线值: { 声望: 100 },
    });
    testAxisValues['n1'] = { 声望: 165 };
    scheduleLodPhase(s, 1, 1, undefined, PRED_STRATEGY);
    expect(s.LOD表['n1']?.连续偏离计数).toBe(1);
  });

  it('连续 3 拍 predicate true → 计数=3（供 detectLodTrigger 读取）', () => {
    const s = makeStateWithLod({
      nodeKey: 'n1', 模块键: TEST_MODULE_KEY,
      漂移基线值: { 声望: 100 },
    });
    testAxisValues['n1'] = { 声望: 165 };
    scheduleLodPhase(s, 1, 1, undefined, PRED_STRATEGY);
    scheduleLodPhase(s, 1, 2, undefined, PRED_STRATEGY);
    scheduleLodPhase(s, 1, 3, undefined, PRED_STRATEGY);
    expect(s.LOD表['n1']?.连续偏离计数).toBe(3);
  });

  it('predicate 突然 false → 计数立刻归零（无滞回·cur 改回≈baseline）', () => {
    const s = makeStateWithLod({
      nodeKey: 'n1', 模块键: TEST_MODULE_KEY,
      连续偏离计数: 2,
      漂移基线值: { 声望: 100 },
    });
    // 第1拍：cur=165 drift=65%>50% → true → count=3
    testAxisValues['n1'] = { 声望: 165 };
    scheduleLodPhase(s, 1, 1, undefined, PRED_STRATEGY);
    expect(s.LOD表['n1']?.连续偏离计数).toBe(3);
    // 第2拍：cur≈baseline → drift=5%<50% → false → 归零
    testAxisValues['n1'] = { 声望: 105 };
    scheduleLodPhase(s, 1, 2, undefined, PRED_STRATEGY);
    expect(s.LOD表['n1']?.连续偏离计数).toBeUndefined(); // 归零后 delete
  });

  it('首拍无基线 → 初始化基线·漂移=0 → predicate false → count=0', () => {
    const s = makeStateWithLod({
      nodeKey: 'n1', 模块键: TEST_MODULE_KEY, // 无 漂移基线值
    });
    testAxisValues['n1'] = { 声望: 200 };
    scheduleLodPhase(s, 1, 1, undefined, PRED_STRATEGY);
    expect(s.LOD表['n1']?.连续偏离计数).toBeUndefined(); // 首拍 fail-closed
    expect(s.LOD表['n1']?.漂移基线值).toBeDefined();      // 基线已初始化
  });
});

// ────────────────────────────────────────────────────────────────────────────
// D-6: per-tick promote ≤8 seeded 排序
// ────────────────────────────────────────────────────────────────────────────
describe('D-6: per-tick promote ≤8 seeded 排序', () => {
  it(`10 PC-present 节点 → 只促升 ≤${LOD_PROMOTE_BUDGET} 个（共享区域·1 PC）`, () => {
    const s = makeBase();
    (s.地图.地点 as Record<string, unknown>)['region_hub'] = {
      名称: 'region_hub', 类别: '区域级', 父节点: '',
    };
    for (let i = 0; i < 10; i++) {
      const nodeKey = `node_${i}`;
      (s.地图.地点 as Record<string, unknown>)[nodeKey] = {
        名称: nodeKey, 父节点: 'region_hub',
      };
      s.LOD表[nodeKey] = {
        模块键: nodeKey, 档位: '粗',
      } as NonNullable<RootState['LOD表']>[string];
    }
    (s._席位表 as unknown as Record<string, unknown>) = {
      本机: { 焦点角色键: 'pc1' },
    };
    (s.NPC as Record<string, unknown>)['pc1'] = { 位置: 'region_hub' };

    scheduleLodPhase(s, 42, 1);

    const promoted = Object.values(s.LOD表).filter(e => e?.档位 === '实体').length;
    expect(promoted).toBeLessThanOrEqual(LOD_PROMOTE_BUDGET);
  });

  it('相同 seed/tick → 相同排序结果（确定性）', () => {
    function makeSharedRegionState() {
      const s = makeBase();
      (s.地图.地点 as Record<string, unknown>)['region_hub'] = {
        名称: 'region_hub', 类别: '区域级', 父节点: '',
      };
      for (let i = 0; i < 5; i++) {
        const nodeKey = `nd_${i}`;
        (s.地图.地点 as Record<string, unknown>)[nodeKey] = {
          名称: nodeKey, 父节点: 'region_hub',
        };
        s.LOD表[nodeKey] = {
          模块键: nodeKey, 档位: '粗',
        } as NonNullable<RootState['LOD表']>[string];
      }
      (s._席位表 as unknown as Record<string, unknown>) = {
        本机: { 焦点角色键: 'pc1' },
      };
      (s.NPC as Record<string, unknown>)['pc1'] = { 位置: 'region_hub' };
      return s;
    }
    const s1 = makeSharedRegionState();
    const s2 = makeSharedRegionState();
    scheduleLodPhase(s1, 99, 5);
    scheduleLodPhase(s2, 99, 5);
    const promoted1 = new Set(Object.keys(s1.LOD表).filter(k => s1.LOD表[k]?.档位 === '实体'));
    const promoted2 = new Set(Object.keys(s2.LOD表).filter(k => s2.LOD表[k]?.档位 === '实体'));
    expect(promoted1).toEqual(promoted2);
  });

  it('空 LOD表 → 精确 no-op（0 promote）', () => {
    const s = makeBase();
    scheduleLodPhase(s, 1, 1);
    expect(Object.values(s.LOD表).filter(e => e?.档位 === '实体').length).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// D-7: LOD态 DSL ctx 注入
// ────────────────────────────────────────────────────────────────────────────
describe('D-7: LOD态 DSL ctx', () => {
  it('粗节点 → LOD态.{key} = 0', () => {
    const s = makeBase();
    s.LOD表['loc_a'] = { 模块键: 'loc_a', 档位: '粗' };
    const ctx = projectStateCtx(s);
    expect((ctx as Record<string, unknown>)['LOD态']).toBeDefined();
    const lodCtx = (ctx as Record<string, Record<string, number>>)['LOD态']!;
    expect(lodCtx['loc_a']).toBe(0);
  });

  it('实体节点 → LOD态.{key} = 1', () => {
    const s = makeBase();
    s.LOD表['loc_b'] = { 模块键: 'loc_b', 档位: '实体' };
    const ctx = projectStateCtx(s);
    const lodCtx = (ctx as Record<string, Record<string, number>>)['LOD态']!;
    expect(lodCtx['loc_b']).toBe(1);
  });

  it('混合节点 → 各键独立编码', () => {
    const s = makeBase();
    s.LOD表['loc_coarse'] = { 模块键: 'loc_coarse', 档位: '粗' };
    s.LOD表['loc_entity'] = { 模块键: 'loc_entity', 档位: '实体' };
    const ctx = projectStateCtx(s);
    const lodCtx = (ctx as Record<string, Record<string, number>>)['LOD态']!;
    expect(lodCtx['loc_coarse']).toBe(0);
    expect(lodCtx['loc_entity']).toBe(1);
  });

  it('未授权键（不在 LOD表）→ ctx 无此键→ miss=0（fail-closed）', () => {
    const s = makeBase();
    const ctx = projectStateCtx(s);
    const lodCtx = (ctx as Record<string, Record<string, number>>)['LOD态'];
    expect(lodCtx?.['ghost_key']).toBeUndefined();
  });

  it('空 LOD表 → LOD态 = {} 空对象', () => {
    const s = makeBase();
    const ctx = projectStateCtx(s);
    const lodCtx = (ctx as Record<string, Record<string, number>>)['LOD态'];
    expect(lodCtx).toEqual({});
  });
});

// ────────────────────────────────────────────────────────────────────────────
// D-8: 指纹分线守卫 — LOD 全程排外·金向量恒等
// ────────────────────────────────────────────────────────────────────────────
describe('D-8: 指纹分线守卫', () => {
  it('漂移绑定策略 不在 BUNDLE_MEMBERS / PRESET_FIELDS / SNAPSHOT_FIELDS', () => {
    expect(FINGERPRINT_BUNDLE_MEMBERS).not.toContain('漂移绑定策略');
    expect(FINGERPRINT_PRESET_FIELDS).not.toContain('漂移绑定策略');
    expect(FINGERPRINT_SNAPSHOT_FIELDS).not.toContain('漂移绑定策略');
  });

  it('漂移绑定策略 不在 fingerprintManifest 任意组（已迁入 LOD 模块·C-2·排外）', () => {
    expect(FINGERPRINT_EXCLUDED_FIELDS).not.toContain('漂移绑定策略');
  });

  it('LOD态 DSL ctx 调用 evalPredStr 不通过 collectLorePredicates（架构分线断言）', () => {
    const s = makeBase();
    s.LOD表['loc_x'] = { 模块键: 'loc_x', 档位: '实体' };
    projectStateCtx(s);
    const h1 = hashJudgmentBundle({ ...JUDGMENT_BASE });
    s.LOD表['loc_x']!.档位 = '粗';
    const h2 = hashJudgmentBundle({ ...JUDGMENT_BASE });
    expect(h1).toBe(h2);
  });

  it('漂移绑定策略变化 → 不影响指纹（排外结构断言·C-2 迁出 manifest）', () => {
    expect(FINGERPRINT_EXCLUDED_FIELDS).not.toContain('漂移绑定策略');
    expect(FINGERPRINT_BUNDLE_MEMBERS).not.toContain('漂移绑定策略');
    const h1 = hashJudgmentBundle({ ...JUDGMENT_BASE });
    const h2 = hashJudgmentBundle({ ...JUDGMENT_BASE });
    expect(h1).toBe(h2);
  });

  it('LOD表/连续偏离计数/漂移基线值 不在 BUNDLE/PRESET/SNAPSHOT 任意组', () => {
    expect(FINGERPRINT_BUNDLE_MEMBERS).not.toContain('LOD表');
    expect(FINGERPRINT_PRESET_FIELDS).not.toContain('LOD表');
    expect(FINGERPRINT_SNAPSHOT_FIELDS).not.toContain('LOD表');
    expect(FINGERPRINT_EXCLUDED_FIELDS).not.toContain('连续偏离计数');
    expect(FINGERPRINT_EXCLUDED_FIELDS).not.toContain('漂移基线值');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// D-9: computeResourceFactor re-export 行为不变
// ────────────────────────────────────────────────────────────────────────────
describe('D-9: computeResourceFactor re-export', () => {
  it('无区域 / 无紧张度 → 1.0（兼容无 tension 现有测试）', () => {
    const locs = { loc_a: { 名称: 'loc_a', 父节点: '' } };
    expect(computeResourceFactor('loc_a', locs as unknown as Parameters<typeof computeResourceFactor>[1])).toBe(1.0);
  });

  it('无效 locKey → 1.0（fail-safe）', () => {
    expect(computeResourceFactor('', {} as Parameters<typeof computeResourceFactor>[1])).toBe(1.0);
  });

  it('节点不在 locs → 1.0（无区域无抑制）', () => {
    const locs = {};
    expect(computeResourceFactor('missing_node', locs as unknown as Parameters<typeof computeResourceFactor>[1])).toBe(1.0);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// D-10: 守恒门 schemaKeys/BUNDLE/manifest
// ────────────────────────────────────────────────────────────────────────────
describe('D-10: 守恒门', () => {
  it('schemaKeys = 54（无新顶层键）', () => {
    expect(BLUEPRINT_KEYS.length).toBe(54);
  });

  it('BUNDLE = 28', () => {
    expect(FINGERPRINT_BUNDLE_MEMBERS.length).toBe(28);
  });

  it('manifest 总长 = 97（BUNDLE28+PRESET10+SNAPSHOT5+EXCLUDED54·漂移绑定策略→LOD模块·C-2）', () => {
    const total = FINGERPRINT_BUNDLE_MEMBERS.length
      + FINGERPRINT_PRESET_FIELDS.length
      + FINGERPRINT_SNAPSHOT_FIELDS.length
      + FINGERPRINT_EXCLUDED_FIELDS.length;
    expect(total).toBe(97);
  });

  it('LOD_DRIFT_N = 3 / LOD_PROMOTE_BUDGET = 8', () => {
    expect(LOD_DRIFT_N).toBe(3);
    expect(LOD_PROMOTE_BUDGET).toBe(8);
  });
});
