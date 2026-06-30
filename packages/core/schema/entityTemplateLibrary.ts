// PR-瘦身·实体模板库 · additive · dormant · 进内容哈希 · 不进 hashJudgmentBundle
// schemaKeys 守恒 52：实体模板库属装配层·不进 RootSchema
// 定义层（作者声明）⊥ preset.实体模板库（旧轨 z.object·暂留·双轨剥离再迁移）
// ⚠ 不携带 物品模板 → 物品库(itemLibrary)为唯一权威·旧黑洞双轨期保留不删
// 命名避撞：preset.ts 已有 实体模板库Schema(z.object)·本文件冰箱为 by-ID record
// 纯 schema + 类型·无副作用·禁 Date.now / new Date / Math.random / window / document
import { z } from 'zod';

export const 实体模板ID正则 = /^[a-z][a-z0-9_]*$/;

// ── 实体模板定义条目 ── 三层：信封 + 黑洞面（NPC/组织 opaque·待 P0-7+ 补全）────────
// ① 信封 typed（resolve 三层校验 + content_hash 可复现面）
// ② 黑洞面·opaque（NPC模板/组织模板 结构待 P0-7+ 补全·与 preset 旧黑洞一致）
//    物品模板不包含 → 物品库为唯一权威（itemLibrary.ts）
//    dormant·不进 hashJudgmentBundle·整库 0 重定基
export const 实体模板定义条目Schema = z.object({
  // ① 信封
  名称: z.string(),
  版本: z.string().optional(),
  作者: z.string().optional(),
  描述: z.string().optional(),
  内容哈希: z.string().optional(),    // mod 可复现面·进内容包哈希（computeEffectPackHash）

  // ② 黑洞面（opaque·待 P0-7+ 补全结构·不强校验·与 preset.实体模板库 黑洞形态一致）
  NPC模板:   z.array(z.unknown()).optional(),
  组织模板:  z.array(z.unknown()).optional(),
  // 物品模板：不携带·物品库为唯一权威（itemLibrary.ts·81edfc7）
});

// ── 实体模板库（冰箱）= record<实体模板ID, 实体模板定义条目>.default({}) ────────────
export const 实体模板冰箱Schema = z.record(
  z.string().regex(实体模板ID正则, { message: '实体模板ID 须为蛇形 /^[a-z][a-z0-9_]*$/' }),
  实体模板定义条目Schema,
).default({});

export type 实体模板定义条目Type = z.infer<typeof 实体模板定义条目Schema>;
export type 实体模板冰箱Type     = z.infer<typeof 实体模板冰箱Schema>;
