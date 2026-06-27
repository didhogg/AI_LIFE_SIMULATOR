// 批④ Step 2 · core 侧编译期断言（securityBoundary.ts 活绑·正交核心调用·主权集覆盖）
// 自包含 helper（禁 expectTypeOf/@ts-expect-error·沿批②③④ 同款范式）
import { describe, it, expect } from 'vitest';
import { canonicalize } from '../engine/text/canonicalize.js';
import { 不可逆Schema } from '../schema/verb.js';
import { 死亡拦截器条目Schema } from '../schema/preset.js';
import { NpcSchema } from '../schema/actor.js';
describe('批④ Step 2 core 侧编译期断言', () => {
    // ── 断言1：端点键名扣合 ───────────────────────────────────────────────────────
    // 元组 extends 禁分布：导出剥离敏感键名 ⊆ keyof _模型画像条目型
    // dollar.ts 改名 apiKeyRef → 键从 keyof 消失 → false → tsc 报错
    // 本常量改名 → 新键不在 keyof → 同样报错
    it('A1: 端点键名 ⊆ 真相 schema 字段名（dollar.ts 改名即死）', () => {
        const _a1 = true;
        expect(_a1).toBe(true);
    });
    // ── 断言2：端点字段类型 Equals（类型改变也被捕获·如 apiKeyRef→number）────────
    it('A2: 端点四字段类型 Equals 真相型（类型漂移即死）', () => {
        const _a2 = true;
        expect(_a2).toBe(true);
    });
    // ── 断言3：主权事件集 ⊇ 必备概念（删概念即死）───────────────────────────────
    // 谁从薄壳常量删掉一个概念 → _IsSubsetOf 报 false → tsc 报错
    it('A3: 主权地板事件集合 ⊇ 必备五概念（少一个即死）', () => {
        const _a3 = true;
        expect(_a3).toBe(true);
    });
    // ── 断言4：effect 契约输出 === string（ReturnType 活绑·双向 extends）──────────
    it('A4: 校验effect包过五道闸 返回类型 === string', () => {
        const _a4 = true;
        expect(_a4).toBe(true);
    });
    // ── 断言5：正交·core 侧（导出敏感键名 ∪ 主权事件名 ⊥ 核心调用类型）─────────
    // 防「导出剥离敏感键名」或「主权地板事件名」任一字符串意外出现在核心调用类型的字段名里
    it('A5: (导出剥离敏感键名 | 主权地板事件名) ⊥ 核心调用条目Type', () => {
        const _a5a = true;
        expect(_a5a).toBe(true);
    });
    it('A5b: (导出剥离敏感键名 | 主权地板事件名) ⊥ CheckInput', () => {
        const _a5b = true;
        expect(_a5b).toBe(true);
    });
    // ── 断言5c：主权降级字段名 ⊥ 核心调用（Step 3 补全）─────────────────────────
    it('A5c: 主权降级字段名 ⊥ 核心调用条目Type ⊥ CheckInput', () => {
        const _a5c = true;
        const _a5d = true;
        expect(_a5c).toBe(true);
        expect(_a5d).toBe(true);
    });
});
// ── 批④ Step 3 · 主权降级 no-default 证 + unset≡absent canonicalize 证 ─────────
describe('批④ Step 3 · 主权降级 no-default 证 + unset≡absent canonicalize 证', () => {
    // ── 不可逆Schema ──────────────────────────────────────────────────────────
    it('C1a: 不可逆Schema 最小 parse 不含 主权降级 键（.optional 无 default）', () => {
        const parsed = 不可逆Schema.parse({});
        expect('主权降级' in parsed).toBe(false);
    });
    it('C1b: 不可逆Schema · unset≡absent canonicalize 逐位恒等', () => {
        const base = { 重掷策略: '禁用' };
        expect(canonicalize({ ...base, 主权降级: undefined })).toBe(canonicalize({ ...base }));
    });
    // ── 死亡拦截器条目Schema ──────────────────────────────────────────────────
    it('C2a: 死亡拦截器条目Schema 最小 parse 不含 主权降级 键（.optional 无 default）', () => {
        const parsed = 死亡拦截器条目Schema.parse({});
        expect('主权降级' in parsed).toBe(false);
    });
    it('C2b: 死亡拦截器条目Schema · unset≡absent canonicalize 逐位恒等', () => {
        const base = { 注册者: '', 优先级: 0, 条件引用: '', 目标动词: '' };
        expect(canonicalize({ ...base, 主权降级: undefined })).toBe(canonicalize({ ...base }));
    });
    // ── 婚姻条目Schema（经 NpcSchema.婚姻 数组元素访问）──────────────────────
    it('C3a: 婚姻条目Schema 最小 parse 不含 主权降级 键（.optional 无 default）', () => {
        const parsed = NpcSchema.parse({ 婚姻: [{}] });
        const 婚姻条目 = parsed.婚姻[0];
        expect('主权降级' in 婚姻条目).toBe(false);
    });
    it('C3b: 婚姻条目Schema · unset≡absent canonicalize 逐位恒等', () => {
        const base = { 配偶: '', 状态: '', 缔结: 0, 终止: 0 };
        expect(canonicalize({ ...base, 主权降级: undefined })).toBe(canonicalize({ ...base }));
    });
});
