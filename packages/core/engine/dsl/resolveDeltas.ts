// P7-7.b · resolveDeltaValues — intervention_pack delta value 前置 pass
// 在 runEffectGates 之前调用；把 string DSL 表达式求值为 number，确保 effectGate 只见纯数值。
// 纯函数·确定性·六禁·effectGate.ts 函数体零 diff（本文件不 import effectGate）
import type { DslContext } from './eval.js';
import { evalExpr } from './eval.js';
import { tryParseExpr } from './parser.js';

// ── 类型 ────────────────────────────────────────────────────────────────────────

/** intervention_pack delta op 联合类型（与 memory.ts 的 intervention_pack_delta条目 保持一致） */
export type PackDeltaOp = 'set' | 'add' | 'sub' | 'clamp' | 'lock';

/** 输入 delta（与 intervention_pack_delta条目 同形·value 可能为 string） */
export interface RawDelta {
  path:         string;
  op:           PackDeltaOp;
  value:        number | string;
  max_delta?:   number | undefined;
}

/** 输出 delta（value 已确保为 number） */
export interface ResolvedDelta {
  path:         string;
  op:           PackDeltaOp;
  value:        number;
  max_delta?:   number | undefined;
}

// ── 核心函数 ─────────────────────────────────────────────────────────────────────

/**
 * 将 intervention_pack deltas 中的 DSL expression string 求值为 number。
 *
 * 语义：
 *   · value 为 number → 直通（pass-through）
 *   · value 为 string → tryParseExpr → evalExpr → 必须为 isFinite number
 *
 * fail-closed：任一 delta 解析/求值失败（parse=null 或 !isFinite）→ 整包 ok:false。
 * 空 deltas → ok:true, resolved=[]（无 delta=pass-through·不报错）。
 */
export function resolveDeltaValues(
  deltas: ReadonlyArray<RawDelta>,
  ctx:    DslContext,
): { ok: true; resolved: ResolvedDelta[] } | { ok: false; reason: string } {
  const resolved: ResolvedDelta[] = [];

  for (const delta of deltas) {
    if (typeof delta.value === 'number') {
      // 直通
      const r: ResolvedDelta = {
        path:  delta.path,
        op:    delta.op,
        value: delta.value,
      };
      if (delta.max_delta !== undefined) r.max_delta = delta.max_delta;
      resolved.push(r);
      continue;
    }

    // DSL expression string
    const ast = tryParseExpr(delta.value);
    if (ast === null) {
      return {
        ok:     false,
        reason: `delta.value 表达式解析失败·path「${delta.path}」value="${delta.value}"`,
      };
    }

    const n = evalExpr(ast, ctx);
    if (!isFinite(n)) {
      return {
        ok:     false,
        reason: `delta.value 求值结果非有限数 (${n})·path「${delta.path}」value="${delta.value}"`,
      };
    }

    const r: ResolvedDelta = {
      path:  delta.path,
      op:    delta.op,
      value: n,
    };
    if (delta.max_delta !== undefined) r.max_delta = delta.max_delta;
    resolved.push(r);
  }

  return { ok: true, resolved };
}
