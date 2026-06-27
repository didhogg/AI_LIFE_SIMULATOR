// M2.7 对账闸语义/方向硬化 — 集成测试
// ① NFKC 归一四类用例
// ② 找零方向 / 赊账债权 / 垫付代付 / 总价"共" 四类语义 fail-closed
// ③ from/to 实体不可确认 → degraded 不默认主角
// M2.5/M2.6 用例见 m25.test.ts；本文件仅测 M2.7 新增拦截路径
import { describe, it, expect } from 'vitest';
import { gateCoverage } from '../ledger/gate.js';
import { TickProposalSchema } from '../ledger/proposalSchema.js';
function makeP(amounts, opts) {
    return TickProposalSchema.parse({
        transfers: amounts.map((a, i) => ({
            from: opts?.from ?? `a${i}`,
            to: opts?.to ?? `b${i}`,
            amount: a,
            reason: '',
        })),
    });
}
// slice 世界实体上下文（用于 from/to 校验测试）
const WORLD_CTX = {
    entities: [
        { key: 'pc_linjiu', aliases: ['林九', '主角'] },
        { key: 'npc_hong', aliases: ['红姨', '红叶'] },
        { key: 'npc_wang', aliases: ['王掌柜', '掌柜'] },
    ],
};
// ── ① NFKC 归一：全角/空格/括号/单位 fail-closed ─────────────────────────────
describe('M2.7 Gate③: NFKC 归一召回', () => {
    it('全角数字 「５０文」提案「50」→ covered:true', () => {
        expect(gateCoverage('花了５０文', makeP([50])).covered).toBe(true);
    });
    it('全角数字 「５０文」提案「30」→ covered:false（金额漏项）', () => {
        const r = gateCoverage('花了５０文', makeP([30]));
        expect(r.covered).toBe(false);
        if (!r.covered)
            expect(r.missing).toContain(50);
    });
    it('全角空格 「5　0　文」提案「50」→ covered:true（NFKC+折叠）', () => {
        expect(gateCoverage('花了5　0　文', makeP([50])).covered).toBe(true);
    });
    it('全角空格 「5　0　文」提案「5」→ covered:false（不拆成两个数）', () => {
        const r = gateCoverage('花了5　0　文', makeP([5]));
        expect(r.covered).toBe(false);
    });
    it('全角括号 「（50文）」提案「50」→ covered:true', () => {
        expect(gateCoverage('（50文）', makeP([50])).covered).toBe(true);
    });
    it('「5 两」（普通空格）→ 单位 fail-closed，reason=单位不可确认', () => {
        // 两 = 不可确认单位，即使与提案数值相同也不放行
        const r = gateCoverage('5 两', makeP([5]));
        expect(r.covered).toBe(false);
        if (!r.covered)
            expect(r.reason).toBe('单位不可确认');
    });
});
// ── ② 语义方向/性质硬化 ──────────────────────────────────────────────────────
describe('M2.7 Gate③: 找零方向 fail-closed', () => {
    it('「找你三十文」提案支出30 → 方向不符 → covered:false', () => {
        // 核心用例（spec 原文）：金额=30 一致，但方向是收入，提案标为支出 → 不得放行
        const r = gateCoverage('王掌柜找你三十文', makeP([30]));
        expect(r.covered).toBe(false);
        if (!r.covered)
            expect(r.reason).toBe('方向:收入不记支出');
    });
    it('「找零」→ covered:false', () => {
        const r = gateCoverage('找零五文', makeP([5]));
        expect(r.covered).toBe(false);
        if (!r.covered)
            expect(r.reason).toBe('方向:收入不记支出');
    });
    it('「退你二十文」→ covered:false', () => {
        const r = gateCoverage('退你二十文', makeP([20]));
        expect(r.covered).toBe(false);
        if (!r.covered)
            expect(r.reason).toBe('方向:收入不记支出');
    });
    it('「给了三十文」（正常支出）→ 不命中方向词 → 继续比对流程', () => {
        // 普通支出叙事不触发方向 fail-closed
        expect(gateCoverage('林九给了红姨三十文', makeP([30])).covered).toBe(true);
    });
});
describe('M2.7 Gate③: 债权 fail-closed', () => {
    it('「赊账二两」→ 单位先 fail-closed（两≠文）', () => {
        // 双重问题：单位非文 + 债权；单位检查先行
        const r = gateCoverage('赊账二两', makeP([2]));
        expect(r.covered).toBe(false);
        if (!r.covered)
            expect(r.reason).toBe('单位不可确认');
    });
    it('「欠款五十文」→ 性质债权 → covered:false', () => {
        const r = gateCoverage('欠款五十文', makeP([50]));
        expect(r.covered).toBe(false);
        if (!r.covered)
            expect(r.reason).toBe('性质:债权不记现金');
    });
    it('「欠了三十文」→ 性质债权 → covered:false', () => {
        const r = gateCoverage('他欠了三十文', makeP([30]));
        expect(r.covered).toBe(false);
        if (!r.covered)
            expect(r.reason).toBe('性质:债权不记现金');
    });
    it('「借了八文」→ 性质债权 → covered:false', () => {
        const r = gateCoverage('林九借了八文', makeP([8]));
        expect(r.covered).toBe(false);
        if (!r.covered)
            expect(r.reason).toBe('性质:债权不记现金');
    });
    it('「赊账二两」提案空 → 也是 fail-closed（绝不因提案为空而放行）', () => {
        expect(gateCoverage('赊账二两', makeP([])).covered).toBe(false);
    });
});
describe('M2.7 Gate③: 代付 fail-closed', () => {
    it('「垫付五十文」→ 性质代付 → covered:false（spec 原文）', () => {
        const r = gateCoverage('林九垫付五十文', makeP([50]));
        expect(r.covered).toBe(false);
        if (!r.covered)
            expect(r.reason).toBe('性质:代付不记现金');
    });
    it('「代付了二十文」→ covered:false', () => {
        const r = gateCoverage('代付了二十文给红姨', makeP([20]));
        expect(r.covered).toBe(false);
        if (!r.covered)
            expect(r.reason).toBe('性质:代付不记现金');
    });
});
describe('M2.7 Gate③: 总价防重复计数', () => {
    it('「价银共二百两」→ 单位先 fail-closed（两≠文）', () => {
        // spec 原文用例；两是不可确认单位，单位检查先行
        const r = gateCoverage('价银共二百两', makeP([200]));
        expect(r.covered).toBe(false);
        if (!r.covered)
            expect(r.reason).toBe('单位不可确认');
    });
    it('「一共三百文」→ 总价词 → covered:false（防重复计数）', () => {
        // 如果叙事用"一共"描述总额，不得直接当分项落账
        const r = gateCoverage('一共三百文', makeP([300]));
        expect(r.covered).toBe(false);
        if (!r.covered)
            expect(r.reason).toBe('总价:防重复计数');
    });
    it('「合计五十文」→ covered:false', () => {
        const r = gateCoverage('合计五十文', makeP([50]));
        expect(r.covered).toBe(false);
        if (!r.covered)
            expect(r.reason).toBe('总价:防重复计数');
    });
    it('「共同出资」（无数字 lookahead）→ 不触发总价词', () => {
        // 确保"共"不过度触发
        expect(gateCoverage('大家共同出资两文', makeP([2])).covered).toBe(true);
    });
});
// ── ③ from/to 实体不可确认 ────────────────────────────────────────────────────
describe('M2.7 Gate③: from/to 实体校验', () => {
    const proposal = TickProposalSchema.parse({
        transfers: [{ from: 'pc_linjiu', to: 'npc_hong', amount: 30, reason: '' }],
    });
    it('叙事含「林九」和「红姨」→ 实体可确认 → covered:true', () => {
        expect(gateCoverage('林九给了红姨三十文', proposal, WORLD_CTX).covered).toBe(true);
    });
    it('叙事「给了三十文。」无实体名 → from/to 不可确认 → covered:false', () => {
        // spec 原文：省略主语/宾语 → 绝不默认 from=主角
        const r = gateCoverage('给了三十文。', proposal, WORLD_CTX);
        expect(r.covered).toBe(false);
        if (!r.covered)
            expect(r.reason).toBe('from/to:实体不可确认');
    });
    it('叙事只含 from「林九」但无 to → covered:false', () => {
        const r = gateCoverage('林九给了三十文', proposal, WORLD_CTX);
        expect(r.covered).toBe(false);
        if (!r.covered)
            expect(r.reason).toBe('from/to:实体不可确认');
    });
    it('叙事只含 to「红姨」但无 from → covered:false', () => {
        const r = gateCoverage('红姨收了三十文', proposal, WORLD_CTX);
        expect(r.covered).toBe(false);
        if (!r.covered)
            expect(r.reason).toBe('from/to:实体不可确认');
    });
    it('不传 context → 不做实体校验（向后兼容）', () => {
        // 不传 context 时，旧逻辑：只比对金额
        expect(gateCoverage('给了三十文', makeP([30])).covered).toBe(true);
    });
    it('proposal 无 transfers → 不触发实体校验', () => {
        expect(gateCoverage('林九随便说了句话，两文', makeP([]), WORLD_CTX).covered).toBe(false);
        // no entity check since transfers=[], falls through to amount miss
    });
});
// ── 语义拦截 + degraded 路径 ───────────────────────────────────────────────────
describe('M2.7: 语义 covered:false 可标 degraded（调用方重试仍失败）', () => {
    it('方向拦截 → 调用方可附 degraded:true 不崩', () => {
        const r = gateCoverage('找你三十文', makeP([30]));
        expect(r.covered).toBe(false);
        if (!r.covered) {
            const degraded = { ...r, degraded: true };
            expect(degraded.degraded).toBe(true);
            expect(degraded.reason).toBe('方向:收入不记支出');
        }
    });
    it('实体拦截 → 调用方可附 degraded:true 不崩', () => {
        const proposal = TickProposalSchema.parse({
            transfers: [{ from: 'pc_linjiu', to: 'npc_hong', amount: 10, reason: '' }],
        });
        const r = gateCoverage('给了十文', proposal, WORLD_CTX);
        expect(r.covered).toBe(false);
        if (!r.covered) {
            const degraded = { ...r, degraded: true };
            expect(degraded.degraded).toBe(true);
        }
    });
});
// ── M2.5/M2.6 不回归（抽样）────────────────────────────────────────────────
describe('M2.7: M2.5/M2.6 行为不回归', () => {
    it('「两文」提案「2」→ covered:true', () => {
        expect(gateCoverage('给了两文', makeP([2])).covered).toBe(true);
    });
    it('「三百块」→ 单位 fail-closed（M2.6）', () => {
        const r = gateCoverage('花了三百块', makeP([300]));
        expect(r.covered).toBe(false);
        if (!r.covered)
            expect(r.reason).toBe('单位不可确认');
    });
    it('「2文」提案「2」→ covered:true（阿拉伯不回归）', () => {
        expect(gateCoverage('林九给了2文小费', makeP([2])).covered).toBe(true);
    });
});
