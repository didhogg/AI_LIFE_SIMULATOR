import { describe, it, expect } from 'vitest';
import {
  isLegalCharTransition,
  isLegalItemTransition,
} from '../interfaces/itemCharStateInvariant.js';

// ── L-15 · 角色存活状态转移（9 边）────────────────────────────────────────────

describe('L-15 · isLegalCharTransition — 角色存活状态', () => {
  it('在世 → 失踪 ✓', () => {
    expect(isLegalCharTransition('在世', '失踪', { hasRevivalFlag: false })).toBe(true);
  });

  it('失踪 → 在世 ✓', () => {
    expect(isLegalCharTransition('失踪', '在世', { hasRevivalFlag: false })).toBe(true);
  });

  it('在世 → 已故 ✓', () => {
    expect(isLegalCharTransition('在世', '已故', { hasRevivalFlag: false })).toBe(true);
  });

  it('失踪 → 已故 ✓', () => {
    expect(isLegalCharTransition('失踪', '已故', { hasRevivalFlag: false })).toBe(true);
  });

  it('已故 → 在世 hasRevivalFlag=true ✓（转域续命授权）', () => {
    expect(isLegalCharTransition('已故', '在世', { hasRevivalFlag: true })).toBe(true);
  });

  it('已故 → 在世 hasRevivalFlag=false ✗（无授权则拒绝）', () => {
    expect(isLegalCharTransition('已故', '在世', { hasRevivalFlag: false })).toBe(false);
  });

  it('已故 → 失踪 ✗（已故是终态·不可退为失踪）', () => {
    expect(isLegalCharTransition('已故', '失踪', { hasRevivalFlag: false })).toBe(false);
  });

  it('undefined → 在世 ✓（创建·无前态）', () => {
    expect(isLegalCharTransition(undefined, '在世', { hasRevivalFlag: false })).toBe(true);
  });

  it('已故 → 已故 ✓（同态写·幂等）', () => {
    expect(isLegalCharTransition('已故', '已故', { hasRevivalFlag: false })).toBe(true);
  });
});

// ── L-15 · 物品状态转移（9 边）────────────────────────────────────────────────

describe('L-15 · isLegalItemTransition — 物品状态', () => {
  it('持有 → 遗失 ✓', () => {
    expect(isLegalItemTransition('持有', '遗失')).toBe(true);
  });

  it('遗失 → 持有 ✓', () => {
    expect(isLegalItemTransition('遗失', '持有')).toBe(true);
  });

  it('持有 → 销毁 ✓', () => {
    expect(isLegalItemTransition('持有', '销毁')).toBe(true);
  });

  it('遗失 → 销毁 ✓', () => {
    expect(isLegalItemTransition('遗失', '销毁')).toBe(true);
  });

  it('销毁 → 持有 ✗（销毁→* 全 false）', () => {
    expect(isLegalItemTransition('销毁', '持有')).toBe(false);
  });

  it('销毁 → 遗失 ✗（销毁→* 全 false）', () => {
    expect(isLegalItemTransition('销毁', '遗失')).toBe(false);
  });

  it('销毁 → 销毁 ✗（销毁→* 全 false·含同态写）', () => {
    expect(isLegalItemTransition('销毁', '销毁')).toBe(false);
  });

  it('undefined → 持有 ✓（创建·无前态）', () => {
    expect(isLegalItemTransition(undefined, '持有')).toBe(true);
  });

  it('持有 → 持有 ✓（同态写·幂等）', () => {
    expect(isLegalItemTransition('持有', '持有')).toBe(true);
  });
});
