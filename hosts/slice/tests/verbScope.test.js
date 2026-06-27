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
import { assertConservation, assertNetZero } from '../ledger/gate.js';
import { runD20Check } from '../engine/check.js';
describe('Task 4E (slice): 动词表/植入字段 TS 编译期隔离（记账/检定/结算入参 结构上不含）', () => {
    // ── ① 记账：Transfer（提案入参）/ FlowRecord（落账产出）────────────────────────
    it('Transfer 不含任一动词表字段', () => {
        const _ = true;
        expect(_).toBe(true);
    });
    it('FlowRecord 不含任一动词表字段', () => {
        const _ = true;
        expect(_).toBe(true);
    });
    // ── ② 检定：CheckIntent（记账 LLM 检定意图·叙事 LLM 不碰）────────────────────────
    it('CheckIntent 不含任一动词表字段', () => {
        const _ = true;
        expect(_).toBe(true);
    });
    // ── ③ 结算：assertConservation / assertNetZero 入参（守恒断言·签名冻结）──────────
    it('assertConservation 入参不含任一动词表字段', () => {
        const _ = true;
        expect(_).toBe(true);
    });
    it('assertNetZero 入参不含任一动词表字段', () => {
        const _ = true;
        expect(_).toBe(true);
    });
    it('assertConservation/assertNetZero 签名冻结（未本批引入新参数形状）', () => {
        expectTypeOf(assertConservation).parameters.toEqualTypeOf();
        expectTypeOf(assertNetZero).parameters.toEqualTypeOf();
    });
    // ── ④ 植入专项（§六 DoD）：植入OptionSchema 字段够不到①②③任一入参/产出类型 ──────
    it('植入OptionSchema 字段 与 Transfer/FlowRecord/CheckIntent 字段名零交集', () => {
        const a = true, b = true, c = true;
        expect(a).toBe(true);
        expect(b).toBe(true);
        expect(c).toBe(true);
    });
    it('植入OptionSchema 字段 与 assertConservation/assertNetZero 入参字段名零交集', () => {
        const a = true, b = true;
        expect(a).toBe(true);
        expect(b).toBe(true);
    });
    it('不可逆Schema 字段（解除通道/重掷策略） 与 ①②③ 全部入参字段名零交集', () => {
        const a = true, b = true, c = true, d = true, e = true;
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
        const _ = true;
        expect(_).toBe(true);
    });
    it('MinArchiveHeader 不含任一动词表字段', () => {
        const _ = true;
        expect(_).toBe(true);
    });
    it('植入OptionSchema/不可逆Schema 字段 与 D20CheckResult/MinArchiveHeader 字段名零交集', () => {
        const a = true, b = true;
        expect(a).toBe(true);
        expect(b).toBe(true);
    });
    it('runD20Check 签名冻结（未本批引入新参数形状·全标量+MinArchiveHeader）', () => {
        expectTypeOf(runD20Check).parameters.toEqualTypeOf();
        expectTypeOf(runD20Check).returns.toEqualTypeOf();
    });
});
describe('6.59 registry 键空间够不到 slice 实战记账/检定/结算（编译期断言）', () => {
    it('slice 记账 Transfer 不含 registry 键空间字段', () => {
        const _ = true;
        expect(_).toBe(true);
    });
    it('slice 记账 FlowRecord 不含 registry 键空间字段', () => {
        const _ = true;
        expect(_).toBe(true);
    });
    it('slice 检定 CheckIntent 不含 registry 键空间字段', () => {
        const _ = true;
        expect(_).toBe(true);
    });
    it('结算 assertConservation 入参元素 不含 registry 键空间字段', () => {
        const _ = true;
        expect(_).toBe(true);
    });
});
describe('批③ content_hash ⊥ slice 实战核心调用（编译期断言）', () => {
    it('slice 记账 Transfer 不含 content_hash 键', () => {
        const _ = true;
        expect(_).toBe(true);
    });
    it('slice 记账 FlowRecord 不含 content_hash 键', () => {
        const _ = true;
        expect(_).toBe(true);
    });
    it('slice 检定 CheckIntent 不含 content_hash 键', () => {
        const _ = true;
        expect(_).toBe(true);
    });
});
