import { 指令信封Schema, 方向槽枚举 } from '../schema/proposal.js';
import { 动词Id枚举 } from '../schema/verb.js';
const 方向槽合法值 = new Set(方向槽枚举);
const 动词合法值 = new Set(动词Id枚举);
/**
 * 将 ActionOption 桥接为指令信封，通过 Zod 形状闸后返回 envelope。
 * 纯函数：禁 Date.now / Math.random / localeCompare / 裸 JSON.stringify / NFC normalize。
 */
export function executeActionOption(args) {
    const { chosenOptionId, optionSet, chosenTarget, chosenValue } = args;
    // ── Step 1: 精确匹配权威选项集 ──────────────────────────────────────────────
    const option = optionSet.find(o => o.option_id === chosenOptionId);
    if (!option) {
        return { matched: false, downgrade: true };
    }
    // ── Step 2: 动词验证（option_id 首段 = 单一权威来源） ─────────────────────────
    const verb = chosenOptionId.split(':')[0] ?? '';
    if (!动词合法值.has(verb)) {
        return { matched: true, downgrade: true };
    }
    // ── Step 3: 目标解析 ─────────────────────────────────────────────────────────
    let resolvedTarget;
    if (chosenTarget !== undefined && option.target_choices.includes(chosenTarget)) {
        resolvedTarget = chosenTarget;
    }
    else if (option.target_choices.length === 1) {
        resolvedTarget = option.target_choices[0];
    }
    else {
        return { matched: true, downgrade: true };
    }
    // ── Step 4: 数值槽钳制（仅 value_slot 存在时处理） ───────────────────────────
    let 数值槽;
    if (option.value_slot !== undefined && chosenValue !== undefined) {
        const lo = option.min ?? -Infinity;
        const hi = option.max ?? Infinity;
        数值槽 = lo > hi ? chosenValue : Math.min(hi, Math.max(lo, chosenValue));
    }
    // ── Step 5: 方向槽 + 对手方条目（由 option.params 派生）────────────────────────
    const rawDir = option.params['方向槽'];
    const rawCounterparts = option.params['对手方条目'];
    const 方向槽 = typeof rawDir === 'string' && 方向槽合法值.has(rawDir)
        ? rawDir
        : undefined;
    const 对手方条目 = Array.isArray(rawCounterparts)
        ? rawCounterparts.filter((e) => typeof e === 'object' && e !== null &&
            typeof e['目标引用'] === 'string' &&
            typeof e['数值槽'] === 'number')
        : [];
    // ── Step 6: 构建 提案批 array（E-2·每条目独立路径+带符号数值槽）──────────────
    // 主条目：动作类别 + 目标引用（全路径）+ 可选数值槽（已钳制）+ 可选方向槽
    // 对手方条目：忠实搬运 params.对手方条目·符号原样复制·零取反·零推导
    const primaryEntry = {
        动作类别: verb,
        目标引用: resolvedTarget,
        ...(数值槽 !== undefined ? { 数值槽 } : {}),
        ...(方向槽 !== undefined ? { 方向槽 } : {}),
    };
    const 提案批条目 = [primaryEntry];
    for (const counterpart of 对手方条目) {
        提案批条目.push({
            动作类别: verb,
            目标引用: counterpart.目标引用,
            数值槽: counterpart.数值槽,
        });
    }
    const rawEnvelope = {
        provenance: 'player_option',
        提案批: 提案批条目,
    };
    // ── Step 7: 形状闸（Zod parse）────────────────────────────────────────────────
    const parsed = 指令信封Schema.safeParse(rawEnvelope);
    if (!parsed.success) {
        const failure = {
            tickId: 'executor',
            callGeneration: 'aohp-executor',
            errorCode: '①-shape',
            detail: parsed.error.message,
        };
        return { matched: true, downgrade: false, failure };
    }
    return { matched: true, downgrade: false, envelope: parsed.data };
}
