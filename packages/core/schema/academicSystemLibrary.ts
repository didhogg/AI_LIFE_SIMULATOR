// PR-瘦身·学业制式库 · additive · dormant · 进内容哈希 · 不进 hashJudgmentBundle
// schemaKeys 守恒 52：学业制式库属装配层·不进 RootSchema
// 定义层（作者声明）⊥ preset.学业制式库（旧轨·暂留·双轨剥离再迁移）
// 命名避撞：preset.ts 已有 学业制式条目Schema·本文件用 学业制式定义条目Schema 区分
// 纯 schema + 类型·无副作用·禁 Date.now / new Date / Math.random / window / document
import { z } from 'zod';

export const 学业制式ID正则 = /^[a-z][a-z0-9_]*$/;

// ── 学业制式定义条目 ── 三层：信封 + 学制事实层（typed·照搬 preset.学业制式条目）──────
// ① 信封 typed（resolve 三层校验 + content_hash 可复现面）
// ② 学制事实层（照搬 preset.学业制式条目Schema·剥 default·全 optional·去枚举）
//    dormant·不进 hashJudgmentBundle·整库 0 重定基
export const 学业制式定义条目Schema = z.object({
  // ① 信封
  名称: z.string(),
  版本: z.string().optional(),
  作者: z.string().optional(),
  描述: z.string().optional(),
  内容哈希: z.string().optional(),    // mod 可复现面·进内容包哈希（computeEffectPackHash）

  // ② 学制事实层（对齐 preset.学业制式条目·剥 default·optional）
  阶段名: z.string().optional(),
  时长分钟: z.number().int().min(0).optional(),
  前置条件: z.array(z.string()).optional(),
  解锁技能: z.array(z.string()).optional(),
  考核检定: z.string().optional(),
});

// ── 学业制式库 = record<学业制式ID, 学业制式定义条目>.default({}) ──────────────────
export const 学业制式库Schema = z.record(
  z.string().regex(学业制式ID正则, { message: '学业制式ID 须为蛇形 /^[a-z][a-z0-9_]*$/' }),
  学业制式定义条目Schema,
).default({});

export type 学业制式定义条目Type = z.infer<typeof 学业制式定义条目Schema>;
export type 学业制式库Type       = z.infer<typeof 学业制式库Schema>;
