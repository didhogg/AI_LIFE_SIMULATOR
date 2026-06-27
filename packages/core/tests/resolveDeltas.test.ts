// P7-7.b · resolveDeltaValues 单测
// number 直通 / path 表达式 / 算术 / 解析失败→ok:false / NaN/Inf→ok:false
import { describe, it, expect } from 'vitest';
import { resolveDeltaValues } from '../engine/dsl/resolveDeltas.js';
import type { DslContext } from '../engine/dsl/eval.js';

const CTX: DslContext = {
  属性: { 体质: 60, 智慧: 40 },
  账户: { 文: 500 },
  全局: { 拍计数: 10 },
};

// ── P7.b-1 · number 直通 ────────────────────────────────────────────────────

describe('P7.b-1 · number 直通', () => {
  it('单条 number delta 原样输出', () => {
    const r = resolveDeltaValues(
      [{ path: '属性.体质', op: 'add', value: 5 }],
      CTX,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.resolved[0]?.value).toBe(5);
    expect(r.resolved[0]?.path).toBe('属性.体质');
    expect(r.resolved[0]?.op).toBe('add');
  });

  it('max_delta 保留', () => {
    const r = resolveDeltaValues(
      [{ path: 'x', op: 'set', value: 10, max_delta: 3 }],
      CTX,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.resolved[0]?.max_delta).toBe(3);
  });

  it('多条 number delta 全直通', () => {
    const r = resolveDeltaValues(
      [
        { path: 'a', op: 'add', value: 1 },
        { path: 'b', op: 'sub', value: 2 },
      ],
      CTX,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.resolved).toHaveLength(2);
    expect(r.resolved[0]?.value).toBe(1);
    expect(r.resolved[1]?.value).toBe(2);
  });
});

// ── P7.b-2 · 空 deltas ────────────────────────────────────────────────────

describe('P7.b-2 · 空 deltas', () => {
  it('空数组 → ok:true resolved=[]', () => {
    const r = resolveDeltaValues([], CTX);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.resolved).toHaveLength(0);
  });
});

// ── P7.b-3 · DSL path 表达式（string value）────────────────────────────────

describe('P7.b-3 · DSL path 表达式', () => {
  it('属性.体质 → 60（路径求值）', () => {
    const r = resolveDeltaValues(
      [{ path: 'some.path', op: 'set', value: '属性.体质' }],
      CTX,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.resolved[0]?.value).toBe(60);
  });

  it('账户.文 → 500', () => {
    const r = resolveDeltaValues(
      [{ path: 'some.path', op: 'add', value: '账户.文' }],
      CTX,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.resolved[0]?.value).toBe(500);
  });
});

// ── P7.b-4 · DSL 算术表达式 ─────────────────────────────────────────────────

describe('P7.b-4 · DSL 算术表达式', () => {
  it('属性.体质 * 2 → 120', () => {
    const r = resolveDeltaValues(
      [{ path: 'p', op: 'set', value: '属性.体质 * 2' }],
      CTX,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.resolved[0]?.value).toBe(120);
  });

  it('属性.体质 + 属性.智慧 → 100', () => {
    const r = resolveDeltaValues(
      [{ path: 'p', op: 'add', value: '属性.体质 + 属性.智慧' }],
      CTX,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.resolved[0]?.value).toBe(100);
  });

  it('字面数值串 50 → 50（整数 token）', () => {
    const r = resolveDeltaValues(
      [{ path: 'p', op: 'set', value: '50' }],
      CTX,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.resolved[0]?.value).toBe(50);
  });
});

// ── P7.b-5 · 解析失败 → ok:false（整包） ────────────────────────────────────

describe('P7.b-5 · 解析失败 → ok:false', () => {
  it('无效表达式串 → ok:false', () => {
    const r = resolveDeltaValues(
      [{ path: 'p', op: 'set', value: '!!! 无效 DSL' }],
      CTX,
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBeTruthy();
  });

  it('部分 delta 失败 → 整包 ok:false（fail-closed）', () => {
    const r = resolveDeltaValues(
      [
        { path: 'a', op: 'set', value: 1 },          // 合法
        { path: 'b', op: 'set', value: 'ILLEGAL!!!' }, // 非法
        { path: 'c', op: 'add', value: 2 },            // 合法
      ],
      CTX,
    );
    expect(r.ok).toBe(false);
  });
});

// ── P7.b-6 · 除零→0（DSL v1.0 约定·isFinite=true·不触发 ok:false）─────────

describe('P7.b-6 · 除零保护', () => {
  it('属性.体质 / 0 → 0（DSL v1 除零→0·isFinite·ok:true）', () => {
    const r = resolveDeltaValues(
      [{ path: 'p', op: 'set', value: '属性.体质 / 0' }],
      CTX,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.resolved[0]?.value).toBe(0);
  });
});

// ── P7.b-7 · max_delta 在 string value 路径中保留 ─────────────────────────

describe('P7.b-7 · max_delta 保留（DSL value path）', () => {
  it('string value + max_delta → resolved 保留 max_delta', () => {
    const r = resolveDeltaValues(
      [{ path: 'p', op: 'add', value: '属性.体质', max_delta: 20 }],
      CTX,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.resolved[0]?.value).toBe(60);
    expect(r.resolved[0]?.max_delta).toBe(20);
  });
});
