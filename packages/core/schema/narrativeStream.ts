// 6.43 叙事流条目（历史档案层，不进 RootSchema）
// 分块键 = 周目谱系节点，住储存层而非条目字段（P0-9 接线）
// 历史档案默认不进 AI 上下文；唯一间接通道 = 定期报刊出刊时引擎喂公开层编年史事实给格式模板（P0-8 接线）
// 每行由引擎 Ring 0 机械落账，记账 AI 无日志动词
import { z } from 'zod';
import { HISTORY_TEXT_MAX } from './constants.js';

export const 叙事流条目Schema = z.object({
  序号: z.number().int(),             // 单调主键，排序唯一依据（禁按时间排）
  拍号: z.number().int().min(0).default(0),
  // X5·演出层水印·永不传入 rngFor rerollSalt·永不进判定——见 P0-5-decisions §5
  演出层草稿计数: z.number().int().min(0).default(0),
  时刻: z.object({
    读数: z.number().int().default(0), // 纪元分钟；0=哨兵；负值合法
    钟源: z.enum(['世界钟', '镜头钟']).default('世界钟'),
  }).default({}),                      // 仅展示，引擎不读时刻判定
  来源: z.enum(['AI叙事', '玩家输入', '引擎系统行', '降级文本']),
  类型标签: z.string().default(''),    // 写入点机械记号，开放串
  // X2：typed 实体键（角色/NPC/组织键），非自由字符串；引用不存在的键合法（离场后保留血统）
  说话者: z.string().optional(),
  // X3·信息源哨兵：实体键 | '匿名' | '未知'；陌生号码兜底，确保信源可追溯
  信息源哨兵: z.string().optional(),
  // X1·渠道标签：多源线程分组标识（对话/旁白/系统/媒介/思绪）；可空=未分组
  渠道标签: z.string().optional(),
  // X1·线程键：同渠道内子线程分组（如多人对话分头叙述）；可空=无子线程
  线程键: z.string().optional(),
  // X4·修正目标序号：撤回/更正事件回指原条目序号；absent=非修正行
  修正目标序号: z.number().int().optional(),
  // R5 确定性·tick内序号：同一拍内的排序序号（意图序/注入序统一字段）
  // 玩家输入 来源 → 意图序（intent order within tick）
  // 引擎系统行 来源 → 注入序（injection/trigger order within tick）
  // 回放/重组装时以此为次排序键（主键=序号），保证拍内确定性顺序
  tick内序号: z.number().int().optional(),
  正文: z.string().max(HISTORY_TEXT_MAX), // AI行/玩家行冻结原文
  结构化附注: z.record(z.string(), z.unknown()).optional(), // 系统行只存附注，由渲染器确定性重排
}).strip();

export type 叙事流条目Type = z.infer<typeof 叙事流条目Schema>;
