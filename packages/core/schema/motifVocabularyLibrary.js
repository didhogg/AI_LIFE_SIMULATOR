// PR-瘦身·母题词汇库 · additive · dormant · 进内容哈希 · 不进 hashJudgmentBundle
// schemaKeys 守恒 52：母题词汇库属装配层·不进 RootSchema
//    dormant·不进 hashJudgmentBundle·整库 0 重定基
// 对应旧 preset.ts 母题词汇表Schema（FINGERPRINT_EXCLUDED_FIELDS 已列）
// 纯 schema + 类型·无副作用·禁 Date.now / new Date / Math.random / window / document
import { z } from 'zod';
export const 母题词汇ID正则 = /^[a-z][a-z0-9_]*$/;
// ── 母题词汇定义条目 = 信封 + 词汇数据体（对齐 preset.ts 母题词汇表Schema value） ──────
export const 母题词汇定义条目Schema = z.object({
    // 信封
    名称: z.string(),
    版本: z.string().optional(),
    描述: z.string().optional(),
    内容哈希: z.string().optional(),
    // 词汇数据体（dormant·不进 hashJudgmentBundle·叙事主题词汇扩充）
    词条: z.array(z.string()).default([]),
    调味提示词: z.string().optional(),
});
// ── 母题词汇库 = record<母题词汇ID, 母题词汇定义条目>.default({}) ────────────────────────
export const 母题词汇库Schema = z.record(z.string().regex(母题词汇ID正则, { message: '母题词汇ID 须为蛇形 /^[a-z][a-z0-9_]*$/' }), 母题词汇定义条目Schema).default({});
