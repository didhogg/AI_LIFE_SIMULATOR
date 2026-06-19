// M2 账本落账 — 单写者 worklist + clampLedger (H1) + commit
// 唯一合法写入路径：外部只能通过 TransferWorklist.commit() 改余额
// 禁止外部代码直接 balances.set()
import { clampLedger } from '@ai-life-sim/core/engine/math/ledger';
import type { Transfer } from './proposalSchema.js';
import type { SliceBalances } from './state.js';
import type { LineageTransfer } from '../engine/ticket.js';

export interface FlowRecord {
  from:          string;
  to:            string;
  requestedAmt:  number;  // 原始请求金额
  actualAmt:     number;  // 实际落账金额（钳制后）
  reason:        string;
  before_from:   number;
  before_to:     number;
  after_from:    number;
  after_to:      number;
  clamped:       boolean; // true = 触发软顶，调用方应广播 ⚠
}

// 单写者 worklist：防多处直接写账 + 防双重 commit
export class TransferWorklist {
  private _transfers: Transfer[] = [];
  private _committed = false;

  load(transfers: Transfer[]): void {
    if (this._committed) throw new Error('Worklist: cannot reload after commit (单写者防护)');
    this._transfers = [...transfers];
  }

  get size(): number { return this._transfers.length; }
  get isCommitted(): boolean { return this._committed; }

  commit(balances: SliceBalances): FlowRecord[] {
    if (this._committed) throw new Error('Worklist: double-commit blocked (单写者防护)');
    this._committed = true;

    const records: FlowRecord[] = [];
    for (const t of this._transfers) {
      const before_from = balances.get(t.from) ?? 0;
      const before_to   = balances.get(t.to)   ?? 0;

      // H1 clamp：转账额不超过发起方当前余额（软顶=余额，硬底=0）
      const clampRes = clampLedger(
        t.amount,
        0,
        before_from,
        `transfer.${t.from}→${t.to}`,
      );
      const actual = clampRes.value;

      balances.set(t.from, before_from - actual);
      balances.set(t.to,   before_to   + actual);
      records.push({
        from: t.from, to: t.to, reason: t.reason,
        requestedAmt: t.amount, actualAmt: actual,
        before_from, before_to,
        after_from: before_from - actual,
        after_to:   before_to   + actual,
        clamped: clampRes.exceeded,
      });
    }
    return records;
  }
}

// ── Z3 条目级双向核销 ──────────────────────────────────────────────────────────

/**
 * Z3 无血统拒收 + all-or-nothing 预验 + 6.67 幂等防护。
 * 预验通过后才执行；任一条件失败整组不落账。
 */
export function commitWithLineage(
  transfers:       LineageTransfer[],
  balances:        SliceBalances,
  committedEvents: Set<string>,
): FlowRecord[] {
  // Z3a: 无血统拒收
  for (const t of transfers) {
    if (!t.eventId) {
      throw new Error(`Z3 无血统拒收: (${t.from}→${t.to} amount=${t.amount})`);
    }
  }
  // 6.67: 幂等防护 — 同 eventId 不双落账
  for (const t of transfers) {
    if (committedEvents.has(t.eventId)) {
      throw new Error(`6.67 重复 eventId=${t.eventId} 已落账·幂等防护拒收`);
    }
  }
  // Z3 all-or-nothing: 在克隆 Map 上预演，全部通过才执行（严格余额检查·不 clamp）
  const preview = new Map(balances);
  for (const t of transfers) {
    const avail = preview.get(t.from) ?? 0;
    if (avail < t.amount) {
      throw new Error(
        `Z3 全退: ${t.from} 余额=${avail} < 请求=${t.amount}·eventId=${t.eventId}`,
      );
    }
    preview.set(t.from, avail - t.amount);
    preview.set(t.to, (preview.get(t.to) ?? 0) + t.amount);
  }
  // 预验全通过 → 原子执行
  const wl = new TransferWorklist();
  wl.load(transfers.map(t => ({ from: t.from, to: t.to, amount: t.amount, reason: t.reason })));
  const records = wl.commit(balances);
  for (const t of transfers) committedEvents.add(t.eventId);
  return records;
}

/**
 * Z3 未消耗打回：提案每条目必须在 committed 列表中出现，否则 throw。
 * 用于校验「LLM 提案单 = 事务组，不得部分执行」。
 */
export function assertFullProposalConsumed(
  proposal:  Array<{ from: string; to: string; amount: number }>,
  committed: Array<{ from: string; to: string; amount: number }>,
): void {
  for (const p of proposal) {
    const found = committed.some(
      c => c.from === p.from && c.to === p.to && c.amount === p.amount,
    );
    if (!found) {
      throw new Error(
        `Z3 提案条目未消耗·打回: (${p.from}→${p.to} amount=${p.amount})`,
      );
    }
  }
}
