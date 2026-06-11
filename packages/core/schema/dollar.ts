// 4.9 $ 层与 $meta 层（AI 永不可见）
import { z } from 'zod';

// ── $运气 / $寿命预期 ──
export const $运气Schema = z.number().int().min(1).max(100).default(50);
export const $寿命预期Schema = z.number().int().min(1).max(200).default(75);

// ── $聆听心声触发 / $浮现记忆ID ──
export const $聆听心声触发Schema = z.boolean().default(false);
export const $浮现记忆IDSchema = z.string().default('');

// ── $涟漪候选（6.37 涟漪引擎暂存缓冲） ──
export const $涟漪候选Schema = z.record(
  z.string(), // 目标实体键
  z.array(z.object({
    标签: z.string().default(''),
    极性: z.string().default(''),
    强度: z.number().min(0).max(100).default(0),
    可见性: z.string().default(''),
    来源拍号: z.number().int().min(0).default(0),
  })),
).default({});

// ── $RP暂存（微行为聚合缓冲，§2.3） ──
export const $RP暂存Schema = z.object({
  本场摘要: z.string().default(''),
  起始时间: z.number().int().min(0).default(0), // 绝对纪元分钟
  本场新登场: z.array(z.object({
    类型: z.string().default('NPC'),
    名称: z.string().default(''),
    摘要: z.string().default(''),
  })).default([]),
  聚合行动摘要: z.string().default(''), // 微行为聚合后向日程层记一笔
});

// ── $流速（前端层） ──
export const $流速Schema = z.object({
  模式: z.enum(['自动', '回合制']).default('回合制'),
  速度档: z.number().int().min(1).max(4).default(1), // ×1/×2/×3/×4
  自动暂停触发: z.array(z.string()).default([]), // 枚举项：遭遇战/HP阈值/秘密暴露/叙事生成失败…
});

// ── $战斗暂存（schema版本化，退场即清） ──
export const $战斗暂存Schema = z.object({
  局部网格: z.string().default(''), // 序列化后的战斗地图
  单位: z.array(z.object({
    NPC键: z.string().default(''),
    q: z.number().int().default(0), // 六边形轴坐标
    r: z.number().int().default(0),
    朝向: z.number().int().min(0).max(5).default(0),
    临时HP: z.number().min(0).default(0),
  })).default([]),
  回合order: z.array(z.string()).default([]),
  terrain: z.string().optional(),  // 预留字段（6.2 schema 版本化）
  cover: z.string().optional(),
  zoc: z.string().optional(),
});

// ── $玩家偏好（母题权重，§2 最终归属层待拍板） ──
export const $玩家偏好Schema = z.object({
  母题权重: z.record(z.string(), z.number().min(0)).default({}), // 母题→权重倍率
});

// ── $会话状态（6.1） ──
export const $会话状态Schema = z.object({
  最后交互时间戳: z.number().int().min(0).default(0), // 绝对纪元分钟（合法出现的墙钟触点）
  未读播报数: z.number().int().min(0).default(0),
  崩溃恢复指针: z.string().default(''),
});

// ── $预算控制台（6.7） ──
export const $预算控制台Schema = z.object({
  叙事密度档: z.string().default('中'), // 低/中/高/无限
  每游戏月叙事配额: z.number().int().min(0).default(10),
  软上限: z.number().int().min(0).default(50),
  硬上限: z.number().int().min(0).default(100),
  叙事模型: z.string().default(''),
  记账模型: z.string().default(''),
  旁观播报模型: z.string().default(''),
  累计token: z.number().int().min(0).default(0),
  本会话token: z.number().int().min(0).default(0),
});

// ── $模型画像（6.8·玩家/社区填，引擎只拼接） ──
export const $模型画像Schema = z.record(
  z.string(), // provider 键（claude/gpt/gemini…）
  z.object({
    风格补正提示词: z.string().default(''),
    采样参数: z.record(z.string(), z.unknown()).default({}),
  }),
).default({});

// ── $沉浸模式 ──
export const $沉浸模式Schema = z.boolean().default(false);

// ── $隐藏记忆库（AI 不可见·延时种子 + 彩蛋池） ──

const 延时种子条目Schema = z.object({
  载荷: z.string().default(''),
  类型: z.string().default('伏笔'),
  成熟日: z.number().int().min(0).default(0), // 绝对纪元分钟
  权重: z.number().min(0).max(100).default(10),
  重要等级: z.string().default('中'),          // 普通/重要/命运
  已结算标记: z.number().int().min(0).max(1).default(0),
  幂等锚点: z.string().default(''),
  冲突组: z.string().default(''),
  冷却键: z.string().default(''),
  可合并标签: z.string().default(''),
  后果层级: z.string().default('中'),         // 轻/中/重/命运级
  era锚定: z.string().default(''),            // 原 possible_years 语义
  因果链id: z.string().default(''),
  因果深度: z.number().int().min(0).default(0),
  来源: z.object({
    命名空间: z.string().default(''),
    包id: z.string().default(''),
    事件id: z.string().default(''),
    模块: z.string().default(''),
  }).default({}),
});

const 彩蛋条目Schema = z.object({
  原记忆id: z.string().default(''),
  摘要: z.string().default(''),
  模糊钥匙: z.array(z.string()).default([]),
  关联地点: z.array(z.string()).default([]),
  关联物品: z.array(z.string()).default([]),
  关联意象: z.array(z.string()).default([]),
  关联NPC: z.array(z.string()).default([]),
  情绪基调: z.string().default(''),
  录入时间: z.number().int().min(0).default(0),
  冷却到期: z.number().int().min(0).default(0), // 绝对纪元分钟
  可浮现: z.boolean().default(true),
  已浮现: z.boolean().default(false),
  上次浮现时间: z.number().int().min(0).default(0),
});

export const $隐藏记忆库Schema = z.object({
  延时种子: z.record(z.string(), 延时种子条目Schema).default({}),
  彩蛋池: z.record(z.string(), 彩蛋条目Schema).default({}),
});

// ── $meta（跨周目存档层） ──
export const $metaSchema = z.object({
  总回合数: z.number().int().min(0).default(0),
  上帝之手次数: z.number().int().min(0).default(0),
  聆听心声次数: z.number().int().min(0).default(0),
  历代角色数: z.number().int().min(1).default(1),
  周目谱系: z.record(z.string(), z.object({  // 带 parent 指针的存档树
    parent: z.string().optional(),
    快照引用: z.string().default(''),
    创建时间: z.number().int().min(0).default(0),
    角色键: z.string().default(''),
  })).default({}),
  峰值记录: z.record(z.string(), z.number()).default({}), // 各维度峰值
});

export type $隐藏记忆库Type = z.infer<typeof $隐藏记忆库Schema>;
export type $metaType = z.infer<typeof $metaSchema>;
