// 4.1 系统与元数据层
import { z } from 'zod';

// ── tick 日志条目 ──
export const TickLogEntrySchema = z.object({
  tick_id: z.string().default(''),
  拍计数: z.number().int().min(0).default(0), // 拍计数≠时间，禁止用拍数折算时长
  结果摘要: z.string().default(''),
  系数组指纹: z.string().default(''),
  // P0-9 接线：全局回滚计数器快照；可空，历史记录无此字段时为 undefined
  盐值: z.number().int().optional(),
});

// ── 系统元数据 ──
export const SystemSchema = z.object({
  schema_version: z.number().int().min(0).default(0),
  migration_version: z.number().int().min(0).default(0),
  last_migration: z.number().int().default(0), // 绝对时间（纪元分钟）
  tick_log: z.array(TickLogEntrySchema).default([]),  // 环形缓冲 N 住预设 (6.65 W6)·轮转封顶，引擎维护
  叙事流高水位序号: z.number().int().default(0), // 热区只存高水位，日志本体住存档冷区；拍前快照不复制日志
  已结算标记: z.record(
    z.string(),
    z.object({
      即时分量: z.number().int().min(0).max(1).default(0),
      延时分量: z.record(z.string(), z.number().int().min(0).max(1)).default({}),
    }),
  ).default({}),
  功能开关表: z.object({
    认知迷雾: z.boolean().default(true),
    上帝视角: z.boolean().default(false),
    // 6.75 新增开关
    观战模式: z.boolean().default(false),
    舞台追踪: z.enum(['自动按场景', '强制开', '关']).default('自动按场景'),
    二审严格度: z.number().int().min(0).max(100).default(50),
    // open-ended: keys reference library dimension keys; passthrough allows mod injection
    二审维度开关: z.record(z.string(), z.boolean()).default({}),
    观战推进模式: z.enum(['手动步进', '自动连播', '快播到事件']).default('手动步进'),
    // P0-1 黄金窗口·内容分级（B桶状态·叙事面·不影响判定）
    内容分级: z.enum(['关', 'SFW', 'NSFW']).optional(),
  }).passthrough().default({}),
  事件来源权重: z.object({
    事件包: z.number().min(0).max(100).default(50),
    AI自发: z.number().min(0).max(100).default(50),
  }).default({}),
});

// ── 拍级元数据（AI 只读，引擎写） ──
export const TickSchema = z.object({
  id: z.string().default(''),
  拍计数: z.number().int().min(0).default(0), // 拍计数≠时间，禁止用拍数折算时长
  // M6·AA8：难度分段点 = 组锚点；切换在组边界生效·每段段头写入新指纹·分段机器 = U3（P0-9/P0-10）
  难度系数组指纹: z.string().default(''), // 系数组快照的哈希；P0-5 取材扩展：检定配方表/难度系数组/钳制表/判定骰型/派生量配方/概率域夹逼
  // 骰面量化层①·开局锁定随档快照·与难度系数组指纹同机制·P1 实装时启用
  判定骰型快照: z.union([z.literal(100), z.literal(20)]).optional(),
});

// ── 叙事设置（6.75：人称结构化 + 叙事权限；6.76：决策权限三档 + 视角锁定） ──
// 退役：叙事风格（并入叙事偏好）、写实度（→$玩家偏好.写实程度）、事件倾向（→$玩家偏好.母题权重）
export const NarrativeSettingSchema = z.object({
  人称: z.object({
    视角宿主: z.string().default(''), // 实体引用；'上帝/全知旁白' 为内置特殊值
    人称: z.enum(['一', '二', '三']).default('二'), // 含第二人称「你」
    // 6.76：机械校验"全知×第一人称非法/一二人称须有单一宿主"是 P0-6 导入闸的事，本层只建字段
    视角锁定: z.enum(['锁定单一宿主', '可切换出场角色']).default('锁定单一宿主'),
  }).default({}),
  叙事偏好: z.string().default(''), // 玩家自由文本，进 prompt 组装
  // 6.42/6.44·指向文风库的键集·多选可叠加·玩家手动开关·缺包回退默认·切换落拍边界
  启用文风键: z.array(z.string()).default([]),
  叙事权限: z.object({
    // 6.76·三档决策权限（细化 6.75 两档）：玩家独占 / 模型可代写需确认 / 模型可代写自动
    玩家角色决策权限: z.enum(['玩家独占', '模型可代写·需确认', '模型可代写·自动']).default('玩家独占'),
  }).default({}),
});

// ── 状态机 ──
export const StateMachineSchema = z.object({
  当前态: z.string().default('WORLD_SETUP'),
  模态栈: z.array(z.string()).max(4).default([]),
  timeMode: z.enum(['PAUSED', 'TURN', 'AUTO']).default('PAUSED'),
  // 6.53 C3·多人语义：世界钟=全局单写者、不为任何单席位冻结；多人记账写时刻读全局世界钟
  双时钟: z.object({
    世界钟: z.number().int().default(0), // 纪元分钟
    镜头钟: z.number().int().default(0), // 纪元分钟（RP 细档时与世界钟分离）
  }).default({}),
});

export type TickLogEntry = z.infer<typeof TickLogEntrySchema>;
export type System = z.infer<typeof SystemSchema>;
export type Tick = z.infer<typeof TickSchema>;
export type NarrativeSetting = z.infer<typeof NarrativeSettingSchema>;
export type StateMachine = z.infer<typeof StateMachineSchema>;
