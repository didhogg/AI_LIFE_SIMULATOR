// 4.1 系统与元数据层
import { z } from 'zod';

// ── tick 日志条目 ──
export const TickLogEntrySchema = z.object({
  tick_id: z.string().default(''),
  拍计数: z.number().int().min(0).default(0),
  结果摘要: z.string().default(''),
  系数组指纹: z.string().default(''),
});

// ── 系统元数据 ──
export const SystemSchema = z.object({
  schema_version: z.number().int().min(0).default(0),
  migration_version: z.number().int().min(0).default(0),
  last_migration: z.number().int().min(0).default(0), // 绝对时间（纪元分钟）
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
  拍计数: z.number().int().min(0).default(0),
  难度系数组指纹: z.string().default(''), // 系数组快照的哈希
});

// ── 叙事设置（AI 只读） ──
export const NarrativeSettingSchema = z.object({
  叙事风格: z.string().default('影视化分镜'),
  人称: z.string().default('第二人称'),
  写实度: z.string().default('轻度戏剧化'),
  // 事件倾向已退役（双轨收口）：结构化权重→$玩家偏好.母题权重，自然语言→叙事偏好
  // 拍板一：玩家在前端直接输入、AI 可见的自然语言偏好提示词，进 prompt 组装
  叙事偏好: z.string().default(''),
});

// ── 状态机 ──
export const StateMachineSchema = z.object({
  当前态: z.string().default('WORLD_SETUP'),
  模态栈: z.array(z.string()).max(4).default([]),
  timeMode: z.enum(['PAUSED', 'TURN', 'AUTO']).default('PAUSED'),
  双时钟: z.object({
    世界钟: z.number().int().min(0).default(0), // 纪元分钟
    镜头钟: z.number().int().min(0).default(0), // 纪元分钟（RP 细档时与世界钟分离）
  }).default({}),
});

export type TickLogEntry = z.infer<typeof TickLogEntrySchema>;
export type System = z.infer<typeof SystemSchema>;
export type Tick = z.infer<typeof TickSchema>;
export type NarrativeSetting = z.infer<typeof NarrativeSettingSchema>;
export type StateMachine = z.infer<typeof StateMachineSchema>;
