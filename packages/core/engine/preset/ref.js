// PR-瘦身-指针-0 · 泛型精准引用原语（additive · dormant · 无生产消费者）
// 基于 受治理句柄Schema + 命名空间枚举 派生 Ref<N> 类型 + 惰性解引用解析器
// dormant: 不接 runTick · 不进 resolve 生产路径 · 不进 hashPresetFingerprint
// 纯函数 · 无副作用 · 禁 Date.now / new Date / Math.random / window / document
import { z } from 'zod';
import { 受治理句柄Schema, 命名空间枚举 } from '../../schema/governedKeySpace.js';
import { 冰箱绑定表 } from './refBinding.js';
export { 冰箱绑定表 };
// ── 引用Schema(命名空间) 工厂 ──────────────────────────────────────────────────
// 输入：裸 handle 字符串；输出：Ref<N> 对象
// 复用 受治理句柄Schema 校验逻辑·禁复制正则/校验实现
// 非法命名空间：schema 创建时 throw（TypeScript 类型守卫 + JS 调用方运行时防护）
export function 引用Schema(ns) {
    // 运行时防护（TypeScript 已覆盖·额外防护 JS 调用方）
    if (!命名空间枚举.includes(ns)) {
        throw new Error(`引用Schema: 非法命名空间「${String(ns)}」·必须 ∈ 命名空间枚举`);
    }
    return z.string()
        .superRefine((raw, ctx) => {
        // 委托 受治理句柄Schema 做格式校验·不重写正则
        const result = 受治理句柄Schema.safeParse(raw);
        if (!result.success) {
            for (const issue of result.error.issues) {
                ctx.addIssue(issue);
            }
        }
    })
        .transform(handle => ({ __ns: ns, handle }))
        .describe(`Ref<${ns}>`);
}
// ── 创建引用 — 类型安全的 Ref<N> 构造器 ──────────────────────────────────────
// TypeScript 侧 ns 必须 ∈ 命名空间枚举；运行时校验 handle 格式
export function 创建引用(ns, handle) {
    if (!命名空间枚举.includes(ns)) {
        throw new Error(`创建引用: 非法命名空间「${String(ns)}」·必须 ∈ 命名空间枚举`);
    }
    const result = 受治理句柄Schema.safeParse(handle);
    if (!result.success) {
        throw new Error(`创建引用<${ns}>: 无效句柄「${handle}」: ${result.error.message}`);
    }
    return { __ns: ns, handle };
}
// ── 解引用 — 惰性精准解析器 ────────────────────────────────────────────────────
// 按 ref.__ns 查冰箱绑定表 → 查 成品[解析器键][ref.handle] → 返条目或 null
//
// AA3 语义：未命中（含冰箱待建/冰箱缺失/条目缺失）默认返 null·不静默丢弃
//   strict=true 时抛出具体诊断信息
//
// 惰性设计铁律：
//   · 只读 against 已解析成品·不触发新 resolve·不修改任何状态
//   · 无递归解析·单步 record 查找·允许引用图成环（与装载图 computeLoadOrder 正交）
//
// TODO(P0-6): member-gate 成员级存在性校验（当前 fail-open·与 governedKeySpace 现状一致）
export function 解引用(ref, 成品, opts = {}) {
    const binding = 冰箱绑定表[ref.__ns];
    // 冰箱待建（解析器键 = undefined）
    if (binding === undefined || binding.解析器键 === undefined) {
        if (opts.strict) {
            throw new Error(`解引用: 命名空间「${ref.__ns}」冰箱待建·无法解析` +
                (binding?.描述 ? `（hint: ${binding.描述}）` : ''));
        }
        return null;
    }
    const fridge = 成品[binding.解析器键];
    // 冰箱不在成品中（可能为 null/undefined/非对象）
    if (fridge == null || typeof fridge !== 'object') {
        if (opts.strict) {
            throw new Error(`解引用: 冰箱「${binding.解析器键}」不在成品中`);
        }
        return null;
    }
    // 按 handle 查冰箱条目
    const entry = fridge[ref.handle];
    if (entry === undefined) {
        if (opts.strict) {
            throw new Error(`解引用: 冰箱「${binding.解析器键}」无条目「${ref.handle}」`);
        }
        return null;
    }
    return entry;
}
