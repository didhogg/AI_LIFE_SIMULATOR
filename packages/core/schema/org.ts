// 4.4 组织与约定层
import { z } from 'zod';

// ── 进展树节点 ──
const 进展树节点Schema = z.object({
  前置: z.array(z.string()).default([]),
  进度: z.number().min(0).max(100).default(0),
  投入: z.string().default(''),
  解锁效果: z.string().default(''),
});

// ── 进展树领域（包含节点 DAG + 当前节点指针） ──
const 进展树领域Schema = z.object({
  nodes: z.record(z.string(), 进展树节点Schema).default({}),
  当前节点: z.string().default(''), // 当前所在节点键
});

// ── 部队条目（6.15） ──
const 部队条目Schema = z.object({
  编制: z.string().default(''),
  姿态: z.string().default(''), // 开放串：强攻/死守/阻滞/佯攻/伏击…
  战术引用: z.string().default(''), // 战术库 mod 条目键
});

// ── 派系登记条目 ──
const 派系条目Schema = z.object({
  诉求: z.string().default(''), // 开放串
  领袖: z.string().default(''), // NPC 键
  成员: z.string().default(''), // 受众选择器表达式（开放串）
  // 势力 🧮 派生 f(成员财富+人数+军权)，不存储
  // 激进度 🧮 派生，不存储
});

// ── 网点条目（主存储，地点侧据点设施为派生镜像） ──
const 网点条目Schema = z.object({
  地点键: z.string().default(''),
  营收: z.number().default(0),
  规模: z.number().min(0).max(100).default(0),
  风险: z.number().min(0).max(100).default(0),
  状态: z.string().default(''),
  生产方式: z.string().default(''), // 开放串
});

// ── 占位形态（6.33 提及即占位） ──
const 占位形态Schema = z.object({
  名称: z.string().default(''),
  实体类型: z.string().default('组织'),
  硬约束: z.array(z.string()).default([]),
  来源拍号: z.number().int().min(0).default(0),
  模板引用: z.string().optional(),
});

// ── 个人项目档（6.34，轻量则仅挂一条进展树） ──
const 项目档Schema = z.object({
  进展树: z.record(z.string(), 进展树领域Schema).default({}),
  财务: z.object({
    投入: z.number().default(0),
    累计回报: z.number().default(0),
  }).default({}),
  传播: z.record(z.string(), z.number().min(0).max(100)).default({}), // 区域→渗透度
  用工: z.object({
    成员: z.array(z.string()).default([]), // NPC 键列表
  }).default({}),
});

// ══════════════════════════════════════════
// 组织实体主 schema
// ══════════════════════════════════════════

const 组织实体条目Schema = z.object({
  父组织: z.string().optional(),     // 递归嵌套，空=顶层
  类型: z.string().default(''),      // 开放串
  行业: z.string().default(''),
  状态: z.string().default(''),
  占股: z.number().min(0).max(100).default(0),
  经营范围: z.array(z.string()).default([]),
  风险: z.number().min(0).max(100).default(0),
  币种: z.string().default(''),

  财务: z.object({
    投入本金: z.number().default(0),
    估值: z.number().default(0),
    本期营收: z.number().default(0),
    本期成本: z.number().default(0),
    本期净利: z.number().default(0),
    累计盈亏: z.number().default(0),
  }).default({}),

  用工: z.object({
    员工数: z.number().int().min(0).default(0),
    岗位: z.record(z.string(), z.object({
      人数: z.number().int().min(0).default(0),
      月薪: z.number().min(0).default(0),
      技能等级: z.string().default('初级'),
    })).default({}),
    人力成本: z.number().min(0).default(0),
    产能系数: z.number().min(0).default(1),
    士气: z.number().min(0).max(100).default(70),
    关键员工: z.array(z.string()).default([]),
  }).default({}),

  治理: z.object({
    掌控度: z.number().min(0).max(100).default(0),
    合法性: z.number().min(0).max(100).default(0),
    民心: z.number().min(0).max(100).default(50),
    凝聚力: z.number().min(0).max(100).default(50),
    追随者规模: z.number().int().min(0).default(0),
    控制区: z.array(z.string()).default([]), // 节点键列表
    关联职级体系ID: z.string().default(''),
  }).default({}),

  军事: z.object({
    兵力: z.number().int().min(0).default(0),
    战力档: z.string().default(''),
    装备: z.string().default(''),
    补给: z.number().min(0).max(100).default(100),
    兵种: z.string().default(''),
    主将: z.string().default(''),   // NPC 键
    驻地: z.string().default(''),   // 节点键
    士气: z.number().min(0).max(100).default(70),
    部队: z.array(部队条目Schema).default([]),
  }).default({}),

  信念: z.object({
    官方体系: z.string().default(''),
    强制度: z.number().min(0).max(100).default(0),
    异端容忍: z.number().min(0).max(100).default(50),
    思潮派系: z.string().default(''),
  }).default({}),

  进展树: z.record(z.string(), 进展树领域Schema).default({}),

  派系登记: z.array(派系条目Schema).default([]),

  网点: z.array(网点条目Schema).default([]),

  传播: z.record(z.string(), z.number().min(0).max(100)).default({}), // 区域→渗透度

  项目档: 项目档Schema.optional(),    // 6.34 个人项目容器
  占位形态: 占位形态Schema.optional(), // 6.33 唯一实改点
});

export const 组织实体Schema = z.record(z.string(), 组织实体条目Schema).default({});

// ══════════════════════════════════════════
// 组织关系网（组织↔组织外交边集）
// ══════════════════════════════════════════

export const 组织关系网Schema = z.record(
  z.string(), // 边 ID
  z.object({
    A组织: z.string().default(''),
    B组织: z.string().default(''),
    关系: z.string().default(''),         // 开放串
    关系值: z.number().min(-100).max(100).default(0),
    约定引用键: z.string().default(''),   // 约定库键
  }),
).default({});

export type 组织实体条目Type = z.infer<typeof 组织实体条目Schema>;
export type 组织实体Type = z.infer<typeof 组织实体Schema>;
export type 组织关系网Type = z.infer<typeof 组织关系网Schema>;
