// 4.1 系统与元数据层
import { z } from 'zod';

// ── tick 日志条目 ──
export const TickLogEntrySchema = z.object({
  tick_id: z.string().default(''),
  拍计数: z.number().int().min(0).default(0), // 拍计数≠时间，禁止用拍数折算时长
  结果摘要: z.string().default(''),
  系数组指纹: z.string().default(''),
});

// ── 系统元数据 ──
export const SystemSchema = z.object({
  schema_version: z.number().int().min(0).default(0),
  migration_version: z.number().int().min(0).default(0),
  last_migration: z.number().int().default(0), // 绝对时间（纪元分钟）
  tick_log: z.array(TickLogEntrySchema).default([]),  // 轮转封顶，引擎维护
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
  难度系数组指纹: z.string().default(''), // 系数组快照的哈希
  // 骰面量化层①·开局锁定随档快照·与难度系数组指纹同机制·P1 实装时启用
  判定骰型快照: z.union([z.literal(100), z.literal(20)]).optional(),
});

// ── 叙事设置（AI 可见；最终形态：{ 人称, 叙事偏好 }）──
// 退役：叙事风格（并入叙事偏好）、写实度（→$玩家偏好.写实程度）、事件倾向（→$玩家偏好.母题权重）
export const NarrativeSettingSchema = z.object({
  人称: z.string().default('第二人称'),
  叙事偏好: z.string().default(''), // 玩家自由文本，进 prompt 组装
  // 6.42·指向叙事风格预设库的键集·多选可叠加·玩家手动开关·缺包回退默认·切换落拍边界
  启用文风键: z.array(z.string()).default([]),
});

// ── 状态机 ──
export const StateMachineSchema = z.object({
  当前态: z.string().default('WORLD_SETUP'),
  模态栈: z.array(z.string()).max(4).default([]),
  timeMode: z.enum(['PAUSED', 'TURN', 'AUTO']).default('PAUSED'),
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
