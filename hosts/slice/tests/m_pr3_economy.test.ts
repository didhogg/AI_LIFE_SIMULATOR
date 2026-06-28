// PR-3 · 动态修正层（P12–P14）+ 经济派生（P27）机测
// 测试序：F1~F6（确定性·seeded·禁 Date.now/Math.random）
import { describe, it, expect } from 'vitest';
import { RootSchema } from '@ai-life-sim/core';
import {
  deriveEffectivePrice,
  applyDriftCandidate,
  computeDecayFactor,
  hasActiveWar,
} from '@ai-life-sim/core/engine/economyEngine';
import { FORMULA_REGISTRY } from '@ai-life-sim/core/engine/formulaRegistry';

const ECONOMY_PRICE_CLAMP_LO = FORMULA_REGISTRY['economy_price_clamp_lo'].defaultValue;
const ECONOMY_PRICE_CLAMP_HI = FORMULA_REGISTRY['economy_price_clamp_hi'].defaultValue;
import { buildWorld, SAVE_SEED, EXPECTED_NET_ASSET } from '../fixture/world.js';
import { assertConservation } from '@ai-life-sim/core/engine/conservation';
import { getNetAsset } from '@ai-life-sim/core/engine/netAsset';
import { runTick } from '@ai-life-sim/core/engine/tick';
import type { 玩法预设Type } from '@ai-life-sim/core';
import { FINGERPRINT_BUNDLE_MEMBERS } from '@ai-life-sim/core/engine/fingerprintManifest';

// ── 辅助 ────────────────────────────────────────────────────────────────────

const REGION_ID  = 'region_test';
const CATEGORY_A = '粮食';
const CATEGORY_B = '药材';
const BASE_PRICE = 100;

/** 最小预设对象（仅含经济生成规则·其余字段不必填） */
function makePreset(overrides: Partial<NonNullable<玩法预设Type['经济生成规则']>> = {}): 玩法预设Type {
  return {
    经济生成规则: {
      品类基线: { [CATEGORY_A]: BASE_PRICE, [CATEGORY_B]: 200 },
      资源紧张度权重: 0.5,
      供需权重: 0.3,
      战时修正权重: 0.4,
      衰减率: 0,
      ...overrides,
    },
  } as 玩法预设Type;
}

/** 带区域物价的最小 state（使用 RootSchema.parse 填充 defaults） */
function baseStateWithPrice(tension = 0, supply = 0) {
  return RootSchema.parse({
    地图: {
      地点: {
        [REGION_ID]: { 类别: '区域级', 区域资源紧张度: tension },
      },
      区域物价: {
        [REGION_ID]: {
          [CATEGORY_A]: { 基准价: BASE_PRICE, 供需: supply },
          [CATEGORY_B]: { 基准价: 200, 供需: 0 },
        },
      },
    },
  });
}

// ── F1 · 确定性逐位恒等 + 幂等 ────────────────────────────────────────────────

describe('F1 · deriveEffectivePrice 确定性 + 幂等', () => {
  it('F1-1 相同输入两次结果逐位恒等', () => {
    const preset = makePreset({ 资源紧张度权重: 0.5, 供需权重: 0.3 });
    const r1 = deriveEffectivePrice(baseStateWithPrice(60, 40), preset, REGION_ID, CATEGORY_A);
    const r2 = deriveEffectivePrice(baseStateWithPrice(60, 40), preset, REGION_ID, CATEGORY_A);
    expect(r1).toBe(r2);
  });

  it('F1-2 同 state 两次调用结果不变（纯函数）', () => {
    const preset = makePreset();
    const s = baseStateWithPrice(50, 20);
    expect(deriveEffectivePrice(s, preset, REGION_ID, CATEGORY_A))
      .toBe(deriveEffectivePrice(s, preset, REGION_ID, CATEGORY_A));
  });

  it('F1-3 纯函数：调用后 state 不变', () => {
    const preset = makePreset({ 资源紧张度权重: 0.8 });
    const s = baseStateWithPrice(80, 0);
    const before = JSON.stringify(s.地图.区域物价);
    deriveEffectivePrice(s, preset, REGION_ID, CATEGORY_A);
    expect(JSON.stringify(s.地图.区域物价)).toBe(before);
  });
});

// ── F2 · 退化守卫（无规则→基线·0 漂移·黄金向量恒等）────────────────────────────

describe('F2 · 退化守卫', () => {
  it('F2-1 preset=undefined → 返回 区域物价.基准价', () => {
    const s = baseStateWithPrice(80, -50);
    expect(deriveEffectivePrice(s, undefined, REGION_ID, CATEGORY_A)).toBe(BASE_PRICE);
  });

  it('F2-2 preset.经济生成规则=undefined → 返回基准价', () => {
    const preset = {} as 玩法预设Type;
    const s = baseStateWithPrice(80, -50);
    expect(deriveEffectivePrice(s, preset, REGION_ID, CATEGORY_A)).toBe(BASE_PRICE);
  });

  it('F2-3 区域物价无该品类·品类基线也无 → 返回 0', () => {
    const s = RootSchema.parse({});
    const preset = makePreset({ 品类基线: {} });
    expect(deriveEffectivePrice(s, preset, REGION_ID, CATEGORY_A)).toBe(0);
  });

  it('F2-4 退化时 applyDriftCandidate no-op（不写候选基线）', () => {
    const s = baseStateWithPrice();
    applyDriftCandidate(s, undefined, REGION_ID, CATEGORY_A);
    expect(s.地图.区域物价[REGION_ID]?.[CATEGORY_A]?.候选基线).toBeUndefined();
  });

  it('F2-5 标准 buildWorld（无预设经济规则）两次调用结果不漂移', () => {
    const w1 = buildWorld();
    const w2 = buildWorld();
    // 退化路径：无区域物价 → 0 → 无漂移
    expect(deriveEffectivePrice(w1, undefined, 'nonexistent', '品类'))
      .toBe(deriveEffectivePrice(w2, undefined, 'nonexistent', '品类'));
  });

  it('F2-6 FINGERPRINT_BUNDLE_MEMBERS 成员数守恒（PR-3 不新增·基线=21）', () => {
    // PR-3 不新增 bundle member：经济派生不进指纹（不落库·派生不存储铁律）
    expect(FINGERPRINT_BUNDLE_MEMBERS.length).toBe(21);
  });
});

// ── F3 · 衰减闭式·锚拍号（同拍号同值·双跑恒等）──────────────────────────────

describe('F3 · 修正系数衰减（P13）', () => {
  it('F3-1 衰减率=0 → decayFactor=1（无衰减）', () => {
    expect(computeDecayFactor(0, 100)).toBe(1);
  });

  it('F3-2 同拍号两次独立计算 decayFactor 逐位恒等', () => {
    const d1 = computeDecayFactor(0.01, 50);
    const d2 = computeDecayFactor(0.01, 50);
    expect(d1).toBe(d2);
  });

  it('F3-3 tick 增大 → decayFactor 单调不增', () => {
    const d0  = computeDecayFactor(0.05, 0);
    const d10 = computeDecayFactor(0.05, 10);
    const d50 = computeDecayFactor(0.05, 50);
    expect(d0).toBeGreaterThanOrEqual(d10);
    expect(d10).toBeGreaterThanOrEqual(d50);
  });

  it('F3-4 衰减后有效价格向基线收敛（拍号大→偏差小）', () => {
    const preset = makePreset({
      资源紧张度权重: 0.5, 衰减率: 0.05,
      供需权重: 0, 战时修正权重: 0,
    });
    const s0  = baseStateWithPrice(100, 0); s0._tick.拍计数 = 0;
    const s10 = baseStateWithPrice(100, 0); s10._tick.拍计数 = 10;
    const s50 = baseStateWithPrice(100, 0); s50._tick.拍计数 = 50;
    const p0  = deriveEffectivePrice(s0,  preset, REGION_ID, CATEGORY_A);
    const p10 = deriveEffectivePrice(s10, preset, REGION_ID, CATEGORY_A);
    const p50 = deriveEffectivePrice(s50, preset, REGION_ID, CATEGORY_A);
    expect(Math.abs(p50 - BASE_PRICE)).toBeLessThanOrEqual(Math.abs(p10 - BASE_PRICE));
    expect(Math.abs(p10 - BASE_PRICE)).toBeLessThanOrEqual(Math.abs(p0  - BASE_PRICE));
  });

  it('F3-5 同 tick 双运行结果逐位恒等（闭式守恒）', () => {
    const preset = makePreset({ 衰减率: 0.03 });
    for (const tick of [0, 5, 20, 100]) {
      const s1 = baseStateWithPrice(50, 20); s1._tick.拍计数 = tick;
      const s2 = baseStateWithPrice(50, 20); s2._tick.拍计数 = tick;
      expect(deriveEffectivePrice(s1, preset, REGION_ID, CATEGORY_A))
        .toBe(deriveEffectivePrice(s2, preset, REGION_ID, CATEGORY_A));
    }
  });
});

// ── F4 · 信号单调性 + 钳制边界 ─────────────────────────────────────────────────

describe('F4 · 信号单调性 + 钳制', () => {
  it('F4-1 资源紧张度↑ → 有效价格单调不降（正权重）', () => {
    const preset = makePreset({ 资源紧张度权重: 0.5, 供需权重: 0, 战时修正权重: 0 });
    const pLow  = deriveEffectivePrice(baseStateWithPrice(10, 0), preset, REGION_ID, CATEGORY_A);
    const pHigh = deriveEffectivePrice(baseStateWithPrice(90, 0), preset, REGION_ID, CATEGORY_A);
    expect(pHigh).toBeGreaterThanOrEqual(pLow);
  });

  it('F4-2 供需正值↑ → 有效价格单调不降', () => {
    const preset = makePreset({ 资源紧张度权重: 0, 供需权重: 0.5, 战时修正权重: 0 });
    const pNeg = deriveEffectivePrice(baseStateWithPrice(0, -80), preset, REGION_ID, CATEGORY_A);
    const pPos = deriveEffectivePrice(baseStateWithPrice(0,  80), preset, REGION_ID, CATEGORY_A);
    expect(pPos).toBeGreaterThanOrEqual(pNeg);
  });

  it('F4-3 战时激活 → 有效价格不低于和平时', () => {
    const preset = makePreset({ 资源紧张度权重: 0, 供需权重: 0, 战时修正权重: 0.5 });
    const sPeace = baseStateWithPrice(0, 0);
    const sWar   = baseStateWithPrice(0, 0);
    sWar.战争状态 ??= {};  // R6 opt-in
    sWar.战争状态['war_01'] = { 战争名: '测试战争', 参战方: [], 战争目标: '', 状态: '交战' };
    expect(deriveEffectivePrice(sWar,   preset, REGION_ID, CATEGORY_A))
      .toBeGreaterThanOrEqual(deriveEffectivePrice(sPeace, preset, REGION_ID, CATEGORY_A));
  });

  it('F4-4 极端正信号 → 有效价格不超 HI × 基线（上钳制）', () => {
    const preset = makePreset({ 资源紧张度权重: 0.9, 供需权重: 0.9, 战时修正权重: 0.9 });
    const s = baseStateWithPrice(100, 100);
    s.战争状态 ??= {};  // R6 opt-in
    s.战争状态['w'] = { 战争名: '极限战', 参战方: [], 战争目标: '', 状态: '交战' };
    const p = deriveEffectivePrice(s, preset, REGION_ID, CATEGORY_A);
    expect(p).toBeLessThanOrEqual(Math.ceil(BASE_PRICE * ECONOMY_PRICE_CLAMP_HI));
  });

  it('F4-5 极端负信号 → 有效价格不低于 LO × 基线（下钳制）', () => {
    const preset = makePreset({ 资源紧张度权重: 0, 供需权重: 0.9, 战时修正权重: 0 });
    const s = baseStateWithPrice(0, -100);
    const p = deriveEffectivePrice(s, preset, REGION_ID, CATEGORY_A);
    expect(p).toBeGreaterThanOrEqual(Math.floor(BASE_PRICE * ECONOMY_PRICE_CLAMP_LO));
  });

  it('F4-6 hasActiveWar: 无战→false / 交战→true / 停战→false', () => {
    const sNone = RootSchema.parse({});
    expect(hasActiveWar(sNone)).toBe(false);

    const sWar = RootSchema.parse({});
    sWar.战争状态 ??= {};  // R6 opt-in
    sWar.战争状态['w1'] = { 战争名: 'w', 参战方: [], 战争目标: '', 状态: '交战' };
    expect(hasActiveWar(sWar)).toBe(true);

    const sCease = RootSchema.parse({});
    sCease.战争状态 ??= {};  // R6 opt-in
    sCease.战争状态['w1'] = { 战争名: 'w', 参战方: [], 战争目标: '', 状态: '停战' };
    expect(hasActiveWar(sCease)).toBe(false);
  });
});

// ── F5 · 漂移触发→候选基线=均值·不回写预设 ────────────────────────────────────

describe('F5 · 漂移候选再基线（P14）', () => {
  it('F5-1 漂移超阈 → 写入候选基线', () => {
    // tension=100, weight=0.9 → rawCorrection=0.9 > DRIFT_THRESHOLD(0.2)
    const preset = makePreset({ 资源紧张度权重: 0.9, 供需权重: 0, 战时修正权重: 0 });
    const s = baseStateWithPrice(100, 0);
    applyDriftCandidate(s, preset, REGION_ID, CATEGORY_A);
    expect(s.地图.区域物价[REGION_ID]?.[CATEGORY_A]?.候选基线).toBeDefined();
  });

  it('F5-2 候选基线 = deriveEffectivePrice 返回值', () => {
    const preset = makePreset({ 资源紧张度权重: 0.9, 供需权重: 0, 战时修正权重: 0 });
    const s = baseStateWithPrice(100, 0);
    const expected = deriveEffectivePrice(s, preset, REGION_ID, CATEGORY_A);
    applyDriftCandidate(s, preset, REGION_ID, CATEGORY_A);
    expect(s.地图.区域物价[REGION_ID]![CATEGORY_A]!.候选基线).toBe(expected);
  });

  it('F5-3 漂移未超阈 → 不写候选基线', () => {
    // 所有权重=0 → rawCorrection=0 → 有效价格=基线 → 漂移=0
    const preset = makePreset({ 资源紧张度权重: 0, 供需权重: 0, 战时修正权重: 0 });
    const s = baseStateWithPrice(100, 50);
    applyDriftCandidate(s, preset, REGION_ID, CATEGORY_A);
    expect(s.地图.区域物价[REGION_ID]?.[CATEGORY_A]?.候选基线).toBeUndefined();
  });

  it('F5-4 applyDriftCandidate 不修改预设对象', () => {
    const preset = makePreset({ 资源紧张度权重: 0.9 });
    const ruleStr = JSON.stringify(preset.经济生成规则);
    const s = baseStateWithPrice(100, 0);
    applyDriftCandidate(s, preset, REGION_ID, CATEGORY_A);
    expect(JSON.stringify(preset.经济生成规则)).toBe(ruleStr);
  });

  it('F5-5 无匹配 region → no-op（候选基线不存在）', () => {
    const preset = makePreset({ 资源紧张度权重: 0.9 });
    const s = buildWorld();
    applyDriftCandidate(s, preset, 'nonexistent_region', '品类');
    expect(s.地图?.区域物价?.['nonexistent_region']?.['品类']?.候选基线).toBeUndefined();
  });
});

// ── F6 · 300 拍 soak 守恒持续成立 + 双跑逐位恒等 ─────────────────────────────

describe('F6 · 300 拍 soak', () => {
  it('F6-1 300 拍守恒持续成立（派生调用不破货币守恒）', () => {
    let s = buildWorld();
    const preset = makePreset({ 资源紧张度权重: 0.3, 供需权重: 0.2, 衰减率: 0.01 });
    for (let i = 0; i < 300; i++) {
      ({ state: s } = runTick(s, { tickId: `soak:${i}`, spanMinutes: 1440 }));
      // 派生调用（只读·禁直写货币系统）
      deriveEffectivePrice(s, preset, REGION_ID, CATEGORY_A);
      assertConservation(s.货币系统?.账户 ?? {}, EXPECTED_NET_ASSET, getNetAsset);
    }
  });

  it('F6-2 双跑 300 拍有效价格逐位恒等', () => {
    const runN = () => {
      let s = buildWorld();
      const preset = makePreset({ 资源紧张度权重: 0.3, 衰减率: 0.005 });
      const prices: number[] = [];
      for (let i = 0; i < 300; i++) {
        ({ state: s } = runTick(s, { tickId: `dual:${i}`, spanMinutes: 1440 }));
        prices.push(deriveEffectivePrice(s, preset, REGION_ID, CATEGORY_A));
      }
      return prices;
    };
    const r1 = runN();
    const r2 = runN();
    for (let i = 0; i < 300; i++) {
      expect(r1[i]).toBe(r2[i]);
    }
  });
});
