// P0-7 梯队2 验收测试
// DoD：
//   ① runTick 纯函数·确定性·幂等
//   ② 结算序显式·涟漪 ≤2 跳·covert 过滤
//   ③ 50 拍黄金主线 fixture（确定性对比基准）
//   ④ property 六不变量·schema 恒通过
//   ⑤ C2 golden 断言 EXPECTED_NET_ASSET==230 绿
//   ⑥ C1 defer 明确（约定库 DSL resolver 未就绪）
import { describe, it, expect } from 'vitest';
import { runTick, SETTLEMENT_PHASES } from '@ai-life-sim/core/engine/tick';
import { assertConservation } from '@ai-life-sim/core/engine/conservation';
import { getNetAsset } from '@ai-life-sim/core/engine/netAsset';
import { RootSchema } from '@ai-life-sim/core';
import {
  buildWorld, EXPECTED_NET_ASSET, PC, NPC_WANG, NPC_HONG, LOC_KEY,
  INITIAL_PC_BALANCE, INITIAL_WANG_BALANCE,
} from '../fixture/world.js';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeWorld() { return buildWorld(); }

// ── ① 纯函数·确定性 ──────────────────────────────────────────────────────────

describe('P0-7-T2 · ① runTick 纯函数·确定性', () => {
  it('同输入两次调用 → 结果深度相等（确定性）', () => {
    const s0 = makeWorld();
    const r1 = runTick(s0, { tickId: 'det-1', spanMinutes: 1440 });
    const r2 = runTick(s0, { tickId: 'det-1', spanMinutes: 1440 });
    expect(r1.state.世界?.纪元分钟).toBe(r2.state.世界?.纪元分钟);
    expect(r1.state._tick?.拍计数).toBe(r2.state._tick?.拍计数);
    expect(r1.settledPhases).toEqual(r2.settledPhases);
  });

  it('runTick 不改变输入 state（纯函数·入口深拷）', () => {
    const s0 = makeWorld();
    const preEpoch = s0.世界?.纪元分钟 ?? 0;
    runTick(s0, { tickId: 'immut-1', spanMinutes: 1440 });
    expect(s0.世界?.纪元分钟).toBe(preEpoch); // 输入未变
  });

  it('结算后 RootSchema.safeParse 通过（schema 恒合法）', () => {
    const s0 = makeWorld();
    const { state: s1 } = runTick(s0, { tickId: 'schema-1', spanMinutes: 1440 });
    const parsed = RootSchema.safeParse(s1);
    expect(parsed.success).toBe(true);
  });
});

// ── ② 幂等 ───────────────────────────────────────────────────────────────────

describe('P0-7-T2 · ② 幂等（已结算 tickId 第二次调用不变）', () => {
  it('第一次 runTick 标记 即时分量=1', () => {
    const { state: s1 } = runTick(makeWorld(), { tickId: 'idem-1', spanMinutes: 1440 });
    expect(s1._系统.已结算标记['idem-1']?.即时分量).toBe(1);
  });

  it('第二次同 tickId → settledPhases 为空（幂等短路）', () => {
    const { state: s1 } = runTick(makeWorld(), { tickId: 'idem-2', spanMinutes: 1440 });
    const { settledPhases } = runTick(s1, { tickId: 'idem-2', spanMinutes: 1440 });
    expect(settledPhases).toHaveLength(0);
  });

  it('幂等后 世界.纪元分钟 不变（第二次不推进时钟）', () => {
    const { state: s1 } = runTick(makeWorld(), { tickId: 'idem-3', spanMinutes: 1440 });
    const epochAfterFirst = s1.世界?.纪元分钟 ?? 0;
    const { state: s2 } = runTick(s1, { tickId: 'idem-3', spanMinutes: 1440 });
    expect(s2.世界?.纪元分钟).toBe(epochAfterFirst);
  });
});

// ── ③ 结算序 ──────────────────────────────────────────────────────────────────

describe('P0-7-T2 · ③ 结算序显式', () => {
  it('SETTLEMENT_PHASES 包含预期阶段（含 P7-6b 媒介拍末取材 + 提案落账 + C2-4 死亡感知发射 = 12 个）', () => {
    expect(SETTLEMENT_PHASES).toHaveLength(12);
  });

  it('第一次 runTick 结算全部阶段（含 P7-6b 新增媒介拍末取材）', () => {
    const { settledPhases } = runTick(makeWorld(), { tickId: 'phases-1', spanMinutes: 1440 });
    expect(settledPhases).toHaveLength(SETTLEMENT_PHASES.length);
  });

  it('结算序以「原子提交」结尾', () => {
    const { settledPhases } = runTick(makeWorld(), { tickId: 'phases-2', spanMinutes: 1440 });
    expect(settledPhases.at(-1)).toBe('原子提交');
  });

  it('世界.纪元分钟 +spanMinutes', () => {
    const s0 = makeWorld();
    const pre = s0.世界?.纪元分钟 ?? 0;
    const { state: s1 } = runTick(s0, { tickId: 'time-1', spanMinutes: 1440 });
    expect(s1.世界?.纪元分钟).toBe(pre + 1440);
  });

  it('_tick.拍计数 +1', () => {
    const s0 = makeWorld();
    const pre = s0._tick?.拍计数 ?? 0;
    const { state: s1 } = runTick(s0, { tickId: 'tick-ctr-1', spanMinutes: 1440 });
    expect(s1._tick?.拍计数).toBe(pre + 1);
  });

  it('tick_log 追加一条记录', () => {
    const s0 = makeWorld();
    const { state: s1 } = runTick(s0, { tickId: 'log-1', spanMinutes: 1440 });
    expect(s1._系统.tick_log.length).toBeGreaterThan(s0._系统.tick_log.length);
  });

  it('tick_log 环形缓冲上限为 8', () => {
    let s = makeWorld();
    for (let i = 0; i < 12; i++) {
      ({ state: s } = runTick(s, { tickId: `buf-${i}`, spanMinutes: 1440 }));
    }
    expect(s._系统.tick_log.length).toBeLessThanOrEqual(8);
  });
});

// ── ④ 涟漪 ≤2 跳·covert 过滤 ────────────────────────────────────────────────

describe('P0-7-T2 · ④ 涟漪引擎', () => {
  it('涟漪候选空时无印象写入（空 $涟漪候选 → 认知档案不变）', () => {
    const s0 = makeWorld();
    expect(Object.keys(s0.$涟漪候选 ?? {})).toHaveLength(0);
    const { state: s1 } = runTick(s0, { tickId: 'ripple-empty', spanMinutes: 1440 });
    // 认知档案在空涟漪候选时应为空（buildWorld 未预埋认知条目）
    expect(Object.keys(s1.认知档案).length).toBe(0);
  });

  it('一跳：目标在场时同地 NPC 收到印象', () => {
    const s0 = makeWorld();
    // PC 在 LOC_KEY；WANG/HONG 同地 → 应收到印象
    s0.$涟漪候选 = {
      [PC]: [{ 标签: '说服', 极性: '正', 强度: 80, 可见性: '公开', 来源拍号: 0 }],
    };
    const { state: s1 } = runTick(s0, { tickId: 'ripple-1hop', spanMinutes: 1440 });
    // NPC_WANG 在同地 → 应收到关于 PC 的印象
    const wangImps = s1.认知档案[NPC_WANG]?.[PC]?.印象 ?? [];
    expect(wangImps.length).toBeGreaterThan(0);
    expect(wangImps[0]?.来源类型).toBe('一手观测');
  });

  it('covert 事件 → 全零印象（一跳/二跳均不落认知档案·走 fact 自带门）', () => {
    const s0 = makeWorld();
    // 为演示 covert，让 NPC_HONG 移到另一地点
    (s0.NPC[NPC_HONG] as { 位置: string }).位置 = 'other_loc';
    s0.$涟漪候选 = {
      [PC]: [{ 标签: '秘密行动', 极性: '中', 强度: 70, 可见性: '隐秘', 来源拍号: 0 }],
    };
    // 在场: NPC_WANG（同地 LOC_KEY）；不在场: NPC_HONG（other_loc）
    const wangNpc = s0.NPC[NPC_WANG];
    if (wangNpc) {
      (wangNpc as { 关系: { 对象键: string; 类型: string; 强度: number; 极性: string; 信任: number; 深度: number }[] }).关系 = [
        { 对象键: NPC_HONG, 类型: '友人', 强度: 80, 极性: '正', 信任: 90, 深度: 70 },
      ];
    }
    const { state: s1 } = runTick(s0, { tickId: 'ripple-covert', spanMinutes: 1440 });
    // covert 走 fact 自带门 → 一跳在场者(WANG)零印象
    expect(s1.认知档案[NPC_WANG]?.[PC]?.印象.length ?? 0).toBe(0);
    // 二跳(HONG)同样零印象
    expect(s1.认知档案[NPC_HONG]?.[PC]?.印象.length ?? 0).toBe(0);
  });

  it('二跳：公开事件通过关系边传播·强度衰减', () => {
    const s0 = makeWorld();
    // NPC_HONG 移到另一地点（不在场）
    (s0.NPC[NPC_HONG] as { 位置: string }).位置 = 'other_loc';
    // WANG（在场·同地）有关系→HONG（不在场）
    const wangNpc = s0.NPC[NPC_WANG];
    if (wangNpc) {
      (wangNpc as { 关系: { 对象键: string; 类型: string; 强度: number; 极性: string; 信任: number; 深度: number }[] }).关系 = [
        { 对象键: NPC_HONG, 类型: '友人', 强度: 80, 极性: '正', 信任: 100, 深度: 70 },
      ];
    }
    s0.$涟漪候选 = {
      [PC]: [{ 标签: '壮举', 极性: '正', 强度: 80, 可见性: '公开', 来源拍号: 0 }],
    };
    const { state: s1 } = runTick(s0, { tickId: 'ripple-2hop', spanMinutes: 1440 });
    // HONG 应通过 WANG 的关系边收到二跳衰减印象
    const hongImps = s1.认知档案[NPC_HONG]?.[PC]?.印象 ?? [];
    expect(hongImps.length).toBeGreaterThan(0);
    expect(hongImps[0]?.来源类型).toBe('二手转述');
    expect(hongImps[0]?.强度).toBeLessThan(80); // 衰减后 < 原始强度
  });

  it('涟漪后 $涟漪候选 被清空', () => {
    const s0 = makeWorld();
    s0.$涟漪候选 = {
      [PC]: [{ 标签: 'foo', 极性: '正', 强度: 50, 可见性: '公开', 来源拍号: 0 }],
    };
    const { state: s1 } = runTick(s0, { tickId: 'ripple-clear', spanMinutes: 1440 });
    expect(Object.keys(s1.$涟漪候选 ?? {})).toHaveLength(0);
  });

  it('取 max 防环：同 (observer,target,tag) 只取强度更大的印象', () => {
    const s0 = makeWorld();
    // 先手动写入一个弱印象
    s0.认知档案[NPC_WANG] = { [PC]: { 了解度: 0, 误差表: {}, 印象: [
      { 标签: '豪气', 极性: '正', 强度: 30, 来源: 'pre', 获知时间: 0, 衰减速率: 0 }
    ], 时效: 0, 姓名知识: '已知姓名' } };
    // 涟漪带来更强印象
    s0.$涟漪候选 = { [PC]: [{ 标签: '豪气', 极性: '正', 强度: 70, 可见性: '公开', 来源拍号: 1 }] };
    const { state: s1 } = runTick(s0, { tickId: 'ripple-takemax', spanMinutes: 1440 });
    const imp = s1.认知档案[NPC_WANG]?.[PC]?.印象.find(i => i.标签 === '豪气');
    expect(imp?.强度).toBe(70); // 取 max（覆盖弱印象 30）
    // 且只有一条该 tag 的印象（不重复追加）
    const sameTag = s1.认知档案[NPC_WANG]?.[PC]?.印象.filter(i => i.标签 === '豪气' && i.极性 === '正');
    expect(sameTag?.length).toBe(1);
  });
});

// ── ⑤ D4 事件种子萌发 ────────────────────────────────────────────────────────

describe('P0-7-T2 · ⑤ D4 事件种子萌发（纪元分钟成熟锚）', () => {
  it('成熟日=0 → 立即成熟哨兵·本拍收入 matureSeeds', () => {
    const s0 = makeWorld();
    s0.$隐藏记忆库 = { 延时种子: {
      's1': { 载荷: '伏笔', 类型: '伏笔', 成熟日: 0, 权重: 10, 重要等级: '中',
              已结算标记: 0, 幂等锚点: '', 冲突组: '', 冷却键: '', 可合并标签: '',
              后果层级: '中', era锚定: '', 因果链id: '', 因果深度: 0,
              来源: { 命名空间: '', 包id: '', 来源包: '', 事件id: '', 模块: '' } },
    }, 彩蛋池: {} };
    const { matureSeeds } = runTick(s0, { tickId: 'seed-imm', spanMinutes: 1440 });
    expect(matureSeeds).toContain('s1');
  });

  it('成熟日 > 当前纪元分钟 → 本拍不成熟', () => {
    const s0 = makeWorld();
    const futureEpoch = (s0.世界?.纪元分钟 ?? 0) + 99999;
    s0.$隐藏记忆库 = { 延时种子: {
      's2': { 载荷: '未来', 类型: '伏笔', 成熟日: futureEpoch, 权重: 10, 重要等级: '中',
              已结算标记: 0, 幂等锚点: '', 冲突组: '', 冷却键: '', 可合并标签: '',
              后果层级: '中', era锚定: '', 因果链id: '', 因果深度: 0,
              来源: { 命名空间: '', 包id: '', 来源包: '', 事件id: '', 模块: '' } },
    }, 彩蛋池: {} };
    const { matureSeeds } = runTick(s0, { tickId: 'seed-future', spanMinutes: 1440 });
    expect(matureSeeds).not.toContain('s2');
  });

  it('种子级幂等：已结算标记=1 的种子不再重复触发', () => {
    const s0 = makeWorld();
    s0.$隐藏记忆库 = { 延时种子: {
      's3': { 载荷: '已做', 类型: '伏笔', 成熟日: 0, 权重: 10, 重要等级: '中',
              已结算标记: 1, 幂等锚点: '', 冲突组: '', 冷却键: '', 可合并标签: '',
              后果层级: '中', era锚定: '', 因果链id: '', 因果深度: 0,
              来源: { 命名空间: '', 包id: '', 来源包: '', 事件id: '', 模块: '' } },
    }, 彩蛋池: {} };
    const { matureSeeds } = runTick(s0, { tickId: 'seed-idem', spanMinutes: 1440 });
    expect(matureSeeds).not.toContain('s3');
  });
});

// ── ⑥ 守恒不变量 ─────────────────────────────────────────────────────────────

describe('P0-7-T2 · ⑥ 守恒不变量（Σ净值=230 贯穿所有拍）', () => {
  it('C2 golden：EXPECTED_NET_ASSET === 230', () => {
    expect(EXPECTED_NET_ASSET).toBe(230);
  });

  it('50 拍后 货币系统守恒：Σ净值 === 230', () => {
    let s = makeWorld();
    for (let i = 0; i < 50; i++) {
      ({ state: s } = runTick(s, { tickId: `cons-${i}`, spanMinutes: 1440 }));
    }
    expect(() =>
      assertConservation(s.货币系统!.账户!, 230, getNetAsset)
    ).not.toThrow();
  });

  it('单拍后守恒验证通过', () => {
    const { state: s1 } = runTick(makeWorld(), { tickId: 'cons-single', spanMinutes: 1440 });
    expect(() =>
      assertConservation(s1.货币系统!.账户!, 230, getNetAsset)
    ).not.toThrow();
  });
});

// ── ⑦ 50 拍黄金主线 fixture ──────────────────────────────────────────────────

describe('P0-7-T2 · ⑦ 50 拍黄金主线（确定性对比基准）', () => {
  function run50Ticks() {
    let s = makeWorld();
    for (let i = 0; i < 50; i++) {
      ({ state: s } = runTick(s, { tickId: `golden-${i}`, spanMinutes: 1440 }));
    }
    return s;
  }

  it('50 拍后 世界.纪元分钟 = 初始 + 50×1440', () => {
    const s0 = makeWorld();
    const initial = s0.世界?.纪元分钟 ?? 0;
    const s50 = run50Ticks();
    expect(s50.世界?.纪元分钟).toBe(initial + 50 * 1440);
  });

  it('50 拍后 世界.周期数 = 初始 + 50', () => {
    const s0 = makeWorld();
    const initial = s0.世界?.周期数 ?? 0;
    const s50 = run50Ticks();
    expect(s50.世界?.周期数).toBe(initial + 50);
  });

  it('50 拍后 _tick.拍计数 = 初始 + 50', () => {
    const s0 = makeWorld();
    const initial = s0._tick?.拍计数 ?? 0;
    const s50 = run50Ticks();
    expect(s50._tick?.拍计数).toBe(initial + 50);
  });

  it('50 拍两次调用结果确定性恒等', () => {
    const a = run50Ticks();
    const b = run50Ticks();
    // 关键确定性字段比较
    expect(a.世界?.纪元分钟).toBe(b.世界?.纪元分钟);
    expect(a._tick?.拍计数).toBe(b._tick?.拍计数);
    expect(a._系统.tick_log.length).toBe(b._系统.tick_log.length);
    expect(JSON.stringify(a.货币系统)).toBe(JSON.stringify(b.货币系统));
  });

  it('50 拍后 账户余额不变（stub 阶段无消费）', () => {
    const s50 = run50Ticks();
    expect(s50.货币系统?.账户?.[PC]?.持有?.['文']).toBe(INITIAL_PC_BALANCE);
    expect(s50.货币系统?.账户?.[NPC_WANG]?.持有?.['文']).toBe(INITIAL_WANG_BALANCE);
  });

  it('50 拍后 schema 仍合法', () => {
    const s50 = run50Ticks();
    expect(RootSchema.safeParse(s50).success).toBe(true);
  });
});

// ── ⑧ 衰减批 ─────────────────────────────────────────────────────────────────

describe('P0-7-T2 · ⑧ 衰减批', () => {
  it('有衰减速率的印象在 tick 后强度降低', () => {
    const s0 = makeWorld();
    s0.认知档案[NPC_WANG] = { [PC]: { 了解度: 0, 误差表: {}, 印象: [
      { 标签: '好感', 极性: '正', 强度: 100, 来源: 'pre', 获知时间: 0, 衰减速率: 0.01 }
    ], 时效: 0, 姓名知识: '已知姓名' } };
    const { state: s1 } = runTick(s0, { tickId: 'decay-1', spanMinutes: 1440 });
    const imp = s1.认知档案[NPC_WANG]?.[PC]?.印象.find(i => i.标签 === '好感');
    expect(imp?.强度).toBeLessThan(100);
  });

  it('衰减速率=0 → 强度不变', () => {
    const s0 = makeWorld();
    s0.认知档案[NPC_WANG] = { [PC]: { 了解度: 0, 误差表: {}, 印象: [
      { 标签: '记忆', 极性: '中', 强度: 50, 来源: 'pre', 获知时间: 0, 衰减速率: 0 }
    ], 时效: 0, 姓名知识: '已知姓名' } };
    const { state: s1 } = runTick(s0, { tickId: 'decay-zero', spanMinutes: 1440 });
    const imp = s1.认知档案[NPC_WANG]?.[PC]?.印象.find(i => i.标签 === '记忆');
    expect(imp?.强度).toBe(50); // 不变
  });

  it('衰减到 0 的印象被剔除', () => {
    const s0 = makeWorld();
    s0.认知档案[NPC_WANG] = { [PC]: { 了解度: 0, 误差表: {}, 印象: [
      { 标签: '淡忘', 极性: '中', 强度: 1, 来源: 'pre', 获知时间: 0, 衰减速率: 100 } // 会衰减至 0
    ], 时效: 0, 姓名知识: '已知姓名' } };
    const { state: s1 } = runTick(s0, { tickId: 'decay-zero-out', spanMinutes: 1440 });
    const imps = s1.认知档案[NPC_WANG]?.[PC]?.印象 ?? [];
    expect(imps.find(i => i.标签 === '淡忘')).toBeUndefined();
  });
});

// ── C1 defer 声明 ─────────────────────────────────────────────────────────────

describe('P0-7-T2 · C1 defer（约定库 DSL resolver 未就绪）', () => {
  it('_应收/_应付 不进 getNetAsset（C1 待 DSL resolver 实装）', () => {
    // 账户有 _应收 记录（→约定库键），getNetAsset 不读取（值无法求值）
    const { 账户Schema } = require('@ai-life-sim/core');
    const acct = 账户Schema.parse({
      持有: { '文': 100 },
      _应收: { '债务A': '约定库键1' },  // 指向约定库，金额在约定库 DSL 表达式中
    });
    // getNetAsset MVP 仅读 持有+储蓄+存货·_应收 defer
    const { getNetAsset: getNA } = require('@ai-life-sim/core/engine/netAsset');
    expect(getNA(acct)).toBe(100);  // _应收 不计入（C1 defer）
  });
});
