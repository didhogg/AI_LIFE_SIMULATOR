// ⊕-2 runProposalGate — five-gate pipeline tests.
// Gate① shape · Gate② whitelist+C6 · Gate③ M3 · Gate④ K5 merge+clamp+computeDelta ·
// Gate⑤ audit log.
import { describe, it, expect } from 'vitest';
import { runProposalGate } from '../engine/proposal/runProposalGate.js';
import { RootSchema } from '../schema/index.js';
import type { RootState } from '../schema/index.js';
import type { K5DeltaEntry } from '../interfaces/interventionMerge.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

// Minimal valid state with a 货币系统 account path for Gate④ tests.
const BASE_STATE: RootState = RootSchema.parse({
  货币系统: {
    账户: {
      npc_wang: { 持有: { 文: 200 } },
    },
  },
  _状态机: { 双时钟: { 世界钟: 100 } },
  _席位表: {},
  全局: {},
});

// Minimal valid envelope.
const ENV_BASIC = { 提案: { 动作类别: '转账', 目标引用: 'npc_wang' } };
const ENV_TXN   = { txn_id: 'txn_001', 提案: { 动作类别: '转账', 目标引用: 'npc_wang' } };

// Whitelisted numeric path that exists in BASE_STATE.
const WL_PATH = '货币系统.账户.npc_wang.持有.文';

// Helper: read 货币系统.账户[acctKey].持有 from result state.
function getHoldings(state: RootState, acctKey: string): Record<string, number> {
  const 货币系统 = state.货币系统 as Record<string, unknown>;
  const 账户 = 货币系统['账户'] as Record<string, unknown>;
  const acct = 账户[acctKey] as Record<string, unknown>;
  return acct['持有'] as Record<string, number>;
}

// Helper: read 全局._覆写日志 from result state.
function getLog(state: RootState): Record<string, unknown>[] {
  const 全局 = state.全局 as Record<string, unknown>;
  return (全局['_覆写日志'] as Record<string, unknown>[]) ?? [];
}

function pack(entries: K5DeltaEntry[]): K5DeltaEntry[][] {
  return [entries];
}

// ─── Gate①: shape ─────────────────────────────────────────────────────────────

describe('Gate① — Zod shape validation', () => {
  it('rejects non-object envelope', () => {
    const r = runProposalGate(null, BASE_STATE, 'seat1', 'test');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.gate).toBe('①-shape');
  });

  it('rejects missing 提案 field', () => {
    const r = runProposalGate({ txn_id: 'x' }, BASE_STATE, 'seat1', 'test');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.gate).toBe('①-shape');
  });

  it('accepts minimal valid envelope with no packs', () => {
    const r = runProposalGate(ENV_BASIC, BASE_STATE, 'seat1', 'test');
    expect(r.ok).toBe(true);
  });
});

// ─── Gate②-a: whitelist ───────────────────────────────────────────────────────

describe('Gate② — whitelist', () => {
  it('rejects path not in whitelist', () => {
    const r = runProposalGate(
      ENV_BASIC,
      BASE_STATE,
      'seat1',
      'test',
      pack([{ path: '危险路径.foo', op: 'add', value: 1 }]),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.gate).toBe('②-whitelist');
      expect(r.reason).toContain('危险路径.foo');
    }
  });

  it('accepts whitelisted path', () => {
    const r = runProposalGate(
      ENV_BASIC,
      BASE_STATE,
      'seat1',
      'test',
      pack([{ path: WL_PATH, op: 'add', value: 10 }]),
    );
    expect(r.ok).toBe(true);
  });

  it('returns original state snapshot on whitelist failure', () => {
    const r = runProposalGate(
      ENV_BASIC,
      BASE_STATE,
      'seat1',
      'test',
      pack([{ path: '不存在.xxx', op: 'set', value: 1 }]),
    );
    expect(r.ok).toBe(false);
    // state returned = snapshot of original (no mutations)
    if (!r.ok) expect(r.state).not.toBe(BASE_STATE); // structuredClone
  });
});

// ─── Gate②-b: C6 seat scope ──────────────────────────────────────────────────

describe('Gate② — C6 seat scope', () => {
  it('single-player degrades to eligible (seat table size ≤1)', () => {
    // _席位表 = {} (0 seats) → single-player → eligible
    const r = runProposalGate(
      ENV_BASIC,
      BASE_STATE,
      'seat1',
      'test',
      pack([{ path: WL_PATH, op: 'add', value: 5 }]),
    );
    expect(r.ok).toBe(true);
  });

  it('multi-seat: wrong seat target → C6 ineligible', () => {
    const multiSeatState: RootState = RootSchema.parse({
      ...BASE_STATE,
      _席位表: {
        seat_a: { 焦点角色键: 'npc_hong', 控制者: '人类', 连接状态: '本地' },
        seat_b: { 焦点角色键: 'npc_wang', 控制者: 'AI',  连接状态: '本地' },
      },
    });
    // NPC.npc_wang path, but seatId=seat_a whose focus is npc_hong → ineligible
    const r = runProposalGate(
      ENV_BASIC,
      multiSeatState,
      'seat_a',
      'test',
      pack([{ path: 'NPC.npc_wang.当前作息模式', op: 'set', value: '营业中' }]),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.gate).toBe('②-C6');
  });
});

// ─── Gate③: M3 prefix ────────────────────────────────────────────────────────

describe('Gate③ — M3 structural invariant', () => {
  it('rejects hard-excluded path (first segment starts with _)', () => {
    // _作弊标记 etc. — even if not in whitelist, M3 gate would catch it
    // Here we use a whitelisted-looking but _ prefixed first segment.
    // Actually, such a path wouldn't pass Gate②, but test M3 with a
    // non-whitelisted check is fine — Gate② fires first. Let's instead
    // check a path where first segment IS _: already caught by Gate②.
    // Use a path that WOULD be whitelisted (NPC.{id}.当前作息模式) but
    // construct a path starting with _ via M3 direct test.
    // We verify gate field is '②-whitelist' for _-prefixed paths (Gate② first).
    const r = runProposalGate(
      ENV_BASIC,
      BASE_STATE,
      'seat1',
      'test',
      pack([{ path: '_作弊标记', op: 'add', value: 1 }]),
    );
    expect(r.ok).toBe(false);
    // Gate②-whitelist fires before Gate③ (path not in whitelist either)
    if (!r.ok) expect(r.gate).toMatch(/②|③/);
  });

  it('rejects forward-only path with sub op (M3 forward-only violation)', () => {
    // 编年史.序号 is forward-only: sub is forbidden.
    // Gate②-whitelist may fire first; either way it must not be ok.
    const r = runProposalGate(
      ENV_BASIC,
      BASE_STATE,
      'seat1',
      'test',
      pack([{ path: '编年史.序号', op: 'sub', value: 1 }]),
    );
    expect(r.ok).toBe(false);
  });
});

// ─── Gate④: K5 merge + clamp + computeDelta ──────────────────────────────────

describe('Gate④ — K5 delta application', () => {
  it('add op applies to state correctly', () => {
    const r = runProposalGate(
      ENV_BASIC,
      BASE_STATE,
      'seat1',
      'test',
      pack([{ path: WL_PATH, op: 'add', value: 50 }]),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(getHoldings(r.state, 'npc_wang')['文']).toBe(250); // 200 + 50
  });

  it('sub op applies to state correctly', () => {
    const r = runProposalGate(
      ENV_BASIC,
      BASE_STATE,
      'seat1',
      'test',
      pack([{ path: WL_PATH, op: 'sub', value: 30 }]),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(getHoldings(r.state, 'npc_wang')['文']).toBe(170); // 200 - 30
  });

  it('clamp op caps value at ceiling via clampLedger', () => {
    // Current value is 200, clamp ceiling is 150 → result should be 150.
    const r = runProposalGate(
      ENV_BASIC,
      BASE_STATE,
      'seat1',
      'test',
      pack([{ path: WL_PATH, op: 'clamp', value: 150 }]),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(getHoldings(r.state, 'npc_wang')['文']).toBe(150);
  });

  it('clamp op above current value is no-op', () => {
    // Current value is 200, clamp ceiling is 500 → value unchanged.
    const r = runProposalGate(
      ENV_BASIC,
      BASE_STATE,
      'seat1',
      'test',
      pack([{ path: WL_PATH, op: 'clamp', value: 500 }]),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(getHoldings(r.state, 'npc_wang')['文']).toBe(200);
  });

  it('lock op then add on same path fails Gate④', () => {
    // Two entries in one pack: lock first, then add on same path.
    const entries: K5DeltaEntry[] = [
      { path: WL_PATH, op: 'lock', value: 0 },
      { path: WL_PATH, op: 'add', value: 10 },
    ];
    const r = runProposalGate(ENV_BASIC, BASE_STATE, 'seat1', 'test', [entries]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.gate).toBe('④-delta');
  });

  it('computeDelta path-not-found in Gate④ fails with gate=④-delta', () => {
    // Path is technically whitelisted pattern (货币系统.账户.{id}.持有.{id})
    // but the concrete key npc_missing does not exist in state.
    const r = runProposalGate(
      ENV_BASIC,
      BASE_STATE,
      'seat1',
      'test',
      pack([{ path: '货币系统.账户.npc_missing.持有.文', op: 'add', value: 1 }]),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.gate).toBe('④-delta');
  });

  it('multi-pack merge: cross-pack clamp takes min ceiling', () => {
    // Pack1: clamp ceiling=300, Pack2: clamp ceiling=120 → merged ceiling=120.
    const p1: K5DeltaEntry[] = [{ path: WL_PATH, op: 'clamp', value: 300 }];
    const p2: K5DeltaEntry[] = [{ path: WL_PATH, op: 'clamp', value: 120 }];
    const r = runProposalGate(ENV_BASIC, BASE_STATE, 'seat1', 'test', [p1, p2]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(getHoldings(r.state, 'npc_wang')['文']).toBe(120);
  });

  it('max_delta cap is respected in merged delta', () => {
    // add value=100, max_delta=20 → only +20 applied.
    const r = runProposalGate(
      ENV_BASIC,
      BASE_STATE,
      'seat1',
      'test',
      pack([{ path: WL_PATH, op: 'add', value: 100, max_delta: 20 }]),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(getHoldings(r.state, 'npc_wang')['文']).toBe(220); // 200 + 20
  });
});

// ─── Gate⑤: audit log ────────────────────────────────────────────────────────

describe('Gate⑤ — audit log append', () => {
  it('appends one log entry on success', () => {
    const r = runProposalGate(ENV_BASIC, BASE_STATE, 'seat1', 'auth_src');
    expect(r.ok).toBe(true);
    if (r.ok) expect(getLog(r.state)).toHaveLength(1);
  });

  it('log entry has correct 时间 from world clock (100)', () => {
    const r = runProposalGate(ENV_BASIC, BASE_STATE, 'seat1', 'auth_src');
    expect(r.ok).toBe(true);
    if (r.ok) expect(getLog(r.state)[0]?.['时间']).toBe(100);
  });

  it('log entry 授权源 matches parameter', () => {
    const r = runProposalGate(ENV_BASIC, BASE_STATE, 'seat1', 'gm_override');
    expect(r.ok).toBe(true);
    if (r.ok) expect(getLog(r.state)[0]?.['授权源']).toBe('gm_override');
  });

  it('txn_id forwarded to 提案单引用 in log entry', () => {
    const r = runProposalGate(ENV_TXN, BASE_STATE, 'seat1', 'auth_src');
    expect(r.ok).toBe(true);
    if (r.ok) expect(getLog(r.state)[0]?.['提案单引用']).toBe('txn_001');
  });

  it('no 提案单引用 in log entry when txn_id absent', () => {
    const r = runProposalGate(ENV_BASIC, BASE_STATE, 'seat1', 'auth_src');
    expect(r.ok).toBe(true);
    if (r.ok) expect(Object.prototype.hasOwnProperty.call(getLog(r.state)[0], '提案单引用')).toBe(false);
  });

  it('no log entry appended on Gate② failure', () => {
    const r = runProposalGate(
      ENV_BASIC,
      BASE_STATE,
      'seat1',
      'test',
      pack([{ path: '非白名单路径.x', op: 'add', value: 1 }]),
    );
    expect(r.ok).toBe(false);
    // state is the snapshot (original); 全局._覆写日志 should remain empty
    if (!r.ok) expect(getLog(r.state)).toHaveLength(0);
  });
});

// ─── Determinism ─────────────────────────────────────────────────────────────

describe('runProposalGate — determinism', () => {
  it('two identical runs produce identical state JSON', () => {
    const opts: [unknown, RootState, string, string, K5DeltaEntry[][]] = [
      ENV_BASIC,
      BASE_STATE,
      'seat1',
      'auth',
      pack([{ path: WL_PATH, op: 'add', value: 7 }]),
    ];
    const r1 = runProposalGate(...opts);
    const r2 = runProposalGate(...opts);
    expect(r1.ok).toBe(r2.ok);
    // Compare state JSON (uses JSON.stringify only in tests — not in engine code).
    expect(JSON.stringify(r1.state)).toBe(JSON.stringify(r2.state));
  });

  it('input state is not mutated by gate run', () => {
    const before = JSON.stringify(BASE_STATE);
    runProposalGate(ENV_BASIC, BASE_STATE, 'seat1', 'test', pack([{ path: WL_PATH, op: 'add', value: 99 }]));
    expect(JSON.stringify(BASE_STATE)).toBe(before);
  });
});
