// PR-瘦身·小剧场剧本库 · additive · dormant · 进内容哈希 · 不进 hashJudgmentBundle
// schemaKeys 守恒 52：小剧场剧本库属装配层·不进 RootSchema
// 定义层（作者声明·渲染面）⊥ preset.小剧场剧本库（旧轨 z.array.optional·暂留·双轨剥离再迁移）
// 命名避撞：preset.ts 已有 小剧场剧本条目Schema·本文件用 小剧场剧本定义条目Schema 区分
// 分类：渲染·认知层 → 渲染载荷 opaque（仿 UI库/媒体库/文风库）
// 纯 schema + 类型·无副作用·禁 Date.now / new Date / Math.random / window / document
import { z } from 'zod';

export const 小剧场剧本ID正则 = /^[a-z][a-z0-9_]*$/;

// ── 小剧场剧本定义条目 ── 三层：信封 + 渲染面（opaque·认知层·引擎零解释）──────────
// ① 信封 typed（resolve 三层校验 + content_hash 可复现面）
// ② 渲染面·认知 opaque（容纳 图标/分类/提示词/读历史默认/输出格式 等；
//    引擎零解释·不进指纹·与 文风库 一致）
//    dormant·不进 hashJudgmentBundle·整库 0 重定基
export const 小剧场剧本定义条目Schema = z.object({
  // ① 信封
  名称: z.string(),
  版本: z.string().optional(),
  作者: z.string().optional(),
  描述: z.string().optional(),
  内容哈希: z.string().optional(),    // mod 可复现面·进内容包哈希（computeEffectPackHash）

  // ② 渲染面·认知 opaque（引擎零解释·不进指纹·守作者内容自由）
  渲染载荷: z.record(z.string(), z.unknown()).optional(),
});

// ── 小剧场剧本库 = record<小剧场剧本ID, 小剧场剧本定义条目>.default({}) ─────────────
export const 小剧场剧本库Schema = z.record(
  z.string().regex(小剧场剧本ID正则, { message: '小剧场剧本ID 须为蛇形 /^[a-z][a-z0-9_]*$/' }),
  小剧场剧本定义条目Schema,
).default({});

export type 小剧场剧本定义条目Type = z.infer<typeof 小剧场剧本定义条目Schema>;
export type 小剧场剧本库Type       = z.infer<typeof 小剧场剧本库Schema>;
