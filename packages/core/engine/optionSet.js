// optionSet — mod-declared deterministic option-set sampling (阶段1·AOHP)
//
// 职责：
//   1. 对 玩法预设.动词选项集（mod 作者声明的全量候选）做 seeded 子集采样
//   2. 经 buildMenuOptionIds 派生 option_id → 返回权威 ActionOptionType[]
//   3. 权威集交 executeActionOption 消费；越界 option_id → 降级纯叙事不写账
//
// 确定性约束：
//   - 同 seed + tick + rerollSalt → 同子集 → 同 option_id 集（逐位恒等）
//   - 六禁继承：禁 Date.now / Math.random / localeCompare / 裸 JSON.stringify / NFC normalize
//   - 菜单条目数 ≤ 99（受 rngFor [0,99] 精度·partialShuffleSample 无偏约束）
//
// 指纹纪律：
//   - 动词选项集定义进 PRESET 指纹（动词选项集哈希 = hashCanonical(玩法预设.动词选项集)）
//   - 当前拍权威 option_id 集进指纹（AOHP選項id集·已在位）
//   - 采样逻辑本身不新增 RNG 通道至 runTick 主流·仅宿主层调用
import { rngFor } from './rng.js';
import { buildMenuOptionIds } from './aohp.js';
/**
 * 对 mod 声明的全量候选选项做 seeded 子集采样，派生 option_id，
 * 返回本拍权威 ActionOptionType[]。
 */
export function sampleOptionSet(args) {
    const { declaredOptions, seed, tick, rerollSalt, maxPerTick } = args;
    if (!declaredOptions || !declaredOptions.length)
        return [];
    // ── 子集采样（Fisher-Yates 局部 shuffle，rngFor 驱动）──────────────────
    const sampled = maxPerTick && maxPerTick > 0 && maxPerTick < declaredOptions.length
        ? partialShuffleSample(declaredOptions, maxPerTick, seed, tick, rerollSalt)
        : [...declaredOptions];
    // ── option_id 派生（buildMenuOptionIds · verb:targetEntityId[:salient_args]）
    const menuOpts = sampled.map(e => {
        const base = {
            verb: e.verb,
            targetEntityId: e.target_choices[0] ?? '',
            tool_name: e.tool_name,
            params: e.params,
            target_choices: e.target_choices,
        };
        if (e.salient_args !== undefined)
            base.salientArgs = e.salient_args;
        if (e.display_text !== undefined)
            base.displayText = e.display_text;
        if (e.value_slot !== undefined)
            base['value_slot'] = e.value_slot;
        if (e.min !== undefined)
            base['min'] = e.min;
        if (e.max !== undefined)
            base['max'] = e.max;
        return base;
    });
    const withIds = buildMenuOptionIds(menuOpts);
    return withIds.map(opt => {
        const result = {
            option_id: opt.option_id,
            tool_name: typeof opt['tool_name'] === 'string' ? opt['tool_name'] : '',
            params: opt['params'] ?? {},
            target_choices: Array.isArray(opt['target_choices'])
                ? opt['target_choices']
                : [],
        };
        if (typeof opt['value_slot'] === 'string')
            result.value_slot = opt['value_slot'];
        if (typeof opt['min'] === 'number')
            result.min = opt['min'];
        if (typeof opt['max'] === 'number')
            result.max = opt['max'];
        return result;
    });
}
/**
 * 局部 Fisher-Yates 子集采样：取前 `size` 项。
 * rngFor(seed, tick, '检定:aohp:sample', rerollSalt, i) 驱动第 i 次交换。
 * 约束：arr.length ≤ 99（rngFor 返回 [0,99]，模运算在此范围无偏）。
 */
function partialShuffleSample(arr, size, seed, tick, rerollSalt) {
    const copy = [...arr];
    const n = copy.length;
    for (let i = 0; i < size; i++) {
        const roll = rngFor(seed, tick, '检定:aohp:sample', rerollSalt, i);
        const j = i + (roll % (n - i));
        const tmp = copy[i];
        copy[i] = copy[j];
        copy[j] = tmp;
    }
    return copy.slice(0, size);
}
