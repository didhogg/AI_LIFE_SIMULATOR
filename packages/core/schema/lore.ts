// Module 15 — lore 知识库（世界恒真知识层·AI 只读·随玩法预设/mod 包注入·可空零迁移）
// 口径锁定：docs/design/lore_tool_spec.md；gate/组装器实装留 P0-6/P0-8。
import { z } from 'zod';
import { 导入保真度枚举 } from './preset.js';
import { 谓词串Schema } from './commonEntry.js';
import { 工具引用Schema } from './toolLibrary.js';

// ══════════════════════════════════════════
// ② 别名同义词条目（进 S 批归并表·受治理键空间）
// ══════════════════════════════════════════

const lore别名条目Schema = z.object({
  别名: z.string().default(''),
  // 命名空间：S/K 批治理·导入闸校验·禁裸写无命名空间别名
  命名空间: z.string().default(''),
});

// ══════════════════════════════════════════
// ⑤ 状态转移逻辑（可选·衣物「解扣不脱」/食物「应季」/方言「默认口音」）
// ══════════════════════════════════════════

const lore状态转移条目Schema = z.object({
  触发条件: 谓词串Schema.default(''), // ③ DSL 谓词（P0-6 实装求值器）
  动作描述: z.string().default(''), // 人读描述
  结果状态: z.string().default(''), // 转移后状态描述符
  工具: 工具引用Schema.optional(), // 驱动此转移的 [TOOL] 工具引用（工具ID→工具库·可带 命名空间覆盖）
});

// ══════════════════════════════════════════
// ⑥ 硬约束/禁令（可选·禁清式盘扣/禁反季食材/禁串口音）
// ══════════════════════════════════════════

const lore硬约束条目Schema = z.object({
  禁令谓词: 谓词串Schema.default(''), // DSL 谓词·命中即拒（P0-6 导入闸/拍首检查）
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
  触发谓词: 谓词串Schema.default(''),

  // ④ 知识载荷（描述性文本·供叙事读取·不进指纹·叙事注入路径·R7-b）
  // 与③正交：载荷走语义召回/叙事注入，触发谓词走确定性 DSL 求值
  知识载荷: z.string().default(''),

  // ⑤ 状态转移逻辑（可选）
  状态转移: z.array(lore状态转移条目Schema).optional(),

  // ⑥ 硬约束/禁令（可选）
  硬约束: z.array(lore硬约束条目Schema).optional(),

  // [TOOL] 工具引用（此条目关联的工具·工具ID→工具库·可带 命名空间覆盖·入指纹排除名单）
  工具引用: z.array(工具引用Schema).optional(),

  // D-a-lore: 谓词冻结标志（导入时 freeze·永不重算·配 L-21 纪律）
  // 冻结后谓词串聚合为 lore谓词集合 → hashJudgmentBundle → 指纹（R7-b gate判定路径）
  触发谓词_冻结: z.boolean().optional(),

  // D-a-lore: 导入保真度档落血统（compat_strict/compat_plus/native）
  // 导入时档位写血统元数据·零指纹增长（当前无确定性消费点·档本身不再影响运行）
  _导入保真度: z.enum(导入保真度枚举).optional(),

  // L-14: 历法权威表字段 — 将此条目用作时代数据源时填写（可空·additive-only·零迁移）
  // 消费分工：结构可判→P0-6 钳制闸（时代存在性校验）/ 语义判→P0-8 校验闸（L-28·时代错置语义）
  // 本批只下表·不接闸·不接时间核；时代错置校验必须查时间核，不在此自算（时间换算唯一源铁律）
  // 表本体借 lore谓词集合路径进指纹（触发谓词_冻结后聚合·R7-b gate判定路径）
  时代名: z.string().optional(),
  时代范围: z.object({
    开始年: z.number().int(),
    结束年: z.number().int().optional(),
  }).optional(),
  可用物品类别: z.array(z.string()).optional(),
  可用制度类别: z.array(z.string()).optional(),
});

// ══════════════════════════════════════════
// 顶层：lore 知识库
// 扁平 record·键 = 「命名空间:条目键」（如 hanfu:交领_唐制·cuisine:川菜·dialect:苏州话）
// 可空 default({})·零迁移·老档无此键时透明通过
// ══════════════════════════════════════════

export const lore知识库Schema = z.record(z.string(), lore条目Schema).default({});

export type lore条目Type = z.infer<typeof lore条目Schema>;
export type lore知识库Type = z.infer<typeof lore知识库Schema>;
