import { describe, it, expect } from 'vitest';
import { assertConservation, ConservationError } from '../engine/conservation.js';
import { 账户Schema } from '../schema/economy.js';
import type { 账户Type } from '../schema/economy.js';

// 辅助：构造最小合法账户（用 schema default 确保字段齐全）
function makeAcct(持有: Record<string, number> = {}): 账户Type {
  return 账户Schema.parse({ 持有 });
}

// 注入口径 A：仅现金（持有某单一币种）
const 仅现金 = (coin: string) => (acct: 账户Type) => acct.持有[coin] ?? 0;

describe('assertConservation', () => {
  it('守恒通过 = noop（Σ === expected，不 throw）', () => {
    const accounts = {
      pc_a: makeAcct({ 两: 100 }),
      npc_b: makeAcct({ 两: 50 }),
      org_c: makeAcct({ 两: 80 }),
    };
    // getNetAsset: 只取持有.两
    expect(() => assertConservation(accounts, 230, 仅现金('两'))).not.toThrow();
  });

  it('单实体失衡 → throw ConservationError，detail 含该实体', () => {
    const accounts = { pc_a: makeAcct({ 两: 100 }) };
    let err: ConservationError | null = null;
    try {
      assertConservation(accounts, 999, 仅现金('两'));
    } catch (e) {
      if (e instanceof ConservationError) err = e;
    }
    expect(err).not.toBeNull();
    expect(err!.detail.expected).toBe(999);
    expect(err!.detail.actual).toBe(100);
    expect(err!.detail.perEntity.some((e) => e.key === 'pc_a')).toBe(true);
  });

  it('多实体 Σ 失衡 → throw，perEntity 覆盖所有键', () => {
    const accounts = {
      pc_a: makeAcct({ 铜: 300 }),
      npc_b: makeAcct({ 铜: 200 }),
    };
    let err: ConservationError | null = null;
    try {
      assertConservation(accounts, 600, 仅现金('铜'));
    } catch (e) {
      if (e instanceof ConservationError) err = e;
    }
    expect(err).not.toBeNull();
    expect(err!.detail.actual).toBe(500);
    const keys = err!.detail.perEntity.map((e) => e.key);
    expect(keys).toContain('pc_a');
    expect(keys).toContain('npc_b');
  });

  it('空账户 {} → Σ===0，expected=0 → 不 throw', () => {
    expect(() => assertConservation({}, 0, 仅现金('两'))).not.toThrow();
  });

  it('自定义 getNetAsset 注入路径：同 accounts，两种口径得不同结论', () => {
    const accounts = {
      pc_a: makeAcct({ 两: 100, 铜: 50 }),
    };
    // 口径 A：只现金.两
    expect(() => assertConservation(accounts, 100, 仅现金('两'))).not.toThrow();
    // 口径 B：只现金.铜 → 相同 accounts，expected=100 时失衡
    expect(() => assertConservation(accounts, 100, 仅现金('铜'))).toThrow(ConservationError);
  });
});
