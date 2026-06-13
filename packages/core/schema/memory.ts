// 4.8 记忆·事件·调度层
import { z } from 'zod';

// ══════════════════════════════════════════
// 工作记忆 / 长期归档通用条目（计时重标定为绝对时间）
// ══════════════════════════════════════════

export const 记忆条目Schema = z.object({
  记忆id: z.string().default(''),
  发生时间: z.number().int().default(0), // 绝对纪元分钟（原"周期"重标定）
  标题: z.string().default(''),
  摘要: z.string().default(''),
  涉及人物: z.string().default(''),
  涉及地点: z.string().default(''),
  重要度: z.string().default('普通'), // 普通/重要/命运
  关联地点: z.array(z.string()).default([]),
  关联物品: z.array(z.string()).default([]),
  关联意象: z.array(z.string()).default([]),
  关联NPC: z.array(z.string()).default([]),
  情绪基调: z.string().default(''),
  思念权重: z.number().min(0).max(100).default(0),
  权重: z.number().min(0).max(100).default(50),
  上次浮现时间: z.number().int().default(0),
  可浮现: z.boolean().default(true),
  因果: z.object({
    起因事件id: z.string().default(''),
    关联种子id: z.string().default(''),
    导致后果: z.string().default(''),
  }).default({}),
});

// 长期归档扩展字段
const 归档记忆条目Schema = 记忆条目Schema.extend({
  归档时间: z.number().int().default(0), // 绝对纪元分钟
  来源时间范围: z.string().default(''),
});

// ══════════════════════════════════════════
// 工作记忆 / 长期归档（顶层键）
// ══════════════════════════════════════════

export const 工作记忆Schema = z.array(记忆条目Schema).default([]);

export const 长期归档Schema = z.array(归档记忆条目Schema).default([]);

// ══════════════════════════════════════════
// 日程（指令台·4.8）
// ══════════════════════════════════════════

const 意图条目Schema = z.object({
  行动: z.string().default(''),
  地点: z.string().default(''),          // 节点键
  同行NPC: z.array(z.string()).default([]),
  行动点消耗: z.number().int().min(0).default(1),
  指令类型: z.string().default(''),
  关联实体: z.string().default(''),      // 实体键或资产名
  调度对象: z.array(z.string()).default([]),
  目标: z.string().default(''),
  使用物品或技能: z.string().default(''),
  指令参数: z.record(z.string(), z.unknown()).default({}),
});

export const 日程Schema = z.record(
  z.string(), // 槽位键（上午/下午/晚上/自定义）
  z.array(意图条目Schema),
).default({});

// ══════════════════════════════════════════
// 行动卡库（单源，取代旧双轨行动卡片池）
// ══════════════════════════════════════════

const 行动卡条目Schema = z.object({
  名称: z.string().default(''),
  类别: z.string().default(''),
  行动点消耗: z.number().int().min(0).max(20).default(1),
  占用槽位: z.number().int().min(1).max(5).default(1),
  适用粒度: z.array(z.string()).default([]),
  关联属性: z.string().default(''),
  关联技能: z.string().default(''),
  关联地点: z.string().default(''),
  关联NPC: z.string().default(''),
  检定模板: z.string().default(''),
  收益标签: z.string().default(''),
  风险标签: z.string().default(''),
  来源包: z.string().default(''),
});

export const 行动卡库Schema = z.record(z.string(), 行动卡条目Schema).default({});

// ══════════════════════════════════════════
// 播报条目（tagged union by 渠道·6.9/6.40）
// 渠道 = required discriminant（旧 渠道标签 optional string 升格为 literal）
// 旧存档迁移：缺 渠道 字段的条目在 migrate.ts 补默认值 '系统'
// ══════════════════════════════════════════

// 共享基础字段（所有渠道共用）
const 播报基础 = z.object({
  播报id: z.string().default(''),
  重要度: z.string().default('普通'),
  发生时间: z.number().int().default(0),
  // P0 预埋·行为实现在 P1：缺省视为挂起；AI 仅可提案，硬闯由引擎第④闸按白名单终裁
  打断级别: z.enum(['挂起', '闪念', '硬闯']).optional(),
  // P0 预埋·行为实现在 P1：绝对纪元分钟；超期由引擎降级系统文本强制出队
  最迟期限: z.number().int().optional(), // 绝对纪元分钟；0=哨兵/永不降级
  已读: z.boolean().default(false),
});

export const 播报条目Schema = z.discriminatedUnion('渠道', [
  // 系统：引擎日志/通知；也是旧存档默认迁移目标
  播报基础.extend({ 渠道: z.literal('系统'), 内容: z.string().default('') }),
  // 对话：NPC/角色台词广播
  播报基础.extend({
    渠道: z.literal('对话'),
    说话者键: z.string().default(''),     // 实体键
    说话者称谓: z.string().default(''),
    对白内容: z.string().default(''),
  }),
  // 旁白：叙事性旁白段落
  播报基础.extend({
    渠道: z.literal('旁白'),
    内容: z.string().default(''),
    叙述视角: z.string().default(''),
  }),
  // 媒介：报刊/情报/书信等格式化媒介
  播报基础.extend({
    渠道: z.literal('媒介'),
    媒介附件引用键: z.string().default(''), // 媒介登记表键
    渲染缓存摘要: z.string().default(''),
  }),
  // 思绪：主角内心独白（仅渲染，不广播给其他实体）
  播报基础.extend({
    渠道: z.literal('思绪'),
    内容: z.string().default(''),
    可见性: z.string().default('私有'),   // 私有/可被特定角色感知
  }),
]);

// ══════════════════════════════════════════
// 仲裁器（附录B′·延后队列已删除）
// ══════════════════════════════════════════

export const 仲裁器Schema = z.object({
  冷却表: z.record(z.string(), z.number().int()).default({}), // 冷却键→到期纪元分钟
  本轮种子包: z.array(z.string()).default([]),    // 本拍成熟的种子 ID 列表
  播报队列: z.array(播报条目Schema).default([]),  // 待播报条目
});

// ══════════════════════════════════════════
// mod 注册表（6.6·ATTR_WHITELIST 退役）
// ══════════════════════════════════════════

const mod条目Schema = z.object({
  pack_id: z.string().default(''),
  版本: z.string().default(''),
  启用: z.boolean().default(true),
  优先级: z.number().int().min(0).default(0),
  依赖: z.array(z.string()).default([]),
  冲突: z.array(z.string()).default([]),
  命名空间: z.string().default(''),
  作者: z.string().default(''),
});

export const mod注册表Schema = z.record(z.string(), mod条目Schema).default({});

export type 记忆条目Type = z.infer<typeof 记忆条目Schema>;
export type 意图条目Type = z.infer<typeof 意图条目Schema>;
export type 播报条目Type = z.infer<typeof 播报条目Schema>;
export type 仲裁器Type = z.infer<typeof 仲裁器Schema>;
