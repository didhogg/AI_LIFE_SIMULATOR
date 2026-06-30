// PR-瘦身·二审维度库 · additive · dormant · 进内容哈希 · 不进 hashJudgmentBundle
// schemaKeys 守恒 52：二审维度库属装配层·不进 RootSchema
// 定义层（作者声明）⊥ preset.二审维度库（旧轨 z.array.optional·暂留·双轨剥离再迁移）
// 命名避撞：preset.ts 已有 二审维度条目Schema·本文件用 二审维度定义条目Schema 区分
// 分类：含事实层字段（检测方式/越界类型 typed enum）→ 照搬现有形状
// 纯 schema + 类型·无副作用·禁 Date.now / new Date / Math.random / window / document
import { z } from 'zod';

export const 二审维度ID正则 = /^[a-z][a-z0-9_]*$/;

// ── 二审维度定义条目 ── 三层：信封 + 维度事实层（typed·照搬 preset.二审维度条目）──────
// ① 信封 typed（resolve 三层校验 + content_hash 可复现面）
// ② 维度事实层（照搬 preset.二审维度条目Schema·剥 default·全 optional）
//    检测方式/越界类型 保留 enum（确定性约束·L-8 拍板·非开放串）
//    dormant·不进 hashJudgmentBundle·整库 0 重定基
export const 二审维度定义条目Schema = z.object({
  // ① 信封
  名称: z.string(),
  版本: z.string().optional(),
  作者: z.string().optional(),
  描述: z.string().optional(),
  内容哈希: z.string().optional(),    // mod 可复现面·进内容包哈希（computeEffectPackHash）

  // ② 维度事实层（对齐 preset.二审维度条目·剥 default·optional）
  检测方式:    z.enum(['机械', '审稿提示词']).optional(),  // L-8 拍板·保留 enum·确定性约束
  规则或提示词: z.string().optional(),
  阈值:        z.number().optional(),
  默认开:      z.boolean().optional(),
  越界类型:    z.enum(['Off-Topic', 'Cheating']).optional(),  // L-8 拍板·保留 enum
});

// ── 二审维度库 = record<二审维度ID, 二审维度定义条目>.default({}) ────────────────────
export const 二审维度库Schema = z.record(
  z.string().regex(二审维度ID正则, { message: '二审维度ID 须为蛇形 /^[a-z][a-z0-9_]*$/' }),
  二审维度定义条目Schema,
).default({});

export type 二审维度定义条目Type = z.infer<typeof 二审维度定义条目Schema>;
export type 二审维度库Type       = z.infer<typeof 二审维度库Schema>;
