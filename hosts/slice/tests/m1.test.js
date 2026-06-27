// M1 单拍闭环 — 单元测试（无 LLM 调用，全部 mock 数据）
import { describe, it, expect } from 'vitest';
import { gateStructural, gateCoverage, assertConservation, } from '../ledger/gate.js';
import { TransferWorklist } from '../ledger/commit.js';
import { initBalances, getBalance } from '../ledger/state.js';
import { TickProposalSchema } from '../ledger/proposalSchema.js';
// ── 闸① 结构校验 ─────────────────────────────────────────────────────────────
describe('Gate①: 结构校验', () => {
    it('合法提案单解析成功', () => {
        const raw = JSON.stringify({
            transfers: [{ from: 'pc_linjiu', to: 'npc_hong', amount: 2, reason: '小费' }],
            checks: [],
            knowledge: [],
        });
        const res = gateStructural(raw);
        expect(res.ok).toBe(true);
        if (res.ok) {
            expect(res.proposal.transfers[0]?.amount).toBe(2);
        }
    });
    it('非 JSON 字符串 → 降级不崩', () => {
        const res = gateStructural('这不是JSON!!!');
        expect(res.ok).toBe(false);
        expect(res.reason).toMatch(/JSON/);
    });
    it('amount 为 0 → Zod 拒绝（非正整数）', () => {
        const raw = JSON.stringify({
            transfers: [{ from: 'pc_linjiu', to: 'npc_hong', amount: 0 }],
        });
        const res = gateStructural(raw);
        expect(res.ok).toBe(false);
    });
    it('amount 为负数 → Zod 拒绝', () => {
        const raw = JSON.stringify({
            transfers: [{ from: 'a', to: 'b', amount: -5 }],
        });
        const res = gateStructural(raw);
        expect(res.ok).toBe(false);
    });
    it('amount 为小数 → Zod 拒绝（非整数）', () => {
        const raw = JSON.stringify({
            transfers: [{ from: 'a', to: 'b', amount: 1.5 }],
        });
        const res = gateStructural(raw);
        expect(res.ok).toBe(false);
    });
    it('空对象 → 默认值填充，解析成功', () => {
        const res = gateStructural('{}');
        expect(res.ok).toBe(true);
        if (res.ok) {
            expect(res.proposal.transfers).toEqual([]);
            expect(res.proposal.checks).toEqual([]);
            expect(res.proposal.knowledge).toEqual([]);
        }
    });
    it('缺 from 字段 → Zod 拒绝', () => {
        const raw = JSON.stringify({
            transfers: [{ to: 'npc_hong', amount: 2 }],
        });
        const res = gateStructural(raw);
        expect(res.ok).toBe(false);
    });
});
// ── 闸③ 对账覆盖性 ───────────────────────────────────────────────────────────
describe('Gate③: 对账覆盖性', () => {
    const makeProposal = (amounts) => TickProposalSchema.parse({
        transfers: amounts.map(a => ({ from: 'pc_linjiu', to: 'npc_hong', amount: a })),
    });
    it('叙事无金额 → 覆盖', () => {
        const res = gateCoverage('林九和王掌柜打了招呼', makeProposal([]));
        expect(res.covered).toBe(true);
    });
    it('叙事有 2文，提案单有 2 → 覆盖', () => {
        const res = gateCoverage('林九给了红姨2文小费', makeProposal([2]));
        expect(res.covered).toBe(true);
    });
    it('叙事有 2文，提案单为空 → 漏项', () => {
        const res = gateCoverage('林九给了红姨2文小费', makeProposal([]));
        expect(res.covered).toBe(false);
        if (!res.covered)
            expect(res.missing).toContain(2);
    });
    it('叙事有 5文钱，提案单只有 3 → 漏项', () => {
        const res = gateCoverage('给了5文钱', makeProposal([3]));
        expect(res.covered).toBe(false);
        if (!res.covered)
            expect(res.missing).toContain(5);
    });
    it('叙事中 0文 忽略（提取时排除）', () => {
        // "0文" → parseChineseAmount('0') = null → not extracted; no proposal needed
        const res = gateCoverage('坐了0文钱的冷板凳，什么都没花', makeProposal([]));
        expect(res.covered).toBe(true);
    });
});
// ── 单写者 worklist ──────────────────────────────────────────────────────────
describe('Gate②: 单写者 worklist', () => {
    it('正常 load → commit → 余额变更正确', () => {
        const balances = initBalances({ pc_linjiu: 30, npc_hong: 0 });
        const wl = new TransferWorklist();
        wl.load([{ from: 'pc_linjiu', to: 'npc_hong', amount: 2, reason: '小费' }]);
        const records = wl.commit(balances);
        expect(getBalance(balances, 'pc_linjiu')).toBe(28);
        expect(getBalance(balances, 'npc_hong')).toBe(2);
        expect(records[0]?.before_from).toBe(30);
        expect(records[0]?.after_from).toBe(28);
        expect(records[0]?.before_to).toBe(0);
        expect(records[0]?.after_to).toBe(2);
    });
    it('double-commit 抛错（单写者防护）', () => {
        const balances = initBalances({ pc_linjiu: 30, npc_hong: 0 });
        const wl = new TransferWorklist();
        wl.load([{ from: 'pc_linjiu', to: 'npc_hong', amount: 2, reason: '' }]);
        wl.commit(balances);
        expect(() => wl.commit(balances)).toThrow(/double-commit/);
    });
    it('commit 后 reload 抛错（单写者防护）', () => {
        const balances = initBalances({ pc_linjiu: 30, npc_hong: 0 });
        const wl = new TransferWorklist();
        wl.load([{ from: 'pc_linjiu', to: 'npc_hong', amount: 1, reason: '' }]);
        wl.commit(balances);
        expect(() => wl.load([{ from: 'pc_linjiu', to: 'npc_hong', amount: 1, reason: '' }])).toThrow(/reload after commit/);
    });
    it('空 worklist commit → records 为空，余额不变', () => {
        const balances = initBalances({ pc_linjiu: 30, npc_hong: 0 });
        const wl = new TransferWorklist();
        wl.load([]);
        const records = wl.commit(balances);
        expect(records).toHaveLength(0);
        expect(getBalance(balances, 'pc_linjiu')).toBe(30);
    });
});
// ── 守恒断言 ─────────────────────────────────────────────────────────────────
describe('守恒断言', () => {
    it('发出 = 收到 → 断言通过', () => {
        expect(() => assertConservation([{ before_from: 30, after_from: 28, before_to: 0, after_to: 2 }])).not.toThrow();
    });
    it('发出 ≠ 收到 → 断言抛错', () => {
        expect(() => assertConservation([{ before_from: 30, after_from: 27, before_to: 0, after_to: 2 }])).toThrow(/守恒断言失败/);
    });
});
// ── 拍 3 黄金路径（mock 数据·无 LLM）────────────────────────────────────────
describe('拍 3 黄金路径: 林九给红姨 2 文小费', () => {
    const narrative = '林九从怀里掏出2文铜钱，笑着递给红姨。"小费，多谢了。"';
    const rawJson = JSON.stringify({
        transfers: [{ from: 'pc_linjiu', to: 'npc_hong', amount: 2, reason: '小费' }],
        checks: [],
        knowledge: [],
    });
    it('提案单结构合法', () => {
        const res = gateStructural(rawJson);
        expect(res.ok).toBe(true);
    });
    it('覆盖性通过（叙事 2文 ↔ 提案 2）', () => {
        const gate1 = gateStructural(rawJson);
        if (!gate1.ok)
            throw new Error(gate1.reason);
        const res = gateCoverage(narrative, gate1.proposal);
        expect(res.covered).toBe(true);
    });
    it('账本: pc_linjiu 30→28、npc_hong 0→2', () => {
        const balances = initBalances({ pc_linjiu: 30, npc_hong: 0, npc_wang: 200 });
        const gate1 = gateStructural(rawJson);
        if (!gate1.ok)
            throw new Error(gate1.reason);
        const wl = new TransferWorklist();
        wl.load(gate1.proposal.transfers);
        const records = wl.commit(balances);
        expect(getBalance(balances, 'pc_linjiu')).toBe(28);
        expect(getBalance(balances, 'npc_hong')).toBe(2);
        expect(getBalance(balances, 'npc_wang')).toBe(200); // 无关账户不变
        assertConservation(records);
    });
});
// ── 故意非法提案（验收要求）──────────────────────────────────────────────────
describe('故意非法/漏项提案', () => {
    it('场景A: 叙事提到 2文但提案单为空 → 覆盖性闸漏项（一次重写机会）', () => {
        const narrative = '林九悄悄塞给红姨2文钱，低声道："不声张。"';
        const emptyRaw = '{"transfers":[],"checks":[],"knowledge":[]}';
        const gate1 = gateStructural(emptyRaw);
        expect(gate1.ok).toBe(true);
        if (!gate1.ok)
            return;
        const coverage = gateCoverage(narrative, gate1.proposal);
        // 漏项，触发一次重写
        expect(coverage.covered).toBe(false);
        if (!coverage.covered) {
            expect(coverage.missing).toContain(2);
            // 模拟重写后仍然为空 → 降级标记
            const retryRaw = '{"transfers":[],"checks":[],"knowledge":[]}';
            const retryGate = gateStructural(retryRaw);
            expect(retryGate.ok).toBe(true);
            if (!retryGate.ok)
                return;
            const retryCoverage = gateCoverage(narrative, retryGate.proposal);
            expect(retryCoverage.covered).toBe(false);
            if (!retryCoverage.covered) {
                // 降级标记：不崩、有 missing 数据可追踪
                const degraded = { ...retryCoverage, degraded: true };
                expect(degraded.degraded).toBe(true);
                expect(degraded.missing.length).toBeGreaterThan(0);
            }
        }
    });
    it('场景B: 完全无效 JSON → 结构闸拒绝，全程不崩', () => {
        const res = gateStructural('<invalid-json>');
        expect(res.ok).toBe(false);
        expect(res.reason).toMatch(/JSON/);
        // 调用方降级处理（无 transfer），账本不变
        const balances = initBalances({ pc_linjiu: 30, npc_hong: 0 });
        const wl = new TransferWorklist();
        wl.load([]); // degraded → empty worklist
        const records = wl.commit(balances);
        expect(records).toHaveLength(0);
        expect(getBalance(balances, 'pc_linjiu')).toBe(30);
    });
    it('场景C: amount 字段为字符串 → Zod 拒绝，不崩', () => {
        const raw = JSON.stringify({
            transfers: [{ from: 'pc_linjiu', to: 'npc_hong', amount: '两文', reason: '' }],
        });
        const res = gateStructural(raw);
        expect(res.ok).toBe(false);
    });
});
