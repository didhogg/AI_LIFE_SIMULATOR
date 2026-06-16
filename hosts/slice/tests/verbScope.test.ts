// Task 4E（续·slice 侧）：动词表/植入字段「够不到账本/结算」编译期断言
// 纯类型层断言·零运行时改动·零迁移；不碰确定性引擎/结算管线运行逻辑/canonicalize/RING_K/fixed.ts
// 目标类型来自本纵切实际生效的记账/结算管线（非 packages/core 平行副本）：
//   记账：Transfer / FlowRecord（ledger/proposalSchema.ts·ledger/commit.ts）
//   检定：CheckIntent（ledger/proposalSchema.ts·记账 LLM 独立调用的检定意图）
//   结算：assertConservation / assertNetZero 入参（ledger/gate.ts·守恒断言）
//
// Step 6.5 任务 A 判据（活路径 vs 死代码）：
//   grep 全仓库 "from '.*engine/check"：
//     hosts/slice/engine/check.ts 的消费方 = index.ts（CLI 主入口）/ scripts/soak.ts
//       （fuzz harness）/ tests/m2.test.ts / tests/m3.test.ts —— 是 CLI/soak 实战路径。
//     packages/core/engine/check.ts 的消费方 = packages/core 自己的三个 *.test.ts，
//       零生产/运行时消费者，hosts/slice 从未 import 它。
//   结论：判 A1——hosts/slice/engine/check.ts 是活路径，必须单独补同款断言（见下方③节）；
//   packages/core/engine/check.ts（CheckInput）已在 stubs.test.ts Task 4E 覆盖，继续保留。
import { describe, it, expect, expectTypeOf } from 'vitest';
import type { z } from 'zod';
import type { Transfer, CheckIntent } from '../ledger/proposalSchema.js';
import type { FlowRecord } from '../ledger/commit.js';
import { assertConservation, assertNetZero } from '../ledger/gate.js';
import { runD20Check } from '../engine/check.js';
import type { D20CheckResult } from '../engine/check.js';
import type { MinArchiveHeader } from '../engine/archive.js';
import type {
  转移OptionSchema, 缔结OptionSchema, 解除OptionSchema, 赋予OptionSchema, 剥夺OptionSchema,
  调整OptionSchema, 披露OptionSchema, 移动OptionSchema, 施加OptionSchema, 植入OptionSchema,
  不可逆Schema, 组织属性轴条目Schema, 属性轴表Schema,
} from '@ai-life-sim/core';

// 同 packages/core/tests/stubs.test.ts 同款类型断言工具（按 keyof 排除取代逐字段判断）：
// 自包含小工具，非业务逻辑第二实现，刻意不跨包导入私有类型。
type _Expect<T extends true> = T;
type _NoForbiddenKeys<Target, Forbidden extends string> =
  Extract<Forbidden, keyof Target> extends never ? true : false;

// Step 6.5 任务 B：禁字段集自动从 verb.ts/org.ts/preset.ts 导出 schema 联合 keyof 推导，
// 与 packages/core/tests/stubs.test.ts 同一套派生方式（理由/残留手列项见该文件注释）。
type 动词Option自动Key =
  | keyof NonNullable<z.infer<typeof 转移OptionSchema>>
  | keyof NonNullable<z.infer<typeof 缔结OptionSchema>>
  | keyof NonNullable<z.infer<typeof 解除OptionSchema>>
  | keyof NonNullable<z.infer<typeof 赋予OptionSchema>>
  | keyof NonNullable<z.infer<typeof 剥夺OptionSchema>>
  | keyof NonNullable<z.infer<typeof 调整OptionSchema>>
  | keyof NonNullable<z.infer<typeof 披露OptionSchema>>
  | keyof NonNullable<z.infer<typeof 移动OptionSchema>>
  | keyof NonNullable<z.infer<typeof 施加OptionSchema>>
  | keyof NonNullable<z.infer<typeof 植入OptionSchema>>;
type 不可逆内部自动Key = keyof z.infer<typeof 不可逆Schema>;
type 属性轴Cascade自动Key =
  | keyof z.infer<typeof 组织属性轴条目Schema>
  | keyof z.infer<typeof 属性轴表Schema>[number];
type 手列残留Key = '不可逆' | '子类键'; // 理由同 stubs.test.ts：self-reference 无意义 / actor.ts 未 export
type VerbTableForbiddenKey = 动词Option自动Key | 不可逆内部自动Key | 属性轴Cascade自动Key | 手列残留Key;

type AssertConservationRecord = Parameters<typeof assertConservation>[0][number];
type AssertNetZeroRecord      = Parameters<typeof assertNetZero>[0][number];

describe('Task 4E (slice): 动词表/植入字段 TS 编译期隔离（记账/检定/结算入参 结构上不含）', () => {
  // ── ① 记账：Transfer（提案入参）/ FlowRecord（落账产出）────────────────────────
  it('Transfer 不含任一动词表字段', () => {
    type Assert = _Expect<_NoForbiddenKeys<Transfer, VerbTableForbiddenKey>>;
    const _: Assert = true;
    expect(_).toBe(true);
  });
  it('FlowRecord 不含任一动词表字段', () => {
    type Assert = _Expect<_NoForbiddenKeys<FlowRecord, VerbTableForbiddenKey>>;
    const _: Assert = true;
    expect(_).toBe(true);
  });

  // ── ② 检定：CheckIntent（记账 LLM 检定意图·叙事 LLM 不碰）────────────────────────
  it('CheckIntent 不含任一动词表字段', () => {
    type Assert = _Expect<_NoForbiddenKeys<CheckIntent, VerbTableForbiddenKey>>;
    const _: Assert = true;
    expect(_).toBe(true);
  });

  // ── ③ 结算：assertConservation / assertNetZero 入参（守恒断言·签名冻结）──────────
  it('assertConservation 入参不含任一动词表字段', () => {
    type Assert = _Expect<_NoForbiddenKeys<AssertConservationRecord, VerbTableForbiddenKey>>;
    const _: Assert = true;
    expect(_).toBe(true);
  });
  it('assertNetZero 入参不含任一动词表字段', () => {
    type Assert = _Expect<_NoForbiddenKeys<AssertNetZeroRecord, VerbTableForbiddenKey>>;
    const _: Assert = true;
    expect(_).toBe(true);
  });
  it('assertConservation/assertNetZero 签名冻结（未本批引入新参数形状）', () => {
    expectTypeOf(assertConservation).parameters.toEqualTypeOf<[AssertConservationRecord[]]>();
    expectTypeOf(assertNetZero).parameters.toEqualTypeOf<[AssertNetZeroRecord[]]>();
  });

  // ── ④ 植入专项（§六 DoD）：植入OptionSchema 字段够不到①②③任一入参/产出类型 ──────
  it('植入OptionSchema 字段 与 Transfer/FlowRecord/CheckIntent 字段名零交集', () => {
    type 植入OptionKey = keyof NonNullable<z.infer<typeof 植入OptionSchema>>;
    type A1 = _Expect<_NoForbiddenKeys<Transfer, 植入OptionKey>>;
    type A2 = _Expect<_NoForbiddenKeys<FlowRecord, 植入OptionKey>>;
    type A3 = _Expect<_NoForbiddenKeys<CheckIntent, 植入OptionKey>>;
    const a: A1 = true, b: A2 = true, c: A3 = true;
    expect(a).toBe(true);
    expect(b).toBe(true);
    expect(c).toBe(true);
  });
  it('植入OptionSchema 字段 与 assertConservation/assertNetZero 入参字段名零交集', () => {
    type 植入OptionKey = keyof NonNullable<z.infer<typeof 植入OptionSchema>>;
    type A1 = _Expect<_NoForbiddenKeys<AssertConservationRecord, 植入OptionKey>>;
    type A2 = _Expect<_NoForbiddenKeys<AssertNetZeroRecord, 植入OptionKey>>;
    const a: A1 = true, b: A2 = true;
    expect(a).toBe(true);
    expect(b).toBe(true);
  });
  it('不可逆Schema 字段（解除通道/重掷策略） 与 ①②③ 全部入参字段名零交集', () => {
    type 不可逆Key = keyof z.infer<typeof 不可逆Schema>;
    type A1 = _Expect<_NoForbiddenKeys<Transfer, 不可逆Key>>;
    type A2 = _Expect<_NoForbiddenKeys<FlowRecord, 不可逆Key>>;
    type A3 = _Expect<_NoForbiddenKeys<CheckIntent, 不可逆Key>>;
    type A4 = _Expect<_NoForbiddenKeys<AssertConservationRecord, 不可逆Key>>;
    type A5 = _Expect<_NoForbiddenKeys<AssertNetZeroRecord, 不可逆Key>>;
    const a: A1 = true, b: A2 = true, c: A3 = true, d: A4 = true, e: A5 = true;
    expect(a).toBe(true);
    expect(b).toBe(true);
    expect(c).toBe(true);
    expect(d).toBe(true);
    expect(e).toBe(true);
  });
});

// ── Task 4E 任务 A1：hosts/slice/engine/check.ts（实战检定活路径）同款断言 ──────────
// 与 packages/core 那份对称：runD20Check 入参/出参全是标量 + MinArchiveHeader（无结构化
// 判定输入对象，故没有 CheckInput 同构类型），逐一确认两个结构化类型（D20CheckResult 出参 /
// MinArchiveHeader 入参）均不含动词表字段，外加签名冻结防未来悄悄塞进结构化负载。
describe('Task 4E (slice 活路径): hosts/slice/engine/check.ts 检定类型 TS 编译期隔离', () => {
  it('D20CheckResult 不含任一动词表字段', () => {
    type Assert = _Expect<_NoForbiddenKeys<D20CheckResult, VerbTableForbiddenKey>>;
    const _: Assert = true;
    expect(_).toBe(true);
  });
  it('MinArchiveHeader 不含任一动词表字段', () => {
    type Assert = _Expect<_NoForbiddenKeys<MinArchiveHeader, VerbTableForbiddenKey>>;
    const _: Assert = true;
    expect(_).toBe(true);
  });
  it('植入OptionSchema/不可逆Schema 字段 与 D20CheckResult/MinArchiveHeader 字段名零交集', () => {
    type 植入OptionKey = keyof NonNullable<z.infer<typeof 植入OptionSchema>>;
    type 不可逆Key = keyof z.infer<typeof 不可逆Schema>;
    type A1 = _Expect<_NoForbiddenKeys<D20CheckResult, 植入OptionKey | 不可逆Key>>;
    type A2 = _Expect<_NoForbiddenKeys<MinArchiveHeader, 植入OptionKey | 不可逆Key>>;
    const a: A1 = true, b: A2 = true;
    expect(a).toBe(true);
    expect(b).toBe(true);
  });
  it('runD20Check 签名冻结（未本批引入新参数形状·全标量+MinArchiveHeader）', () => {
    expectTypeOf(runD20Check).parameters.toEqualTypeOf<
      [number, number, string, number, number, MinArchiveHeader]
    >();
    expectTypeOf(runD20Check).returns.toEqualTypeOf<D20CheckResult>();
  });
});
