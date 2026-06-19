// M2 账本落账 — 单写者 worklist + clampLedger (H1) + commit
// 唯一合法写入路径：外部只能通过 TransferWorklist.commit() 改余额
// 禁止外部代码直接 balances.set()
import { clampLedger } from '@ai-life-sim/core/engine/math/ledger';
// 单写者 worklist：防多处直接写账 + 防双重 commit
export class TransferWorklist {
    _transfers = [];
    _committed = false;
    load(transfers) {
        if (this._committed)
            throw new Error('Worklist: cannot reload after commit (单写者防护)');
        this._transfers = [...transfers];
    }
    get size() { return this._transfers.length; }
    get isCommitted() { return this._committed; }
    commit(balances) {
        if (this._committed)
            throw new Error('Worklist: double-commit blocked (单写者防护)');
        this._committed = true;
        const records = [];
        for (const t of this._transfers) {
            const before_from = balances.get(t.from) ?? 0;
            const before_to = balances.get(t.to) ?? 0;
            // H1 clamp：转账额不超过发起方当前余额（软顶=余额，硬底=0）
            const clampRes = clampLedger(t.amount, 0, before_from, `transfer.${t.from}→${t.to}`);
            const actual = clampRes.value;
            balances.set(t.from, before_from - actual);
            balances.set(t.to, before_to + actual);
            records.push({
                from: t.from, to: t.to, reason: t.reason,
                requestedAmt: t.amount, actualAmt: actual,
                before_from, before_to,
                after_from: before_from - actual,
                after_to: before_to + actual,
                clamped: clampRes.exceeded,
            });
        }
        return records;
    }
}

// ── Z3 条目级双向核销 ──────────────────────────────────────────────────────────

export function commitWithLineage(transfers, balances, committedEvents) {
    // Z3a: 无血统拒收
    for (const t of transfers) {
        if (!t.eventId) {
            throw new Error(`Z3 无血统拒收: (${t.from}→${t.to} amount=${t.amount})`);
        }
    }
    // 6.67: 幂等防护
    for (const t of transfers) {
        if (committedEvents.has(t.eventId)) {
            throw new Error(`6.67 重复 eventId=${t.eventId} 已落账·幂等防护拒收`);
        }
    }
    // Z3 all-or-nothing: 预演克隆 Map
    const preview = new Map(balances);
    for (const t of transfers) {
        const avail = preview.get(t.from) ?? 0;
        if (avail < t.amount) {
            throw new Error(`Z3 全退: ${t.from} 余额=${avail} < 请求=${t.amount}·eventId=${t.eventId}`);
        }
        preview.set(t.from, avail - t.amount);
        preview.set(t.to, (preview.get(t.to) ?? 0) + t.amount);
    }
    // 预验通过 → 原子执行
    const wl = new TransferWorklist();
    wl.load(transfers.map(t => ({ from: t.from, to: t.to, amount: t.amount, reason: t.reason })));
    const records = wl.commit(balances);
    for (const t of transfers) committedEvents.add(t.eventId);
    return records;
}

export function assertFullProposalConsumed(proposal, committed) {
    for (const p of proposal) {
        const found = committed.some(
            c => c.from === p.from && c.to === p.to && c.amount === p.amount,
        );
        if (!found) {
            throw new Error(`Z3 提案条目未消耗·打回: (${p.from}→${p.to} amount=${p.amount})`);
        }
    }
}
