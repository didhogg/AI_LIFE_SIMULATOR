// M2 账本落账 — 单写者 worklist + clampLedger (H1) + commit
// 唯一合法写入路径：外部只能通过 TransferWorklist.commit() 改余额
// 禁止外部代码直接 balances.set()
import { clampLedger } from '@ai-life-sim/core/engine/math/ledger';
import type { Transfer } from './proposalSchema.js';
import type { SliceBalances } from './state.js';

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
