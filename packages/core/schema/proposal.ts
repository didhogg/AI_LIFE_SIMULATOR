// 提案单 schema（6.68·Zod schema·由 AI 生成·经五道闸审查后落账）
import { z } from 'zod';

// 方向槽五类（Z2·6.68）：各类动作的方向语义标注
// 转账收支方向 / 缔约方角色 / 关系极性 / 主被动方 / 秘密涉事方角色
export const 方向槽枚举 = [
  '转账收支方向',
  '缔约方角色',
  '关系极性',
  '主被动方',
  '秘密涉事方角色',
] as const;

export const 提案单条目Schema = z.object({
  动作类别: z.string().default(''),      // 开放串·引擎动作类别（转账/缔约/关系变更/…）
  目标引用: z.string().default(''),      // 动作目标实体键
  数值槽: z.number().optional(),         // 数量/金额等数值参数·可空
  方向槽: z.enum(方向槽枚举).optional(), // Z2·五类方向槽·可空
  关联实体: z.array(z.string()).default([]), // 除目标外涉及的其他实体键
}).strip();

export const 提案单Schema = z.array(提案单条目Schema).default([]);

// ── P0-1·指令信封（txn_id：组级原子事务 ID·可空零迁移）─────────────────────────
// txn_id: 同一信封内的多条提案单条目视为原子组；缺省=非组级事务（单条提案）
export const 指令信封Schema = z.object({
  txn_id:   z.string().optional(), // 组级原子事务 ID·缺省=非组级
  提案血统: z.string().optional(), // Z3·6.68·发起方血统键引用·可空·瞬时非存档
  提案:     提案单条目Schema,
}).strip();

export type 提案单条目Type = z.infer<typeof 提案单条目Schema>;
export type 提案单Type = z.infer<typeof 提案单Schema>;
export type 指令信封Type = z.infer<typeof 指令信封Schema>;

// ── Z5·失败工单（6.68·Zod schema 地基·零迁移·逻辑实装 P0-7）────────────────────
// 表达式预求值同数值槽族(z.number)·加 .int()（预求值为定值=整型）
// FailureTicket 单源：replay/types.ts 直接 z.infer 派生，禁两份手维护
export const 失败工单条目Schema = z.object({
  tickId:         z.string(),
  callGeneration: z.string(),
  errorCode:      z.string(),
  detail:         z.string().optional(),
  // Z5 地基
  提案单引用:     z.string().optional(),        // 键引用·同覆写日志口径
  叙事段引用:     z.string().optional(),        // 叙事流序号串引用
  表达式预求值:   z.number().int().optional(),  // 原拍快照预求值定值
  已冻结:         z.boolean().optional(),       // ⚠标记
});
export const 失败工单Schema = z.array(失败工单条目Schema).default([]);
export type FailureTicketType = z.infer<typeof 失败工单条目Schema>;

// ── AOHP ActionOption schema（对撞①·option_id 稳定键约束）──────────────────────────
// option_id 必须是稳定结构键（动词键+目标键+参数组合）·禁位置序号（重渲漂移来源）
// 菜单生成需子集走 seeded rngFor·禁 LLM 自由决定选项集
export const ActionOptionSchema = z.object({
  option_id:      z.string(),               // 稳定键: 动词键+目标键+参数哈希（非位置序号）
  tool_name:      z.string().default(''),   // 调用工具名（open string）
  params:         z.record(z.string(), z.unknown()).default({}),
  value_slot:     z.string().optional(),    // 绑定的数值槽键（提案单条目.数值槽映射）
  target_choices: z.array(z.string()).default([]), // 目标实体键候选
  min:            z.number().optional(),    // 数值槽最小值
  max:            z.number().optional(),    // 数值槽最大值
}).strip();

export const ActionOptionListSchema = z.array(ActionOptionSchema).default([]);

export type ActionOptionType = z.infer<typeof ActionOptionSchema>;
export type ActionOptionListType = z.infer<typeof ActionOptionListSchema>;
