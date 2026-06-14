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
  txn_id: z.string().optional(), // 组级原子事务 ID·缺省=非组级
  提案: 提案单条目Schema,
}).strip();

export type 提案单条目Type = z.infer<typeof 提案单条目Schema>;
export type 提案单Type = z.infer<typeof 提案单Schema>;
export type 指令信封Type = z.infer<typeof 指令信封Schema>;
