// PR-瘦身·战术包库 · additive · dormant · 进内容哈希 · 不进 hashJudgmentBundle
// schemaKeys 守恒 52：战术包库属装配层·不进 RootSchema
//    dormant·不进 hashJudgmentBundle·整库 0 重定基
// 纯 schema + 类型·无副作用·禁 Date.now / new Date / Math.random / window / document
import { z } from 'zod';

export const 战术包ID正则 = /^[a-z][a-z0-9_]*$/;

// ── 战术包定义条目 = 信封 + 战术数据体（对齐 preset.ts 战术条目Schema） ─────────────────
export const 战术包定义条目Schema = z.object({
  // 信封
  名称: z.string(),
  版本: z.string().optional(),
  作者: z.string().optional(),
  描述: z.string().optional(),
  内容哈希: z.string().optional(),
  // 战术数据体（dormant·不进 hashJudgmentBundle）
  前置: z.object({
    地形: z.array(z.string()).default([]),
    兵种: z.array(z.string()).default([]),
    情报阈值: z.number().min(0).max(100).default(0),
  }).default({}),
  修正包: z.record(z.string(), z.number()).default({}),
  风险: z.string().default(''),
  母题标签: z.array(z.string()).default([]),
});

// ── 战术包库 = record<战术包ID, 战术包定义条目>.default({}) ───────────────────────────
export const 战术包库Schema = z.record(
  z.string().regex(战术包ID正则, { message: '战术包ID 须为蛇形 /^[a-z][a-z0-9_]*$/' }),
  战术包定义条目Schema,
).default({});

export type 战术包定义条目Type = z.infer<typeof 战术包定义条目Schema>;
export type 战术包库Type       = z.infer<typeof 战术包库Schema>;
