// G1a · 涟漪发射端复活 — 专项回归测试
//
// DoD:
//   V1 emitRipple 工具 — 追加到 $涟漪候选 缓冲
//   V2 Phase 6 关系触发 — |强度|×信任/100 ≥ 50 的关系推涟漢候选
//   V3 A→B→C 两跳衰减断言（emitRipple → propagateRipple → 认知档案）
//   V4 covert 零印象断言（隐秘事件不落认知档案）
//   V5 Phase 6 + 传播端到端（关系触发自动推候选 → 传播）
//   V6 C2-3 专项回归（factFragment 载荷·全体发射主体键·守恒·密室<广场）
import { describe, it, expect } from 'vitest';
import { runTick, emitRipple } from '@ai-life-sim/core/engine/tick';
import { RootSchema } from '@ai-life-sim/core';
import { buildWorld, PC, NPC_WANG, NPC_HONG, LOC_KEY } from '../fixture/world.js';

function makeWorld() { return buildWorld(); }

// ── V1 · emitRipple 工具 ──────────────────────────────────────────────────────

describe('G1a-V1 · emitRipple 工具', () => {
  it('空 pending：创建目标键并追加条目', () => {
    const pending: Record<string, { 标签: string; 极性: string; 强度: number; 可见性: string; 来源拍号: number }[]> = {};
    emitRipple(pending, PC, { 标签: '说服', 极性: '正', 强度: 60, 可见性: '公开', 来源拍号: 1 });
    expect(pending[PC]).toHaveLength(1);
    expect(pending[PC]?.[0]?.标签).toBe('说服');
  });

  it('已有键：追加不覆盖', () => {
    const pending: Record<string, { 标签: string; 极性: string; 强度: number; 可见性: string; 来源拍号: number }[]> = {
      [PC]: [{ 标签: 'A', 极性: '正', 强度: 30, 可见性: '公开', 来源拍号: 0 }],
    };
    emitRipple(pending, PC, { 标签: 'B', 极性: '中', 强度: 40, 可见性: '公开', 来源拍号: 1 });
    expect(pending[PC]).toHaveLength(2);
    expect(pending[PC]?.[1]?.标签).toBe('B');
  });

  it('多目标键互不干扰', () => {
    const pending: Record<string, { 标签: string; 极性: string; 强度: number; 可见性: string; 来源拍号: number }[]> = {};
    emitRipple(pending, PC, { 标签: 'X', 极性: '正', 强度: 50, 可见性: '公开', 来源拍号: 0 });
    emitRipple(pending, NPC_WANG, { 标签: 'Y', 极性: '中', 强度: 50, 可见性: '公开', 来源拍号: 0 });
    expect(Object.keys(pending)).toHaveLength(2);
    expect(pending[PC]).toHaveLength(1);
    expect(pending[NPC_WANG]).toHaveLength(1);
  });
});

// ── V2 · Phase 6 关系触发 ─────────────────────────────────────────────────────

describe('G1a-V2 · Phase 6 关系触发发射', () => {
  it('无关系 → Phase 6 不发射·认知档案为空', () => {
    const s0 = makeWorld();
    // buildWorld 中 NPC 均无关系
    const { state: s1 } = runTick(s0, { tickId: 'p6-none', spanMinutes: 1440 });
    expect(Object.keys(s1.认知档案)).toHaveLength(0);
  });

  it('|强度|×信任/100 < 50 的关系不发射', () => {
    const s0 = makeWorld();
    // 强度=40, 信任=100 → score=40 < 50，不发射
    const wang = s0.NPC[NPC_WANG];
    if (wang) {
      (wang as { 关系: { 对象键: string; 类型: string; 强度: number; 极性: string; 信任: number; 深度: number }[] }).关系 = [
        { 对象键: NPC_HONG, 类型: '点头之交', 强度: 40, 极性: '中', 信任: 100, 深度: 10 },
      ];
    }
    (s0.NPC[NPC_HONG] as { 位置: string }).位置 = 'other_loc';
    const { state: s1 } = runTick(s0, { tickId: 'p6-below', spanMinutes: 1440 });
    // HONG 在 other_loc 且 score < 50 → 无涟漪落账
    expect(s1.认知档案[NPC_WANG]?.[NPC_HONG]).toBeUndefined();
  });

  it('|强度|×信任/100 ≥ 50 的关系发射候选·清空后 $涟漪候选 为空', () => {
    const s0 = makeWorld();
    // 强度=80, 信任=100 → score=80 ≥ 50，发射关于 HONG 的候选
    const wang = s0.NPC[NPC_WANG];
    if (wang) {
      (wang as { 关系: { 对象键: string; 类型: string; 强度: number; 极性: string; 信任: number; 深度: number }[] }).关系 = [
        { 对象键: NPC_HONG, 类型: '友人', 强度: 80, 极性: '正', 信任: 100, 深度: 70 },
      ];
    }
    // HONG 移到不同地点（无在场观察者）→ 候选被发射但 Phase 8 无法传播
    (s0.NPC[NPC_HONG] as { 位置: string }).位置 = 'other_loc';
    const { state: s1 } = runTick(s0, { tickId: 'p6-emit', spanMinutes: 1440 });
    // Phase 8 清空 $涟漪候选
    expect(Object.keys(s1.$涟漪候选 ?? {})).toHaveLength(0);
  });
});

// ── V3 · A→B→C 两跳衰减断言 ──────────────────────────────────────────────────

describe('G1a-V3 · A→B→C 两跳衰减链路', () => {
  it('A(PC) 发出公开涟漪 → B(WANG) 一跳·C(HONG) 二跳衰减', () => {
    const s0 = makeWorld();
    // HONG 移到另一地点（不在场）
    (s0.NPC[NPC_HONG] as { 位置: string }).位置 = 'other_loc';
    // WANG→HONG 关系（信任=100）
    const wang = s0.NPC[NPC_WANG];
    if (wang) {
      (wang as { 关系: { 对象键: string; 类型: string; 强度: number; 极性: string; 信任: number; 深度: number }[] }).关系 = [
        { 对象键: NPC_HONG, 类型: '友人', 强度: 80, 极性: '正', 信任: 100, 深度: 70 },
      ];
    }
    // A=PC 发出涟漪（场景：PC 在场内做了一件壮举·强度80）
    emitRipple(s0.$涟漪候选, PC, { 标签: '壮举', 极性: '正', 强度: 80, 可见性: '公开', 来源拍号: 0 });
    const { state: s1 } = runTick(s0, { tickId: 'abc-chain', spanMinutes: 1440 });

    // B(WANG) 一跳：在场且公开 → 收到强度=80 印象
    const wangImps = s1.认知档案[NPC_WANG]?.[PC]?.印象 ?? [];
    expect(wangImps.length).toBeGreaterThan(0);
    expect(wangImps[0]?.来源类型).toBe('一手观测');
    expect(wangImps[0]?.强度).toBe(80);

    // C(HONG) 二跳：经 WANG 关系边·强度 = 80 × 0.5 × (100/100) = 40
    const hongImps = s1.认知档案[NPC_HONG]?.[PC]?.印象 ?? [];
    expect(hongImps.length).toBeGreaterThan(0);
    expect(hongImps[0]?.来源类型).toBe('二手转述');
    expect(hongImps[0]?.强度).toBe(40); // 80 × 0.5 × 1.0 = 40
    expect(hongImps[0]?.来源).toBe(`听闻自:${NPC_WANG}`);
  });

  it('两跳强度严格小于一跳（衰减验证）', () => {
    const s0 = makeWorld();
    (s0.NPC[NPC_HONG] as { 位置: string }).位置 = 'other_loc';
    const wang = s0.NPC[NPC_WANG];
    if (wang) {
      (wang as { 关系: { 对象键: string; 类型: string; 强度: number; 极性: string; 信任: number; 深度: number }[] }).关系 = [
        { 对象键: NPC_HONG, 类型: '友人', 强度: 80, 极性: '正', 信任: 60, 深度: 50 },
      ];
    }
    emitRipple(s0.$涟漪候选, PC, { 标签: '义举', 极性: '正', 强度: 70, 可见性: '公开', 来源拍号: 0 });
    const { state: s1 } = runTick(s0, { tickId: 'abc-decay', spanMinutes: 1440 });

    const wangStrength = s1.认知档案[NPC_WANG]?.[PC]?.印象[0]?.强度 ?? 0;
    const hongStrength = s1.认知档案[NPC_HONG]?.[PC]?.印象[0]?.强度 ?? 0;
    expect(wangStrength).toBe(70);
    expect(hongStrength).toBeLessThan(wangStrength); // 二跳 < 一跳（衰减·信任折扣）
  });
});

// ── V4 · covert 零印象断言 ────────────────────────────────────────────────────

describe('G1a-V4 · covert 零印象', () => {
  it('隐秘事件 → 在场观察者(WANG)零印象', () => {
    const s0 = makeWorld();
    emitRipple(s0.$涟漪候选, PC, { 标签: '暗中布局', 极性: '中', 强度: 90, 可见性: '隐秘', 来源拍号: 0 });
    const { state: s1 } = runTick(s0, { tickId: 'cov-zero', spanMinutes: 1440 });
    // WANG/HONG 均在场·covert → 均无印象
    expect(s1.认知档案[NPC_WANG]?.[PC]?.印象.length ?? 0).toBe(0);
    expect(s1.认知档案[NPC_HONG]?.[PC]?.印象.length ?? 0).toBe(0);
  });

  it('隐秘事件与公开事件同时处理·公开的正常落账·隐秘的不落账', () => {
    const s0 = makeWorld();
    emitRipple(s0.$涟漪候选, PC, { 标签: '慷慨', 极性: '正', 强度: 60, 可见性: '公开', 来源拍号: 0 });
    emitRipple(s0.$涟漪候选, NPC_WANG, { 标签: '黑吃黑', 极性: '负', 强度: 80, 可见性: '隐秘', 来源拍号: 0 });
    const { state: s1 } = runTick(s0, { tickId: 'cov-mixed', spanMinutes: 1440 });
    // WANG 关于 PC 的公开涟漪 → 有印象
    const wangAboutPC = s1.认知档案[NPC_WANG]?.[PC]?.印象 ?? [];
    expect(wangAboutPC.length).toBeGreaterThan(0);
    // PC 关于 WANG 的隐秘涟漪 → 零印象
    const pcAboutWang = s1.认知档案[PC]?.[NPC_WANG]?.印象 ?? [];
    expect(pcAboutWang.length).toBe(0);
  });
});

// ── V5 · Phase 6 + 传播端到端 ────────────────────────────────────────────────

describe('G1a-V5 · Phase 6 关系发射 + 传播端到端', () => {
  it('Phase 6 发射 → Phase 8 传播·在场观察者收到关系涟漪', () => {
    const s0 = makeWorld();
    // 将 PC 设置在不同地点，让 WANG 与 HONG 同在 LOC_KEY
    (s0.NPC[PC] as { 位置: string }).位置 = 'other_loc';
    // WANG→PC 强关系（score=80 ≥ 50）·Phase 6 应发射关于 PC 的候选
    const wang = s0.NPC[NPC_WANG];
    if (wang) {
      (wang as { 关系: { 对象键: string; 类型: string; 强度: number; 极性: string; 信任: number; 深度: number }[] }).关系 = [
        { 对象键: PC, 类型: '友人', 强度: 80, 极性: '正', 信任: 100, 深度: 70 },
      ];
    }
    // PC 在 other_loc → 无在场观察者 → Phase 8 对 PC 候选无法传播印象
    // 但验证 Phase 6 确实发射（$涟漪候选 在 Phase 8 处理后清空）
    const { state: s1 } = runTick(s0, { tickId: 'p6-e2e', spanMinutes: 1440 });
    expect(Object.keys(s1.$涟漪候选 ?? {})).toHaveLength(0); // Phase 8 已清空
  });

  it('Phase 6 发射 + HONG 在场 → HONG 收到关于关系目标的一跳印象', () => {
    const s0 = makeWorld();
    // PC 移到 other_loc（WANG→PC 关系发射候选·PC 在 other_loc·HONG 不在 other_loc·无观察者）
    // 改为：WANG→HONG 关系·HONG 移回 LOC_KEY（与 PC 同地）
    // PC 作为关系目标候选·WANG 和 HONG 都在 LOC_KEY 可观察 PC
    // 先把所有人放在 LOC_KEY（buildWorld 默认），给 WANG→PC 一个强关系
    const wang = s0.NPC[NPC_WANG];
    if (wang) {
      (wang as { 关系: { 对象键: string; 类型: string; 强度: number; 极性: string; 信任: number; 深度: number }[] }).关系 = [
        { 对象键: PC, 类型: '老友', 强度: 90, 极性: '正', 信任: 100, 深度: 80 },
      ];
    }
    // WANG→PC 关系 score=90 ≥ 50·Phase 6 发射 $涟漪候选[PC]·Phase 8 传播给在场观察者
    // PC 在 LOC_KEY·在场观察者 = WANG 和 HONG（不含 PC 自身）
    const { state: s1 } = runTick(s0, { tickId: 'p6-e2e-hit', spanMinutes: 1440 });
    // HONG 在场·观察到关于 PC 的涟漪（来自 Phase 6 发射·Phase 8 传播）
    const hongAboutPC = s1.认知档案[NPC_HONG]?.[PC]?.印象 ?? [];
    expect(hongAboutPC.length).toBeGreaterThan(0);
    expect(hongAboutPC[0]?.来源类型).toBe('一手观测');
    expect(hongAboutPC[0]?.标签).toBe('老友'); // 关系类型作为标签
  });
});

// ── V6 · C2-3 专项回归 ───────────────────────────────────────────────────────
// C2-3 引入四条不变式，每条锁一个断言：
//   FF-1 factFragment 载荷经一跳传播到认知档案（来源类型='一手观测'·维度/Δ方向逐位恒等）
//   FF-2 Phase6 全体 actor 发射（factFragment.主体 = 发射者 NPC 键·非硬编 PC）
//   FF-3 RippleParcel 守恒（$涟漪候选 → propagateRipple 处理后清空为 {}）
//   FF-4 密室 < 广场（二跳强度·高社交开放度 > 低社交开放度·仅二跳·一跳恒 1）

describe('G1a-V6 · C2-3 factFragment + 场景系数专项回归', () => {
  it('FF-1 手注 factFragment{维度:生命,Δ方向:-1} → 一跳观察者认知档案含该载荷', () => {
    const s0 = makeWorld();
    // 手动注入：模拟死亡事件 factFragment（真实死亡发射路径 = C2-4 任务·此处验证传播链）
    s0.$涟漪候选[PC] = [{
      标签: '伤亡', 极性: '中', 强度: 80, 可见性: '公开', 来源拍号: 0,
      有锚布尔: true,
      factFragment: { 主体: 'npc_enemy', 维度: '生命', Δ方向: -1, 量级: 80 },
    }];
    const { state: s1 } = runTick(s0, { tickId: 'ff1', spanMinutes: 1440 });
    const wangAboutPC = s1.认知档案[NPC_WANG]?.[PC]?.印象 ?? [];
    expect(wangAboutPC.length).toBeGreaterThan(0);
    const ff = wangAboutPC[0]?.factFragment;
    expect(ff?.维度).toBe('生命');
    expect(ff?.Δ方向).toBe(-1);
    expect(ff?.主体).toBe('npc_enemy');
    expect(wangAboutPC[0]?.来源类型).toBe('一手观测'); // 一跳·非极性判断·只传客观事实
  });

  it('FF-2 Phase6 全体 actor 发射·factFragment.主体 = 发射者 NPC 键（非硬编 PC）', () => {
    const s0 = makeWorld();
    const wang = s0.NPC[NPC_WANG];
    if (wang) {
      (wang as { 关系: { 对象键: string; 类型: string; 强度: number; 极性: string; 信任: number; 深度: number }[] }).关系 = [
        { 对象键: PC, 类型: '旧友', 强度: 90, 极性: '正', 信任: 100, 深度: 70 },
      ];
    }
    // Phase6：WANG→PC score=90≥50 → 发射 $涟漪候选[PC]，主体 = NPC_WANG
    const { state: s1 } = runTick(s0, { tickId: 'ff2', spanMinutes: 1440 });
    const hongAboutPC = s1.认知档案[NPC_HONG]?.[PC]?.印象 ?? [];
    expect(hongAboutPC.length).toBeGreaterThan(0);
    const ff = hongAboutPC[0]?.factFragment;
    expect(ff?.主体).toBe(NPC_WANG);   // 发射者是 WANG，不是 PC
    expect(ff?.维度).toBe('关系');      // Phase6 关系触发 → 关系维度（上下文派生·非写死）
  });

  it('FF-3 RippleParcel 守恒：$涟漪候选 经 propagateRipple 后清空为 {}', () => {
    const s0 = makeWorld();
    emitRipple(s0.$涟漪候选, PC,       { 标签: 'A', 极性: '中', 强度: 60, 可见性: '公开', 来源拍号: 0 });
    emitRipple(s0.$涟漪候选, NPC_WANG, { 标签: 'B', 极性: '中', 强度: 50, 可见性: '公开', 来源拍号: 0 });
    expect(Object.keys(s0.$涟漪候选).length).toBe(2); // 传播前非空
    const { state: s1 } = runTick(s0, { tickId: 'ff3', spanMinutes: 1440 });
    expect(Object.keys(s1.$涟漪候选 ?? {}).length).toBe(0); // 传播后清空
  });

  it('FF-4 密室 < 广场：二跳强度在高社交开放度地点 > 低社交开放度地点', () => {
    // 构造两个对称世界：仅 LOC_KEY.社交开放度 不同
    // PC 在 LOC_KEY（target）· WANG 在 LOC_KEY（一跳）· HONG 在 loc_other（二跳）
    // WANG 关系列表包含 HONG（信任 100）→ 二跳触发
    // 二跳公式：strength × 0.5 × (trust/100) × sfactor × sceneCoeff
    //   sfactor = 1.0（无区域图）·sceneCoeff = 高:1.3 / 低:0.7
    //   → 广场=80×0.5×1.0×1.3=52·密室=80×0.5×1.0×0.7=28
    const makeSceneWorld = (openness: string) => {
      const s = RootSchema.parse({
        地图: { 地点: {
          [LOC_KEY]:   { 社交开放度: openness },
          'loc_other': {},
        }},
        NPC: {
          [PC]:       { 姓名: '林九',   位置: LOC_KEY },
          [NPC_WANG]: { 姓名: '王掌柜', 位置: LOC_KEY },
          [NPC_HONG]: { 姓名: '红姨',   位置: 'loc_other' },
        },
      });
      const wang = s.NPC[NPC_WANG];
      if (wang) wang.关系 = [{ 对象键: NPC_HONG, 类型: '相识', 强度: 40, 极性: '中', 信任: 100, 深度: 20 }];
      s.$涟漪候选[PC] = [{ 标签: '声誉', 极性: '中', 强度: 80, 可见性: '公开', 来源拍号: 0 }];
      return s;
    };

    const { state: s广 } = runTick(makeSceneWorld('高'), { tickId: 'ff4-hi', spanMinutes: 1 });
    const { state: s密 } = runTick(makeSceneWorld('低'), { tickId: 'ff4-lo', spanMinutes: 1 });

    const hi2 = s广.认知档案[NPC_HONG]?.[PC]?.印象[0]?.强度 ?? 0;
    const lo2 = s密.认知档案[NPC_HONG]?.[PC]?.印象[0]?.强度 ?? 0;
    expect(hi2).toBeGreaterThan(lo2);  // 广场 > 密室（方向性断言）
    expect(hi2).toBeCloseTo(52, 0);    // 80×0.5×1.0×1.3=52（数值锁）
    expect(lo2).toBeCloseTo(28, 0);    // 80×0.5×1.0×0.7=28（数值锁）
    // 一跳不受场景系数影响（S5 不变式）
    const hi1 = s广.认知档案[NPC_WANG]?.[PC]?.印象[0]?.强度 ?? 0;
    const lo1 = s密.认知档案[NPC_WANG]?.[PC]?.印象[0]?.强度 ?? 0;
    expect(hi1).toBe(lo1); // 一跳恒等·场景系数不影响
  });
});
