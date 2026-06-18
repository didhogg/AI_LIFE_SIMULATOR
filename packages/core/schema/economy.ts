// 4.7 经济层
import { z } from 'zod';
import { 是JS保留键 } from './governedKeySpace.js';

// ── 币种定义 ──
const 币种定义Schema = z.object({
  名称: z.string().default(''),
  类型: z.string().default(''), // 法币/虚拟/物品货币
  量词: z.string().default(''),
  单位: z.string().default(''),
  符号: z.string().default(''),
  时代适用: z.string().default(''), // era 锚定（非公历年份，防 Date.now）
  地域适用: z.array(z.string()).default([]),
  对基准汇率: z.number().min(0).default(1),
});

// ── 资产条目（E1：取代持仓七枚举，开放对象） ──
export const 资产条目Schema = z.object({
  标的: z.string().default(''),
  类别: z.string().default(''), // 开放串：股票/期货/地契/灵石/版权…
  数量: z.number().default(0),
  成本价: z.number().default(0),
  现价: z.number().default(0),
  杠杆: z.number().min(0).optional(),
  保证金: z.number().min(0).optional(),
  到期日: z.number().int().optional(), // 绝对纪元分钟；0=哨兵/无到期
  衍生品参数: z.record(z.string(), z.number()).optional(),
  // D1·6.54·缺省母域·可空："这笔钱在哪只域钟下生息"（跨时间域兜底·P2 实装收益计算）
  域籍: z.string().optional(),
});

// ── 经济记录键 superRefine（AA4·禁 JS 保留键·防原型污染） ──
// 复用 governedKeySpace.是JS保留键；add-constraint only：z.infer 仍 string，零迁移。
// 用于 货币系统 中 币种定义/汇率/行业景气 三个 record 面。
const 经济记录键Schema = z.string().superRefine((raw, ctx) => {
  if (是JS保留键(raw)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `经济记录键: 命中 JS 保留键黑名单「${raw}」` });
  }
});

// ── 账户键 superRefine（AA4·禁 JS 保留键·防原型污染） ──
// 复用 governedKeySpace.是JS保留键；扁平 token 不 split·不调 规范化键码位（账户键非注册表键）。
// add-constraint only：z.infer 仍 string，存储形状不变，零迁移。
const 账户键Schema = z.string().superRefine((raw, ctx) => {
  if (raw === '') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: '账户键: 不可为空' });
    return;
  }
  if (是JS保留键(raw)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `账户键: 命中 JS 保留键黑名单「${raw}」` });
  }
});

// ── 账户 ──
// 账本语义钉死（P0-6 黄金窗口）：账本键约定 = 实体键（主角/NPC/组织均可持账）。
// 当前单例形态为主角中心退化态；per-entity 化（账户 → z.record(实体键, 账户Schema)）
// 为破坏性迁移，排 B6-Step6 白名单派生 fire 前独立批，另行 ALERT。
export const 账户Schema = z.object({
  持有: z.record(账户键Schema, z.number()).default({}), // 币种→金额（允许为负=透支档）
  储蓄: z.record(账户键Schema, z.number()).default({}),
  本期收入: z.object({
    总额: z.number().default(0),
    明细: z.record(账户键Schema, z.number()).default({}), // 网点id/来源→金额
  }).default({}),
  本期支出: z.object({
    总额: z.number().default(0),
    明细: z.record(账户键Schema, z.number()).default({}),
  }).default({}),
  _负债: z.record(账户键Schema, z.string()).default({}),  // 债务ID→约定库键
  _应收: z.record(账户键Schema, z.string()).default({}),  // 应收ID→约定库键（金额真值单源在约定库·与_负债对称）
  // accrual 消费报表流·不进 getNetAsset·与 本期支出(现金流) 非双写——
  // _费用=赊账消费时点记，本期支出=现金流出时点记
  _费用: z.object({
    总额: z.number().default(0),
    明细: z.record(账户键Schema, z.number()).default({}),
  }).default({}),
  被动收入来源: z.record(账户键Schema, z.number()).default({}),
  资产: z.array(资产条目Schema).default([]),
});

// ── 经济依附 ──
const 经济依附Schema = z.object({
  状态: z.string().default(''), // 依附/半独立/独立/赡养
  对象: z.string().default(''), // NPC 键或组织键
  每期模式: z.string().default(''),
});

// ── 市场状态 ──
const 市场状态Schema = z.object({
  激活: z.boolean().default(false),
  大盘景气: z.number().min(0).max(100).default(50),
  通胀率: z.number().default(0),    // 年化（纪元时间）
  基准利率: z.number().default(0),  // 年化
  行业景气: z.record(经济记录键Schema, z.number().min(0).max(100)).default({}),
  时代风波: z.string().default(''),
  // 区域物价 → 引用地图侧（不双写）
});

// ══════════════════════════════════════════
// 货币系统（顶层键）
// ══════════════════════════════════════════

export const 货币系统Schema = z.object({
  币种定义: z.record(经济记录键Schema, 币种定义Schema).default({}),
  基准币种: z.string().default(''),
  汇率: z.record(经济记录键Schema, z.number().min(0)).default({}), // 币种→对基准汇率
  换汇登记: z.array(z.object({
    时间: z.number().int().default(0), // 绝对纪元分钟
    从: z.string().default(''),
    到: z.string().default(''),
    金额: z.number().default(0),
  })).default([]),
  经济依附: 经济依附Schema.default({}),
  账户: z.record(账户键Schema, 账户Schema).default({}), // per-entity（B6·账本迁移批）
  市场状态: 市场状态Schema.default({}),
});

export type 货币系统Type = z.infer<typeof 货币系统Schema>;
export type 资产条目Type = z.infer<typeof 资产条目Schema>;
export type 账户Type = z.infer<typeof 账户Schema>;

// 沉没账户保留实体键常量——守恒承重（Σ全实体净值不变·消耗现金流入 sink 账户）。
// 只进不出 invariant 留 P0-7 动词层；键保留禁 mod 占用留 B6/AA4。
export const SINK_ENTITY_KEY = '__sink__';
