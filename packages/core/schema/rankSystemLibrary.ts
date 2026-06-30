// PR-瘦身·职级体系库 · additive · dormant · 进内容哈希 · 不进 hashJudgmentBundle
// schemaKeys 守恒 52：职级体系库属装配层·不进 RootSchema
// 定义层（作者声明）⊥ preset.职级体系库（旧轨·暂留·双轨剥离再迁移）
// 命名避撞：preset.ts 已有 职级条目Schema·本文件用 职级定义条目Schema 区分
// 纯 schema + 类型·无副作用·禁 Date.now / new Date / Math.random / window / document
import { z } from 'zod';

export const 职级体系ID正则 = /^[a-z][a-z0-9_]*$/;

// ── 职级定义条目 ── 三层：信封 + 职级事实层（typed·照搬 preset.职级条目）────────────
// ① 信封 typed（resolve 三层校验 + content_hash 可复现面）
// ② 职级事实层（照搬 preset.职级条目Schema·剥 default·全 optional·去枚举）
//    dormant·不进 hashJudgmentBundle·整库 0 重定基
export const 职级定义条目Schema = z.object({
  // ① 信封
  名称: z.string(),
  版本: z.string().optional(),
  作者: z.string().optional(),
  描述: z.string().optional(),
  内容哈希: z.string().optional(),    // mod 可复现面·进内容包哈希（computeEffectPackHash）

  // ② 职级事实层（对齐 preset.职级条目·剥 default·optional·晋升模式开放串去枚举）
  职级名: z.string().optional(),
  组织类型: z.string().optional(),
  晋升模式: z.string().optional(),    // 考核制/资历制/竞选制/战功制 仅注释示例·开放串
  前置职级: z.string().optional(),
  晋升检定: z.string().optional(),
  薪资系数: z.number().min(0).optional(),
  权限标签: z.array(z.string()).optional(),
});

// ── 职级体系库 = record<职级体系ID, 职级定义条目>.default({}) ─────────────────────
export const 职级体系库Schema = z.record(
  z.string().regex(职级体系ID正则, { message: '职级体系ID 须为蛇形 /^[a-z][a-z0-9_]*$/' }),
  职级定义条目Schema,
).default({});

export type 职级定义条目Type = z.infer<typeof 职级定义条目Schema>;
export type 职级体系库Type   = z.infer<typeof 职级体系库Schema>;
