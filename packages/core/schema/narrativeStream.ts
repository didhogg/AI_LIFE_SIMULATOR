// 6.43 叙事流条目（历史档案层，不进 RootSchema）
// 分块键 = 周目谱系节点，住储存层而非条目字段（P0-9 接线）
// 历史档案默认不进 AI 上下文；唯一间接通道 = 定期报刊出刊时引擎喂公开层编年史事实给格式模板（P0-8 接线）
// 每行由引擎 Ring 0 机械落账，记账 AI 无日志动词
import { z } from 'zod';
import { HISTORY_TEXT_MAX } from './constants.js';

export const 叙事流条目Schema = z.object({
  序号: z.number().int(),      // 单调主键，排序唯一依据（禁按时间排）
  拍号: z.number().int().min(0).default(0),
  重掷序号: z.number().int().min(0).default(0), // 血统水印
  时刻: z.object({
    读数: z.number().int().default(0), // 纪元分钟；0=哨兵；负值合法
    钟源: z.enum(['世界钟', '镜头钟']).default('世界钟'),
  }).default({}), // 仅展示，引擎不读时刻判定
  来源: z.enum(['AI叙事', '玩家输入', '引擎系统行', '降级文本']),
  类型标签: z.string().default(''), // 写入点机械记号，开放串
  说话者: z.string().optional(),
  正文: z.string().max(HISTORY_TEXT_MAX),
  结构化附注: z.record(z.string(), z.unknown()).optional(), // 系统行只存附注，由渲染器确定性重排
}).strip();

export type 叙事流条目Type = z.infer<typeof 叙事流条目Schema>;
