// 4.5 秘密·约定·家族·全局层
import { z } from 'zod';
import { HISTORY_TEXT_MAX } from './constants.js';
import { 引用Schema } from '../engine/preset/ref.js';

// ── 受众选择器（开放串：实体/派系/关系/标签/血缘距离谓词） ──
const 受众选择器 = z.string();

// ══════════════════════════════════════════
// 秘密库
// ══════════════════════════════════════════

const 涉事方条目Schema = z.object({
  实体键: z.string().default(''),
  // 严格五类：一个实体在同一秘密中仅一角色；多角色拆多条 涉事方 条目
  角色: z.string().default(''),
});

const 已暴露线索条目Schema = z.object({
  线索: z.string().default(''),
  暴露程度: z.number().min(0).max(100).default(0),
  状态: z.string().default('存在'),   // 存在/已销毁/已栽赃/已掩盖
  关联地点键: z.string().optional(),
  发现者: z.string().optional(),     // 跳级特例
});

const 知情名单条目Schema = z.object({
  对象: 受众选择器.default(''),
  // 来源选择器：审计血统用；可空·Q1 实装展开为真键集；目前存原始选择器串
  // 知情棘轮：知道了不可逆·只增不减——执行层 P2 实装；schema 只标记
  来源选择器: z.string().optional(),
  知情程度: z.number().min(0).max(100).default(0),
  立场: z.string().default(''),     // 死守/动摇/可能反水
  掩护基调: z.string().default(''),
});

const 秘密库条目Schema = z.object({
  母题: z.string().default(''),      // 开放串（原 9 类枚举开放化）
  涉事方: z.array(涉事方条目Schema).default([]),
  进展: z.number().min(0).max(100).default(0),
  严重度: z.number().min(0).max(100).default(0),
  暴露度: z.number().min(0).max(100).default(0), // 引擎确定性推涨
  $谜底: z.string().default(''),                  // AI 平时物理不可见（P0-8 切片）
  已暴露线索: z.array(已暴露线索条目Schema).default([]),
  知情名单: z.array(知情名单条目Schema).default([]),
});

// ══════════════════════════════════════════
// 约定库
// ══════════════════════════════════════════

const 条款条目Schema = z.object({
  内容: z.string().default(''),
  // P0-1 黄金窗口·DSL v1.0 标的表达式（零迁移：旧字面量串走 string 分支；新 DSL 走对象分支）
  // 求值时点 = 结算拍首快照；除法取整向不利于发起者；DSL 文法版本已在指纹取材集
  标的: z.union([
    z.string(),                                // 旧：字面量值（零迁移兼容）
    z.object({
      v: z.literal('1.0'),                    // DSL 文法版本（对应指纹取材集中的版本号）
      expr: z.string(),                        // DSL v1.0 表达式（M·1 EBNF）
    }),
  ]).optional(),
  履行状态: z.string().default('待履行'), // 待履行/已履行/违约
});

// 子类型 discriminated union（6.58）——三分支互斥
// - 一次性缺省：单次执行，无额外字段
// - 循环承诺：周期性重复，需 周期+终止条件
// - 条件挂起：事件触发激活，需 触发条件+失败策略
export const 约定子类型Schema = z.discriminatedUnion('类型', [
  z.object({
    类型: z.literal('一次性缺省'),
  }),
  z.object({
    类型: z.literal('循环承诺'),
    周期: z.number().int().min(0).optional(),  // 游戏时长·纪元分钟/循环
    终止条件: z.string().optional(),            // 开放串谓词
  }),
  z.object({
    类型: z.literal('条件挂起'),
    触发条件: z.string().optional(),            // 开放串谓词；满足时激活
    失败策略: z.string().optional(), // 缺省=跳过+落未履约事件
  }),
]);

export type 约定子类型Type = z.infer<typeof 约定子类型Schema>;

const 约定库条目Schema = z.object({
  缔约方: z.array(z.object({
    实体键: z.string().default(''),
    角色: z.string().default(''),
  })).default([]),
  形式: z.string().default(''),         // 开放串：婚约/盟约/条约/债务/协议
  条款: z.array(条款条目Schema).default([]),
  约束力: z.number().min(0).max(100).default(0),
  维系手段: z.string().default(''),
  期限: z.number().int().optional(),    // 绝对纪元分钟；无 = 永久
  状态: z.string().default('有效'),

  // ── 6.58 子类型配置（optional·缺省=一次性缺省语义）──────────────────────────
  子类型: 约定子类型Schema.optional(),
  // 挂靠时钟域：约定推进所依赖的时钟域（缺省母域·D1）
  挂靠时钟域: z.string().optional(),
  // 目标失效回退：缔约目标实体失效后处理（可后补赋值）
  目标失效回退: z.string().optional(),
});

// ══════════════════════════════════════════
// 继承包（通用接管载荷）
// ══════════════════════════════════════════

const 继承包Schema = z.object({
  候选: z.array(z.object({
    NPC键: z.string().default(''),
    权限级别: z.string().default(''), // 开放串；'' = 无预设（渲染层/作者决定缺省行为）
    白名单: z.array(z.string()).default([]), // 可抓取字段列表
  })).default([]),
  抓取载荷: z.record(z.string(), z.unknown()).default({}),
  // 世界遗产白名单：跨周目搬运路径列表（缺口4·6.45·可空·P2实装）
  世界遗产白名单: z.array(z.string()).optional(),
});

// ══════════════════════════════════════════
// 家族树（6.27/6.30）
// ══════════════════════════════════════════

const 双亲边Schema = z.object({
  parent_id: z.string().default(''),
  边类型: z.string().default(''),  // 开放串：血亲/领养/过继/继养…；'' = 无预设（渲染层/作者决定缺省行为）
});

const 家族树节点Schema = z.object({
  双亲边: z.array(双亲边Schema).default([]),
  生卒: z.object({
    出生: z.number().int().default(0),       // 绝对纪元分钟；0=未记录
    死亡: z.number().int().optional(),       // 绝对纪元分钟；absent=健在/未记录
  }).default({}),
  总评: z.string().default(''),
  关键成就: z.array(z.string()).default([]),
  传家宝: z.array(z.string()).default([]),
});

const 幽灵节点Schema = z.object({
  称谓: z.string().default(''),
  姓氏: z.string().default(''),
  生卒约束: z.string().default(''),          // 约束描述串（开放谓词）
  _模板引用: 引用Schema('实体模板').optional(),
});

const 家族树Schema = z.object({
  // 双亲边 DAG：角色ID → 节点（名义边；生物真值走秘密库身世条目）
  边: z.record(z.string(), 家族树节点Schema).default({}),
  // 幽灵节点：尚未实体化的占位祖先/亲属（6.30）
  幽灵节点: z.record(z.string(), 幽灵节点Schema).default({}),
});

// ══════════════════════════════════════════
// 编年史（6.43）
// ══════════════════════════════════════════

const 媒介附件Schema = z.object({
  格式模板键: z.string().default(''),        // 取值 = 媒介登记表的媒介键（6.44）
  渠道标签: z.string(),                      // 必填
  // 只读展示件；引擎判定永不读；重生成规则：模板+seed；导出可剥离
  渲染缓存全文: z.string().max(HISTORY_TEXT_MAX).default(''),
});

export const 编年史条目Schema = z.object({
  // append-only；L2 折叠 = 软折叠收冷区不物理删；知情过滤后才入册；
  // covert 事不入册，declassify 后补「真相大白」新条
  序号: z.number().int(),                    // 单调递增主键；无 default（调用方必须提供）
  时间: z.number().int().default(0),         // 纪元分钟绝对时刻；0=哨兵；负值合法（史前）
  标题: z.string().default(''),
  地点键: z.string().optional(),
  母题: z.string().optional(),               // 开放串
  结果摘要行: z.string().default(''),
  关联实体键: z.array(z.string()).default([]),
  事件id: z.string().optional(),
  重要等级: z.string().default(''),      // 开放串：路人/次要/重要/核心…；'' = 无预设（渲染层/作者决定缺省行为）
  媒介附件: 媒介附件Schema.optional(),
});

// ══════════════════════════════════════════
// 覆写日志（附录H）
// ══════════════════════════════════════════

const 覆写日志条目Schema = z.object({
  时间: z.number().int().default(0),         // 绝对纪元分钟
  授权源: z.string().default(''),
  级别: z.string().default(''),              // L1大额数值/L2改判定档/L3归零
  目标: z.string().default(''),
  理由: z.string().default(''),
  是否作弊: z.boolean().default(false),
  提案单引用: z.string().optional(),         // Z3·可空·6.68
});

// ══════════════════════════════════════════
// v2 真相实体层（PR-0 · T1 留位·G2/PR-1 接线）
// ══════════════════════════════════════════

// factFragment 种子条目：真相层显式化（T1）核心载体
// 键 = factFragment 唯一标识（命名规约 G2 接线时确定·当前留 string 键·空跑）
// AI 只读（_前缀）；进指纹排除（留位阶段不影响判定面）
export const factFragment种子条目Schema = z.object({
  // ── 核心 factFragment 字段（与 $涟漪候选/印象条目 口径对齐）──
  主体: z.string().default(''),           // 事件主体实体键
  维度: z.string().default(''),           // 变化维度（关系/生命/财富/声誉…）
  Δ方向: z.number().default(0),           // 方向量（+1=提升·-1=下降·量级内）
  客体: z.string().optional(),            // 关系类事件的对象实体键
  场景: z.string().optional(),            // 发生场景键（地点键）
  量级: z.number().default(0),            // 事件量级 [0-100]
  narrativeFrame: z.string().optional(),  // 可争叙事框架（T8 信息战覆写入口）
  // ── v2 真相实体层扩展（T1/T9/T6 留位）──
  访问阈值: z.number().min(0).max(100).default(0), // access 场须达此阈值才可读（T2 接线）
  来源世界域: z.string().optional(),       // 事件发生的世界域键（T9 跨域验证·cross-domain access=0）
  有锚布尔: z.boolean().default(true),     // false = 无锚 = 造谣 factFragment（T6 新闻先于物化）
  // ── 社会 LOD 粗节点引用（T11 留位·G7/cohort 接线）──
  粗节点引用: z.string().optional(),       // cohort 粗节点键（flyweight 原型·G7/T11 接线时填写）
});

// ══════════════════════════════════════════
// 全局层（顶层键 全局）
// ══════════════════════════════════════════

export const 全局Schema = z.object({
  秘密库: z.record(z.string(), 秘密库条目Schema).default({}),
  约定库: z.record(z.string(), 约定库条目Schema).default({}),
  继承包: 继承包Schema.optional(),
  家族树: 家族树Schema.optional(),
  _覆写日志: z.array(覆写日志条目Schema).default([]),
  _作弊标记: z.boolean().default(false),      // 本周目不可逆
  _编年史: z.array(编年史条目Schema).default([]), // append-only 既成事实记录
  // ── PR-0 · v2 真相实体层留位（additive·optional·空跑·G2/PR-1 接线后消费）──────────
  // AI 只读（_ 前缀）；暴露度→派生化、知情程度→保留独立存储（命门一 2026-06-21 已锁）
  _factFragment种子库: z.record(z.string(), factFragment种子条目Schema).optional(),
});

export type 全局Type = z.infer<typeof 全局Schema>;
export type 秘密库条目Type = z.infer<typeof 秘密库条目Schema>;
export type 约定库条目Type = z.infer<typeof 约定库条目Schema>;
export type 知情名单条目Type = z.infer<typeof 知情名单条目Schema>;
export type 涉事方条目Type = z.infer<typeof 涉事方条目Schema>;
export type factFragment种子条目Type = z.infer<typeof factFragment种子条目Schema>;
