// B5 · M2 覆写授权源认证 · 确定性验收测试
import { describe, it, expect } from 'vitest';
import {
  VALID_OVERWRITE_AUTH_SOURCES,
  DESTINY_CHANNEL_SOURCE,
  checkM2Violation,
  writeM2Tombstone,
  type M2TombstoneEntry,
  type M2ViolationResult,
} from '../interfaces/authGate.js';

// ── 类型辅助 ────────────────────────────────────────────────────────────────
type _Expect<T extends true> = T;
type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
  ? true
  : false;

// ── VALID_OVERWRITE_AUTH_SOURCES ─────────────────────────────────────────────

describe('B5 · M2 · VALID_OVERWRITE_AUTH_SOURCES', () => {
  it('是冻结数组', () => {
    expect(Object.isFrozen(VALID_OVERWRITE_AUTH_SOURCES)).toBe(true);
  });
  it('包含「系统」「裁判」「玩家确认」', () => {
    expect(VALID_OVERWRITE_AUTH_SOURCES).toContain('系统');
    expect(VALID_OVERWRITE_AUTH_SOURCES).toContain('裁判');
    expect(VALID_OVERWRITE_AUTH_SOURCES).toContain('玩家确认');
  });
  it('不包含「天命」（天命来源经普通通道即越权）', () => {
    expect(VALID_OVERWRITE_AUTH_SOURCES).not.toContain('天命');
  });
  it('DESTINY_CHANNEL_SOURCE 常量为「天命」', () => {
    expect(DESTINY_CHANNEL_SOURCE).toBe('天命');
  });
});

// ── checkM2Violation · 有效授权源 ────────────────────────────────────────────

describe('B5 · M2 · checkM2Violation · 有效授权源放行', () => {
  for (const src of VALID_OVERWRITE_AUTH_SOURCES) {
    it(`授权源「${src}」→ violation: false`, () => {
      const r = checkM2Violation(src);
      expect(r.violation).toBe(false);
    });
  }
  it('返回值类型：violation=false 时无 reason 字段（类型收窄）', () => {
    type R = Extract<M2ViolationResult, { violation: false }>;
    type Assert = _Expect<Equals<keyof R, 'violation'>>;
    const _: Assert = true;
    void _;
  });
});

// ── checkM2Violation · 无效授权源 ────────────────────────────────────────────

describe('B5 · M2 · checkM2Violation · 无效授权源越权', () => {
  it('空串 → 越权，reason=覆写授权越权', () => {
    const r = checkM2Violation('');
    expect(r.violation).toBe(true);
    if (r.violation) expect(r.reason).toBe('覆写授权越权');
  });
  it('任意无关字符串 → 越权', () => {
    const r = checkM2Violation('未知来源');
    expect(r.violation).toBe(true);
    if (r.violation) expect(r.reason).toBe('覆写授权越权');
  });
  it('mod 名称自称授权源 → 越权', () => {
    const r = checkM2Violation('mod_alpha');
    expect(r.violation).toBe(true);
    if (r.violation) expect(r.reason).toBe('覆写授权越权');
  });
  it('越权时 诊断 字段非空', () => {
    const r = checkM2Violation('');
    if (r.violation) expect(r.诊断.length).toBeGreaterThan(0);
  });
});

// ── checkM2Violation · 天命通道越权 ─────────────────────────────────────────

describe('B5 · M2 · checkM2Violation · 天命通道越权', () => {
  it(`授权源「${DESTINY_CHANNEL_SOURCE}」经普通通道 → 越权`, () => {
    const r = checkM2Violation(DESTINY_CHANNEL_SOURCE);
    expect(r.violation).toBe(true);
  });
  it('天命通道越权诊断含「天命通道」关键词', () => {
    const r = checkM2Violation(DESTINY_CHANNEL_SOURCE);
    if (r.violation) {
      expect(r.诊断).toContain('天命通道');
      expect(r.reason).toBe('覆写授权越权');
    }
  });
  it('天命通道越权诊断含来源字符串本身', () => {
    const r = checkM2Violation(DESTINY_CHANNEL_SOURCE);
    if (r.violation) expect(r.诊断).toContain(DESTINY_CHANNEL_SOURCE);
  });
});

// ── writeM2Tombstone · 幂等+确定性 ──────────────────────────────────────────

describe('B5 · M2 · writeM2Tombstone · 幂等+确定性', () => {
  it('原因始终为「覆写授权越权」', () => {
    expect(writeM2Tombstone('k').原因).toBe('覆写授权越权');
    expect(writeM2Tombstone('k', 'p', '诊断').原因).toBe('覆写授权越权');
  });
  it('最小形态：仅 记录键 + 原因', () => {
    const t = writeM2Tombstone('mod_beta');
    expect(t).toEqual({ 记录键: 'mod_beta', 原因: '覆写授权越权' });
    expect(t.pack_id).toBeUndefined();
    expect(t.诊断).toBeUndefined();
  });
  it('带 pack_id → 含 pack_id', () => {
    const t = writeM2Tombstone('mod_beta', 'mod_beta');
    expect(t.pack_id).toBe('mod_beta');
    expect(t.诊断).toBeUndefined();
  });
  it('带 诊断（无 pack_id）→ 含 诊断 但无 pack_id', () => {
    const t = writeM2Tombstone('mod_gamma', undefined, '越权原因说明');
    expect(t.诊断).toBe('越权原因说明');
    expect(t.pack_id).toBeUndefined();
  });
  it('带全部参数 → 含全部字段', () => {
    const t = writeM2Tombstone('mod_delta', 'mod_delta', '诊断文本');
    expect(t.记录键).toBe('mod_delta');
    expect(t.pack_id).toBe('mod_delta');
    expect(t.原因).toBe('覆写授权越权');
    expect(t.诊断).toBe('诊断文本');
  });
  it('幂等：相同输入两次调用结果逐字节相等', () => {
    const a = writeM2Tombstone('mod_alpha', 'mod_alpha', '测试原因');
    const b = writeM2Tombstone('mod_alpha', 'mod_alpha', '测试原因');
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
  it('确定性：无 wall-clock（多次调用结果恒等）', () => {
    const r1 = JSON.stringify(writeM2Tombstone('k', 'k', '诊断'));
    const r2 = JSON.stringify(writeM2Tombstone('k', 'k', '诊断'));
    expect(r1).toBe(r2);
  });
  it('M2TombstoneEntry 类型兼容 mod墓碑条目Schema：原因字面量收窄', () => {
    type R = M2TombstoneEntry['原因'];
    type Assert = _Expect<Equals<R, '覆写授权越权'>>;
    const _: Assert = true;
    void _;
  });
});
