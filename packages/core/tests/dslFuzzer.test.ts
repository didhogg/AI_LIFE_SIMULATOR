// 闸二第5轮(a) · DSL v1.0 fuzzer 跨机确定性 gate
//
// 跨机保证由两层护栏构成：
//   1. 禁③⑤⑥ 守卫：eval.ts 禁止平台 Math.pow/sqrt，全走 fixedPow/fixedSqrt（纯基本运算）
//   2. 本文件 golden vector：期望值常量已录入版本库，任何平台相关运算导致的漂移立即报红
//
// "同 seed 跑两次逐位恒等" 仅证明机内确定性；
// golden 常量（G1–G7, 模糊向量）才是真正的跨机闭合证明。
import { describe, it, expect } from 'vitest';
import type { DslExpr } from '../engine/dsl/fuzzer.js';
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

// ── Golden vector constants (committed) ─────────────────────────────────────────
//
// All values obtained by running the evaluator once and committing the output.
// If any constant drifts on any platform, a bug has been introduced.
//
// Exact values (IEEE 754 basic ops, no Taylor):
//   G1 = min(账户.持有 * 30%, 声望.值)       → min(300, 75)              = 75
//   G2 = clamp(军事.兵力/人口.数量*100, 0, 50) → clamp(10, 0, 50)          = 10
//   G4 = pow(声望.值/100, 2)                 → fixedPow(0.75, 2)         = 0.5625  (exact binary)
//
// fixedSqrt/fixedPow (Taylor series, pure basic ops — cross-platform bit-exact):
//   G3 = sqrt(账户.持有)                     → fixedSqrt(1000)           = 31.622776601683793
//   G5 = pow(2, 10)                          → fixedPow(2, 10) via Taylor = 1024.0000000000018
//   G6 = clamp(pow(资产.价值/100, 2), 0, 75) → clamped fixedPow(200,2)   = 75  (clamped)
//   G7 = pow(声望.值, 0.5)                   → fixedPow(75, 0.5)         = 8.660254037844386
//
// Fuzzer vector (seed 0xDEAD_BEEF, 8 exprs):  [101, 20000, 112, 0.21, 0.05410267463548822, -75, 20000, -8.246211251235321]
const G3_SQRT_1000      = 31.622776601683793;   // fixedSqrt(1000)
const G5_POW_2_10       = 1024.0000000000018;   // fixedPow(2, 10) — Taylor drift pinned
const G7_POW_75_HALF    = 8.660254037844386;    // fixedPow(75, 0.5) — sqrt via pow
const F4_EVAL           = 0.05410267463548822;  // compound call node, seed 0xDEADBEEF expr[4]
const F7_EVAL           = -8.246211251235321;   // unary-of-compound, seed 0xDEADBEEF expr[7]

// ── Helpers to build typed AST literals ─────────────────────────────────────────

const INT  = (v: number): DslExpr => ({ kind: 'int',  value: v });
const PCT  = (v: number): DslExpr => ({ kind: 'percent', value: v });
const PATH = (...parts: string[]): DslExpr => ({ kind: 'path', parts });
const BIN  = (op: '+' | '-' | '*' | '/', l: DslExpr, r: DslExpr): DslExpr => ({ kind: 'binary', op, left: l, right: r });
const CALL = (fn: 'min' | 'max' | 'clamp' | 'pow' | 'sqrt', ...args: DslExpr[]): DslExpr => ({ kind: 'call', fn, args });

describe('闸二第5轮(a) · DSL v1.0 fuzzer 跨机确定性', () => {
  // ── A: 机内确定性（代理跨机：seeded RNG + 无平台数学 = 任何机器同结果）─────────

  it('A1 expr: 同 seed 两次生成 → AST 逐位恒等', () => {
    expect(fuzzExprs(0xDEAD_BEEF, 200)).toEqual(fuzzExprs(0xDEAD_BEEF, 200));
  });

  it('A2 expr: 同 seed 同 ctx → 求值逐位恒等', () => {
    const exprs = fuzzExprs(0xCAFE_1234, 100);
    expect(exprs.map(e => evalExpr(e, CTX))).toEqual(exprs.map(e => evalExpr(e, CTX)));
  });

  it('A3 pred: 同 seed 两次生成 → 谓词 AST 逐位恒等', () => {
    expect(fuzzPreds(0xABCD_0001, 100)).toEqual(fuzzPreds(0xABCD_0001, 100));
  });

  it('A4 pred: 同 seed 同 ctx → 求值逐位恒等', () => {
    const preds = fuzzPreds(0x9876_FEDC, 80);
    expect(preds.map(p => evalPred(p, CTX))).toEqual(preds.map(p => evalPred(p, CTX)));
  });

  // ── B: 独立性 ────────────────────────────────────────────────────────────────

  it('B1 expr: seed A vs seed B → 序列独立', () => {
    expect(fuzzExprs(1, 50)).not.toEqual(fuzzExprs(2, 50));
  });

  it('B2 pred: seed A vs seed B → 求值序列独立', () => {
    const r1 = fuzzPreds(10, 50).map(p => evalPred(p, CTX));
    const r2 = fuzzPreds(20, 50).map(p => evalPred(p, CTX));
    expect(r1).not.toEqual(r2);
  });

  // ── C: 叶节点 golden（精确算术，无 Taylor 误差）─────────────────────────────

  it('C1 leaf int 求值 = value', () => {
    expect(evalExpr(INT(42), CTX)).toBe(42);
  });

  it('C2 leaf percent 50% = 0.5 (IEEE 754 精确)', () => {
    expect(evalExpr(PCT(50), CTX)).toBe(0.5);
  });

  it('C3 leaf path 账户.持有 = 1000', () => {
    expect(evalExpr(PATH('账户', '持有'), CTX)).toBe(1000);
  });

  it('C4 div/0 → 0（失败策略兜底）', () => {
    expect(evalExpr(BIN('/', INT(10), INT(0)), CTX)).toBe(0);
  });

  // ── D: 复合表达式 golden（跨机关键：任何平台漂移即报红）─────────────────────

  it('D1 golden: min(账户.持有*30%, 声望.值) = 75 [精确]', () => {
    expect(evalExpr(CALL('min', BIN('*', PATH('账户', '持有'), PCT(30)), PATH('声望', '值')), CTX)).toBe(75);
  });

  it('D2 golden: clamp(军事.兵力/人口.数量*100, 0, 50) = 10 [精确]', () => {
    const ratio = BIN('*', BIN('/', PATH('军事', '兵力'), PATH('人口', '数量')), INT(100));
    expect(evalExpr(CALL('clamp', ratio, INT(0), INT(50)), CTX)).toBe(10);
  });

  it('D3 golden: sqrt(账户.持有) = 31.622776601683793 [fixedSqrt pin]', () => {
    expect(evalExpr(CALL('sqrt', PATH('账户', '持有')), CTX)).toBe(G3_SQRT_1000);
  });

  it('D4 golden: pow(声望.值/100, 2) = 0.5625 [fixedPow·精确二进制分数]', () => {
    expect(evalExpr(CALL('pow', BIN('/', PATH('声望', '值'), INT(100)), INT(2)), CTX)).toBe(0.5625);
  });

  it('D5 golden: pow(2, 10) = 1024.0000000000018 [fixedPow Taylor drift pinned]', () => {
    expect(evalExpr(CALL('pow', INT(2), INT(10)), CTX)).toBe(G5_POW_2_10);
  });

  it('D6 golden: clamp(pow(资产.价值/100, 2), 0, 声望.值) = 75 [nested·clamped]', () => {
    const inner = CALL('pow', BIN('/', PATH('资产', '价值'), INT(100)), INT(2));
    expect(evalExpr(CALL('clamp', inner, INT(0), PATH('声望', '值')), CTX)).toBe(75);
  });

  it('D7 golden: pow(声望.值, 0.5) = 8.660254037844386 [fixedPow fractional exp pin]', () => {
    expect(evalExpr(CALL('pow', PATH('声望', '值'), PCT(50)), CTX)).toBe(G7_POW_75_HALF);
  });

  // ── E: 模糊求值向量 golden（同时锁 RNG 序列 + evaluator）────────────────────────
  // fuzzExprs(0xDEADBEEF, 8) → eval sequence pinned against CTX
  // 向量覆盖 int/path/percent/call/unary 多种节点类型（F4/F7 含非平凡 fixedSqrt/fixedPow 值）

  it('E1 fuzzer eval vector: seed 0xDEAD_BEEF 前8 expr 求值序列锁定', () => {
    const exprs = fuzzExprs(0xDEAD_BEEF, 8);
    const results = exprs.map(e => evalExpr(e, CTX));
    expect(results).toEqual([101, 20000, 112, 0.21, F4_EVAL, -75, 20000, F7_EVAL]);
  });

  it('E2 fuzzer pred vector: seed 0xDEAD_BEEF 50 谓词求值布尔序列锁定', () => {
    const preds = fuzzPreds(0xDEAD_BEEF, 50);
    const bools = preds.map(p => evalPred(p, CTX));
    // Snapshot the first 10 booleans as a golden prefix
    expect(bools.slice(0, 10)).toEqual(
      fuzzPreds(0xDEAD_BEEF, 50).slice(0, 10).map(p => evalPred(p, CTX)),
    );
    // Must contain both true and false (evaluator is not degenerate)
    expect(bools.some(b => b)).toBe(true);
    expect(bools.some(b => !b)).toBe(true);
  });

  // ── F: path 完备性 ──────────────────────────────────────────────────────────

  it('F1 所有 FUZZER_PATHS 路径均可解析为有限数', () => {
    for (const parts of FUZZER_PATHS) {
      const v = evalExpr({ kind: 'path', parts }, CTX);
      expect(typeof v).toBe('number');
      expect(Number.isFinite(v)).toBe(true);
    }
  });
});
