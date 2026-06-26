// 工具执行 seam · commit-1 · additive · 不进 hashJudgmentBundle
// tool_name → 工具库 解引用 → 调用约束谓词 gate → 按能力类型分派骨架
// R10-b: output_tag 命名空间覆盖域校验 + effectGate Gate③ $/_ 硬拒路由验证
// 调用约束极性：空串=无约束放行（与 lore 触发谓词空=恒触同侧）
// 引用即授权：tool_name 在选项集中即授权，无白名单
// commits 2/3/4 复用此 seam 实装各类型执行逻辑
// 红线：不改 gate.ts/rng.ts/fnv1a32/canonicalize/computeDelta/conservation/effectGate 函数体

import { evalPredStr, type DslContext } from './dsl/eval.js';
import { runEffectGates } from './effectGate.js';
import type { 工具条目Type, 工具库Type } from '../schema/toolLibrary.js';
import type { intervention_pack_v1Type } from '../schema/memory.js';

export type ToolKind = 'code' | 'llm' | 'roll_dice' | 'json_schema' | 'trigger' | 'output_tag';

export interface ToolDispatchArgs {
  /** 动词选项条目.tool_name（按名引用·引用即授权·无白名单） */
  toolName: string;
  /** 运行期工具库成品（来自 resolve/装配层·不进 RootSchema） */
  toolLib: 工具库Type;
  /** 调用约束谓词求值上下文（来自当前状态投影·可省略=空 ctx） */
  ctx?: DslContext;
  /** use-site 命名空间覆盖（来自 工具引用.命名空间覆盖·R10-b 域约束） */
  namespaceOverride?: string;
  /** output_tag 准备写出的 path（过 Gate③ $/_ 硬拒） */
  outputTagPath?: string;
  // ── commit-2: llm 预算闸 + AA1 世代号 ───────────────────────────────────────
  /** 当前 token 预算余量（宿主维护·传 0=已耗尽→确定性降级·不传=不检预算） */
  budgetTokensRemaining?: number;
  /**
   * AA1 世代号（Ring2GenerationTracker.enqueue(callId) 的返回值）。
   * 宿主在 dispatch 前调用 tracker.enqueue(callId)，将返回的世代号传此字段。
   * 不传=不做世代核对。
   */
  generation?: number;
}

/** llm 确定性降级原因 */
export type LlmDowngradeReason = 'budget_exhausted';

export type ToolDispatchResult =
  | { ok: true; kind: ToolKind; entry: 工具条目Type; resolvedNamespace?: string; generation?: number; downgraded?: boolean; downgradeReason?: LlmDowngradeReason }
  | { ok: false; reason: string; kind?: ToolKind };

/**
 * 解引用 tool_name → 工具条目。
 * own-property guard：防原型链注入（'constructor'/'__proto__'/'toString' 等）。
 * 空串或未命中 → null。
 */
export function resolveToolEntry(toolName: string, toolLib: 工具库Type): 工具条目Type | null {
  if (!toolName) return null;
  return Object.prototype.hasOwnProperty.call(toolLib, toolName)
    ? toolLib[toolName]!
    : null;
}

/**
 * 调用约束谓词 gate。
 * 空串极性：空=无约束放行（与 lore 触发谓词空=恒触同侧·显式声明）。
 * evalPredStr fail-closed：parse/eval 异常 → false → 拒行。
 */
export function checkCallConstraint(entry: 工具条目Type, ctx: DslContext = {}): boolean {
  const constraint = entry.调用约束;
  if (!constraint || constraint === '') return true;
  try {
    return evalPredStr(constraint, ctx);
  } catch {
    return false; // fail-closed
  }
}

/**
 * R10-b: output_tag 命名空间覆盖域校验。
 * 命名空间覆盖不得逃出工具声明的 输出命名空间 域（须以 `{域}:` 为前缀）。
 * 无覆盖 → 直接使用工具声明值；域为空且有覆盖 → 拒。
 */
export function validateOutputTagNamespace(
  entry: 工具条目Type,
  namespaceOverride?: string,
): { ok: boolean; resolvedNamespace?: string; reason?: string } {
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
export function routeOutputTagViaGate(outputTagPath: string): { ok: boolean; reason?: string } {
  const mockPack: Pick<intervention_pack_v1Type, 'deltas'> = {
    deltas: [{ path: outputTagPath, op: 'set', value: 0 }],
  };
  const result = runEffectGates(mockPack);
  if (!result.ok) {
    return { ok: false, reason: result.errors[0] ?? 'Gate③ 拒绝' };
  }
  return { ok: true };
}

/**
 * 工具执行分派入口（纯函数·无副作用·无 RNG·无写账）。
 * commits 2/3/4 复用此 seam 实装各类型执行逻辑。
 */
export function dispatchTool(args: ToolDispatchArgs): ToolDispatchResult {
  const {
    toolName, toolLib, ctx = {},
    namespaceOverride, outputTagPath,
    budgetTokensRemaining, generation,
  } = args;

  // Step 1: 解引用 tool_name → 工具条目
  const entry = resolveToolEntry(toolName, toolLib);
  if (!entry) {
    return { ok: false, reason: `工具「${toolName}」在工具库中不存在` };
  }

  const kind = entry.能力.类型 as ToolKind;

  // Step 2: 调用约束谓词 gate（空串放行·非空 evalPredStr fail-closed）
  if (!checkCallConstraint(entry, ctx)) {
    return { ok: false, reason: `调用约束不满足：工具「${toolName}」`, kind };
  }

  // Step 3: 按能力类型分派
  switch (kind) {
    case 'output_tag': {
      // R10-b: 命名空间覆盖域校验
      const nsResult = validateOutputTagNamespace(entry, namespaceOverride);
      if (!nsResult.ok) return { ok: false, reason: nsResult.reason!, kind };

      // Gate③: output_tag delta path 过 effectGate $/_ 硬拒
      if (outputTagPath) {
        const gateResult = routeOutputTagViaGate(outputTagPath);
        if (!gateResult.ok) return { ok: false, reason: gateResult.reason!, kind };
      }

      return nsResult.resolvedNamespace
        ? { ok: true, kind, entry, resolvedNamespace: nsResult.resolvedNamespace }
        : { ok: true, kind, entry };
    }

    case 'llm': {
      // commit-2: llm 预算闸 + AA1 世代号接线
      // 需预算? 工具 + 预算余量已传 + 余量耗尽 → 确定性降级（不抛·可复现）
      if (entry.需预算 === true && budgetTokensRemaining !== undefined && budgetTokensRemaining <= 0) {
        return generation !== undefined
          ? { ok: true, kind, entry, generation, downgraded: true, downgradeReason: 'budget_exhausted' }
          : { ok: true, kind, entry, downgraded: true, downgradeReason: 'budget_exhausted' };
      }
      // 预算充足（或未声明需预算）→ 正常分派·回传世代号
      return generation !== undefined
        ? { ok: true, kind, entry, generation }
        : { ok: true, kind, entry };
    }

    case 'roll_dice':
      // commit-3: rngFor 变长消耗爆炸骰（骨架占位）
      return { ok: true, kind, entry };

    case 'code':
    case 'json_schema':
    case 'trigger':
      // 骨架占位·后续阶段实装
      return { ok: true, kind, entry };
  }
}
