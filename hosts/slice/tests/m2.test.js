// M2 检定 + 账本守恒 — 单元测试（无 LLM 调用）
import { describe, it, expect } from 'vitest';
import { runD20Check } from '../engine/check.js';
import { createArchiveHeader, bumpSalt } from '../engine/archive.js';
import { TransferWorklist } from '../ledger/commit.js';
import { initBalances, getBalance } from '../ledger/state.js';
import { assertConservation, assertNetZero } from '../ledger/gate.js';
import { SAVE_SEED, RECIPE, RECIPE_KEY, PC, NPC_WANG, NPC_HONG } from '../fixture/world.js';
// ── rngFor 确定性（同 seed 双跑逐位恒等）────────────────────────────────────
describe('M2: rngFor 确定性·同 seed 双跑逐位恒等', () => {
    it('相同 (seed, tick, channel, salt) → rawU 逐位相同', () => {
        const header = createArchiveHeader(SAVE_SEED);
        const r1 = runD20Check(SAVE_SEED, 4, RECIPE_KEY, RECIPE.attrBonus, RECIPE.dc, header);
        const r2 = runD20Check(SAVE_SEED, 4, RECIPE_KEY, RECIPE.attrBonus, RECIPE.dc, header);
        expect(r1.rawU).toBe(r2.rawU);
        expect(r1.diceRoll).toBe(r2.diceRoll);
        expect(r1.success).toBe(r2.success);
    });
    it('不同 tick → rawU 不同', () => {
        const header = createArchiveHeader(SAVE_SEED);
        const r4 = runD20Check(SAVE_SEED, 4, RECIPE_KEY, RECIPE.attrBonus, RECIPE.dc, header);
        const r5 = runD20Check(SAVE_SEED, 5, RECIPE_KEY, RECIPE.attrBonus, RECIPE.dc, header);
        // tick 不同时 rawU 大概率不同（用 r4.rawU 锚 regression）
        expect(r4.rawU).not.toBe(r5.rawU);
    });
    it('不同 seed → rawU 不同', () => {
        const h1 = createArchiveHeader(42);
        const h2 = createArchiveHeader(99);
        const r1 = runD20Check(42, 4, RECIPE_KEY, RECIPE.attrBonus, RECIPE.dc, h1);
        const r2 = runD20Check(99, 4, RECIPE_KEY, RECIPE.attrBonus, RECIPE.dc, h2);
        expect(r1.rawU).not.toBe(r2.rawU);
    });
    it('bumpSalt 后 rawU 不同（防骰子农场）', () => {
        const h0 = createArchiveHeader(SAVE_SEED);
        const h1 = bumpSalt(h0);
        const r0 = runD20Check(SAVE_SEED, 4, RECIPE_KEY, RECIPE.attrBonus, RECIPE.dc, h0);
        const r1 = runD20Check(SAVE_SEED, 4, RECIPE_KEY, RECIPE.attrBonus, RECIPE.dc, h1);
        expect(r0.salt).toBe(0);
        expect(r1.salt).toBe(1);
        expect(r0.rawU).not.toBe(r1.rawU);
    });
});
// ── 检定范围与结构 ────────────────────────────────────────────────────────────
describe('M2: d20 检定结构', () => {
    it('diceRoll 在 [1,20] 范围内', () => {
        const header = createArchiveHeader(SAVE_SEED);
        for (let tick = 1; tick <= 20; tick++) {
            const r = runD20Check(SAVE_SEED, tick, RECIPE_KEY, RECIPE.attrBonus, RECIPE.dc, header);
            expect(r.diceRoll).toBeGreaterThanOrEqual(1);
            expect(r.diceRoll).toBeLessThanOrEqual(20);
        }
    });
    it('total = diceRoll + attrBonus', () => {
        const header = createArchiveHeader(SAVE_SEED);
        const r = runD20Check(SAVE_SEED, 4, RECIPE_KEY, RECIPE.attrBonus, RECIPE.dc, header);
        expect(r.total).toBe(r.diceRoll + r.attrBonus);
    });
    it('success = (total >= dc)', () => {
        const header = createArchiveHeader(SAVE_SEED);
        const r = runD20Check(SAVE_SEED, 4, RECIPE_KEY, RECIPE.attrBonus, RECIPE.dc, header);
        expect(r.success).toBe(r.total >= r.dc);
    });
    it('salt 字段 = 全局回滚计数器（tick_log 写入源）', () => {
        const header = createArchiveHeader(SAVE_SEED);
        const r = runD20Check(SAVE_SEED, 4, RECIPE_KEY, RECIPE.attrBonus, RECIPE.dc, header);
        expect(r.salt).toBe(header.全局回滚计数器);
    });
    // 黄金向量：固定 (seed=42, tick=4, salt=0) → 锁定 rawU（改 rngFor 必须更新此值）
    it('黄金向量：seed=42 tick=4 salt=0 rawU=2 diceRoll=1（RNG 序列回归门）', () => {
        const header = createArchiveHeader(42);
        const r = runD20Check(42, 4, RECIPE_KEY, RECIPE.attrBonus, RECIPE.dc, header);
        expect(r.rawU).toBe(2); // xorshift128+ deterministic output
        expect(r.diceRoll).toBe(1); // floor(2/5)+1 = 1
        expect(r.total).toBe(7); // 1 + 魅力加成6
        expect(r.success).toBe(false); // 7 < DC12
    });
});
// ── 账本守恒（M2 收紧版）─────────────────────────────────────────────────────
describe('M2: 账本守恒 + clampLedger H1', () => {
    it('成功路径：赊账 8文，双方余额守恒', () => {
        const balances = initBalances({ [PC]: 30, [NPC_WANG]: 200, [NPC_HONG]: 0 });
        const wl = new TransferWorklist();
        // 成功时王掌柜借出 8文给林九（赊账=主角余额+8）
        wl.load([{ from: NPC_WANG, to: PC, amount: 8, reason: '赊账' }]);
        const records = wl.commit(balances);
        expect(getBalance(balances, NPC_WANG)).toBe(192);
        expect(getBalance(balances, PC)).toBe(38);
        expect(records[0]?.clamped).toBe(false);
        assertConservation(records);
        assertNetZero(records);
    });
    it('失败路径：无账变，账本不动', () => {
        const balances = initBalances({ [PC]: 30, [NPC_WANG]: 200, [NPC_HONG]: 0 });
        const wl = new TransferWorklist();
        wl.load([]); // 失败 → 无转账
        const records = wl.commit(balances);
        expect(records).toHaveLength(0);
        expect(getBalance(balances, PC)).toBe(30);
        expect(getBalance(balances, NPC_WANG)).toBe(200);
    });
    it('H1 clamp：余额不足时钳制 + clamped=true', () => {
        const balances = initBalances({ [PC]: 5, [NPC_WANG]: 200 });
        const wl = new TransferWorklist();
        wl.load([{ from: PC, to: NPC_WANG, amount: 10, reason: '还钱（余额不足）' }]);
        const records = wl.commit(balances);
        // clamp to available balance: actualAmt = 5
        expect(records[0]?.actualAmt).toBe(5);
        expect(records[0]?.requestedAmt).toBe(10);
        expect(records[0]?.clamped).toBe(true);
        // 守恒基于实际落账量
        assertConservation(records);
        expect(getBalance(balances, PC)).toBe(0);
        expect(getBalance(balances, NPC_WANG)).toBe(205);
    });
    it('H1 clamp：余额为 0 时转账 → actualAmt=0，账本不变', () => {
        const balances = initBalances({ [PC]: 0, [NPC_HONG]: 0 });
        const wl = new TransferWorklist();
        wl.load([{ from: PC, to: NPC_HONG, amount: 5, reason: '' }]);
        const records = wl.commit(balances);
        expect(records[0]?.actualAmt).toBe(0);
        expect(records[0]?.clamped).toBe(true);
        assertConservation(records);
        expect(getBalance(balances, PC)).toBe(0);
        expect(getBalance(balances, NPC_HONG)).toBe(0);
    });
    it('守恒断言·多笔记账：Σ净额 = 0', () => {
        const balances = initBalances({ [PC]: 30, [NPC_WANG]: 200, [NPC_HONG]: 2 });
        const wl = new TransferWorklist();
        wl.load([
            { from: PC, to: NPC_HONG, amount: 3, reason: '第二次小费' },
            { from: PC, to: NPC_WANG, amount: 5, reason: '部分还账' },
        ]);
        const records = wl.commit(balances);
        assertConservation(records);
        assertNetZero(records);
        expect(getBalance(balances, PC)).toBe(22); // 30-3-5
        expect(getBalance(balances, NPC_HONG)).toBe(5); // 2+3
        expect(getBalance(balances, NPC_WANG)).toBe(205); // 200+5
    });
});
// ── 拍 4 黄金路径（mock 数据·无 LLM）────────────────────────────────────────
describe('M2: 拍 4 黄金路径 chk_persuade_credit', () => {
    const header = createArchiveHeader(SAVE_SEED);
    const result = runD20Check(SAVE_SEED, 4, RECIPE_KEY, RECIPE.attrBonus, RECIPE.dc, header);
    it('rawU ∈ [0,99]', () => {
        expect(result.rawU).toBeGreaterThanOrEqual(0);
        expect(result.rawU).toBeLessThanOrEqual(99);
    });
    it('diceRoll ∈ [1,20]', () => {
        expect(result.diceRoll).toBeGreaterThanOrEqual(1);
        expect(result.diceRoll).toBeLessThanOrEqual(20);
    });
    it('salt 记录用于 tick_log.盐值', () => {
        expect(typeof result.salt).toBe('number');
        expect(Number.isInteger(result.salt)).toBe(true);
    });
    it('成功时落赊账账，失败时无账变', () => {
        const balances = initBalances({ [PC]: 30, [NPC_WANG]: 200 });
        const wl = new TransferWorklist();
        if (result.success) {
            wl.load([{ from: NPC_WANG, to: PC, amount: 8, reason: '赊账' }]);
        }
        else {
            wl.load([]);
        }
        const records = wl.commit(balances);
        if (result.success) {
            expect(getBalance(balances, PC)).toBe(38);
            expect(getBalance(balances, NPC_WANG)).toBe(192);
            assertConservation(records);
        }
        else {
            expect(getBalance(balances, PC)).toBe(30);
            expect(records).toHaveLength(0);
        }
    });
    it('同 seed 双跑：拍 4 结果完全一致', () => {
        const h = createArchiveHeader(SAVE_SEED);
        const a = runD20Check(SAVE_SEED, 4, RECIPE_KEY, RECIPE.attrBonus, RECIPE.dc, h);
        const b = runD20Check(SAVE_SEED, 4, RECIPE_KEY, RECIPE.attrBonus, RECIPE.dc, h);
        expect(a.rawU).toBe(b.rawU);
        expect(a.diceRoll).toBe(b.diceRoll);
        expect(a.success).toBe(b.success);
        expect(a.salt).toBe(b.salt);
    });
});
