// 4.4 组织与约定层
import { z } from 'zod';

// ══════════════════════════════════════════
// 公共子 schema
// ══════════════════════════════════════════

// ── 属性轴条目（6.45/6.48）─────────────────────────────────────────────────────
// 出厂七轴键名冻结：掌控度/合法性/民心/凝聚力（治理域）/ 士气（军事域）/ 强制度/异端容忍（信念域）
// 可扩新轴·可休眠(停用?)·不可改名删除·显示名?仅表盘换皮永不参与寻址·同名禁与固定字段双写·可派生的不开轴
export const 组织属性轴条目Schema = z.object({
  数值: z.number().default(0),
  显示名: z.string().optional(),      // 仅表盘刻字，如修真「香火」=民心
  停用: z.boolean().optional(),       // 休眠出厂轴（出厂轴不可删，但可暂停）
  域: z.string().optional(),          // 治理/军事/信念·纯展示分栏
  衰减速率: z.number().min(0).optional(), // 每纪元分钟自然衰减量
  // Step 3-A·黄金窗口预埋·schema-only（实例级可选覆盖·轴级声明见 preset.ts 属性轴表Schema）：
  // 缺省即 undefined（绝不给默认值），既有存档 canonicalize 不取材此字段，指纹零变。
  // TODO 序②(6.59) 收紧为受治理级联注册表键。
  cascade_on_change: z.array(z.string()).optional(),
});

// ── 进展树节点 ──────────────────────────────────────────────────────────────────
const 进展树节点Schema = z.object({
  前置: z.array(z.string()).default([]),   // 前置节点键列表（DAG 拓扑）
  进度: z.number().min(0).max(100).default(0),
  投入: z.string().default(''),           // 资源/条件描述（开放串）
  解锁效果: z.string().default(''),       // 解锁后效果钩子（开放串）
});

// 进展树领域：节点 DAG + 当前节点指针
const 进展树领域Schema = z.object({
  nodes: z.record(z.string(), 进展树节点Schema).default({}),
  当前节点: z.string().default(''), // 当前所在节点键；空串=未启动
});

// ── 部队条目（6.15）──────────────────────────────────────────────────────────────
const 部队条目Schema = z.object({
  编制: z.string().default(''),           // 开放串：步兵营/骑兵队/龙骑…
  姿态: z.string().default(''),           // 开放串（6.15）：强攻/死守/阻滞/佯攻/伏击…
  战术引用: z.string().default(''),       // 战术库 mod 条目键
});

// ── 派系登记条目 ────────────────────────────────────────────────────────────────
// 势力/激进度 🧮 派生（成员财富+人数+军权），不进 schema
const 派系条目Schema = z.object({
  诉求: z.string().default(''),           // 开放串
  领袖: z.string().default(''),           // NPC 键
  成员: z.string().default(''),           // 受众选择器表达式（开放串）
});

// ── 网点条目（主存储；地点侧据点设施=派生镜像）────────────────────────────────────
const 网点条目Schema = z.object({
  地点键: z.string().default(''),
  营收: z.number().default(0),
  规模: z.number().min(0).max(100).default(0),
  风险: z.number().min(0).max(100).default(0),
  状态: z.string().default(''),
  生产方式: z.string().default(''),       // 开放串
});

// ── 离场演化契约（6.45/6.66·可空·惰性补结·P2实装纠缠闭包）────────────────────────
export const 离场演化契约Schema = z.object({
  演化速率: z.number().min(0).default(0),
  随机事件表: z.string().default(''),     // 事件表引用键（预设/事件包侧）
  晋升倾轧规则: z.string().default(''),   // 规则描述（开放串·机械可执行）
  // 关联声明[]：依赖外部信号声明（6.66），供闭包计算与注入点筛选
  关联声明: z.array(z.string()).optional(),
});

// ── 占位形态（6.33/6.52·与 NPC 占位同款）────────────────────────────────────────
export const 组织占位形态Schema = z.object({
  名称: z.string().default(''),
  实体类型: z.string().default('组织'),   // 开放串
  硬约束: z.array(z.string()).default([]),
  来源拍号: z.number().int().default(0),  // 拍计数；0=哨兵（出现时拍未知）
  _模板引用: z.string().optional(),        // K2/K3·血统只读·AI 不可改模板来源
  _模板快照: z.unknown().optional(),       // K4·包卸载后脱包兜底·只读
});

// ══════════════════════════════════════════
// 财务子结构（组织 + 项目档共用）
// ══════════════════════════════════════════

const 财务Schema = z.object({
  投入本金: z.number().default(0),
  估值: z.number().default(0),
  本期营收: z.number().default(0),
  本期成本: z.number().default(0),
  本期净利: z.number().default(0),
  累计盈亏: z.number().default(0),
});

// ══════════════════════════════════════════
// 用工子结构（组织 + 项目档共用；士气已收编出厂轴）
// ══════════════════════════════════════════

const 用工Schema = z.object({
  员工数: z.number().int().min(0).default(0),
  岗位: z.record(z.string(), z.object({
    人数: z.number().int().min(0).default(0),
    月薪: z.number().min(0).default(0),
    技能等级: z.string().default('初级'),
  })).default({}),
  人力成本: z.number().min(0).default(0),
  产能系数: z.number().min(0).default(1),
  // 士气 🗑️ 已收编为军事域出厂轴（属性轴.士气），不在用工里重存
  关键员工: z.array(z.string()).default([]), // NPC 键列表
});

// ── 个人项目档（6.34·个人项目=微型组织·轻重两档）─────────────────────────────────
const 项目档Schema = z.object({
  进展树: z.record(z.string(), 进展树领域Schema).default({}),
  财务: 财务Schema.default({}),
  传播: z.record(z.string(), z.number().min(0).max(100)).default({}), // 区域→渗透度
  用工: 用工Schema.default({}),
});

// ══════════════════════════════════════════
// 组织实体主 schema
// ══════════════════════════════════════════

const 组织实体条目Schema = z.object({
  // ── 身份骨架 ──
  父组织: z.string().optional(),          // 递归嵌套；空=顶层独立实体
  类型: z.string().default(''),           // 开放串：政权/商会/宗门/家族/帮派…
  行业: z.string().default(''),
  状态: z.string().default(''),
  占股: z.number().min(0).max(100).default(0),
  经营范围: z.array(z.string()).default([]),
  风险: z.number().min(0).max(100).default(0),
  币种: z.string().default(''),

  // ── 财务 ──
  财务: 财务Schema.default({}),

  // ── 用工 ──（士气已收编属性轴，不在此重存）
  用工: 用工Schema.default({}),

  // ── 属性轴?（6.45/6.48·出厂七轴·可扩·可休眠·键名冻结）──────────────────────
  // 出厂轴域分布：治理={掌控度,合法性,民心,凝聚力} / 军事={士气} / 信念={强制度,异端容忍}
  // 🗑️ 这些值不再作治理/军事/信念下的固定字段重存（旧字段 P0-2 迁移映射单独 PR）
  属性轴: z.record(z.string(), 组织属性轴条目Schema).optional(),

  // ── 治理（连续数值已收编出厂轴，只保留结构性字段）────────────────────────────────
  // 🗑️ 掌控度/合法性/民心/凝聚力 已迁至属性轴（P0-2 破坏性迁移映射）
  治理: z.object({
    追随者规模: z.number().int().min(0).default(0),
    控制区: z.array(z.string()).default([]),  // 节点键列表
    关联职级体系ID: z.string().default(''),
  }).default({}),

  // ── 军事（士气已收编出厂轴）───────────────────────────────────────────────────
  // 🗑️ 士气 已迁至属性轴.士气
  军事: z.object({
    兵力: z.number().int().min(0).default(0),
    战力档: z.string().default(''),
    装备: z.string().default(''),
    补给: z.number().min(0).max(100).default(100),
    兵种: z.string().default(''),
    主将: z.string().default(''),           // NPC 键
    驻地: z.string().default(''),           // 节点键
    部队: z.array(部队条目Schema).default([]),
  }).default({}),

  // ── 信念（6.45/6.48 瘦身·强制度/异端容忍收编为信念域出厂轴）─────────────────────
  // 🗑️ 强制度/异端容忍 已迁至属性轴（3-8B 迁移映射已落 migrate.ts·migrate组织信念轴）
  // ⚠️ 勿碰 NPC.信念（4.3），只有组织信念走出厂轴
  信念: z.object({
    官方体系: z.string().default(''),
    思潮派系: z.string().default(''),
  }).default({}),

  // ── 离场演化契约?（6.45/6.66·惰性补结·可空零迁移）──────────────────────────────
  离场演化契约: 离场演化契约Schema.optional(),

  // ── 进展树（[领域]:节点DAG + 当前节点指针）─────────────────────────────────────
  进展树: z.record(z.string(), 进展树领域Schema).default({}),

  // ── 派系登记（势力/激进度 🧮 派生，不进 schema）────────────────────────────────
  派系登记: z.array(派系条目Schema).default([]),

  // ── 网点[]（主存储·地点侧据点设施=派生镜像）─────────────────────────────────────
  网点: z.array(网点条目Schema).default([]),

  // ── 传播{[区域]:渗透度}（软影响力热力）─────────────────────────────────────────
  传播: z.record(z.string(), z.number().min(0).max(100)).default({}),

  // ── 项目档?（6.34·个人项目=微型组织·轻重两档）──────────────────────────────────
  项目档: 项目档Schema.optional(),

  // ── 占位形态?（6.33/6.52·唯一实改点·提及即占位）────────────────────────────────
  占位形态: 组织占位形态Schema.optional(),
});

export const 组织实体Schema = z.record(z.string(), 组织实体条目Schema).default({});

// ══════════════════════════════════════════
// 组织关系网（组织↔组织外交边集）
// ══════════════════════════════════════════

// 条约走约定库引用键，不内嵌自由串（E5）
export const 组织关系网Schema = z.record(
  z.string(), // 边 ID
  z.object({
    A组织: z.string().default(''),
    B组织: z.string().default(''),
    关系: z.string().default(''),           // 开放串：盟友/宗藩/贸易/敌对…
    关系值: z.number().min(-100).max(100).default(0),
    约定引用键: z.string().default(''),     // 约定库键（E5·条约一等公民化）
  }),
).default({});

// ── 导出类型 ────────────────────────────────────────────────────────────────────
export type 组织属性轴条目Type = z.infer<typeof 组织属性轴条目Schema>;
export type 离场演化契约Type = z.infer<typeof 离场演化契约Schema>;
export type 组织占位形态Type = z.infer<typeof 组织占位形态Schema>;
export type 组织实体条目Type = z.infer<typeof 组织实体条目Schema>;
export type 组织实体Type = z.infer<typeof 组织实体Schema>;
export type 组织关系网Type = z.infer<typeof 组织关系网Schema>;
