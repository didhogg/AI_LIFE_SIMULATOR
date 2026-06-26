// PR-瘦身·工具库 · additive · dormant · 进内容哈希 · 不进 hashJudgmentBundle
// schemaKeys 守恒 52：工具库属装配层·不进 RootSchema
// 能力核：llm/code/roll_dice/json_schema/trigger/output_tag 按 工具ID 解
// 纯 schema + 类型·无副作用·禁 Date.now / new Date / Math.random / window / document
import { z } from 'zod';
import { 谓词串Schema } from './commonEntry.js';

const 工具ID正则 = /^[a-z][a-z0-9_]*$/;

// ── [TOOL] 能力类型枚举（从 lore.ts 迁入·唯一权威·R6-a～R6-d）──────────────────────
// 入指纹排除名单：能力集元数据属叙事/路由层，不影响判定面（R7-b 叙事注入路径）
export const TOOL_能力类型 = [
  'code',        // DSL·声明式非图灵完备；禁任意 JS（R6-a）
  'llm',         // LLM 子调用；纳预算闸 + 调用世代号 AA1（R6-b）
  'roll_dice',   // 骰点；爆炸骰走 rngFor 变长消耗确定性（R6-c）
  'json_schema', // 输出形状校验约束
  'trigger',     // 事件触发；planning/post_pipeline 两段时机（R6-d）
  'output_tag',  // 自定义变量输出；命名空间化 + 过五道闸前缀权限（R10-b）
] as const;

export type TOOL_能力类型Type = (typeof TOOL_能力类型)[number];

// ── [TOOL] 能力条目（单条能力声明·供工具条目.能力字段嵌入）────────────────────────
export const TOOL_能力条目Schema = z.object({
  类型: z.enum(TOOL_能力类型),
  // output_tag 专属：命名空间字段（入指纹排除名单·S/K 批治理·禁写 $ 层·R10-b）
  输出命名空间: z.string().optional(),
  参数描述: z.string().optional(), // 人读描述·不参与判定
});

export type TOOL_能力条目Type = z.infer<typeof TOOL_能力条目Schema>;

// ── 工具条目 ── 四层：信封 + 能力核 + 事实补充 + 认知 opaque ──────────────────────
// ① 信封 typed（resolve 三层校验 + json_schema 闸可跑）
// ② 能力核：明确 能力 字段（单条 TOOL_能力条目）
// ③ 事实补充（typed seam·消费者留 P0-x）：调用约束/触发时机/需预算/输出契约
// ④ 认知 opaque：实现载荷 z.record(z.string(), z.unknown())·引擎零解释·不进指纹
export const 工具条目Schema = z.object({
  // ① 信封（typed·供 resolve/导入校验·非判定）
  名称: z.string(),
  版本: z.string().optional(),
  作者: z.string().optional(),
  描述: z.string().optional(),
  内容哈希: z.string().optional(),  // mod 可复现面·进内容包哈希（computeEffectPackHash）

  // ② 能力核（单条·每个工具条目对应一种能力类型）
  能力: TOOL_能力条目Schema,

  // ③ 事实补充（typed seam·R6-d 约束·消费者留 P0-x·引擎当前零解释）
  调用约束: 谓词串Schema.optional(),                         // DSL gate·前置谓词·R6-a
  触发时机: z.enum(['planning', 'post_pipeline']).optional(), // R6-d 两段时机
  需预算: z.boolean().optional(),                            // llm·token 预算闸·执行在 host 侧
  输出契约: z.string().optional(),                           // json_schema 形状描述

  // ④ 认知 opaque（引擎零解释·不进指纹·守作者自由）
  实现载荷: z.record(z.string(), z.unknown()).optional(),    // code→DSL串 / llm→prompt
});

// ── 工具库 = record<工具ID, 工具条目>.default({}) ──────────────────────────────────
export const 工具库Schema = z.record(
  z.string().regex(工具ID正则, { message: '工具ID 须为蛇形 /^[a-z][a-z0-9_]*$/' }),
  工具条目Schema,
).default({});

// ── 工具引用Schema（唯一权威·供 lore/下游 use-site 复用）──────────────────────────
// 工具ID → 工具库 key；命名空间覆盖? = use-site 覆盖该工具 output_tag 的 输出命名空间
// 不填 → 用工具定义里的 输出命名空间（R10-b）
// 覆盖值受 $ 前缀权限/五道闸③约束（运行期校验留 P0-x·本轮仅 schema）
export const 工具引用Schema = z.object({
  工具ID: z.string(),
  命名空间覆盖: z.string().optional(),
});

export type 工具条目Type = z.infer<typeof 工具条目Schema>;
export type 工具库Type = z.infer<typeof 工具库Schema>;
export type 工具引用Type = z.infer<typeof 工具引用Schema>;

// 导出正则供测试/导入闸复用
export { 工具ID正则 };
