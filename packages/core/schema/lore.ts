// Module 15 — lore 知识库（世界恒真知识层·AI 只读·随玩法预设/mod 包注入·可空零迁移）
// 口径锁定：docs/design/lore_tool_spec.md；gate/组装器实装留 P0-6/P0-8。
import { z } from 'zod';

// ══════════════════════════════════════════
// ② 别名同义词条目（进 S 批归并表·受治理键空间）
// ══════════════════════════════════════════

const lore别名条目Schema = z.object({
  别名: z.string().default(''),
  // 命名空间：S/K 批治理·导入闸校验·禁裸写无命名空间别名
  命名空间: z.string().default(''),
});

// ══════════════════════════════════════════
// [TOOL] 能力集枚举 + output_tag 命名空间
// R6-a～R6-d 约束见 docs/design/lore_tool_spec.md
// 入指纹排除名单：能力集元数据属叙事/路由层，不影响判定面（R7-b 叙事注入路径）
// ══════════════════════════════════════════

export const TOOL_能力类型 = [
  'code',        // DSL·声明式非图灵完备；禁任意 JS（R6-a）
  'llm',         // LLM 子调用；纳预算闸 + 调用世代号 AA1（R6-b）
  'roll_dice',   // 骰点；爆炸骰走 rngFor 变长消耗确定性（R6-c）
  'json_schema', // 输出形状校验约束
  'trigger',     // 事件触发；planning/post_pipeline 两段时机（R6-d）
  'output_tag',  // 自定义变量输出；命名空间化 + 过五道闸前缀权限（R10-b）
] as const;

export type TOOL_能力类型Type = (typeof TOOL_能力类型)[number];

export const TOOL_能力条目Schema = z.object({
  类型: z.enum(TOOL_能力类型),
  // output_tag 专属：命名空间字段（入指纹排除名单·S/K 批治理·禁写 $ 层·R10-b）
  输出命名空间: z.string().optional(),
  参数描述: z.string().optional(), // 人读描述·不参与判定
});

// ══════════════════════════════════════════
// ⑤ 状态转移逻辑（可选·衣物「解扣不脱」/食物「应季」/方言「默认口音」）
// ══════════════════════════════════════════

const lore状态转移条目Schema = z.object({
  触发条件: z.string().default(''), // ③ DSL 谓词（P0-6 实装求值器）
  动作描述: z.string().default(''), // 人读描述
  结果状态: z.string().default(''), // 转移后状态描述符
  工具: TOOL_能力条目Schema.optional(), // 驱动此转移的 [TOOL] 能力（可空）
});

// ══════════════════════════════════════════
// ⑥ 硬约束/禁令（可选·禁清式盘扣/禁反季食材/禁串口音）
// ══════════════════════════════════════════

const lore硬约束条目Schema = z.object({
  禁令谓词: z.string().default(''), // DSL 谓词·命中即拒（P0-6 导入闸/拍首检查）
  禁令描述: z.string().default(''), // 人读说明
  错误代码: z.string().optional(),  // 机器可读·供作者警示（R7-a）
});

// ══════════════════════════════════════════
// lore 条目（六件字段）
// ══════════════════════════════════════════

export const lore条目Schema = z.object({
  // ① 嵌套分类路径（交领>唐/明·菜系>地域·方言>语音特征）
  // 有序字符串数组；组装器/派生器按此重建分类树；不限层深
  分类路径: z.array(z.string()).default([]),

  // ② 别名同义词表（进 S 批归并表·受治理键空间）
  别名表: z.array(lore别名条目Schema).default([]),

  // ③ 触发谓词（DSL 文法·非关键词字面·走 DSL 求值器·P0-6 实装）
  // 覆盖：时代/地域/场景/在场实体/状态等多维谓词
  // ⚠️ 双轨中的「gate判定路径」输入·命中结果进指纹（TODO P0-6: 纳签名）；绝不走语义召回（R7-b）
  触发谓词: z.string().default(''),

  // ④ 知识载荷（描述性文本·供叙事读取·不进指纹·叙事注入路径·R7-b）
  // 与③正交：载荷走语义召回/叙事注入，触发谓词走确定性 DSL 求值
  知识载荷: z.string().default(''),

  // ⑤ 状态转移逻辑（可选）
  状态转移: z.array(lore状态转移条目Schema).optional(),

  // ⑥ 硬约束/禁令（可选）
  硬约束: z.array(lore硬约束条目Schema).optional(),

  // [TOOL] 能力集（此条目可使用的工具类型白名单·入指纹排除名单）
  能力集: z.array(TOOL_能力条目Schema).optional(),
});

// ══════════════════════════════════════════
// 顶层：lore 知识库
// 扁平 record·键 = 「命名空间:条目键」（如 hanfu:交领_唐制·cuisine:川菜·dialect:苏州话）
// 可空 default({})·零迁移·老档无此键时透明通过
// ══════════════════════════════════════════

export const lore知识库Schema = z.record(z.string(), lore条目Schema).default({});

export type lore条目Type = z.infer<typeof lore条目Schema>;
export type lore知识库Type = z.infer<typeof lore知识库Schema>;
export type TOOL_能力条目Type = z.infer<typeof TOOL_能力条目Schema>;
