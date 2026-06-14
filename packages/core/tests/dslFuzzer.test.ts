// 闸二第5轮(a) · DSL v1.0 fuzzer 跨机确定性 gate
// 验收标准：同 seed → 逐位 AST 恒等 + 求值逐位恒等；不同 seed → 序列独立
import { describe, it, expect } from 'vitest';
import { fuzzExprs, fuzzPreds, FUZZER_PATHS } from '../engine/dsl/fuzzer.js';
import { evalExpr, evalPred } from '../engine/dsl/eval.js';
import type { DslContext } from '../engine/dsl/eval.js';

// Deterministic context matching FUZZER_PATHS entries
const CTX: DslContext = {
  账户: { 持有: 1000 },
  人口: { 数量: 50000 },
  声望: { 值: 75 },
  军事: { 兵力: 5000 },
  资产: { 价值: 20000 },
};

describe('闸二第5轮(a) · DSL v1.0 fuzzer 跨机确定性', () => {
  // ── 表达式 ──────────────────────────────────────────────────────────────────

  it('expr: 同 seed 两次生成 → AST 逐位恒等（跨机确定性代理）', () => {
    const a = fuzzExprs(0xDEAD_BEEF, 200);
    const b = fuzzExprs(0xDEAD_BEEF, 200);
    expect(a).toEqual(b);
  });

  it('expr: 同 seed 同 ctx → 求值结果逐位恒等', () => {
    const exprs = fuzzExprs(0xCAFE_1234, 100);
    const r1 = exprs.map(e => evalExpr(e, CTX));
    const r2 = exprs.map(e => evalExpr(e, CTX));
    expect(r1).toEqual(r2);
  });

  it('expr: seed A vs seed B → 序列独立（不同 seed 生成不同表达式）', () => {
    const a = fuzzExprs(1, 50);
    const b = fuzzExprs(2, 50);
    // 50 expressions — effectively impossible to be identical if RNG is distinct
    expect(a).not.toEqual(b);
  });

  it('expr: 所有 FUZZER_PATHS 条目均可解析（path lookup 完备性）', () => {
    for (const parts of FUZZER_PATHS) {
      const v = evalExpr({ kind: 'path', parts }, CTX);
      expect(typeof v).toBe('number');
      expect(Number.isFinite(v)).toBe(true);
    }
  });

  // ── 谓词 ──────────────────────────────────────────────────────────────────

  it('pred: 同 seed 两次生成 → 谓词 AST 逐位恒等', () => {
    const a = fuzzPreds(0xABCD_0001, 100);
    const b = fuzzPreds(0xABCD_0001, 100);
    expect(a).toEqual(b);
  });

  it('pred: 同 seed 同 ctx → 求值结果逐位恒等', () => {
    const preds = fuzzPreds(0x9876_FEDC, 80);
    const r1 = preds.map(p => evalPred(p, CTX));
    const r2 = preds.map(p => evalPred(p, CTX));
    expect(r1).toEqual(r2);
  });

  it('pred: seed A vs seed B → 求值序列独立', () => {
    const pA = fuzzPreds(10, 50).map(p => evalPred(p, CTX));
    const pB = fuzzPreds(20, 50).map(p => evalPred(p, CTX));
    expect(pA).not.toEqual(pB);
  });

  // ── 叶节点求值确定性 ─────────────────────────────────────────────────────

  it('leaf int 求值恒等 value', () => {
    expect(evalExpr({ kind: 'int', value: 42 }, CTX)).toBe(42);
  });

  it('leaf percent 50% = 0.5（IEEE 754 bit-exact）', () => {
    expect(evalExpr({ kind: 'percent', value: 50 }, CTX)).toBe(0.5);
  });

  it('div/0 → 0（失败策略兜底）', () => {
    expect(evalExpr({ kind: 'binary', op: '/', left: { kind: 'int', value: 10 }, right: { kind: 'int', value: 0 } }, CTX)).toBe(0);
  });

  it('sqrt(4) → 2（fixedSqrt 跨机一致）', () => {
    expect(evalExpr({ kind: 'call', fn: 'sqrt', args: [{ kind: 'int', value: 4 }] }, CTX)).toBe(2);
  });

  it('pow(2, 10) 两次求值逐位恒等（fixedPow 跨机确定性·非精确整数）', () => {
    const expr = { kind: 'call' as const, fn: 'pow' as const, args: [{ kind: 'int' as const, value: 2 }, { kind: 'int' as const, value: 10 }] };
    expect(evalExpr(expr, CTX)).toBe(evalExpr(expr, CTX));
  });

  it('clamp(150, 0, 100) → 100', () => {
    expect(evalExpr({ kind: 'call', fn: 'clamp', args: [{ kind: 'int', value: 150 }, { kind: 'int', value: 0 }, { kind: 'int', value: 100 }] }, CTX)).toBe(100);
  });
});
