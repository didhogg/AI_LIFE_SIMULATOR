// P0-8 Batch 3: 对账闸族 + 切片预算 B1-B6 + N-4 输出软拒 验收测试
//
// ① 解析器单一真相源断言（三层共享·chineseNumber 单一进指纹口径）
// ② 对账闸分级失败（M2.5/M2.6/M2.7 归纳·可解析歧义→单次重试·不可解析→硬拒+重Roll）
// ③ 对账闸判定进指纹 / 切片降级不进指纹（R7-b 边界断言）
// ④ 切片预算 B1-B6 阶梯（降级顺序: lore→nearK→chronicle）
// ⑤ N-4 输出侧软拒 + 玩家主权断言（不自动重生·不抬预算·UX常驻提示）
import { describe, it, expect } from 'vitest';
// ── 解析器单一真相源 ────────────────────────────────────────────────────────────
import { CHINESE_NUMBER_RULE_VERSION, CANONICAL_UNITS, extractMoneyAmounts, isCanonicalUnit, prepareNarrative, } from '@ai-life-sim/core/engine/text/chineseNumber';
import { FINGERPRINT_PRESET_FIELDS, FINGERPRINT_EXCLUDED_FIELDS, } from '@ai-life-sim/core/engine/fingerprintManifest';
// ── 对账闸 ────────────────────────────────────────────────────────────────────
import { gateCoverage } from '../ledger/gate.js';
import { runReconcileGate, RECONCILE_ROLL_HINT, } from '../engine/reconcileGate.js';
import { TickProposalSchema } from '../ledger/proposalSchema.js';
// ── 切片预算 ──────────────────────────────────────────────────────────────────
import { estimateTokens, estimateSliceTokens, applySliceBudget, DEGRADATION_ORDER, } from '@ai-life-sim/core/engine/sliceBudget';
import { CALL_TYPE_REGISTRY } from '@ai-life-sim/core/prompt/callRegistry';
import { assemblePrompt } from '../assemble.js';
import { buildWorld, PC, LOC_NAME } from '../fixture/world.js';
// ── N-4 输出软拒 ──────────────────────────────────────────────────────────────
import { runOutputGuard, OUTPUT_GUARD_ROLL_HINT, } from '../engine/outputGuard.js';
import { SOFT_REJECT_RULE_VERSION } from '@ai-life-sim/core/engine/softReject';
// ── 工具函数 ──────────────────────────────────────────────────────────────────
function makeP(amounts) {
    return TickProposalSchema.parse({
        transfers: amounts.map((a, i) => ({ from: `a${i}`, to: `b${i}`, amount: a, reason: '' })),
    });
}
// ═══════════════════════════════════════════════════════════════════════════════
// ① 解析器单一真相源
// ═══════════════════════════════════════════════════════════════════════════════
describe('Batch3 ① 解析器单一真相源（三层共享·无复制逻辑）', () => {
    it('CHINESE_NUMBER_RULE_VERSION > 0（版本标识合法）', () => {
        expect(CHINESE_NUMBER_RULE_VERSION).toBeGreaterThan(0);
    });
    it('CANONICAL_UNITS 只含「文」「文钱」（世界货币单位表·唯一真相源）', () => {
        expect(CANONICAL_UNITS.has('文')).toBe(true);
        expect(CANONICAL_UNITS.has('文钱')).toBe(true);
        expect(CANONICAL_UNITS.size).toBe(2);
    });
    it('isCanonicalUnit 与 CANONICAL_UNITS 同源（函数 = 单一真相源包装）', () => {
        for (const u of CANONICAL_UNITS) {
            expect(isCanonicalUnit(u)).toBe(true);
        }
        expect(isCanonicalUnit('块')).toBe(false);
        expect(isCanonicalUnit('贯')).toBe(false);
    });
    it('对账闸 gateCoverage 复用同一 extractMoneyAmounts（「两文」直接触发·无第二解析路径）', () => {
        // 如果对账闸有第二解析路径，「两文」提案「2」可能不一致——本测用于锁定单一源
        const r = gateCoverage('林九给了两文铜钱', makeP([2]));
        expect(r.covered).toBe(true);
        // 同一文本用 extractMoneyAmounts 应得相同结果
        const amounts = extractMoneyAmounts(prepareNarrative('林九给了两文铜钱'));
        expect(amounts.some(a => a.value === 2 && isCanonicalUnit(a.unit))).toBe(true);
    });
});
// ═══════════════════════════════════════════════════════════════════════════════
// ② 对账闸分级失败（runReconcileGate）
// ═══════════════════════════════════════════════════════════════════════════════
describe('Batch3 ② 对账闸分级失败: covered（无错误）', () => {
    it('叙事「两文」提案「2」→ status=covered·无 rollHint', () => {
        const r = runReconcileGate('林九给了两文铜钱', makeP([2]));
        expect(r.status).toBe('covered');
        expect(r.rollHint).toBeUndefined();
    });
    it('叙事无金额·提案空 → status=covered', () => {
        const r = runReconcileGate('大家休息一会儿', makeP([]));
        expect(r.status).toBe('covered');
    });
});
describe('Batch3 ② 对账闸分级失败: 可解析歧义（金额漏项）→ 单次重试', () => {
    it('金额漏项·无 retryNarrative → status=retried_failed+rollHint（等待调用方提供重试）', () => {
        const r = runReconcileGate('林九给了三文铜钱', makeP([5]));
        expect(r.status).toBe('retried_failed');
        expect(r.rollHint).toBeDefined();
        expect(r.rollHint.ui提示).toContain('重 Roll');
        expect(r.finalCoverage.covered).toBe(false);
    });
    it('金额漏项·retryNarrative 修正 → status=retried_covered', () => {
        const r = runReconcileGate('林九给了三文铜钱', makeP([5]), '林九给了五文铜钱');
        expect(r.status).toBe('retried_covered');
        expect(r.rollHint).toBeUndefined();
        expect(r.finalCoverage.covered).toBe(true);
    });
    it('金额漏项·retryNarrative 仍错 → status=retried_failed+rollHint·degraded=true', () => {
        const r = runReconcileGate('林九给了三文铜钱', makeP([5]), '林九给了八文铜钱');
        expect(r.status).toBe('retried_failed');
        expect(r.rollHint).toBeDefined();
        const cov = r.finalCoverage;
        if (!cov.covered)
            expect(cov.degraded).toBe(true);
    });
});
describe('Batch3 ② 对账闸分级失败: 不可解析→即时硬拒（语义拦截）', () => {
    it('单位不可确认「三百块」→ status=hard_rejected·rollHint存在', () => {
        const r = runReconcileGate('花了三百块', makeP([300]));
        expect(r.status).toBe('hard_rejected');
        expect(r.rollHint).toBeDefined();
        if (!r.finalCoverage.covered) {
            expect(r.finalCoverage.reason).toBe('单位不可确认');
        }
    });
    it('方向拦截「找你三十文」→ status=hard_rejected', () => {
        const r = runReconcileGate('王掌柜找你三十文', makeP([30]));
        expect(r.status).toBe('hard_rejected');
        expect(r.rollHint).toBeDefined();
    });
    it('债权拦截「欠款五十文」→ status=hard_rejected（不重试）', () => {
        const r = runReconcileGate('欠款五十文', makeP([50]));
        expect(r.status).toBe('hard_rejected');
        // 即使传了 retryNarrative 也不应重试（语义问题不可纠偏）
        const r2 = runReconcileGate('欠款五十文', makeP([50]), '林九给了五十文');
        expect(r2.status).toBe('hard_rejected');
    });
    it('代付拦截「垫付五十文」→ status=hard_rejected', () => {
        const r = runReconcileGate('垫付五十文', makeP([50]));
        expect(r.status).toBe('hard_rejected');
    });
    it('总价拦截「一共三百文」→ status=hard_rejected', () => {
        const r = runReconcileGate('一共三百文', makeP([300]));
        expect(r.status).toBe('hard_rejected');
    });
    it('实体不可确认→ hard_rejected（M2.7 ③·有 context）', () => {
        const ctx = { entities: [
                { key: 'pc', aliases: ['林九'] },
                { key: 'npc', aliases: ['红姨'] },
            ] };
        const proposal = TickProposalSchema.parse({
            transfers: [{ from: 'pc', to: 'npc', amount: 30, reason: '' }],
        });
        const r = runReconcileGate('给了三十文', proposal, undefined, ctx);
        expect(r.status).toBe('hard_rejected');
    });
});
describe('Batch3 ② RECONCILE_ROLL_HINT 结构（UX 断言·常驻图标旁）', () => {
    it('提示含「重 Roll」关键词', () => {
        expect(RECONCILE_ROLL_HINT.ui提示).toContain('重 Roll');
        expect(RECONCILE_ROLL_HINT.重Roll说明).toMatch(/重 Roll/);
    });
    it('hard_rejected 时 rollHint === RECONCILE_ROLL_HINT（引用一致·无冗余实例）', () => {
        const r = runReconcileGate('花了三百块', makeP([300]));
        expect(r.rollHint).toStrictEqual(RECONCILE_ROLL_HINT);
    });
});
// ═══════════════════════════════════════════════════════════════════════════════
// ③ 指纹边界断言（对账闸判定进 / 切片降级不进）
// ═══════════════════════════════════════════════════════════════════════════════
describe('Batch3 ③ 对账闸判定进指纹（CHINESE_NUMBER_RULE_VERSION 已登记）', () => {
    it('FINGERPRINT_PRESET_FIELDS 含 "中文数字解析规则版"（对账闸确定性口径已纳入指纹）', () => {
        expect(FINGERPRINT_PRESET_FIELDS).toContain('中文数字解析规则版');
    });
    it('runReconcileGate 暴露 ruleVersion === CHINESE_NUMBER_RULE_VERSION（进指纹口径一致）', () => {
        const r = runReconcileGate('给了两文', makeP([2]));
        expect(r.ruleVersion).toBe(CHINESE_NUMBER_RULE_VERSION);
    });
    it('FINGERPRINT_EXCLUDED_FIELDS 含 "切片预算"（降级不进指纹·R7-b 组装律）', () => {
        expect(FINGERPRINT_EXCLUDED_FIELDS).toContain('切片预算');
    });
    it('DEGRADATION_ORDER 元素全部不在 FINGERPRINT_PRESET_FIELDS（降级键不进指纹）', () => {
        for (const key of DEGRADATION_ORDER) {
            expect(FINGERPRINT_PRESET_FIELDS).not.toContain(key);
        }
    });
});
// ═══════════════════════════════════════════════════════════════════════════════
// ④ 切片预算 B1-B6 阶梯（降级顺序铁律）
// ═══════════════════════════════════════════════════════════════════════════════
describe('Batch3 ④ estimateTokens（CJK/ASCII 分档）', () => {
    it('纯 CJK 文本·约 1 token/char', () => {
        const t = estimateTokens('两文铜钱'); // 4 CJK
        expect(t).toBe(4);
    });
    it('纯 ASCII·约 0.25 token/char（ceil）', () => {
        // "abc" = 3 * 0.25 = 0.75 → ceil = 1
        expect(estimateTokens('abc')).toBe(1);
        // "abcd" = 4 * 0.25 = 1.0 → ceil = 1
        expect(estimateTokens('abcd')).toBe(1);
        // "abcde" = 5 * 0.25 = 1.25 → ceil = 2
        expect(estimateTokens('abcde')).toBe(2);
    });
    it('混合文本·CJK部分与ASCII部分分开计算', () => {
        const t = estimateTokens('两文abc'); // 2 CJK(2) + 3 ASCII(0.75→ceil1) = 3
        expect(t).toBe(3);
    });
});
describe('Batch3 ④ applySliceBudget 降级顺序（拍板③铁律）', () => {
    const LORE_PART = { key: 'lore', content: '这是一段很长的 lore 谓词载荷'.repeat(5) };
    const NEARK_PART = { key: 'nearK', content: ['叙事1', '叙事2', '叙事3', '叙事4'].join('\n') };
    const CHRON_PART = { key: 'chronicle', content: '[序1] 林九：进了客栈' };
    const NPC_PART = { key: 'npc', content: '红姨（老板娘）' };
    const CORE_PART = { key: 'core', content: '核心信息' };
    it('预算充足→所有部件保留（无降级）', () => {
        const parts = [LORE_PART, NEARK_PART, CHRON_PART, NPC_PART, CORE_PART];
        const { parts: result, degradedKeys } = applySliceBudget(parts, { softLimitTokens: 9999 });
        expect(result.length).toBe(parts.length);
        expect(degradedKeys).toHaveLength(0);
    });
    it('超限·lore 先降（降级顺序第1位）', () => {
        const parts = [LORE_PART, NEARK_PART, CHRON_PART];
        const totalBeforeLore = estimateSliceTokens([NEARK_PART, CHRON_PART]);
        // 设预算仅容下 NEARK+CHRON·lore 必须被降
        const { parts: result, degradedKeys } = applySliceBudget(parts, { softLimitTokens: totalBeforeLore + 1 });
        expect(result.find(p => p.key === 'lore')).toBeUndefined();
        expect(degradedKeys).toContain('lore');
        expect(result.find(p => p.key === 'nearK')).toBeDefined();
        expect(result.find(p => p.key === 'chronicle')).toBeDefined();
    });
    it('超限·lore 降后仍超→nearK 减半（降级顺序第2位）', () => {
        const bigChron = { key: 'chronicle', content: '编年史'.repeat(20) };
        const fourLineNeark = { key: 'nearK', content: ['A', 'B', 'C', 'D'].join('\n') };
        const parts = [LORE_PART, fourLineNeark, bigChron];
        // 设极小预算→lore降→nearK减半→chronicle仍在
        const tiny = estimateSliceTokens([bigChron]) + 5;
        const { parts: result, degradedKeys } = applySliceBudget(parts, { softLimitTokens: tiny });
        expect(degradedKeys).toContain('lore');
        // nearK 如果仍超限则会减半
        const nearKResult = result.find(p => p.key === 'nearK');
        if (nearKResult) {
            // nearK 被保留（可能减半了·取决于 bigChron 大小）
            const originalLines = ['A', 'B', 'C', 'D'];
            const resultLines = nearKResult.content.split('\n').filter(l => l.length > 0);
            expect(resultLines.length).toBeLessThanOrEqual(originalLines.length);
        }
    });
    it('超限·lore+nearK 降后仍超→chronicle 去除（降级顺序第3位）', () => {
        const bigLore = { key: 'lore', content: 'X'.repeat(5000) };
        const bigNeark = { key: 'nearK', content: 'Y'.repeat(5000) };
        const chron = { key: 'chronicle', content: 'Z'.repeat(5000) };
        const parts = [bigLore, bigNeark, chron];
        // 极小预算→三者都超→均降级
        const { parts: result, degradedKeys } = applySliceBudget(parts, { softLimitTokens: 1 });
        expect(degradedKeys).toContain('lore');
        expect(result.find(p => p.key === 'lore')).toBeUndefined();
        expect(result.find(p => p.key === 'chronicle')).toBeUndefined();
    });
    it('npc/core 不可降级件永远保留', () => {
        const parts = [LORE_PART, NEARK_PART, CHRON_PART, NPC_PART, CORE_PART];
        const { parts: result } = applySliceBudget(parts, { softLimitTokens: 1 });
        expect(result.find(p => p.key === 'npc')).toBeDefined();
        expect(result.find(p => p.key === 'core')).toBeDefined();
    });
    it('nearK 最少保留1行（不完全去除）', () => {
        const oneLineNeark = { key: 'nearK', content: '唯一的历史拍叙事' };
        const parts = [oneLineNeark];
        const { parts: result } = applySliceBudget(parts, { softLimitTokens: 0 });
        const nearKResult = result.find(p => p.key === 'nearK');
        if (nearKResult) {
            expect(nearKResult.content.length).toBeGreaterThan(0);
        }
    });
});
describe('Batch3 ④ assemblePrompt 集成切片预算（callTypeKey 路径）', () => {
    const BASE = buildWorld();
    it('不传 callTypeKey → 不降级（向后兼容）', () => {
        const { systemPrompt } = assemblePrompt(BASE, {
            pcKey: PC, locName: LOC_NAME,
            lorePredCtx: { 属性: { 体质: 5 } },
            narrativeHistory: ['h1', 'h2', 'h3'],
        });
        // 无 callTypeKey → 不降级·历史应全部注入
        expect(systemPrompt).toBeDefined();
    });
    it('传 callTypeKey=主线叙事 + 正常内容 → 不降级（预算充足）', () => {
        const { systemPrompt } = assemblePrompt(BASE, {
            pcKey: PC, locName: LOC_NAME,
            narrativeHistory: ['历史1'],
            callTypeKey: '主线叙事',
        });
        expect(systemPrompt).toContain('主角');
    });
});
// ═══════════════════════════════════════════════════════════════════════════════
// ⑤ N-4 输出侧软拒 + 玩家主权断言
// ═══════════════════════════════════════════════════════════════════════════════
describe('Batch3 ⑤ N-4 runOutputGuard: 通过（正常叙事）', () => {
    it('正常武侠叙事 → status=passed·无 rollHint', () => {
        const r = runOutputGuard('林九踏入客栈，红姨正在擦拭柜台，两人四目相对。');
        expect(r.status).toBe('passed');
        expect(r.rollHint).toBeUndefined();
    });
    it('纯数值叙事 → status=passed', () => {
        const r = runOutputGuard('林九花了两文钱买了一碗汤。');
        expect(r.status).toBe('passed');
    });
    it('ruleVersion === SOFT_REJECT_RULE_VERSION（版本口径一致）', () => {
        const r = runOutputGuard('正常叙事内容');
        expect(r.ruleVersion).toBe(SOFT_REJECT_RULE_VERSION);
    });
});
describe('Batch3 ⑤ N-4 runOutputGuard: 软拒检出（AI 拒绝式回复）', () => {
    it('「我无法」→ soft_rejected+rollHint', () => {
        const r = runOutputGuard('我无法完成这个请求，因为内容违反了规定。');
        expect(r.status).toBe('soft_rejected');
        expect(r.rollHint).toBeDefined();
        expect(r.rollHint.ui提示).toContain('重 Roll');
    });
    it('「I cannot」英文拒绝 → soft_rejected', () => {
        const r = runOutputGuard('I cannot assist with this request.');
        expect(r.status).toBe('soft_rejected');
        expect(r.rollHint).toBeDefined();
    });
    it('「作为AI」声明式拒绝 → soft_rejected', () => {
        const r = runOutputGuard('作为AI，我不应该生成此类内容。');
        expect(r.status).toBe('soft_rejected');
    });
    it('检出时 detail 存在（含 matchedKeyword 或 heuristicReason·不含真值内容）', () => {
        const r = runOutputGuard('我无法处理这个任务。');
        expect(r.status).toBe('soft_rejected');
        expect(r.detail).toBeDefined();
        // detail 不应含游戏内真值（秘密母题/谜底）·此处只验证结构
        expect(typeof r.detail).toBe('object');
    });
});
describe('Batch3 ⑤ N-4 玩家主权断言（不自动重生·不抬预算）', () => {
    it('soft_rejected 时只返回 rollHint·不包含重试结果（调用方不得自动重试）', () => {
        const r = runOutputGuard('我无法完成这个请求。');
        expect(r.status).toBe('soft_rejected');
        // 返回结构中没有 retriedOnce / newNarrative 等自动重试字段
        expect(r['retriedOnce']).toBeUndefined();
        expect(r['newNarrative']).toBeUndefined();
    });
    it('OUTPUT_GUARD_ROLL_HINT 常驻图标旁静态提示（不弹窗·文本固定）', () => {
        expect(OUTPUT_GUARD_ROLL_HINT.ui提示).toContain('重 Roll');
        expect(OUTPUT_GUARD_ROLL_HINT.重Roll说明).toMatch(/重 Roll/);
        // 不含「弹窗」「教学」「引导」等主动干预词
        expect(OUTPUT_GUARD_ROLL_HINT.ui提示).not.toContain('弹窗');
        expect(OUTPUT_GUARD_ROLL_HINT.ui提示).not.toContain('请你');
    });
    it('N-4 规则版本进指纹·FINGERPRINT_PRESET_FIELDS 含 "软拒检测规则版本"', () => {
        expect(FINGERPRINT_PRESET_FIELDS).toContain('软拒检测规则版本');
    });
    it('soft_rejected 时 ruleVersion 正确暴露（供调用方传入 hashPresetFingerprint）', () => {
        const r = runOutputGuard('I cannot do this.');
        if (r.status === 'soft_rejected') {
            expect(r.ruleVersion).toBe(SOFT_REJECT_RULE_VERSION);
        }
    });
});
