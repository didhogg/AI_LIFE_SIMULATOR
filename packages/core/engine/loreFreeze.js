// D-a-lore: lore 触发谓词创建即冻结·永不重算·配 L-21 纪律
// 冻结后的谓词串聚合为 lore谓词集合 → hashJudgmentBundle.lore谓词集合 → 指纹
// 血统：freeze 时 event_id 注入 content_hash 聚合链（同 L-21 口径经 B1c 路径）
// 红线：不 import rng.ts / gate.ts / fixed.ts
// commit-1 (1a): collectLorePredicates — 触发谓词聚合·仅非空·assertLorePredicateFrozen 守卫
import { tryParsePred } from './dsl/parser.js';
/**
 * D-a-lore: 创建 lore 条目触发谓词并立即冻结。
 *
 * 只允许在 lore 条目「创建/导入时」调用一次；创建后永不重算。
 * 已冻结（触发谓词_冻结=true）时调用 → 抛出 D-a-lore 不可逆错误。
 * 非空谓词不可解析 → fail-closed（禁止落库非法谓词）。
 * 空谓词串 → 允许冻结（表示此条目无 gate 判定谓词·叙事只读路径）。
 *
 * @param currentEntry 当前 lore 条目（只读·读取冻结状态）
 * @param rawPredicate 原始谓词串（DSL 文法·过 DSL parser·空串合法）
 */
export function freezeLorePredicate(currentEntry, rawPredicate) {
    if (currentEntry.触发谓词_冻结) {
        throw new Error(`D-a-lore 违规: lore 触发谓词已冻结（当前值: "${currentEntry.触发谓词 ?? ''}"），禁止重算`);
    }
    if (rawPredicate !== '') {
        const parsed = tryParsePred(rawPredicate);
        if (parsed === null) {
            throw new Error(`D-a-lore: lore 触发谓词解析失败，禁止落库非法谓词: "${rawPredicate}"`);
        }
    }
    return { 触发谓词: rawPredicate, 触发谓词_冻结: true };
}
/**
 * D-a-lore 守卫：断言 lore 条目触发谓词已冻结。
 * 未冻结 → throw（导入流程漏调 freezeLorePredicate）。
 *
 * @param entry   待检查的 lore 条目
 * @param loreKey lore 键（仅用于错误诊断）
 */
export function assertLorePredicateFrozen(entry, loreKey) {
    if (!entry.触发谓词_冻结) {
        throw new Error(`D-a-lore 守卫: lore「${loreKey}」触发谓词未冻结（谓词: "${entry.触发谓词 ?? ''}"）——导入流程须先调 freezeLorePredicate`);
    }
}
/**
 * 安全读取已冻结的 lore 触发谓词。
 * 未冻结时返回 defaultValue（fail-open·不抛）。
 */
export function readFrozenLorePredicate(entry, defaultValue = '') {
    if (!entry.触发谓词_冻结)
        return defaultValue;
    return entry.触发谓词 ?? defaultValue;
}
// ── D-a-lore: lore谓词集合聚合 ─────────────────────────────────────────────────
/**
 * D-a-lore (1a): 聚合 lore知识库全条目触发谓词集。
 *
 * 对每个条目调 assertLorePredicateFrozen 守卫（未冻结 → throw·import 流程漏调 freezeLorePredicate）。
 * 仅收集非空触发谓词：{loreKey → 谓词串}。
 * 空集合返回 undefined — caller 不传 lore谓词集合 → hashJudgmentBundle canonicalize 跳过此字段 → 指纹不变。
 *
 * @param loreBag _lore知识库（全 record·已完成 import freeze 流程）
 * @returns Record<loreKey, 谓词串>（非空时传入 hashJudgmentBundle.lore谓词集合）| undefined
 */
export function collectLorePredicates(loreBag) {
    const result = {};
    for (const [loreKey, entry] of Object.entries(loreBag)) {
        assertLorePredicateFrozen(entry, loreKey);
        const pred = readFrozenLorePredicate(entry);
        if (pred !== '')
            result[loreKey] = pred;
    }
    return Object.keys(result).length > 0 ? result : undefined;
}
