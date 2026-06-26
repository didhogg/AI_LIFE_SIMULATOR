// 公共中性 schema——地点 / NPC / 物品共用，无业务模块依赖
import { z } from 'zod';

// 意象条目（6.29 统一制式：地点 / NPC / 物品共用）
export const 意象条目Schema = z.object({
  标签: z.string().default(''),
  情绪色彩: z.string().default(''),
  强度: z.number().min(0).max(100).default(0),
  来源: z.string().default(''), // '固有' | '事件烙印' | 事件id
  衰减速率: z.number().min(0).default(0), // 每纪元分钟衰减量；0 = 永久
});

export type 意象条目Type = z.infer<typeof 意象条目Schema>;

// 事实片段（C2-0 / C2-3 · 涟漪引擎暂存缓冲 ⊕ 认知档案印象条目共用·禁第二实现）
// dollar.ts $涟漪候选 factFragment ⊕ actor.ts 印象条目 factFragment 统一来源
// 字段并集：actor.ts 9 字段（含有锚布尔/来源世界域）⊕ dollar.ts 7 核心字段，以 actor 现状为准
export const factFragmentSchema = z.object({
  主体: z.string().default(''),          // 事件主体实体键
  维度: z.string().default(''),          // 变化维度（关系/生命/财富/声誉/位置…）
  Δ方向: z.number().default(0),          // 方向量（+1=提升·-1=下降·±量级）
  客体: z.string().optional(),           // 关系类事件的对象键
  场景: z.string().optional(),           // 发生场景键（地点键）
  量级: z.number().default(0),           // 事件量级 [0-100]
  narrativeFrame: z.string().optional(), // 可争叙事框架（进指纹·可被信息战覆写）
  有锚布尔: z.boolean().optional(),      // G2-2: false=无锚=造谣 factFragment（T1/T6）
  来源世界域: z.string().optional(),     // G2-2: 事件发生的世界域键（T9 跨域验证）
});

export type factFragmentType = z.infer<typeof factFragmentSchema>;
