// DSL v1.0 fuzzer — seeded, deterministic expression/predicate generator.
// Uses pure-rand xorshift128+ (no Math.random).
// Same seed → same AST sequence on any platform (IEEE 754 + xorshift128+).
import * as prand from 'pure-rand';

// ── AST types (DSL v1.0 grammar, freeze.md M·1) ──────────────────────────────

export type DslFn = 'min' | 'max' | 'clamp' | 'pow' | 'sqrt';
export type DslCmpOp = '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in';
export type DslBinOp = '+' | '-' | '*' | '/';
export type DslLogOp = 'and' | 'or';

export type DslExpr =
  | { readonly kind: 'int';    readonly value: number }
  | { readonly kind: 'percent'; readonly value: number }
  | { readonly kind: 'path';   readonly parts: readonly string[] }
  | { readonly kind: 'unary';  readonly op: '-'; readonly expr: DslExpr }
  | { readonly kind: 'binary'; readonly op: DslBinOp; readonly left: DslExpr; readonly right: DslExpr }
  | { readonly kind: 'call';   readonly fn: DslFn; readonly args: readonly DslExpr[] };

// 谓词限深 1：logical only at depth 0, compare only at depth >= 1
export type DslPred =
  | { readonly kind: 'compare'; readonly op: DslCmpOp; readonly left: DslExpr; readonly right: DslExpr }
  | { readonly kind: 'logical'; readonly op: DslLogOp; readonly left: DslPred; readonly right: DslPred };

// ── Fuzzer context paths (fixed set; ensures path lookups resolve) ─────────────

export const FUZZER_PATHS: ReadonlyArray<readonly [string, string]> = [
  ['账户', '持有'],
  ['人口', '数量'],
  ['声望', '值'],
  ['军事', '兵力'],
  ['资产', '价值'],
];

// ── Private helpers ─────────────────────────────────────────────────────────────

const BIN_OPS: readonly DslBinOp[] = ['+', '-', '*', '/'];
const CMP_OPS: readonly DslCmpOp[] = ['==', '!=', '<', '<=', '>', '>='];
const LOG_OPS: readonly DslLogOp[] = ['and', 'or'];

function pick(rng: prand.RandomGenerator, min: number, max: number): number {
  return prand.unsafeUniformIntDistribution(min, max, rng);
}

function genExpr(rng: prand.RandomGenerator, depth: number, maxDepth: number): DslExpr {
  const isLeaf = depth >= maxDepth;
  const choice = pick(rng, 0, isLeaf ? 2 : 7);

  if (choice === 0) return { kind: 'int', value: pick(rng, 1, 200) };
  if (choice === 1) return { kind: 'percent', value: pick(rng, 1, 99) };
  if (choice === 2) {
    const pi = pick(rng, 0, FUZZER_PATHS.length - 1);
    return { kind: 'path', parts: FUZZER_PATHS[pi]! };
  }
  if (choice === 3) return { kind: 'unary', op: '-', expr: genExpr(rng, depth + 1, maxDepth) };
  if (choice === 4) {
    return {
      kind: 'binary',
      op: BIN_OPS[pick(rng, 0, 3)]!,
      left: genExpr(rng, depth + 1, maxDepth),
      right: genExpr(rng, depth + 1, maxDepth),
    };
  }
  if (choice === 5) {
    const fn = pick(rng, 0, 1) === 0 ? 'min' : ('max' as const);
    return { kind: 'call', fn, args: [genExpr(rng, depth + 1, maxDepth), genExpr(rng, depth + 1, maxDepth)] };
  }
  if (choice === 6) {
    return {
      kind: 'call', fn: 'clamp',
      args: [genExpr(rng, depth + 1, maxDepth), genExpr(rng, depth + 1, maxDepth), genExpr(rng, depth + 1, maxDepth)],
    };
  }
  // choice === 7: sqrt with positive int arg (avoids NaN from negative inputs)
  return { kind: 'call', fn: 'sqrt', args: [{ kind: 'int', value: pick(rng, 1, 100) }] };
}

function genPred(rng: prand.RandomGenerator, depth: number): DslPred {
  const choice = depth >= 1 ? 0 : pick(rng, 0, 2);
  if (choice === 0) {
    return {
      kind: 'compare',
      op: CMP_OPS[pick(rng, 0, CMP_OPS.length - 1)]!,
      left: genExpr(rng, 0, 2),
      right: genExpr(rng, 0, 2),
    };
  }
  // choice 1 or 2: logical (and/or) of two compare nodes (depth 1 → leaf)
  return {
    kind: 'logical',
    op: LOG_OPS[pick(rng, 0, 1)]!,
    left: genPred(rng, depth + 1),
    right: genPred(rng, depth + 1),
  };
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Generate `count` DSL v1.0 numeric expressions from a seeded RNG.
 * Same seed → identical AST sequence on any IEEE 754 platform (cross-machine determinism).
 */
export function fuzzExprs(seed: number, count: number, maxDepth = 3): DslExpr[] {
  const rng = prand.xorshift128plus(seed >>> 0);
  const out: DslExpr[] = [];
  for (let i = 0; i < count; i++) out.push(genExpr(rng, 0, maxDepth));
  return out;
}

/**
 * Generate `count` DSL v1.0 predicates from a seeded RNG.
 * Same seed → identical AST sequence on any platform.
 */
export function fuzzPreds(seed: number, count: number): DslPred[] {
  const rng = prand.xorshift128plus(seed >>> 0);
  const out: DslPred[] = [];
  for (let i = 0; i < count; i++) out.push(genPred(rng, 0));
  return out;
}
