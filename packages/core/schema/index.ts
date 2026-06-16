// V4.1 RootSchema — 48 top-level keys (rev: +$天命重掷券, P0-5: +$存档种子, P0-1: 镜头焦点角色→席位表, P0-1 4.8: +调用类型注册表 +Ring2在途调用信封, P0-1 4.9: +存档头, B-1: +_lore知识库, P0-1 BatchA: +$生图配置 +$语音配置 +$RAG配置)
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
export * from './proposal.js';
export * from './lore.js';
export * from './verb.js';
export * from './governedKeySpace.js';

import {
  SystemSchema,
  TickSchema,
  NarrativeSettingSchema,
  StateMachineSchema,
  临时会话Schema,
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
import { lore知识库Schema } from './lore.js';
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
  $生图配置Schema,
  $语音配置Schema,
  $RAG配置Schema,
  存档头Schema,
  $metaSchema,
} from './dollar.js';

// ── Authoritative 48-key list from blueprint 4.0 (rev: +$天命重掷券, P0-5: +$存档种子, B-1: +_lore知识库, P0-1 BatchA: +$生图配置 +$语音配置 +$RAG配置) ──
export const BLUEPRINT_KEYS = [
  '_系统版本',
  '_tick',
  '_系统',
  '_叙事设置',
  '_状态机',
  '世界',
  '世界域',
  '_席位表',
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
  '$生图配置',
  '$语音配置',
  '$RAG配置',
  '_存档头',
  '$meta',
  '_lore知识库',
  '$临时会话',
] as const;

// ── RootSchema ──
export const RootSchema = z.object({
  // 4.1 System
  _系统版本: z.literal('4.1').default('4.1'),
  _tick: TickSchema.default({}),
  _系统: SystemSchema.default({}),
  _叙事设置: NarrativeSettingSchema.default({}),
  _状态机: StateMachineSchema.default({}),

  // 4.2 World
  世界: 世界Schema.default({}),
  世界域: 世界域Schema,

  // 4.3 Actor
  // 席位表替代旧镜头焦点角色字符串指针（6.53 C1·P0-1·迁移映射见 migrate.ts）
  _席位表: 席位表Schema,
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
  $生图配置: $生图配置Schema,
  $语音配置: $语音配置Schema,
  $RAG配置: $RAG配置Schema,
  _存档头: 存档头Schema.default({}),
  $meta: $metaSchema.default({}),
  // 4.X Module 15 — lore 知识库（世界恒真知识层·AI 只读·零迁移可空）
  _lore知识库: lore知识库Schema.optional(),
  // 对撞⑥ 易失态（快照外·崩溃即弃·不进重放·不进 U1 迁移面）
  $临时会话: 临时会话Schema,
});

export type RootState = z.infer<typeof RootSchema>;

// Strict root schema — cross-field constraints not expressible within individual sub-schemas.
// Separate from RootSchema to preserve ZodObject type (RootSchema.shape.xxx access intact).
// Used by P0-6 import gate and schema tests. Parse with RootSchema first, then validate here.
export const RootSchemaStrict = RootSchema.superRefine((root, ctx) => {
  // community gate: 允许玩家覆盖SystemPrompt === true requires 内容分级 === 'community'
  if (root.$玩家偏好.内容分级 !== 'community') {
    for (const [key, entry] of Object.entries(root.调用类型注册表)) {
      if (entry.允许玩家覆盖SystemPrompt === true) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['调用类型注册表', key, '允许玩家覆盖SystemPrompt'],
          message: `非 community 档不可开启 SystemPrompt 覆盖（当前内容分级: ${root.$玩家偏好.内容分级}）`,
        });
      }
    }
  }
});
