// DSL v1.0 minimal evaluator — deterministic, no platform Math.pow/sqrt.
// All arithmetic: IEEE 754 basic ops (+,-,*,/) + v1 fixed-math (fixedPow/fixedSqrt).
// Division by zero → 0 (parse-fail fallback per M·1 静态约束 1).
import { v1 } from '../math/fixed.js';
import type { DslExpr, DslPred } from './fuzzer.js';
import { tryParsePred } from './parser.js';

/** 求值器函数库版本（FINGERPRINT_PRESET_FIELDS[4]·v1={min,max,clamp,pow,sqrt}·增列超越函数时 bump） */
export const DSL_EVALUATOR_VERSION = 'v1.0' as const;

// ── Context ────────────────────────────────────────────────────────────────────

export type DslContext = Readonly<Record<string, number | Readonly<Record<string, number>>>>;

function resolvePath(parts: readonly string[], ctx: DslContext): number {
  if (parts.length === 0) return 0;
  const top = ctx[parts[0]!];
  if (parts.length === 1) return typeof top === 'number' ? top : 0;
  if (top !== null && typeof top === 'object') {
    const v = (top as Readonly<Record<string, number>>)[parts[1]!];
    return typeof v === 'number' ? v : 0;
  }
  return 0;
}

// ── Evaluators ─────────────────────────────────────────────────────────────────

/**
 * Evaluate a DSL v1.0 numeric expression.
 * All operations are cross-platform bit-exact:
 *   add/sub/mul/div → IEEE 754 mandated; pow/sqrt → fixedPow/fixedSqrt (pure Taylor, basic ops only).
 */
export function evalExpr(expr: DslExpr, ctx: DslContext): number {
  switch (expr.kind) {
    case 'int':     return expr.value;
    case 'percent': return expr.value / 100;
    case 'path':    return resolvePath(expr.parts, ctx);
    case 'unary':   return -evalExpr(expr.expr, ctx);
    case 'binary': {
      const l = evalExpr(expr.left, ctx);
      const r = evalExpr(expr.right, ctx);
      if (expr.op === '+') return l + r;
      if (expr.op === '-') return l - r;
      if (expr.op === '*') return l * r;
      return r === 0 ? 0 : l / r; // '/' with zero-guard
    }
    case 'call': {
      const a = (i: number): number => evalExpr(expr.args[i]!, ctx);
      if (expr.fn === 'sqrt')  return v1.sqrt(a(0));
      if (expr.fn === 'min')   return v1.min(a(0), a(1));
      if (expr.fn === 'max')   return v1.max(a(0), a(1));
      if (expr.fn === 'pow')   return v1.pow(a(0), a(1));
      return v1.clamp(a(0), a(1), a(2)); // 'clamp'
    }
  }
}

/**
 * Evaluate a DSL v1.0 predicate.
 * Depth-1 constraint is enforced by the fuzzer at generation time.
 * 'in': extensional set membership — requires external set data not available in DslContext;
 *       returns false (fail-closed) until extensional evaluation is wired (K-a extensional path).
 */
export function evalPred(pred: DslPred, ctx: DslContext): boolean {
  if (pred.kind === 'logical') {
    const l = evalPred(pred.left, ctx);
    const r = evalPred(pred.right, ctx);
    return pred.op === 'and' ? l && r : l || r;
  }
  // 'compare'
  const l = evalExpr(pred.left, ctx);
  const r = evalExpr(pred.right, ctx);
  if (pred.op === '==')  return l === r;
  if (pred.op === '!=')  return l !== r;
  if (pred.op === '<')   return l < r;
  if (pred.op === '<=')  return l <= r;
  if (pred.op === '>')   return l > r;
  if (pred.op === '>=')  return l >= r;
  return false; // 'in': extensional set membership · fail-closed (external set data unavailable)
}

/**
 * Parse a DSL v1.0 predicate string and evaluate it against a context.
 * Returns false on parse failure or empty string (fail-closed).
 * Used for lore 触发谓词 evaluation and K-a intensional predicate queries.
 */
export function evalPredStr(src: string, ctx: DslContext): boolean {
  if (!src) return false;
  const pred = tryParsePred(src);
  if (pred === null) return false;
  return evalPred(pred, ctx);
}
