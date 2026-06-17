// B5 · C6 第②闸席位作用域谓词 · 确定性验收测试
import { describe, it, expect } from 'vitest';
import { checkC6SeatScope, type SeatScopeResult } from '../interfaces/seatScope.js';
import type { 席位表Type } from '../schema/actor.js';

// ── 类型辅助 ─────────────────────────────────────────────────────────────────
type _Expect<T extends true> = T;
type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
  ? true
  : false;

// ── 夹具 ─────────────────────────────────────────────────────────────────────

const SEAT_本机: 席位表Type = {
  本机: { 焦点角色键: '林若茵', 控制者: '人类', 连接状态: '本地' },
};

const SEAT_MULTI: 席位表Type = {
  A席: { 焦点角色键: '林若茵', 控制者: '人类', 连接状态: '本地' },
  B席: { 焦点角色键: '王大柱', 控制者: 'AI', 连接状态: '在线' },
};

const SEAT_EMPTY: 席位表Type = {};

// ── 单机退化（≤1 席位）→ 全权限 ──────────────────────────────────────────────

describe('B5 · C6 · 单机退化 · ≤1 席位全权限', () => {
  it('席位表为空（0 席位）→ eligible: true', () => {
    expect(checkC6SeatScope('任意席', SEAT_EMPTY, '林若茵').eligible).toBe(true);
  });
  it('席位表恰好 1 席位 → eligible: true', () => {
    expect(checkC6SeatScope('本机', SEAT_本机, '林若茵').eligible).toBe(true);
  });
  it('单机模式·target 任意（含不匹配） → eligible: true', () => {
    expect(checkC6SeatScope('本机', SEAT_本机, '王大柱').eligible).toBe(true);
  });
  it('单机模式·seatId 不在表内 → 仍 eligible: true（席位数≤1 优先退化）', () => {
    expect(checkC6SeatScope('不存在席', SEAT_本机, '林若茵').eligible).toBe(true);
  });
});

// ── 多席位 · 合格 ─────────────────────────────────────────────────────────────

describe('B5 · C6 · 多席位 · 合格场景', () => {
  it('席位存在且焦点角色键匹配 → eligible: true', () => {
    expect(checkC6SeatScope('A席', SEAT_MULTI, '林若茵').eligible).toBe(true);
  });
  it('另一席位匹配其焦点角色键 → eligible: true', () => {
    expect(checkC6SeatScope('B席', SEAT_MULTI, '王大柱').eligible).toBe(true);
  });
});

// ── 多席位 · 不合格 ──────────────────────────────────────────────────────────

describe('B5 · C6 · 多席位 · 不合格场景', () => {
  it('seatId 不在席位表 → eligible: false', () => {
    const r = checkC6SeatScope('C席', SEAT_MULTI, '林若茵');
    expect(r.eligible).toBe(false);
    if (!r.eligible) expect(r.reason.length).toBeGreaterThan(0);
  });
  it('seatId 不在席位表 → reason 含 seatId', () => {
    const r = checkC6SeatScope('C席', SEAT_MULTI, '林若茵');
    if (!r.eligible) expect(r.reason).toContain('C席');
  });
  it('焦点角色键不匹配（跨席位越权）→ eligible: false', () => {
    const r = checkC6SeatScope('A席', SEAT_MULTI, '王大柱'); // A席焦点=林若茵≠王大柱
    expect(r.eligible).toBe(false);
  });
  it('跨席位越权 → reason 含两个角色键', () => {
    const r = checkC6SeatScope('A席', SEAT_MULTI, '王大柱');
    if (!r.eligible) {
      expect(r.reason).toContain('林若茵');
      expect(r.reason).toContain('王大柱');
    }
  });
  it('席位焦点角色键为空 → eligible: false（无法确定作用域）', () => {
    const 无焦点席位表: 席位表Type = {
      A席: { 焦点角色键: '', 控制者: '人类', 连接状态: '本地' },
      B席: { 焦点角色键: '王大柱', 控制者: 'AI', 连接状态: '在线' },
    };
    const r = checkC6SeatScope('A席', 无焦点席位表, '林若茵');
    expect(r.eligible).toBe(false);
    if (!r.eligible) expect(r.reason).toContain('无焦点');
  });
});

// ── 确定性 + 纯函数 ────────────────────────────────────────────────────────────

describe('B5 · C6 · 确定性', () => {
  it('相同输入多次调用 → 结果恒等', () => {
    const r1 = checkC6SeatScope('A席', SEAT_MULTI, '林若茵');
    const r2 = checkC6SeatScope('A席', SEAT_MULTI, '林若茵');
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });
  it('不合格分支：多次调用 reason 恒等', () => {
    const r1 = checkC6SeatScope('A席', SEAT_MULTI, '王大柱');
    const r2 = checkC6SeatScope('A席', SEAT_MULTI, '王大柱');
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });
});

// ── 类型形状 ──────────────────────────────────────────────────────────────────

describe('B5 · C6 · 类型形状', () => {
  it('eligible=true 分支无 reason 字段（类型收窄）', () => {
    type EligTrue = Extract<SeatScopeResult, { eligible: true }>;
    type Assert = _Expect<Equals<keyof EligTrue, 'eligible'>>;
    const _: Assert = true;
    void _;
  });
  it('eligible=false 分支含 reason: string', () => {
    type EligFalse = Extract<SeatScopeResult, { eligible: false }>;
    type Assert = _Expect<Equals<EligFalse['reason'], string>>;
    const _: Assert = true;
    void _;
  });
});
