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
