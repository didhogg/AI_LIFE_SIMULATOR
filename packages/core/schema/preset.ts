// 4.10 玩法预设 / 引擎配置层（不进存档）
// 校验用 schema；实际运行时由世界装配 WORLD_SETUP 注入引擎，不序列化进存档。
import { z } from 'zod';

// ── 历法皮肤（附录 C） ──
export const 历法皮肤Schema = z.object({
  纪年法: z.string().default(''),
  纪元锚点: z.number().int().min(0).default(0),
  年号表: z.array(z.object({
    名称: z.string().default(''),
    起始纪元分钟: z.number().int().min(0).default(0),
  })).default([]),
  月制: z.string().default(''),
  显示模板: z.string().default(''),
});

// ── 种族模板（6.30·世代钳制） ──
const 发育阶段Schema = z.object({
  阶段名: z.string().default(''),
  起始年龄分钟: z.number().int().min(0).default(0), // 相对纪元分钟
  结束年龄分钟: z.number().int().min(0).optional(),
  属性系数: z.record(z.string(), z.number()).default({}),
});

export const 种族模板Schema = z.record(
  z.string(), // 种族键
  z.object({
    寿命基准: z.number().int().min(1).default(75),        // 以纪元分钟表示的自然年
    衰老系数: z.number().min(0).max(10).default(1),
    发育阶段表: z.array(发育阶段Schema).default([]),
    遗传参数: z.record(z.string(), z.number()).default({}),
    最小生育年龄分钟: z.number().int().min(0).default(0),  // 6.30 世代钳制
  }),
).default({});

// ── 粒度模板覆盖 ──
const 粒度模板条目Schema = z.object({
  跨度分钟: z.number().int().min(1).default(1440),
  行动点上限: z.number().int().min(1).default(4),
  叙事粒度提示: z.string().default(''),
});

export const 粒度模板覆盖Schema = z.record(
  z.string(), // 粒度名：即时/日常/发展/世代
  粒度模板条目Schema,
).default({});

// ── 难度系数组 ──
export const 难度系数组Schema = z.object({
  基础成功率调整: z.number().min(-50).max(50).default(0),
  秘密暴露系数: z.number().min(0).max(10).default(1),
  NPC_敌意系数: z.number().min(0).max(10).default(1),
  经济难度系数: z.number().min(0).max(10).default(1),
}).passthrough();

// ── 属性轴表 + 检定配方表（6.26） ──
const 检定配方条目Schema = z.object({
  配方名: z.string().default(''),
  主属性: z.string().default(''),
  副属性列: z.array(z.object({
    轴名: z.string().default(''),
    权重: z.number().min(0).max(1).default(0),
  })).default([]),
  难度修正: z.number().default(0),
  母题标签: z.array(z.string()).default([]),
});

export const 检定配方表Schema = z.record(z.string(), 检定配方条目Schema).default({});

export const 属性轴表Schema = z.array(z.object({
  轴名: z.string().default(''),
  说明: z.string().default(''),
  最大值: z.number().int().min(1).default(100),
  自然上限: z.number().int().min(1).default(20),
  允许年龄衰减: z.boolean().default(false),
})).default([]);

// ── 母题配额（6.14） ──
export const 母题配额Schema = z.record(
  z.string(), // 母题键
  z.object({
    基础权重: z.number().min(0).default(1),
    每游戏年上限: z.number().int().min(0).default(0), // 0 = 不限
    互斥组: z.string().default(''),
  }),
).default({});

// ── 媒体渠道表（6.9） ──
export const 媒体渠道表Schema = z.record(
  z.string(), // 渠道键
  z.object({
    名称: z.string().default(''),
    受众选择器: z.string().default(''),
    延迟分钟: z.number().int().min(0).default(0),
    失真率: z.number().min(0).max(1).default(0),
  }),
).default({});

// ── 战术包 ──
const 战术条目Schema = z.object({
  名称: z.string().default(''),
  前置: z.object({
    地形: z.array(z.string()).default([]),
    兵种: z.array(z.string()).default([]),
    情报阈值: z.number().min(0).max(100).default(0),
  }).default({}),
  修正包: z.record(z.string(), z.number()).default({}),
  风险: z.string().default(''),
  母题标签: z.array(z.string()).default([]),
});

export const 战术包Schema = z.record(z.string(), 战术条目Schema).default({});

// ── 学业制式库（§三-14 迁入） ──
const 学业制式条目Schema = z.object({
  阶段名: z.string().default(''),
  描述: z.string().default(''),
  时长分钟: z.number().int().min(0).default(0),
  前置条件: z.array(z.string()).default([]),
  解锁技能: z.array(z.string()).default([]),
  考核检定: z.string().default(''),
});

export const 学业制式库Schema = z.record(z.string(), 学业制式条目Schema).default({});

// ── 职级体系库（迁入） ──
const 职级条目Schema = z.object({
  职级名: z.string().default(''),
  组织类型: z.string().default(''),
  晋升模式: z.string().default('考核制'), // 考核制/资历制/竞选制/战功制
  前置职级: z.string().default(''),
  晋升检定: z.string().default(''),
  薪资系数: z.number().min(0).default(1),
  权限标签: z.array(z.string()).default([]),
});

export const 职级体系库Schema = z.record(z.string(), 职级条目Schema).default({});

// ── 财富分档参数 ──
export const 财富分档参数Schema = z.object({
  分档列表: z.array(z.object({
    档名: z.string().default(''),
    净资产下限: z.number().default(0),
    净资产上限: z.number().optional(),
    标准生活开销: z.number().min(0).default(0),
  })).default([]),
  默认基准币种: z.string().default(''),
});

// ── 欠债阈值与利息周期（6.25） ──
export const 欠债参数Schema = z.object({
  透支触发阈值: z.number().default(-1000), // 低于此值挂追债
  追债冷却分钟: z.number().int().min(0).default(43200),
  大额借贷下限: z.number().min(0).default(10000),
  利息周期分钟: z.number().int().min(1).default(43200),
  默认利率: z.number().min(0).default(0.05), // 年化
});

// ── 赛事结构模板（6.35） ──
const 赛事模板条目Schema = z.object({
  参与者选择器: z.string().default(''),
  赛制: z.enum(['淘汰', '积分', '循环']).default('淘汰'),
  轮次: z.number().int().min(1).default(1),
  检定配方引用: z.string().default(''),
  排名表: z.record(z.string(), z.number()).default({}),
  奖励钩子: z.string().default(''),
});

export const 赛事结构模板Schema = z.record(z.string(), 赛事模板条目Schema).default({});

// ── 穿越契约（6.36） ──
export const 穿越契约Schema = z.object({
  属性映射: z.record(z.string(), z.string()).default({}), // 旧轴名→新轴名
  货币处理: z.string().default(''), // 丢失/按汇率/保留/归零
  技能等价表: z.record(z.string(), z.string()).default({}),
  携带白名单: z.array(z.string()).default([]),
  时间比率: z.number().min(0).default(1),
  随附规则补丁: z.string().optional(), // 规则补丁 ID 引用
});

// ── 规则补丁（6.28·白名单参数面） ──
const 规则补丁条目Schema = z.object({
  补丁名: z.string().default(''),
  秘密类型黑名单: z.array(z.string()).default([]),
  触发器禁用列表: z.array(z.string()).default([]),
  钳制表覆盖: z.record(z.string(), z.unknown()).default({}),
  母题配额置零: z.array(z.string()).default([]),
  种族模板覆盖: z.record(z.string(), z.unknown()).default({}),
  其他参数覆盖: z.record(z.string(), z.unknown()).default({}),
});

export const 规则补丁Schema = z.record(z.string(), 规则补丁条目Schema).default({});

// ══════════════════════════════════════════
// 玩法预设根（顶层）
// ══════════════════════════════════════════

export const 玩法预设Schema = z.object({
  预设ID: z.string().default(''),
  名称: z.string().default(''),
  版本: z.string().default('0.1.0'),
  作者: z.string().default(''),
  描述: z.string().default(''),
  历法皮肤: 历法皮肤Schema.default({}),
  种族模板: 种族模板Schema,
  粒度模板覆盖: 粒度模板覆盖Schema,
  难度系数组: 难度系数组Schema.default({}),
  行动点上限: z.number().int().min(1).default(4),
  属性轴表: 属性轴表Schema,
  检定配方表: 检定配方表Schema,
  母题配额: 母题配额Schema,
  媒体渠道表: 媒体渠道表Schema,
  战术包: 战术包Schema,
  学业制式库: 学业制式库Schema,
  职级体系库: 职级体系库Schema,
  财富分档参数: 财富分档参数Schema.default({}),
  欠债参数: 欠债参数Schema.default({}),
  事件来源权重出厂值: z.object({
    事件包: z.number().min(0).max(100).default(50),
    AI自发: z.number().min(0).max(100).default(50),
  }).default({}),
  赛事结构模板: 赛事结构模板Schema,
  穿越契约: 穿越契约Schema.optional(),
  规则补丁: 规则补丁Schema,
});

export type 玩法预设Type = z.infer<typeof 玩法预设Schema>;
export type 检定配方条目Type = z.infer<typeof 检定配方条目Schema>;
export type 规则补丁条目Type = z.infer<typeof 规则补丁条目Schema>;
