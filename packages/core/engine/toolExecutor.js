// 工具执行 seam · commit-1/2/3/4 · additive · 不进 hashJudgmentBundle
// tool_name → 工具库 解引用 → 调用约束谓词 gate → 按能力类型分派骨架
// R10-b: output_tag 命名空间覆盖域校验 + effectGate Gate③ $/_ 硬拒路由验证
// 调用约束极性：空串=无约束放行（与 lore 触发谓词空=恒触同侧）
// 引用即授权：tool_name 在选项集中即授权，无白名单
// commits 2/3/4 复用此 seam 实装各类型执行逻辑
// 红线：不改 gate.ts/rng.ts/fnv1a32/canonicalize/computeDelta/conservation/effectGate 函数体
import { evalPredStr } from './dsl/eval.js';
import { runEffectGates } from './effectGate.js';
import { rngFor } from './rng.js';
// ── commit-3: 爆炸骰确定性上限 ────────────────────────────────────────────────
/**
 * 爆炸骰最大爆炸次数上限（确定性终止·不可绕过）。
 * 共可投 MAX_EXPLOSION_DEPTH+1 次（1次底骰 + 最多8次爆炸链）。
 * 拍板逻辑：rngFor [0,99]·9轮足够覆盖绝大多数 TRPG 爆炸骰场景·且重放有界。
 */
export const MAX_EXPLOSION_DEPTH = 8;
/**
 * 爆炸骰执行（commit-3）。
 * 纯函数·确定性·rngFor 变长消耗（incrementing roundIndex）。
 * 爆炸上限 = min(rollDiceArgs.maxExplosions ?? MAX_EXPLOSION_DEPTH, MAX_EXPLOSION_DEPTH)。
 * 红线：rngFor 函数体禁改·此处仅为调用者。
 */
export function executeRollDice(toolName, diceArgs) {
    const { seed, tick, channel, rerollSalt } = diceArgs;
    const threshold = diceArgs.explodeThreshold ?? 95;
    const maxExp = Math.min(diceArgs.maxExplosions ?? MAX_EXPLOSION_DEPTH, MAX_EXPLOSION_DEPTH);
    const rolls = [];
    // 底骰（roundIndex=0）
    let roundIndex = 0;
    let roll = rngFor(seed, tick, channel, rerollSalt, roundIndex);
    rolls.push(roll);
    // 爆炸链（roundIndex 递增·有界终止）
    while (roll >= threshold && rolls.length - 1 < maxExp) {
        roundIndex++;
        roll = rngFor(seed, tick, channel, rerollSalt, roundIndex);
        rolls.push(roll);
    }
    const total = rolls.reduce((s, r) => s + r, 0);
    const explosionCount = rolls.length - 1;
    return { rolls, total, exploded: explosionCount > 0, explosionCount };
}
/**
 * 解引用 tool_name → 工具条目。
 * own-property guard：防原型链注入（'constructor'/'__proto__'/'toString' 等）。
 * 空串或未命中 → null。
 */
export function resolveToolEntry(toolName, toolLib) {
    if (!toolName)
        return null;
    return Object.prototype.hasOwnProperty.call(toolLib, toolName)
        ? toolLib[toolName]
        : null;
}
/**
 * 调用约束谓词 gate。
 * 空串极性：空=无约束放行（与 lore 触发谓词空=恒触同侧·显式声明）。
 * evalPredStr fail-closed：parse/eval 异常 → false → 拒行。
 */
export function checkCallConstraint(entry, ctx = {}) {
    const constraint = entry.调用约束;
    if (!constraint || constraint === '')
        return true;
    try {
        return evalPredStr(constraint, ctx);
    }
    catch {
        return false; // fail-closed
    }
}
/**
 * R10-b: output_tag 命名空间覆盖域校验。
 * 命名空间覆盖不得逃出工具声明的 输出命名空间 域（须以 `{域}:` 为前缀）。
 * 无覆盖 → 直接使用工具声明值；域为空且有覆盖 → 拒。
 */
export function validateOutputTagNamespace(entry, namespaceOverride) {
    const baseDomain = entry.能力.输出命名空间 ?? '';
    if (!namespaceOverride) {
        return baseDomain
            ? { ok: true, resolvedNamespace: baseDomain }
            : { ok: true };
    }
    if (!baseDomain) {
        return { ok: false, reason: 'output_tag 工具未声明 输出命名空间，不接受命名空间覆盖' };
    }
    if (!namespaceOverride.startsWith(baseDomain + ':')) {
        return {
            ok: false,
            reason: `命名空间覆盖「${namespaceOverride}」逃出工具声明域「${baseDomain}」(R10-b)`,
        };
    }
    return { ok: true, resolvedNamespace: namespaceOverride };
}
/**
 * Gate③ effectGate 路由验证（output_tag 路径专属）。
 * 把准备写出的 path 过 effectGate 现有 $/_ 硬拒（Gate③）。
 * 纯验证·不落账·不改状态·effectGate 函数体禁改。
 */
export function routeOutputTagViaGate(outputTagPath) {
    const mockPack = {
        deltas: [{ path: outputTagPath, op: 'set', value: 0 }],
    };
    const result = runEffectGates(mockPack);
    if (!result.ok) {
        return { ok: false, reason: result.errors[0] ?? 'Gate③ 拒绝' };
    }
    return { ok: true };
}
/**
 * commit-4: 媒介普通目标解引用（取代专属媒介通道）。
 * 接受基础成功结果，若 mediaTarget+mediaLib 已传入则附加 mediaEntry。
 * own-property guard 防原型链注入（与 resolveToolEntry 一致）。
 * 不影响 ok=false 结果（错误直接透传）。
 */
function applyMediaTarget(base, mediaTarget, mediaLib) {
    if (!base.ok || !mediaTarget || !mediaLib)
        return base;
    if (!Object.prototype.hasOwnProperty.call(mediaLib, mediaTarget)) {
        return { ok: false, reason: `媒体目标「${mediaTarget}」在媒体库中不存在`, kind: base.kind };
    }
    const mediaEntry = mediaLib[mediaTarget];
    return { ...base, mediaEntry };
}
/**
 * 工具执行分派入口（纯函数·无副作用·无写账）。
 * commits 2/3/4 复用此 seam 实装各类型执行逻辑。
 */
export function dispatchTool(args) {
    const { toolName, toolLib, ctx = {}, namespaceOverride, outputTagPath, rollDiceArgs, mediaTarget, mediaLib, budgetTokensRemaining, generation, } = args;
    // Step 1: 解引用 tool_name → 工具条目
    const entry = resolveToolEntry(toolName, toolLib);
    if (!entry) {
        return { ok: false, reason: `工具「${toolName}」在工具库中不存在` };
    }
    const kind = entry.能力.类型;
    // Step 2: 调用约束谓词 gate（空串放行·非空 evalPredStr fail-closed）
    if (!checkCallConstraint(entry, ctx)) {
        return { ok: false, reason: `调用约束不满足：工具「${toolName}」`, kind };
    }
    // Step 3: 按能力类型分派，所有成功分支经 applyMediaTarget 附加媒介目标解引用
    switch (kind) {
        case 'output_tag': {
            // R10-b: 命名空间覆盖域校验
            const nsResult = validateOutputTagNamespace(entry, namespaceOverride);
            if (!nsResult.ok)
                return { ok: false, reason: nsResult.reason, kind };
            // Gate③: output_tag delta path 过 effectGate $/_ 硬拒
            if (outputTagPath) {
                const gateResult = routeOutputTagViaGate(outputTagPath);
                if (!gateResult.ok)
                    return { ok: false, reason: gateResult.reason, kind };
            }
            const base = nsResult.resolvedNamespace
                ? { ok: true, kind, entry, resolvedNamespace: nsResult.resolvedNamespace }
                : { ok: true, kind, entry };
            return applyMediaTarget(base, mediaTarget, mediaLib);
        }
        case 'llm': {
            // commit-2: llm 预算闸 + AA1 世代号接线
            if (entry.需预算 === true && budgetTokensRemaining !== undefined && budgetTokensRemaining <= 0) {
                const base = generation !== undefined
                    ? { ok: true, kind, entry, generation, downgraded: true, downgradeReason: 'budget_exhausted' }
                    : { ok: true, kind, entry, downgraded: true, downgradeReason: 'budget_exhausted' };
                return applyMediaTarget(base, mediaTarget, mediaLib);
            }
            const base = generation !== undefined
                ? { ok: true, kind, entry, generation }
                : { ok: true, kind, entry };
            return applyMediaTarget(base, mediaTarget, mediaLib);
        }
        case 'roll_dice': {
            // commit-3: rngFor 变长消耗爆炸骰
            const base = rollDiceArgs
                ? { ok: true, kind, entry, rollDice: executeRollDice(toolName, rollDiceArgs) }
                : { ok: true, kind, entry };
            return applyMediaTarget(base, mediaTarget, mediaLib);
        }
        case 'code':
        case 'json_schema':
        case 'trigger': {
            // 骨架占位·后续阶段实装
            const base = { ok: true, kind, entry };
            return applyMediaTarget(base, mediaTarget, mediaLib);
        }
    }
}
