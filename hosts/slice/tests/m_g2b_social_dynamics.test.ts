// G2b · 作者可配社会动力学表 验收
//
// DoD:
//   A  作者不填 → 全表回退默认值 → REPLAY/golden 全绿 → 0 重定基
//   B  作者覆盖现有 IC 边类型率 → 经 runTick 真实 IC 路径断言新值生效（非孤立单测）
//   C  作者添加新情绪维度 → applyAppraisal 路径命中新维度条目
//   D  作者调整场景传播系数 → 二跳强度变化
//   E  作者设置体质分档断点 → θ_i 分档口径改变（复杂传播阈值变化）
//   F  作者扩展复杂传播标签集 → 新标签走复杂传播路径

import { describe, it, expect } from 'vitest';
import { runTick, emitRipple } from '@ai-life-sim/core/engine/tick';
import { hashJudgmentBundle, hashPresetFingerprint } from '@ai-life-sim/core/engine/rng';
import { RootSchema } from '@ai-life-sim/core';

// ── 最小 state 构造 ───────────────────────────────────────────────────────────

function makeState(opts: {
  seed?: number;
  npcs?: Record<string, {
    位置?: string;
    存活状态?: string;
    属性?: Record<string, number>;
    关系?: { 对象键: string; 类型: string; 强度: number; 极性: string; 信任: number; 深度: number }[];
  }>;
} = {}) {
  return RootSchema.parse({
    $存档种子: opts.seed ?? 42,
    NPC: Object.fromEntries(
      Object.entries(opts.npcs ?? {}).map(([k, v]) => [k, {
        名称: k, 位置: v.位置 ?? 'loc_a', 存活状态: v.存活状态 ?? '在世',
        属性: v.属性 ?? {}, 关系: v.关系 ?? [],
      }]),
    ),
    地图: { 地点: {
      loc_a: { 名称: 'A', 节点类型: '室内', 人口规模: '中型', 社交开放度: '低', 父节点: '' },
      loc_b: { 名称: 'B', 节点类型: '室内', 人口规模: '中型', 社交开放度: '高', 父节点: '' },
    }},
    _tick: { 拍计数: 0, 周期分钟: 1440, 上次结算纪元分钟: 0 },
  });
}

// ── A: 不填 → 0 重定基 ────────────────────────────────────────────────────────

describe('A · 作者不填 → hashJudgmentBundle 逐位恒等', () => {
  it('空 社会動力学表 → 与不传时 hash 相同', () => {
    const base = hashJudgmentBundle({
      历法皮肤: {}, 粒度模板覆盖: {}, 种族模板: {}, 母题配额: {},
      媒体渠道表: {}, 检定配方表: {}, 检定档切分表: {}, 欠债参数: {},
      赛事结构模板: {}, 派生量配方: {},
      概率域夹逼: { p_最小: 0.0001, p_最大: 0.9999 },
      纠缠闭包弱边阈值: 0.2,
    });
    // 传 undefined → 相同 hash（canonicalize 忽略 undefined 值）
    const withUndef = hashJudgmentBundle({
      历法皮肤: {}, 粒度模板覆盖: {}, 种族模板: {}, 母题配额: {},
      媒体渠道表: {}, 检定配方表: {}, 检定档切分表: {}, 欠债参数: {},
      赛事结构模板: {}, 派生量配方: {},
      概率域夹逼: { p_最小: 0.0001, p_最大: 0.9999 },
      纠缠闭包弱边阈值: 0.2,
      情绪维度表: undefined,
      人口密度系数表: undefined,
      场景传播系数表: undefined,
      IC边类型率表: undefined,
      复杂传播标签集: undefined,
      体质分档断点: undefined,
    });
    expect(withUndef).toBe(base);
  });

  it('作者填入默认值 → hash 变（受控重定基）', () => {
    const base = hashJudgmentBundle({
      历法皮肤: {}, 粒度模板覆盖: {}, 种族模板: {}, 母题配额: {},
      媒体渠道表: {}, 检定配方表: {}, 检定档切分表: {}, 欠债参数: {},
      赛事结构模板: {}, 派生量配方: {},
      概率域夹逼: { p_最小: 0.0001, p_最大: 0.9999 },
      纠缠闭包弱边阈值: 0.2,
    });
    const withExplicitDefault = hashJudgmentBundle({
      历法皮肤: {}, 粒度模板覆盖: {}, 种族模板: {}, 母题配额: {},
      媒体渠道表: {}, 检定配方表: {}, 检定档切分表: {}, 欠债参数: {},
      赛事结构模板: {}, 派生量配方: {},
      概率域夹逼: { p_最小: 0.0001, p_最大: 0.9999 },
      纠缠闭包弱边阈值: 0.2,
      体质分档断点: { tiers: [4, 12] }, // 作者显式填入现值 → hash 仍变（因为引入了新键）
    });
    // 显式填入任何值（即使等于默认） → hash 不同于未填（字段出现在 canonical 中）
    expect(withExplicitDefault).not.toBe(base);
  });
});

// ── B: IC 边类型率 override → 经 runTick IC 路径生效 ─────────────────────────

describe('B · 作者覆盖 IC边类型率表 → 真实传播路径生效', () => {
  it('将「相识」传播率设 0 → 二跳完全阻断', () => {
    // 默认「相识」= 0.7；覆盖为 0.0 → 所有相识边 IC 检定 0% 通过
    const s0 = makeState({
      npcs: {
        src:  { 位置: 'loc_a', 关系: [] },
        obs1: { 位置: 'loc_a', 关系: [{ 对象键: 'obs2', 类型: '相识', 强度: 100, 极性: '正', 信任: 50, 深度: 1 }] },
        obs2: { 位置: 'loc_b', 关系: [] },
      },
    });
    emitRipple(s0.$涟漪候选, 'src', { 标签: '事件', 极性: '正', 强度: 99, 可见性: '公开', 来源拍号: 0 });

    // 无 override → obs2 有概率通过
    const defaultResult = runTick(s0, { tickId: 'b-default', spanMinutes: 1440 });

    // 相识率设 0 → obs2 一定不通过
    const blockedState = makeState({
      npcs: {
        src:  { 位置: 'loc_a', 关系: [] },
        obs1: { 位置: 'loc_a', 关系: [{ 对象键: 'obs2', 类型: '相识', 强度: 100, 极性: '正', 信任: 50, 深度: 1 }] },
        obs2: { 位置: 'loc_b', 关系: [] },
      },
    });
    emitRipple(blockedState.$涟漪候选, 'src', { 标签: '事件', 极性: '正', 强度: 99, 可见性: '公开', 来源拍号: 0 });
    const blockedResult = runTick(blockedState, {
      tickId: 'b-blocked',
      spanMinutes: 1440,
      社会動力学表: { IC边类型率表: { '相识': 0.0 } },
    });

    // 默认情况：obs2 可能有印象（取决于 RNG·但强度 99×0.5 decay 很可能通过）
    // override 情况：obs2 一定无印象（率=0 → 确定阻断）
    const blockedObs2 = blockedResult.state.认知档案?.['obs2'];
    const hasImpression = blockedObs2?.['src']?.印象?.length ?? 0;
    expect(hasImpression).toBe(0); // 阻断后一定零印象
  });

  it('将「陌生人」传播率设 1.0 → 新边类型确定性通过', () => {
    const s0 = makeState({
      npcs: {
        src:  { 位置: 'loc_a', 关系: [] },
        obs1: { 位置: 'loc_a', 关系: [{ 对象键: 'obs2', 类型: '陌生人', 强度: 100, 极性: '正', 信任: 50, 深度: 1 }] },
        obs2: { 位置: 'loc_b', 关系: [] },
      },
    });
    emitRipple(s0.$涟漪候选, 'src', { 标签: '事件', 极性: '正', 强度: 99, 可见性: '公开', 来源拍号: 0 });
    const result = runTick(s0, {
      tickId: 'b-new-type',
      spanMinutes: 1440,
      社会動力学表: { IC边类型率表: { '陌生人': 1.0 } },
    });
    // 率=1 + trust 调制 → 一定通过 → obs2 有印象
    const obs2 = result.state.认知档案?.['obs2'];
    const hasImpression = (obs2?.['src']?.印象?.length ?? 0) > 0;
    expect(hasImpression).toBe(true);
  });
});

// ── C: 新情绪维度 → applyAppraisal 命中 ──────────────────────────────────────

describe('C · 作者添加新情绪维度 → applyAppraisal 路径命中', () => {
  it('添加「恐惧」维度 → factFragment.维度=恐惧 → 情绪栈有对应条目', () => {
    // obs1 与 src 同地 → 一手观测 → propagateRipple 写入 factFragment 印象 → applyAppraisal 命中
    const s0 = makeState({
      npcs: {
        src:  { 位置: 'loc_a', 关系: [] },
        obs1: { 位置: 'loc_a', 关系: [] },
      },
    });
    emitRipple(s0.$涟漪候选, 'src', {
      标签: '恐惧维度测试', 极性: '负', 强度: 80, 可见性: '公开', 来源拍号: 0,
      factFragment: { 主体: 'src', 维度: '恐惧', Δ方向: -1, 量级: 60 },
    });
    const result = runTick(s0, {
      tickId: 'c-new-dim',
      spanMinutes: 1440,
      社会動力学表: {
        情绪维度表: { '恐惧': { pos: '兴奋', neg: '恐慌', coeff: 1.2 } },
      },
    });
    // applyAppraisal 将 factFragment.维度=恐惧·Δ方向=-1 映射为 neg 情绪「恐慌」
    const obs1Emotions = result.state.NPC?.['obs1']?.情绪栈 as { 情绪名: string; 数值: number }[] | undefined;
    const panicEntry = obs1Emotions?.find(e => e.情绪名 === '恐慌');
    expect(panicEntry).toBeDefined();
    expect(panicEntry!.数值).toBeGreaterThan(0);
  });
});

// ── E: 体质分档断点 → θ_i 口径改变 ─────────────────────────────────────────────

describe('E · 体质分档断点 override → 复杂传播门槛改变', () => {
  it('断点 [100] → 体质10 → θ_i=1（简化为单桥即过）', () => {
    // 默认断点[4,12]: 体质10 → θ_i=2（需2条桥）
    // 新断点[100]: 体质10 ≤ 100 → θ_i=1（1条桥即可通过）
    // 用复杂传播标签触发：默认需2条桥；改断点后1条桥即可
    const s0 = makeState({
      seed: 0, // trust=100 → 确定性通过 IC
      npcs: {
        src:  { 位置: 'loc_a', 关系: [] },
        obs1: { 位置: 'loc_a',
          关系: [{ 对象键: 'obs2', 类型: '亲人', 强度: 100, 极性: '正', 信任: 100, 深度: 1 }] },
        // obs2 只与 obs1 相连（1条桥）
        obs2: { 位置: 'loc_b', 属性: { 体质: 10 }, 关系: [] },
      },
    });
    emitRipple(s0.$涟漪候选, 'src', { 标签: '革命动员', 极性: '正', 强度: 99, 可见性: '公开', 来源拍号: 0 });

    // 默认（断点[4,12]·体质10→θ_i=2·单桥不够）
    const defaultResult = runTick(s0, { tickId: 'e-default', spanMinutes: 1440 });
    const defaultObs2 = defaultResult.state.认知档案?.['obs2']?.['src']?.印象?.length ?? 0;
    expect(defaultObs2).toBe(0); // 单桥+复杂传播·默认θ=2 → 阻断

    const s1 = makeState({
      seed: 0,
      npcs: {
        src:  { 位置: 'loc_a', 关系: [] },
        obs1: { 位置: 'loc_a',
          关系: [{ 对象键: 'obs2', 类型: '亲人', 强度: 100, 极性: '正', 信任: 100, 深度: 1 }] },
        obs2: { 位置: 'loc_b', 属性: { 体质: 10 }, 关系: [] },
      },
    });
    emitRipple(s1.$涟漪候选, 'src', { 标签: '革命动员', 极性: '正', 强度: 99, 可见性: '公开', 来源拍号: 0 });

    // 断点改为[100]·体质10→θ_i=1·单桥足够
    const overrideResult = runTick(s1, {
      tickId: 'e-override',
      spanMinutes: 1440,
      社会動力学表: { 体质分档断点: { tiers: [100] } },
    });
    const overrideObs2 = overrideResult.state.认知档案?.['obs2']?.['src']?.印象?.length ?? 0;
    expect(overrideObs2).toBeGreaterThan(0); // 单桥+θ=1 → 通过
  });
});

// ── F: 复杂传播标签集扩展 ──────────────────────────────────────────────────────

describe('F · 复杂传播标签集 extend → 新标签走复杂传播路径', () => {
  it('将「声誉」加入复杂传播集 → 单桥 obs2 阻断', () => {
    // 「声誉」默认为简单传播（单桥即过）
    // 加入复杂传播集后 → 单桥不足（θ_i=2 默认）→ obs2 无印象
    const makeScenario = (seed: number, label: string) => {
      const s = makeState({
        seed,
        npcs: {
          src:  { 位置: 'loc_a', 关系: [] },
          obs1: { 位置: 'loc_a',
            关系: [{ 对象键: 'obs2', 类型: '亲人', 强度: 100, 极性: '正', 信任: 100, 深度: 1 }] },
          obs2: { 位置: 'loc_b', 属性: { 体质: 10 }, 关系: [] },
        },
      });
      emitRipple(s.$涟漪候选, 'src', { 标签: label, 极性: '正', 强度: 99, 可见性: '公开', 来源拍号: 0 });
      return s;
    };

    // 默认：声誉=简单传播→单桥即过
    const s0 = makeScenario(0, '声誉');
    const r0 = runTick(s0, { tickId: 'f-default', spanMinutes: 1440 });
    const defaultImp = r0.state.认知档案?.['obs2']?.['src']?.印象?.length ?? 0;
    expect(defaultImp).toBeGreaterThan(0); // 默认通过

    // 加入复杂传播集：声誉→复杂→单桥阻断
    const s1 = makeScenario(0, '声誉');
    const r1 = runTick(s1, {
      tickId: 'f-complex',
      spanMinutes: 1440,
      社会動力学表: { 复杂传播标签集: ['声誉'] },
    });
    const complexImp = r1.state.认知档案?.['obs2']?.['src']?.印象?.length ?? 0;
    expect(complexImp).toBe(0); // 变为复杂传播后阻断
  });
});
