import { describe, it, expect } from 'vitest';
import { clampLedger, warnAnnualRate } from '../engine/math/ledger.js';

describe('H1 clampLedger — 账面量入账前钳制', () => {
  it('正常值（在范围内）→ 原值·exceeded=false', () => {
    const r = clampLedger(50, 0, 100, '属性.体质');
    expect(r).toEqual({ value: 50, exceeded: false, ceiling: undefined, label: '属性.体质' });
  });

  it('等于软顶边界 → 原值·exceeded=false', () => {
    const r = clampLedger(100, 0, 100, '属性.体质');
    expect(r).toEqual({ value: 100, exceeded: false, ceiling: undefined, label: '属性.体质' });
  });

  it('越软顶 → clamp 到软顶·exceeded=true', () => {
    const r = clampLedger(150, 0, 100, '属性.体质');
    expect(r.value).toBe(100);
    expect(r.exceeded).toBe(true);
    expect(r.ceiling).toBe(100);
    expect(r.label).toBe('属性.体质');
  });

  it('低于硬底 → clamp 到硬底·exceeded=false（无广播）', () => {
    const r = clampLedger(-50, 0, 100, '货币.金币');
    expect(r.value).toBe(0);
    expect(r.exceeded).toBe(false);
    expect(r.ceiling).toBeUndefined();
  });

  it('越硬顶（hardHi）→ clamp 到 hardHi·exceeded=true', () => {
    const r = clampLedger(200, 0, 100, '属性.体质', 150);
    expect(r.value).toBe(150);
    expect(r.exceeded).toBe(true);
    expect(r.ceiling).toBe(150);
  });

  it('硬顶优先于软顶（hardHi < hi）→ 取 hardHi', () => {
    // hardHi=80 比 hi=100 更严
    const r = clampLedger(90, 0, 100, '属性.体质', 80);
    expect(r.value).toBe(80);
    expect(r.exceeded).toBe(true);
  });

  it('softHi 越界但 hardHi 未设 → 走软顶路径', () => {
    const r = clampLedger(110, 0, 100, '属性.体质');
    expect(r.value).toBe(100);
    expect(r.exceeded).toBe(true);
  });

  it('负值范围·正常 → 原值', () => {
    const r = clampLedger(-30, -100, -10, '债务');
    expect(r.value).toBe(-30);
    expect(r.exceeded).toBe(false);
  });

  it('label 原样透传', () => {
    const r = clampLedger(0, 0, 100, '特殊/路径.字段');
    expect(r.label).toBe('特殊/路径.字段');
  });
});

describe('H1 warnAnnualRate — 年化增长率预警', () => {
  it('rate 在警戒线内 → null', () => {
    expect(warnAnnualRate(0.5, '货币.金币')).toBeNull();
    expect(warnAnnualRate(-0.5, '货币.金币')).toBeNull();
    expect(warnAnnualRate(1.0, '货币.金币')).toBeNull();
  });

  it('rate 超过默认警戒线 1.0 → 返回 ⚠ 字符串', () => {
    const msg = warnAnnualRate(1.5, '货币.金币');
    expect(msg).not.toBeNull();
    expect(msg).toContain('⚠');
    expect(msg).toContain('货币.金币');
    expect(msg).toContain('150.00%');
  });

  it('负增长率绝对值越警戒线 → 也触发', () => {
    const msg = warnAnnualRate(-2.0, '属性.体质');
    expect(msg).not.toBeNull();
    expect(msg).toContain('⚠');
  });

  it('自定义阈值 0.5 → 0.6 触发', () => {
    expect(warnAnnualRate(0.6, '货币.银币', 0.5)).not.toBeNull();
    expect(warnAnnualRate(0.4, '货币.银币', 0.5)).toBeNull();
  });

  it('恰好等于阈值 → 不触发（不含等于）', () => {
    expect(warnAnnualRate(1.0, '货币.金币', 1.0)).toBeNull();
  });
});
