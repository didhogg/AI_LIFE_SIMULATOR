// 4.6 地图与战争层
import { z } from 'zod';
import { 意象条目Schema } from './actor.js';

// ══════════════════════════════════════════
// 地图·地点
// ══════════════════════════════════════════

const 产出Schema = z.object({
  L1产业氛围: z.array(z.string()).default([]),
  L2可获取物产: z.array(z.object({
    物品名: z.string().default(''),
    获取方式: z.string().default(''),
    稀有度: z.string().default(''),
    季节: z.string().default(''),
    关联技能: z.string().default(''),
  })).default([]),
  L3战略资源: z.array(z.object({
    资源大类: z.string().default(''),
    储量档: z.string().default(''),
    开采度: z.number().min(0).max(100).default(0),
    产能: z.string().default(''),
  })).default([]),
});

// 拍板二：大地图连通拓扑条目（单写者铁律：可达性只读此字段）
const 相邻条目Schema = z.object({
  目标: z.string().default(''),    // 目标地点键
  方式: z.string().optional(),     // 徒步/水路/传送…
  距离: z.number().min(0).optional(), // 抽象距离，单位由预设定义
}).superRefine((data, ctx) => {
  // L-25 跨字段语义：方式/距离给出时目标不得为空串（结构有效≠语义合法·防悬空边）
  if ((data.方式 !== undefined || data.距离 !== undefined) && data.目标 === '') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['目标'],
      message: '相邻条目: 已指定方式/距离时目标不得为空串',
    });
  }
});

const 地点条目Schema = z.object({
  名称: z.string().default(''),
  // 类别取值为『区域级』的节点即区域；所属区域 = 沿父链回溯最近的区域级祖先节点键；区域物价/传播/压力榜三处共用此键空间
  类别: z.string().default(''),
  空间ID: z.string().default(''), // 开放串：现实/赛博/任意新造平面
  父节点: z.string().default(''),
  相对方位: z.string().default(''),
  地形: z.string().default(''),
  大小: z.string().default(''),
  结构: z.string().default(''),
  状态: z.string().default(''),
  控制方: z.string().default(''), // 组织实体键
  社交开放度: z.string().default('中'), // 高/中/低
  危险度: z.string().default('低'),
  可达性: z.string().default('自由通行'),
  探索度: z.number().min(0).max(100).default(100),
  意象: z.array(意象条目Schema).default([]), // 6.29 统一制式
  产出: 产出Schema.default({}),
  // 据点设施 🧮 派生镜像（filter 组织实体.网点 by 地点键），不存储
  控制度: z.number().min(0).max(100).default(0),
  情报度: z.number().min(0).max(100).default(0),
  人口规模: z.string().default(''),
  seed: z.string().default(''), // 地形栅格程序生成种子（hash 可现算）
  // 拍板二：大地图连通拓扑（权威字段，门户仅用于建筑/室内）
  相邻: z.array(相邻条目Schema).default([]),
  // 前端绘图辅助：中心坐标，引擎逻辑不依赖
  显示坐标: z.object({ x: z.number(), y: z.number() }).optional(),
  // 前端绘图辅助：疆域/区域轮廓多边形顶点（顺序连接成闭合多边形），引擎逻辑不依赖
  边界: z.array(z.object({ x: z.number(), y: z.number() })).optional(),
  // 6.33 地点占位形态（惰性展开，实例化管线 P0-7+）
  占位形态: z.object({
    名称: z.string().default(''),
    父节点: z.string().default(''),
    相对方位: z.string().default(''),
    seed: z.string().default(''),
    模板引用: z.string().optional(),
  }).optional(),
  // 6.42 分区惰性·进区才展开下级占位
  分区键: z.string().optional(),
  // L-5 · 地点物理规范（optional·零迁移·⊥「大小:string」描述串）
  容量: z.number().int().min(0).optional(),   // 最大同时在场人数
  营业时间: z.string().optional(),             // 开放串·如「08:00-22:00」
  活动类型: z.string().optional(),             // '单人'/'双人'/'多人'（开放串）
  // L-3a · 可行走性标记（optional·零迁移·引擎可读·⊥ 前端绘图字段）
  可行走: z.boolean().optional(),
});

// ══════════════════════════════════════════
// 地图·战役
// ══════════════════════════════════════════

const 压力榜条目Schema = z.object({
  阵营键: z.string().default(''),
  压力值: z.number().default(0),
});

const 争夺区域条目Schema = z.object({
  区域id: z.string().default(''),
  当前控制方: z.string().default(''), // 组织键
  压力榜: z.array(压力榜条目Schema).default([]),
});

const 战役条目Schema = z.object({
  交战方: z.array(z.string()).default([]), // 组织键列表
  所属战争键: z.string().default(''),
  态势: z.string().default(''),
  起拍: z.number().int().min(0).default(0), // 拍号（计数·仅审计痕迹）
  // TODO P0-7: 战役时长统计须用起始时刻(绝对纪元分钟·允许负值·0=哨兵)，禁用起拍拍号折算时长——P0-7 前补
  争夺区域: z.array(争夺区域条目Schema).default([]),
});

// ══════════════════════════════════════════
// 地图·区域物价（单源存储，市场状态只引用）
// ══════════════════════════════════════════

const 区域物价Schema = z.record(
  z.string(), // 区域 ID
  z.record(z.string(), z.object({ // 品类
    基准价: z.number().default(0),
    供需: z.number().min(-100).max(100).default(0),
  })),
).default({});

// ══════════════════════════════════════════
// 地图（顶层键）
// ══════════════════════════════════════════

export const 地图Schema = z.object({
  地点: z.record(z.string(), 地点条目Schema).default({}), // 稳定节点键→永不改
  战役: z.record(z.string(), 战役条目Schema).default({}),
  区域物价: 区域物价Schema,
});

// ══════════════════════════════════════════
// 战争状态（顶层键，E3/G2）
// ══════════════════════════════════════════

const 参战方条目Schema = z.object({
  实体键: z.string().default(''),
  阵营键: z.string().default(''),
  战争姿态: z.string().default('防守'), // 主攻/助攻/防守/观望/调停
  参战目标: z.string().default(''),
});

const 战争条目Schema = z.object({
  战争名: z.string().default(''),
  参战方: z.array(参战方条目Schema).default([]),
  战争目标: z.string().default(''),
  状态: z.string().default('交战'), // 交战/停战/和谈/结束
  // _战线 🧮 派生（压力榜汇总），不存储
});

export const 战争状态Schema = z.record(z.string(), 战争条目Schema).default({});

// ══════════════════════════════════════════
// 赛事实例（6.35，模板住预设/事件包·实例进存档）
// ══════════════════════════════════════════

const 赛事实例条目Schema = z.object({
  模板引用: z.string().default(''), // 玩法预设/事件包中的模板 ID
  当前轮次: z.number().int().min(0).default(0),
  排名表: z.record(z.string(), z.number()).default({}), // NPC键→名次
  状态: z.string().default('进行中'),
});

export const 赛事实例Schema = z.record(z.string(), 赛事实例条目Schema).default({});

export type 地图Type = z.infer<typeof 地图Schema>;
export type 战争状态Type = z.infer<typeof 战争状态Schema>;
export type 赛事实例Type = z.infer<typeof 赛事实例Schema>;
