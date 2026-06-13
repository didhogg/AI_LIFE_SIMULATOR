// 4.2 时间与世界层
import { z } from 'zod';

// ── 粒度模板条目 ──
const GranularityTemplateSchema = z.object({
  现实档: z.string().default(''), // 即时/日常/发展/世代
  行动点上限: z.number().int().min(0).default(0), // 0 = 无限
  精力激活: z.boolean().default(true),
  HP模型: z.string().default(''), // 回合血条/体力/寿元等
  自动结算: z.array(z.string()).default([]), // 月结/经济等自动结算项
  对齐模式: z.enum(['固定跨度', '历法对齐']).default('固定跨度'),
});

// ── 历法 ──
const CalendarSchema = z.object({
  纪年法: z.string().default(''),
  纪元锚点: z.number().int().default(0), // 纪元锚点对应的纪元分钟
  年号表: z.array(z.object({
    年号: z.string().default(''),
    起始纪元分钟: z.number().int().default(0),
  })).default([]),
  月制: z.string().default(''),   // 历法月份描述（公历/太阴历等）
  显示模板: z.string().default(''), // 日期渲染模板串
});

// ── 世界 ──
export const 世界Schema = z.object({
  纪元分钟: z.number().int().default(0), // 唯一整型真相；允许负值（0=哨兵，禁 .min(0)）
  历法: CalendarSchema.default({}),
  // 当前日期(显示串) 🧮 派生，不存储
  // 季节 🧮 派生 f(月, 气候带)，不存储
  年代背景: z.string().default(''),
  气候带: z.string().default(''),
  当前粒度: z.string().default('日常'), // 粒度模板键
  粒度栈: z.array(z.string()).default([]),
  周期数: z.number().int().min(0).default(0), // 只读统计；拍计数≠时间，禁止用拍数折算时长
  _本拍跨度: z.number().int().min(1).default(43200), // 只读，单位纪元分钟（默认一天=1440*30）
  _粒度模板: z.object({
    即时: GranularityTemplateSchema.default({}),
    日常: GranularityTemplateSchema.default({}),
    发展: GranularityTemplateSchema.default({}),
    世代: GranularityTemplateSchema.default({}),
  }).default({}),
});

// ── G-1 活跃区间条目（域钟唯一派生输入，随线版本化） ──
export const 活跃区间条目Schema = z.object({
  起始纪元分钟: z.number().int().default(0), // 绝对时刻，允许负值
  终止纪元分钟: z.number().int().nullable().default(null), // null = 域仍处于活跃状态
  版本号: z.number().int().min(0).default(0), // 单调递增，随线版本化
});

// ── 世界域（多世界穿越·6.36，开局单域） ──
// 域时钟 🧮 派生/版本化展示量（f(累计活跃区间表)）·非时间真相·不存储；全局时刻才是唯一真相主键（G-1）
export const 世界域Schema = z.record(
  z.string(), // 域 ID（mod 命名空间同机制）
  z.object({
    玩法预设引用: z.string().default(''),
    封存状态: z.boolean().default(false),
    // G-1·6.54·域钟唯一派生输入·随时间线分块版本化·随 fork/SL 分叉回滚·绝不游离快照外
    累计活跃区间表: z.array(活跃区间条目Schema).default([]),
  }),
).default({});

export type 世界Type = z.infer<typeof 世界Schema>;
export type 世界域Type = z.infer<typeof 世界域Schema>;
export type 活跃区间条目Type = z.infer<typeof 活跃区间条目Schema>;
