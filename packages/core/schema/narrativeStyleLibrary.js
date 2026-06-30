// PR-瘦身·文风库 · additive · dormant · 进内容哈希 · 不进 hashJudgmentBundle
// schemaKeys 守恒 52：文风库属装配层·不进 RootSchema
// 定义层（作者声明·渲染面）⊥ preset.文风库（旧轨 z.array·暂留·双轨剥离再迁移）
// 命名避撞：preset.ts 已有 文风条目Schema·本文件用 文风定义条目Schema 区分
// 分类：渲染·认知层 → 渲染载荷 opaque（仿 UI库/媒体库）
// 纯 schema + 类型·无副作用·禁 Date.now / new Date / Math.random / window / document
import { z } from 'zod';
export const 文风ID正则 = /^[a-z][a-z0-9_]*$/;
// ── 文风定义条目 ── 三层：信封 + 渲染面（opaque·认知层·引擎零解释）──────────────────
// ① 信封 typed（resolve 三层校验 + content_hash 可复现面）
// ② 渲染面·认知 opaque（容纳 风格提示词/禁词表引用/版式/开关 等；
//    注入面防护 max 4000 留双轨剥离 reader 侧·本库 opaque 不强校验·与 UI库/媒体库一致）
//    dormant·不进 hashJudgmentBundle·整库 0 重定基
export const 文风定义条目Schema = z.object({
    // ① 信封
    名称: z.string(),
    版本: z.string().optional(),
    作者: z.string().optional(),
    描述: z.string().optional(),
    内容哈希: z.string().optional(), // mod 可复现面·进内容包哈希（computeEffectPackHash）
    // ② 渲染面·认知 opaque（引擎零解释·不进指纹·守作者内容自由）
    渲染载荷: z.record(z.string(), z.unknown()).optional(),
});
// ── 文风库 = record<文风ID, 文风定义条目>.default({}) ────────────────────────────
export const 文风冰箱Schema = z.record(z.string().regex(文风ID正则, { message: '文风ID 须为蛇形 /^[a-z][a-z0-9_]*$/' }), 文风定义条目Schema).default({});
