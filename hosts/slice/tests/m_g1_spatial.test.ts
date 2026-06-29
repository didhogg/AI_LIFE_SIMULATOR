// G1 · 涟漪空间层因子 — 专项回归测试
//
// DoD:
//   S1 距离单调性：同区域 > 邻区(1跳) > 隔区(2跳) 传播强度严格递减
//   S2 密度方向：高人口密度目标区 → 因子更大（其余条件相同）
//   S3 退化不变式：单区域 / 无区域图场景，传播值与 G1a 逐位一致（空间因子=1）
//   S4 确定性：同 seed+同状态双跑逐位恒等
//   S5 一跳观察者不受空间因子影响（一跳=同地·因子恒为 1）
import { describe, it, expect } from 'vitest';
import { runTick, emitRipple } from '@ai-life-sim/core/engine/tick';
import { RootSchema } from '@ai-life-sim/core';
import { buildWorld, PC, NPC_WANG, NPC_HONG } from '../fixture/world.js';

const NPC_ZHAO = 'npc_zhao';

// ── 世界工厂 ──────────────────────────────────────────────────────────────────

/** 三区域线性链：A(大型) — B(中型) — C(小型)，目标在 A，观察者分布在 A/B/C */
function makeLinearRegionWorld() {
  return RootSchema.parse({
    地图: {
      地点: {
        loc_region_a: {
          类别: '区域级', 人口规模: '大型',
          相邻: [{ 目标: 'loc_region_b' }],
        },
        loc_region_b: {
          类别: '区域级', 人口规模: '中型',
          相邻: [{ 目标: 'loc_region_a' }, { 目标: 'loc_region_c' }],
        },
        loc_region_c: {
          类别: '区域级', 人口规模: '小型',
          相邻: [{ 目标: 'loc_region_b' }],
        },
      },
    },
    NPC: {
      [PC]:       { 姓名: '林九', 位置: 'loc_region_a' },
      [NPC_WANG]: { 姓名: '王掌柜', 位置: 'loc_region_a' },
      [NPC_HONG]: { 姓名: '红姨', 位置: 'loc_region_b' },
      [NPC_ZHAO]: { 姓名: '赵某', 位置: 'loc_region_c' },
    },
  });
}

/** 密度方向测试世界：target 所在区域的人口规模可配置，obs2 在相邻区域（1 跳）*/
function makeDensityWorld(densityTier: string) {
  return RootSchema.parse({
    地图: {
      地点: {
        loc_src: { 类别: '区域级', 人口规模: densityTier, 相邻: [{ 目标: 'loc_dst' }] },
        loc_dst: { 类别: '区域级', 人口规模: '中型', 相邻: [{ 目标: 'loc_src' }] },
      },
    },
    NPC: {
      [PC]:       { 姓名: '林九', 位置: 'loc_src' },
      [NPC_WANG]: { 姓名: '王掌柜', 位置: 'loc_src' },
      [NPC_HONG]: { 姓名: '红姨', 位置: 'loc_dst' },
    },
  });
}

/**
 * 单区域退化世界：A(区域级) + 两个子地点 sub1/sub2。
 * PC+WANG 在 sub1（同地·一跳），HONG 在 sub2（不同地·二跳·但同区域→factor=1）。
 */
function makeSingleRegionWorld() {
  return RootSchema.parse({
    地图: {
      地点: {
        loc_region_a: { 类别: '区域级', 相邻: [] },
        loc_sub_1: { 类别: '场所', 父节点: 'loc_region_a', 相邻: [] },
        loc_sub_2: { 类别: '场所', 父节点: 'loc_region_a', 相邻: [] },
      },
    },
    NPC: {
      [PC]:       { 姓名: '林九', 位置: 'loc_sub_1' },
      [NPC_WANG]: { 姓名: '王掌柜', 位置: 'loc_sub_1' },
      [NPC_HONG]: { 姓名: '红姨', 位置: 'loc_sub_2' },
    },
  });
}

// ── S1 · 距离单调性 ──────────────────────────────────────────────────────────

describe('G1-S1 · 距离单调性', () => {
  it('一跳区域观察者(HONG) 强度 > 二跳区域观察者(ZHAO)（同等信任·同源涟漪）', () => {
    const s0 = makeLinearRegionWorld();
    (s0.NPC[NPC_WANG] as { 关系: { 对象键: string; 类型: string; 强度: number; 极性: string; 信任: number; 深度: number }[] }).关系 = [
      { 对象键: NPC_HONG, 类型: '友人', 强度: 80, 极性: '正', 信任: 100, 深度: 70 },
      { 对象键: NPC_ZHAO, 类型: '友人', 强度: 80, 极性: '正', 信任: 100, 深度: 70 },
    ];
    emitRipple(s0.$涟漪候选, PC, { 标签: '壮举', 极性: '正', 强度: 80, 可见性: '公开', 来源拍号: 0 });
    const { state: s1 } = runTick(s0, { tickId: 'spatial-s1-mono', spanMinutes: 1440 });

    const hongStr = s1.认知档案[NPC_HONG]?.[PC]?.印象[0]?.强度 ?? -1;
    const zhaoStr = s1.认知档案[NPC_ZHAO]?.[PC]?.印象[0]?.强度 ?? -1;

    expect(hongStr).toBeGreaterThan(0);  // 1-hop region：有印象
    expect(zhaoStr).toBeGreaterThan(0);  // 2-hop region：有印象（但更弱）
    expect(hongStr).toBeGreaterThan(zhaoStr); // 严格单调递减
  });

  it('一跳区域因子 > 两跳区域因子（数值比：0.7^1 vs 0.7^2）', () => {
    const s0 = makeLinearRegionWorld();
    (s0.NPC[NPC_WANG] as { 关系: { 对象键: string; 类型: string; 强度: number; 极性: string; 信任: number; 深度: number }[] }).关系 = [
      { 对象键: NPC_HONG, 类型: '友人', 强度: 80, 极性: '正', 信任: 100, 深度: 70 },
      { 对象键: NPC_ZHAO, 类型: '友人', 强度: 80, 极性: '正', 信任: 100, 深度: 70 },
    ];
    emitRipple(s0.$涟漪候选, PC, { 标签: '义举', 极性: '正', 强度: 80, 可见性: '公开', 来源拍号: 0 });
    const { state: s1 } = runTick(s0, { tickId: 'spatial-s1-ratio', spanMinutes: 1440 });

    const hongStr = s1.认知档案[NPC_HONG]?.[PC]?.印象[0]?.强度 ?? 0;
    const zhaoStr = s1.认知档案[NPC_ZHAO]?.[PC]?.印象[0]?.强度 ?? 0;
    // hong/zhao 比值应接近 hop_decay^1 / hop_decay^2 = 1 / 0.7 ≈ 1.43
    expect(hongStr / zhaoStr).toBeGreaterThan(1.3);
    expect(hongStr / zhaoStr).toBeLessThan(1.6);
  });
});

// ── S2 · 密度方向 ────────────────────────────────────────────────────────────

describe('G1-S2 · 密度方向', () => {
  it('高密度目标区(大型 1.2) 二跳强度 > 低密度目标区(微型 0.7)（1跳·同信任）', () => {
    function run(density: string) {
      const s0 = makeDensityWorld(density);
      (s0.NPC[NPC_WANG] as { 关系: { 对象键: string; 类型: string; 强度: number; 极性: string; 信任: number; 深度: number }[] }).关系 = [
        { 对象键: NPC_HONG, 类型: '友人', 强度: 80, 极性: '正', 信任: 100, 深度: 70 },
      ];
      emitRipple(s0.$涟漪候选, PC, { 标签: '壮举', 极性: '正', 强度: 80, 可见性: '公开', 来源拍号: 0 });
      const { state: s1 } = runTick(s0, { tickId: `density-${density}`, spanMinutes: 1440 });
      return s1.认知档案[NPC_HONG]?.[PC]?.印象[0]?.强度 ?? 0;
    }

    const strengthHigh = run('大型');
    const strengthLow  = run('微型');

    expect(strengthHigh).toBeGreaterThan(0);
    expect(strengthLow).toBeGreaterThan(0);
    expect(strengthHigh).toBeGreaterThan(strengthLow); // 高密度 > 低密度
  });

  it('密度梯度：超大型 > 大型 > 中型 > 小型 > 微型（严格递减）', () => {
    const tiers = ['超大型', '大型', '中型', '小型', '微型'];
    const strengths = tiers.map((tier, i) => {
      const s0 = makeDensityWorld(tier);
      (s0.NPC[NPC_WANG] as { 关系: { 对象键: string; 类型: string; 强度: number; 极性: string; 信任: number; 深度: number }[] }).关系 = [
        { 对象键: NPC_HONG, 类型: '友人', 强度: 80, 极性: '正', 信任: 100, 深度: 70 },
      ];
      emitRipple(s0.$涟漪候选, PC, { 标签: '壮举', 极性: '正', 强度: 80, 可见性: '公开', 来源拍号: i });
      const { state: s1 } = runTick(s0, { tickId: `tier-${tier}`, spanMinutes: 1440 });
      return s1.认知档案[NPC_HONG]?.[PC]?.印象[0]?.强度 ?? 0;
    });
    for (let i = 0; i < strengths.length - 1; i++) {
      expect(strengths[i]).toBeGreaterThan(strengths[i + 1]!);
    }
  });
});

// ── S3 · 退化不变式 ──────────────────────────────────────────────────────────

describe('G1-S3 · 退化不变式', () => {
  it('无区域图（地图.地点={}）：二跳强度 = 40（与 G1a 逐位一致·factor=1）', () => {
    // buildWorld() 的 地图.地点 默认为 {}（无区域图）
    const s0 = buildWorld();
    (s0.NPC[NPC_HONG] as { 位置: string }).位置 = 'other_loc';
    (s0.NPC[NPC_WANG] as { 关系: { 对象键: string; 类型: string; 强度: number; 极性: string; 信任: number; 深度: number }[] }).关系 = [
      { 对象键: NPC_HONG, 类型: '友人', 强度: 80, 极性: '正', 信任: 100, 深度: 70 },
    ];
    emitRipple(s0.$涟漪候选, PC, { 标签: '壮举', 极性: '正', 强度: 80, 可见性: '公开', 来源拍号: 0 });
    const { state: s1 } = runTick(s0, { tickId: 'degenerate-nomap', spanMinutes: 1440 });
    // 无地图 → factor=1 → 80 × 0.5 × (100/100) × 1.0 = 40（逐位恒等）
    expect(s1.认知档案[NPC_HONG]?.[PC]?.印象[0]?.强度).toBe(40);
  });

  it('单区域世界（HONG 同区 sub 地点）：二跳强度 = 40（factor=1·同区域短路）', () => {
    const s0 = makeSingleRegionWorld();
    (s0.NPC[NPC_WANG] as { 关系: { 对象键: string; 类型: string; 强度: number; 极性: string; 信任: number; 深度: number }[] }).关系 = [
      { 对象键: NPC_HONG, 类型: '友人', 强度: 80, 极性: '正', 信任: 100, 深度: 70 },
    ];
    emitRipple(s0.$涟漪候选, PC, { 标签: '壮举', 极性: '正', 强度: 80, 可见性: '公开', 来源拍号: 0 });
    const { state: s1 } = runTick(s0, { tickId: 'degenerate-single', spanMinutes: 1440 });
    // 同区域 → factor=1 → 80 × 0.5 × 1.0 × 1.0 = 40
    expect(s1.认知档案[NPC_HONG]?.[PC]?.印象[0]?.强度).toBe(40);
  });

  it('多区域世界下 1-hop 观察者（同地·co-located）强度不变 = 80', () => {
    const s0 = makeLinearRegionWorld();
    emitRipple(s0.$涟漪候选, PC, { 标签: '壮举', 极性: '正', 强度: 80, 可见性: '公开', 来源拍号: 0 });
    const { state: s1 } = runTick(s0, { tickId: 'degenerate-1hop', spanMinutes: 1440 });
    // WANG 在场（同地·一跳）→ 空间因子不介入 → 强度 = 80
    expect(s1.认知档案[NPC_WANG]?.[PC]?.印象[0]?.强度).toBe(80);
    expect(s1.认知档案[NPC_WANG]?.[PC]?.印象[0]?.来源类型).toBe('一手观测');
  });
});

// ── S4 · 确定性 ──────────────────────────────────────────────────────────────

describe('G1-S4 · 确定性', () => {
  it('同 state + 同 tickId 双跑结果逐位恒等（空间因子路径）', () => {
    const s0 = makeLinearRegionWorld();
    (s0.NPC[NPC_WANG] as { 关系: { 对象键: string; 类型: string; 强度: number; 极性: string; 信任: number; 深度: number }[] }).关系 = [
      { 对象键: NPC_HONG, 类型: '友人', 强度: 80, 极性: '正', 信任: 100, 深度: 70 },
    ];
    emitRipple(s0.$涟漪候选, PC, { 标签: '壮举', 极性: '正', 强度: 80, 可见性: '公开', 来源拍号: 0 });

    const r1 = runTick(s0, { tickId: 'det-spatial-1', spanMinutes: 1440 });
    const r2 = runTick(s0, { tickId: 'det-spatial-1', spanMinutes: 1440 });

    // 关键字段逐位恒等
    const str1 = r1.state.认知档案[NPC_HONG]?.[PC]?.印象[0]?.强度;
    const str2 = r2.state.认知档案[NPC_HONG]?.[PC]?.印象[0]?.强度;
    expect(str1).toBe(str2);
    expect(JSON.stringify(r1.state.认知档案)).toBe(JSON.stringify(r2.state.认知档案));
  });

  it('不同区域跳数产生不同强度（可区分·非退化）', () => {
    const s0 = makeLinearRegionWorld();
    (s0.NPC[NPC_WANG] as { 关系: { 对象键: string; 类型: string; 强度: number; 极性: string; 信任: number; 深度: number }[] }).关系 = [
      { 对象键: NPC_HONG, 类型: '友人', 强度: 80, 极性: '正', 信任: 100, 深度: 70 },
      { 对象键: NPC_ZHAO, 类型: '友人', 强度: 80, 极性: '正', 信任: 100, 深度: 70 },
    ];
    emitRipple(s0.$涟漪候选, PC, { 标签: '壮举', 极性: '正', 强度: 80, 可见性: '公开', 来源拍号: 0 });
    const { state: s1 } = runTick(s0, { tickId: 'det-spatial-diff', spanMinutes: 1440 });

    const hongStr = s1.认知档案[NPC_HONG]?.[PC]?.印象[0]?.强度;
    const zhaoStr = s1.认知档案[NPC_ZHAO]?.[PC]?.印象[0]?.强度;
    // 确认两者不同（空间因子实际有效）
    expect(hongStr).toBeDefined();
    expect(zhaoStr).toBeDefined();
    expect(hongStr).not.toBe(zhaoStr);
  });
});

// ── S5 · covert 仍零印象（继承 G1a·回归防护） ───────────────────────────────

describe('G1-S5 · covert 零印象（空间因子路径继承 G1a）', () => {
  it('多区域世界中 covert 涟漪 → 一跳/二跳均不落印象', () => {
    const s0 = makeLinearRegionWorld();
    (s0.NPC[NPC_WANG] as { 关系: { 对象键: string; 类型: string; 强度: number; 极性: string; 信任: number; 深度: number }[] }).关系 = [
      { 对象键: NPC_HONG, 类型: '友人', 强度: 80, 极性: '正', 信任: 100, 深度: 70 },
    ];
    emitRipple(s0.$涟漪候选, PC, { 标签: '暗中布局', 极性: '中', 强度: 90, 可见性: '隐秘', 来源拍号: 0 });
    const { state: s1 } = runTick(s0, { tickId: 'spatial-covert', spanMinutes: 1440 });
    expect(s1.认知档案[NPC_WANG]?.[PC]?.印象.length ?? 0).toBe(0); // 一跳零印象
    expect(s1.认知档案[NPC_HONG]?.[PC]?.印象.length ?? 0).toBe(0); // 二跳零印象
  });
});

// ── S6 · 关系涟漪 Δ方向语义修正（R3-b 判定面·tick 路径）────────────────────────
// 旧 ===负?-1:1 把「中负」当 +1 → 写'信任感'（latent bug）。
// 新 polaritySign 写 -1 → 写'警惕'。
// 路径：NPC.关系[极性='中负'] → Phase6 emitRipple → propagateRipple(一跳) → applyAppraisal。

describe('G1-S6 · 关系涟漪 Δ方向 polaritySign 语义修正（R3-b 判定面）', () => {
  it('rel.极性=中负：factFragment.Δ方向=-1·情绪写警惕（旧+1=信任感 latent bug 已修）', () => {
    // alice → bob 关系 极性=中负，score=80≥50 触发 Phase6 ripple about bob
    // carol 同地 bob(loc_b) → 一手观测 → factFragment.Δ方向=-1 → applyAppraisal → 警惕
    const s0 = RootSchema.parse({
      NPC: {
        alice: { 姓名: 'alice', 位置: 'loc_a',
          关系: [{ 对象键: 'bob', 类型: '怨仇', 强度: 80, 极性: '中负', 信任: 100, 深度: 50 }] },
        bob:   { 姓名: 'bob',   位置: 'loc_b' },
        carol: { 姓名: 'carol', 位置: 'loc_b' },
      },
    });
    const { state: s1 } = runTick(s0, { tickId: 'rel-zhongfu-411', spanMinutes: 1440 });

    const imp = s1.认知档案['carol']?.['bob']?.印象.find(i => i.factFragment?.维度 === '关系');
    expect(imp).toBeDefined();
    expect(imp?.factFragment?.Δ方向).toBe(-1); // 新正确值；旧=+1（killer：此行在旧引擎失败）

    // applyAppraisal: EMOTION_DIMENSION_MAP['关系']{pos:'信任感',neg:'警惕'}
    const 警惕 = s1.NPC['carol']?.情绪栈.find(e => e.情绪名 === '警惕');
    expect(警惕).toBeDefined();       // 旧引擎缺席
    expect(警惕?.极性).toBe('负');

    const 信任感 = s1.NPC['carol']?.情绪栈.find(e => e.情绪名 === '信任感');
    expect(信任感).toBeUndefined();   // 旧引擎存在→新修正后不存在
  });

  it('rel.极性=中：factFragment.Δ方向=0（旧=+1）·情绪仍信任感（0≥0→pos·结构值已修正）', () => {
    const s0 = RootSchema.parse({
      NPC: {
        alice: { 姓名: 'alice', 位置: 'loc_a',
          关系: [{ 对象键: 'bob', 类型: '相识', 强度: 80, 极性: '中', 信任: 100, 深度: 30 }] },
        bob:   { 姓名: 'bob',   位置: 'loc_b' },
        carol: { 姓名: 'carol', 位置: 'loc_b' },
      },
    });
    const { state: s1 } = runTick(s0, { tickId: 'rel-zhong-411', spanMinutes: 1440 });

    const imp = s1.认知档案['carol']?.['bob']?.印象.find(i => i.factFragment?.维度 === '关系');
    expect(imp).toBeDefined();
    expect(imp?.factFragment?.Δ方向).toBe(0); // 新=0（中性无方向）；旧=+1

    // 0≥0→pos→'信任感'·情绪输出与旧一致·但 factFragment 结构值已修正
    const 信任感 = s1.NPC['carol']?.情绪栈.find(e => e.情绪名 === '信任感');
    expect(信任感).toBeDefined();
  });
});
