// V4.1 RootSchema — 44 top-level keys (rev: +$天命重掷券, P0-5: +$存档种子, P0-1: 镜头焦点角色→席位表, P0-1 4.8: +调用类型注册表 +Ring2在途调用信封, P0-1 4.9: +存档头)
import { z } from 'zod';

// ── Layer exports (re-export all sub-schemas) ──
export * from './constants.js';
export * from './system.js';
export * from './world.js';
export * from './actor.js';
export * from './org.js';
export * from './secret.js';
export * from './map.js';
export * from './economy.js';
export * from './memory.js';
export * from './dollar.js';
export * from './preset.js';

import {
  SystemSchema,
  TickSchema,
  NarrativeSettingSchema,
  StateMachineSchema,
} from './system.js';
import { 世界Schema, 世界域Schema } from './world.js';
import {
  席位表Schema,
  NpcRecordSchema,
  已故NPC归档Schema,
  认知档案Schema,
} from './actor.js';
import { 组织实体Schema, 组织关系网Schema } from './org.js';
import { 全局Schema } from './secret.js';
import { 地图Schema, 战争状态Schema, 赛事实例Schema } from './map.js';
import { 货币系统Schema } from './economy.js';
import {
  工作记忆Schema,
  长期归档Schema,
  日程Schema,
  行动卡库Schema,
  仲裁器Schema,
  mod注册表Schema,
  调用类型注册表Schema,
  Ring2在途调用信封Schema,
} from './memory.js';
import {
  $运气Schema,
  $寿命预期Schema,
  $存档种子Schema,
  $聆听心声触发Schema,
  $浮现记忆IDSchema,
  $涟漪候选Schema,
  $RP暂存Schema,
  $隐藏记忆库Schema,
  $流速Schema,
  $战斗暂存Schema,
  $玩家偏好Schema,
  $会话状态Schema,
  $预算控制台Schema,
  $模型画像Schema,
  $沉浸模式Schema,
  $天命重掷券Schema,
  存档头Schema,
  $metaSchema,
} from './dollar.js';

// ── Authoritative 41-key list from blueprint 4.0 (rev: +$天命重掷券, P0-5: +$存档种子) ──
export const BLUEPRINT_KEYS = [
  '_系统版本',
  '_tick',
  '系统',
  '_叙事设置',
  '状态机',
  '世界',
  '世界域',
  '席位表',
  'NPC',
  '已故NPC归档',
  '认知档案',
  '组织实体',
  '组织关系网',
  '全局',
  '地图',
  '战争状态',
  '赛事实例',
  '货币系统',
  '工作记忆',
  '长期归档',
  '日程',
  '行动卡库',
  '仲裁器',
  'mod注册表',
  '调用类型注册表',
  'Ring2在途调用信封',
  '$运气',
  '$寿命预期',
  '$聆听心声触发',
  '$浮现记忆ID',
  '$涟漪候选',
  '$RP暂存',
  '$隐藏记忆库',
  '$流速',
  '$战斗暂存',
  '$玩家偏好',
  '$会话状态',
  '$预算控制台',
  '$模型画像',
  '$沉浸模式',
  '$天命重掷券',
  '$存档种子',
  '存档头',
  '$meta',
] as const;

// ── RootSchema ──
export const RootSchema = z.object({
  // 4.1 System
  _系统版本: z.literal('4.1').default('4.1'),
  _tick: TickSchema.default({}),
  系统: SystemSchema.default({}),
  _叙事设置: NarrativeSettingSchema.default({}),
  状态机: StateMachineSchema.default({}),

  // 4.2 World
  世界: 世界Schema.default({}),
  世界域: 世界域Schema,

  // 4.3 Actor
  // 席位表替代旧镜头焦点角色字符串指针（6.53 C1·P0-1·迁移映射见 migrate.ts）
  席位表: 席位表Schema,
  NPC: NpcRecordSchema,
  已故NPC归档: 已故NPC归档Schema,
  认知档案: 认知档案Schema,

  // 4.4 Org
  组织实体: 组织实体Schema,
  组织关系网: 组织关系网Schema,

  // 4.5 Global (secret / pact / family / inheritance)
  全局: 全局Schema.default({}),

  // 4.6 Map / War
  地图: 地图Schema.default({}),
  战争状态: 战争状态Schema,
  赛事实例: 赛事实例Schema,

  // 4.7 Economy
  货币系统: 货币系统Schema.default({}),

  // 4.8 Memory / Schedule
  工作记忆: 工作记忆Schema,
  长期归档: 长期归档Schema,
  日程: 日程Schema,
  行动卡库: 行动卡库Schema,
  仲裁器: 仲裁器Schema.default({}),
  mod注册表: mod注册表Schema,
  调用类型注册表: 调用类型注册表Schema,
  Ring2在途调用信封: Ring2在途调用信封Schema,

  // 4.9 $ layer (AI-invisible)
  $运气: $运气Schema,
  $寿命预期: $寿命预期Schema,
  $聆听心声触发: $聆听心声触发Schema,
  $浮现记忆ID: $浮现记忆IDSchema,
  $涟漪候选: $涟漪候选Schema,
  $RP暂存: $RP暂存Schema.default({}),
  $隐藏记忆库: $隐藏记忆库Schema.default({}),
  $流速: $流速Schema.default({}),
  $战斗暂存: $战斗暂存Schema.default({}),
  $玩家偏好: $玩家偏好Schema.default({}),
  $会话状态: $会话状态Schema.default({}),
  $预算控制台: $预算控制台Schema.default({}),
  $模型画像: $模型画像Schema,
  $沉浸模式: $沉浸模式Schema,
  $天命重掷券: $天命重掷券Schema.default({}),
  $存档种子: $存档种子Schema,
  存档头: 存档头Schema.default({}),
  $meta: $metaSchema.default({}),
});

export type RootState = z.infer<typeof RootSchema>;
