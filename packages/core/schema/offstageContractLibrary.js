// PR-瘦身·离场演化契约库 · additive · dormant · 进内容哈希 · 不进 hashJudgmentBundle
// schemaKeys 守恒 52：离场演化契约库属装配层·不进 RootSchema
//    dormant·不进 hashJudgmentBundle·整库 0 重定基
// 对应旧 preset.ts 离场演化契约出厂模板（z.record(string, z.unknown()).optional()）
// P2 consumer offstageSettler 待建·当前契约载荷 opaque（z.unknown）
// 纯 schema + 类型·无副作用·禁 Date.now / new Date / Math.random / window / document
import { z } from 'zod';
export const 离场演化契约ID正则 = /^[a-z][a-z0-9_]*$/;
// ── 离场演化契约定义条目 = 信封 + 契约载荷（opaque·P2 offstageSettler 待建） ────────────
export const 离场演化契约定义条目Schema = z.object({
    // 信封
    名称: z.string(),
    版本: z.string().optional(),
    作者: z.string().optional(),
    描述: z.string().optional(),
    内容哈希: z.string().optional(),
    // 契约载荷（opaque·类比 actor.ts 离场演化契约Schema·P2 consumer 待建·勿接线）
    契约载荷: z.record(z.string(), z.unknown()).optional(),
});
// ── 离场演化契约库 = record<离场演化契约ID, 离场演化契约定义条目>.default({}) ─────────────
export const 离场演化契约库Schema = z.record(z.string().regex(离场演化契约ID正则, { message: '离场演化契约ID 须为蛇形 /^[a-z][a-z0-9_]*$/' }), 离场演化契约定义条目Schema).default({});
