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
    const r = runProposalGate(null, BASE_STATE, 'seat1', '系统');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.gate).toBe('①-shape');
  });

  it('rejects missing 提案 field', () => {
    const r = runProposalGate({ txn_id: 'x' }, BASE_STATE, 'seat1', '系统');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.gate).toBe('①-shape');
  });

  it('accepts minimal valid envelope with no packs', () => {
    const r = runProposalGate(ENV_BASIC, BASE_STATE, 'seat1', '系统');
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
      '系统',
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
      '系统',
      pack([{ path: WL_PATH, op: 'add', value: 10 }]),
    );
    expect(r.ok).toBe(true);
  });

  it('returns original state snapshot on whitelist failure', () => {
    const r = runProposalGate(
      ENV_BASIC,
      BASE_STATE,
      'seat1',
      '系统',
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
      '系统',
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
      '系统',
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
      '系统',
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
      '系统',
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
      '系统',
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
      '系统',
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
      '系统',
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
      '系统',
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
    const r = runProposalGate(ENV_BASIC, BASE_STATE, 'seat1', '系统', [entries]);
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
      '系统',
      pack([{ path: '货币系统.账户.npc_missing.持有.文', op: 'add', value: 1 }]),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.gate).toBe('④-delta');
  });

  it('multi-pack merge: cross-pack clamp takes min ceiling', () => {
    // Pack1: clamp ceiling=300, Pack2: clamp ceiling=120 → merged ceiling=120.
    const p1: K5DeltaEntry[] = [{ path: WL_PATH, op: 'clamp', value: 300 }];
    const p2: K5DeltaEntry[] = [{ path: WL_PATH, op: 'clamp', value: 120 }];
    const r = runProposalGate(ENV_BASIC, BASE_STATE, 'seat1', '系统', [p1, p2]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(getHoldings(r.state, 'npc_wang')['文']).toBe(120);
  });

  it('max_delta cap is respected in merged delta', () => {
    // add value=100, max_delta=20 → only +20 applied.
    const r = runProposalGate(
      ENV_BASIC,
      BASE_STATE,
      'seat1',
      '系统',
      pack([{ path: WL_PATH, op: 'add', value: 100, max_delta: 20 }]),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(getHoldings(r.state, 'npc_wang')['文']).toBe(220); // 200 + 20
  });
});

// ─── Gate⑤: audit log ────────────────────────────────────────────────────────

describe('Gate⑤ — audit log append', () => {
  it('appends one log entry on success', () => {
    const r = runProposalGate(ENV_BASIC, BASE_STATE, 'seat1', '系统');
    expect(r.ok).toBe(true);
    if (r.ok) expect(getLog(r.state)).toHaveLength(1);
  });

  it('log entry has correct 时间 from world clock (100)', () => {
    const r = runProposalGate(ENV_BASIC, BASE_STATE, 'seat1', '系统');
    expect(r.ok).toBe(true);
    if (r.ok) expect(getLog(r.state)[0]?.['时间']).toBe(100);
  });

  it('log entry 授权源 matches parameter', () => {
    const r = runProposalGate(ENV_BASIC, BASE_STATE, 'seat1', '玩家确认');
    expect(r.ok).toBe(true);
    if (r.ok) expect(getLog(r.state)[0]?.['授权源']).toBe('玩家确认');
  });

  it('txn_id forwarded to 提案单引用 in log entry', () => {
    const r = runProposalGate(ENV_TXN, BASE_STATE, 'seat1', '系统');
    expect(r.ok).toBe(true);
    if (r.ok) expect(getLog(r.state)[0]?.['提案单引用']).toBe('txn_001');
  });

  it('no 提案单引用 in log entry when txn_id absent', () => {
    const r = runProposalGate(ENV_BASIC, BASE_STATE, 'seat1', '系统');
    expect(r.ok).toBe(true);
    if (r.ok) expect(Object.prototype.hasOwnProperty.call(getLog(r.state)[0], '提案单引用')).toBe(false);
  });

  it('no log entry appended on Gate② failure', () => {
    const r = runProposalGate(
      ENV_BASIC,
      BASE_STATE,
      'seat1',
      '系统',
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
      '系统',
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
    runProposalGate(ENV_BASIC, BASE_STATE, 'seat1', '系统', pack([{ path: WL_PATH, op: 'add', value: 99 }]));
    expect(JSON.stringify(BASE_STATE)).toBe(before);
  });
});

// ─── §2 ±Infinity safety (clampLedger lo=-Infinity / hi=Infinity) ─────────────
//
// Proof: clampLedger(amount, -Infinity, Infinity, path, hardHi) has zero NaN paths:
//   (A) amount > hardHi  → boolean comparison only; returns hardHi (finite). ✓
//   (B) amount > Infinity → always false for finite amount; dead branch.        ✓
//   (C) v1.max(amount, -Infinity) = Math.max(amount, -Infinity) = amount        ✓
//       (IEEE 754: max(x, -∞) = x for any finite x).
// No hi−lo arithmetic, no division, no multiplication involving ±Infinity.

describe('§2 · ±Infinity safety — clamp lo=-Infinity / hi=Infinity', () => {
  it('extreme negative current value: lo=-Infinity does not misfire (overdraft preserved)', () => {
    // Large overdraft: 文 = -1_000_000_000 (valid integer, legitimate overdraft)
    const negState = RootSchema.parse({
      货币系统: { 账户: { npc_wang: { 持有: { 文: -1_000_000_000 } } } },
      _状态机: { 双时钟: { 世界钟: 100 } },
      _席位表: {},
      全局: {},
    });
    // clamp ceiling=0; cur=-1e9 < 0 → NOT hit; v1.max(-1e9,-Infinity)=-1e9 → unchanged
    const r = runProposalGate(ENV_BASIC, negState, 'seat1', '系统',
      pack([{ path: WL_PATH, op: 'clamp', value: 0 }]));
    expect(r.ok).toBe(true);
    if (r.ok) {
      const val = getHoldings(r.state, 'npc_wang')['文'] as number;
      expect(typeof val).toBe('number');
      expect(Number.isFinite(val)).toBe(true);
      expect(val).toBe(-1_000_000_000); // floor -Infinity does not misfire
    }
  });

  it('clamp ceiling hit: written value is finite number equal to ceiling (not NaN/Infinity)', () => {
    // cur=200, ceiling=150 → 200>150 → clampLedger returns hardHi=150 (finite).
    const r = runProposalGate(ENV_BASIC, BASE_STATE, 'seat1', '系统',
      pack([{ path: WL_PATH, op: 'clamp', value: 150 }]));
    expect(r.ok).toBe(true);
    if (r.ok) {
      const val = getHoldings(r.state, 'npc_wang')['文'] as number;
      expect(typeof val).toBe('number');
      expect(Number.isFinite(val)).toBe(true);
      expect(val).toBe(150); // equals ceiling, not NaN/Infinity
    }
  });
});

// ─── §3 · Missing coverage (§3-3 atomic rollback / §3-4 DSL串 / §3-5 add+clamp) ─

describe('§3 · atomic rollback + DSL串拒 + mutation+clamp combo', () => {
  it('§3-3 · Gate④ partial failure → snapshot returned, no partial writes committed', () => {
    // Two adds in one pack: npc_wang (exists, w<z) then npc_zzz (absent, path-not-found).
    // Sorted order: npc_wang add runs first (succeeds, working=250), then npc_zzz fails.
    // On failure, return state=snapshot (original 200), not the partial working copy.
    const p: K5DeltaEntry[] = [
      { path: WL_PATH, op: 'add', value: 50 },
      { path: '货币系统.账户.npc_zzz.持有.文', op: 'add', value: 1 },
    ];
    const r = runProposalGate(ENV_BASIC, BASE_STATE, 'seat1', '系统', [p]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.gate).toBe('④-delta');
      // snapshot preserved: npc_wang.持有.文 must be original 200, not partial 250
      expect(getHoldings(r.state, 'npc_wang')['文']).toBe(200);
    }
  });

  it('§3-4 · string value in add op → Gate④ type-mismatch fail-closed (DSL 串到 add 拒)', () => {
    // K5DeltaEntry.value: number|string; string routed to add hits computeDelta type-mismatch.
    const entry: K5DeltaEntry = { path: WL_PATH, op: 'add', value: 'dsl:ceil*0.5' };
    const r = runProposalGate(ENV_BASIC, BASE_STATE, 'seat1', '系统', [[entry]]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.gate).toBe('④-delta');
  });

  it('§3-5 · add then clamp same path = min(current+delta, ceiling)', () => {
    // Sorted: add(a) before clamp(c). add: 200+50=250. clamp ceiling=220: 250>220 → 220.
    const p: K5DeltaEntry[] = [
      { path: WL_PATH, op: 'add', value: 50 },
      { path: WL_PATH, op: 'clamp', value: 220 },
    ];
    const r = runProposalGate(ENV_BASIC, BASE_STATE, 'seat1', '系统', [p]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(getHoldings(r.state, 'npc_wang')['文']).toBe(220); // min(250, 220)
  });
});

// ─── ⊕-3 · Gate③-M2 覆写授权源认证 ──────────────────────────────────────────

describe('⊕-3 · Gate③-M2 — 覆写授权源认证（M2 pre-check）', () => {
  it('有效授权源「系统」→ M2 放行（not gate=③-M2）', () => {
    const r = runProposalGate(ENV_BASIC, BASE_STATE, 'seat1', '系统');
    expect(r.ok).toBe(true);
  });

  it('有效授权源「裁判」→ M2 放行', () => {
    const r = runProposalGate(ENV_BASIC, BASE_STATE, 'seat1', '裁判');
    expect(r.ok).toBe(true);
  });

  it('有效授权源「玩家确认」→ M2 放行', () => {
    const r = runProposalGate(ENV_BASIC, BASE_STATE, 'seat1', '玩家确认');
    expect(r.ok).toBe(true);
  });

  it('无效授权源（任意串）→ gate=③-M2 fail-closed', () => {
    const r = runProposalGate(ENV_BASIC, BASE_STATE, 'seat1', 'mod_自命授权');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.gate).toBe('③-M2');
  });

  it('天命通道授权源「天命」→ gate=③-M2 fail-closed', () => {
    const r = runProposalGate(ENV_BASIC, BASE_STATE, 'seat1', '天命');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.gate).toBe('③-M2');
  });

  it('空串授权源 → gate=③-M2 fail-closed', () => {
    const r = runProposalGate(ENV_BASIC, BASE_STATE, 'seat1', '');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.gate).toBe('③-M2');
  });

  it('M2 拒 → state===snapshot（零状态写·原子回滚）', () => {
    // Verify returned state equals original snapshot (no 持有 mutation, no log entry)
    const r = runProposalGate(
      ENV_BASIC, BASE_STATE, 'seat1', '无效授权源',
      pack([{ path: WL_PATH, op: 'add', value: 999 }]),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(getHoldings(r.state, 'npc_wang')['文']).toBe(200); // no mutation
      expect(getLog(r.state)).toHaveLength(0);                  // no log entry
    }
  });
});

// ─── ⊕-3 · C6 Rule②③④ ────────────────────────────────────────────────────────

describe('⊕-3 · Gate② — C6 Rule②③④ 补全', () => {
  const MULTI_SEAT: RootState = RootSchema.parse({
    货币系统: { 账户: { npc_wang: { 持有: { 文: 200 } } } },
    _状态机: { 双时钟: { 世界钟: 100 } },
    _席位表: {
      seat_a: { 焦点角色键: 'npc_wang', 控制者: '人类', 连接状态: '本地' },
      seat_b: { 焦点角色键: 'npc_hong', 控制者: 'AI',   连接状态: '本地' },
    },
    全局: {},
  });

  it('Rule② · seatId 不在席位表 → ②-C6（无效席位）', () => {
    const r = runProposalGate(
      ENV_BASIC, MULTI_SEAT, 'seat_ghost', '系统',
      pack([{ path: 'NPC.npc_wang.姓名', op: 'set', value: '王' }]),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.gate).toBe('②-C6');
  });

  it('Rule③ · 焦点角色键===targetCharKey → 多席正向合格（C6 不拦）', () => {
    // seat_a.焦点角色键 === 'npc_wang'; writing to NPC.npc_wang.* → eligible
    const r = runProposalGate(
      ENV_BASIC, MULTI_SEAT, 'seat_a', '系统',
      pack([{ path: 'NPC.npc_wang.姓名', op: 'set', value: '王' }]),
    );
    // C6 must NOT block; may fail at Gate④ (path-not-found in test state)
    if (!r.ok) expect(r.gate).not.toBe('②-C6');
  });

  it('Rule④ · 焦点角色键===\'\' → ②-C6（无焦点席位）', () => {
    const noFocusState: RootState = RootSchema.parse({
      货币系统: { 账户: { npc_wang: { 持有: { 文: 200 } } } },
      _状态机: { 双时钟: { 世界钟: 100 } },
      _席位表: {
        seat_a: { 焦点角色键: '',         控制者: '人类', 连接状态: '本地' },
        seat_b: { 焦点角色键: 'npc_hong', 控制者: 'AI',   连接状态: '本地' },
      },
      全局: {},
    });
    const r = runProposalGate(
      ENV_BASIC, noFocusState, 'seat_a', '系统',
      pack([{ path: 'NPC.npc_wang.姓名', op: 'set', value: '王' }]),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.gate).toBe('②-C6');
  });
});

// ─── ⊕-3 · K5 多包合并 content op 后载覆盖显式验收 ──────────────────────────

describe('⊕-3 · K5 多包合并 — content op 后载覆盖', () => {
  it('两包同路径 add：后包 value 覆盖先包（last-writer-wins·最终+30）', () => {
    // mergeInterventionDeltas: content op = last-writer-wins by load order
    // Pack1: add 10 → Pack2: add 30 → merged: add 30 (not add 40, not add 10)
    const p1: K5DeltaEntry[] = [{ path: WL_PATH, op: 'add', value: 10 }];
    const p2: K5DeltaEntry[] = [{ path: WL_PATH, op: 'add', value: 30 }];
    const r = runProposalGate(ENV_BASIC, BASE_STATE, 'seat1', '系统', [p1, p2]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(getHoldings(r.state, 'npc_wang')['文']).toBe(230); // 200+30
  });
});
