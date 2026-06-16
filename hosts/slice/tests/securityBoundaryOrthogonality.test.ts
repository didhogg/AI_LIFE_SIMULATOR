// 批④ Step 2 · slice 侧正交断言（守包依赖方向·slice→core 合法）
// core 侧装不下 Transfer/FlowRecord/CheckIntent（hosts/slice/ledger 类型）→ 放此处
import { describe, it, expect } from 'vitest';
import type { Transfer, CheckIntent } from '../ledger/proposalSchema.js';
import type { FlowRecord } from '../ledger/commit.js';
import type {
  导出剥离敏感键名,
  主权地板事件名,
} from '@ai-life-sim/core';

// 自包含 helper（与 core 侧 securityBoundary.test.ts 同款·禁第二范式）
type _Expect<T extends true> = T;
type _NoForbiddenKeys<Target, Forbidden extends string> =
  Extract<Forbidden, keyof Target> extends never ? true : false;

describe('批④ Step 2 slice 侧正交断言', () => {
  // 防安全边界字符串（导出敏感键名 / 主权事件名）意外出现在 slice 实战记账/检定入参字段名里
  it('B1: (导出剥离敏感键名 | 主权地板事件名) ⊥ slice 记账 Transfer', () => {
    type _禁集 = 导出剥离敏感键名 | 主权地板事件名;
    type _B1 = _Expect<_NoForbiddenKeys<Transfer, _禁集>>;
    const _b1: _B1 = true;
    expect(_b1).toBe(true);
  });
  it('B2: (导出剥离敏感键名 | 主权地板事件名) ⊥ slice 记账 FlowRecord', () => {
    type _禁集 = 导出剥离敏感键名 | 主权地板事件名;
    type _B2 = _Expect<_NoForbiddenKeys<FlowRecord, _禁集>>;
    const _b2: _B2 = true;
    expect(_b2).toBe(true);
  });
  it('B3: (导出剥离敏感键名 | 主权地板事件名) ⊥ slice 检定 CheckIntent', () => {
    type _禁集 = 导出剥离敏感键名 | 主权地板事件名;
    type _B3 = _Expect<_NoForbiddenKeys<CheckIntent, _禁集>>;
    const _b3: _B3 = true;
    expect(_b3).toBe(true);
  });

  // ── 批④ Step 3 · 主权降级字段名 ⊥ slice 实战类型（与 Step 2 _禁集对称）────────
  it('B4: 主权降级字段名 ⊥ Transfer / FlowRecord / CheckIntent', () => {
    type _B4a = _Expect<_NoForbiddenKeys<Transfer, '主权降级'>>;
    type _B4b = _Expect<_NoForbiddenKeys<FlowRecord, '主权降级'>>;
    type _B4c = _Expect<_NoForbiddenKeys<CheckIntent, '主权降级'>>;
    const _b4a: _B4a = true;
    const _b4b: _B4b = true;
    const _b4c: _B4c = true;
    expect(_b4a).toBe(true);
    expect(_b4b).toBe(true);
    expect(_b4c).toBe(true);
  });
});
