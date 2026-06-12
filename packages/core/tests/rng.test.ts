import { describe, it, expect } from 'vitest';
import { rngFor, rngForFate, hashPresetFingerprint } from '../engine/rng.js';

describe('P0-5 RNG — rngFor (ordinary checks)', () => {
  it('determinism: same inputs → same output over 1000 runs', () => {
    const first = rngFor(42, 7, '检定:魅力', 0);
    for (let i = 0; i < 999; i++) {
      expect(rngFor(42, 7, '检定:魅力', 0)).toBe(first);
    }
  });

  it('output range: u always ∈ [0, 99]', () => {
    for (let salt = 0; salt < 100; salt++) {
      const u = rngFor(999, 3, '检定:武力', salt);
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThanOrEqual(99);
    }
  });

  it('different channels → different u (independence)', () => {
    const u1 = rngFor(1, 1, '检定:魅力', 0);
    const u2 = rngFor(1, 1, '触发:战斗', 0);
    // Astronomically unlikely to collide across 100 values; treat collision as bug
    expect(u1).not.toBe(u2);
  });

  it('rerollSalt change → result changes for ordinary channel', () => {
    const u0 = rngFor(1, 1, '检定:智慧', 0);
    const u1 = rngFor(1, 1, '检定:智慧', 1);
    expect(u0).not.toBe(u1);
  });

  it('channel guard: rejects 天命: prefix', () => {
    expect(() => rngFor(1, 1, '天命:战斗', 0)).toThrow(/rngFor 拒绝天命通道/);
  });
});

describe('P0-5 RNG — rngForFate (fate checks)', () => {
  it('determinism: same inputs → same output over 1000 runs', () => {
    const first = rngForFate(42, 7, '天命:命运转折', 0);
    for (let i = 0; i < 999; i++) {
      expect(rngForFate(42, 7, '天命:命运转折', 0)).toBe(first);
    }
  });

  it('output range: u always ∈ [0, 99]', () => {
    for (let idx = 0; idx < 50; idx++) {
      const u = rngForFate(7, 5, '天命:死亡', idx);
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThanOrEqual(99);
    }
  });

  it('rerollSalt does NOT change fate result (ordinary salt ignored)', () => {
    // rngForFate has no rerollSalt param — fateRerollIndex=0 baseline
    const u0 = rngForFate(1, 1, '天命:战斗', 0);
    const u1 = rngForFate(1, 1, '天命:战斗', 0);
    expect(u0).toBe(u1);
  });

  it('fateRerollIndex change → result changes', () => {
    const u0 = rngForFate(1, 1, '天命:大事件', 0);
    const u1 = rngForFate(1, 1, '天命:大事件', 1);
    expect(u0).not.toBe(u1);
  });

  it('channel guard: rejects non-天命: prefix', () => {
    expect(() => rngForFate(1, 1, '检定:魅力', 0)).toThrow(
      /rngForFate 只接受天命通道/,
    );
    expect(() => rngForFate(1, 1, '触发:战斗', 0)).toThrow(
      /rngForFate 只接受天命通道/,
    );
  });
});

describe('P0-5 RNG — cross-channel independence', () => {
  it('ordinary vs fate channels with same tick/seed differ', () => {
    // Can't call rngFor on 天命 channel, so compare two distinct ordinary channels
    const u1 = rngFor(5, 3, '检定:力量', 0);
    const u2 = rngFor(5, 3, '触发:遭遇', 0);
    expect(u1).not.toBe(u2);
  });
});

describe('P0-5 RNG — XOR folding regression', () => {
  // If seed synthesis used XOR: (tick XOR salt), then (tick=4, salt=0) and (tick=5, salt=1)
  // both yield XOR=4, producing identical roll sequences. FNV-1a prevents this.
  it('(tick=4, salt=0) ≠ (tick=5, salt=1) for ordinary channel', () => {
    const u_4_0 = rngFor(1, 4, '检定:智慧', 0);
    const u_5_1 = rngFor(1, 5, '检定:智慧', 1);
    expect(u_4_0).not.toBe(u_5_1);
  });

  it('(tick=3, salt=2) ≠ (tick=2, salt=3) for ordinary channel', () => {
    const u_3_2 = rngFor(99, 3, '检定:魅力', 2);
    const u_2_3 = rngFor(99, 2, '检定:魅力', 3);
    expect(u_3_2).not.toBe(u_2_3);
  });

  it('(tick=0, salt=5) ≠ (tick=5, salt=0) for fate channel', () => {
    const u_0_5 = rngForFate(7, 0, '天命:命运', 5);
    const u_5_0 = rngForFate(7, 5, '天命:命运', 0);
    expect(u_0_5).not.toBe(u_5_0);
  });
});

describe('P0-5 RNG — hashPresetFingerprint', () => {
  const base = {
    检定配方表: { 魅力: { 主属性: '魅力', 副属性: [] } },
    难度系数组: { 基础DC: 50 },
    钳制表: {},
    判定骰型: 100 as const,
    检定档切分表: { 大胜下限: 40, 胜下限: 15, 惨胜下限: 1, 败下限: -24 },
  };

  it('returns an 8-char hex string', () => {
    const h = hashPresetFingerprint(base);
    expect(h).toMatch(/^[0-9a-f]{8}$/);
  });

  it('deterministic: same input → same hash', () => {
    expect(hashPresetFingerprint(base)).toBe(hashPresetFingerprint(base));
  });

  it('different 判定骰型 → different hash', () => {
    const h100 = hashPresetFingerprint({ ...base, 判定骰型: 100 });
    const h20 = hashPresetFingerprint({ ...base, 判定骰型: 20 });
    expect(h100).not.toBe(h20);
  });

  it('different 难度系数组 → different hash', () => {
    const h1 = hashPresetFingerprint({ ...base, 难度系数组: { 基础DC: 50 } });
    const h2 = hashPresetFingerprint({ ...base, 难度系数组: { 基础DC: 60 } });
    expect(h1).not.toBe(h2);
  });

  it('different 检定档切分表 → different hash', () => {
    const h1 = hashPresetFingerprint(base);
    const h2 = hashPresetFingerprint({
      ...base,
      检定档切分表: { ...base.检定档切分表, 大胜下限: 35 },
    });
    expect(h1).not.toBe(h2);
  });
});
