// 4.5 秘密·约定·家族·全局层
import { z } from 'zod';
import { HISTORY_TEXT_MAX } from './constants.js';

// ── 受众选择器（开放串：实体/派系/关系/标签/血缘距离谓词） ──
const 受众选择器 = z.string();

// ══════════════════════════════════════════
// 秘密库
// ══════════════════════════════════════════

const 涉事方条目Schema = z.object({
  实体键: z.string().default(''),
  角色: z.string().default(''), // 主谋/共犯/受害者/目标/见证 开放串
});

const 已暴露线索条目Schema = z.object({
  线索: z.string().default(''),
  暴露程度: z.number().min(0).max(100).default(0),
  状态: z.string().default('存在'), // 存在/已销毁/已栽赃/已掩盖
  关联地点键: z.string().default(''),
  发现者: z.string().optional(), // 跳级特例
});

const 知情名单条目Schema = z.object({
  对象: 受众选择器.default(''),
  知情程度: z.number().min(0).max(100).default(0),
  立场: z.string().default(''),  // 死守/动摇/可能反水
  掩护基调: z.string().default(''),
});

const 秘密库条目Schema = z.object({
  母题: z.string().default(''),  // 开放串（原 9 类枚举开放化）
  涉事方: z.array(涉事方条目Schema).default([]),
  进展: z.number().min(0).max(100).default(0),
  严重度: z.number().min(0).max(100).default(0),
  暴露度: z.number().min(0).max(100).default(0), // 引擎确定性推涨
  $谜底: z.string().default(''),                  // AI 平时物理不可见
  已暴露线索: z.array(已暴露线索条目Schema).default([]),
  知情名单: z.array(知情名单条目Schema).default([]),
});

// ══════════════════════════════════════════
// 约定库
// ══════════════════════════════════════════

const 条款条目Schema = z.object({
  内容: z.string().default(''),
  标的: z.string().optional(),
  履行状态: z.string().default('待履行'), // 待履行/已履行/违约
});

const 约定库条目Schema = z.object({
  缔约方: z.array(z.object({
    实体键: z.string().default(''),
    角色: z.string().default(''),
  })).default([]),
  形式: z.string().default(''),     // 开放串：婚约/盟约/条约/债务/协议
  条款: z.array(条款条目Schema).default([]),
  约束力: z.number().min(0).max(100).default(0),
  维系手段: z.string().default(''),
  期限: z.number().int().optional(), // 绝对纪元分钟；无 = 永久
  状态: z.string().default('有效'),
});

// ══════════════════════════════════════════
// 继承包（通用接管载荷）
// ══════════════════════════════════════════

const 继承包Schema = z.object({
  候选: z.array(z.object({
    NPC键: z.string().default(''),
    权限级别: z.string().default('全权限'), // 全权限/仅商权+共事记忆/自身背景…
    白名单: z.array(z.string()).default([]), // 可抓取字段列表
  })).default([]),
  抓取载荷: z.record(z.string(), z.unknown()).default({}),
});

// ══════════════════════════════════════════
// 家族树（6.27/6.30）
// ══════════════════════════════════════════

const 双亲边Schema = z.object({
  parent_id: z.string().default(''),
  边类型: z.string().default('血亲'), // 开放串：血亲/领养/过继/继养
});

const 家族树节点Schema = z.object({
  双亲边: z.array(双亲边Schema).default([]),
  生卒: z.object({
    出生: z.number().int().default(0), // 绝对纪元分钟；0=未记录
    死亡: z.number().int().optional(), // 绝对纪元分钟；0=健在/未记录
  }).default({}),
  总评: z.string().default(''),
  关键成就: z.array(z.string()).default([]),
  传家宝: z.array(z.string()).default([]),
});

const 幽灵节点Schema = z.object({
  称谓: z.string().default(''),
  姓氏: z.string().default(''),
  生卒约束: z.string().default(''),   // 约束描述串
  模板引用: z.string().optional(),
});

const 家族树Schema = z.object({
  边: z.record(z.string(), 家族树节点Schema).default({}),    // 角色ID → 节点
  幽灵节点: z.record(z.string(), 幽灵节点Schema).default({}), // 占位ID → 幽灵
});

// ══════════════════════════════════════════
// 编年史（6.43）
// ══════════════════════════════════════════

const 媒介附件Schema = z.object({
  格式模板键: z.string().default(''), // 取值 = 媒介登记表的媒介键（6.44）
  渠道标签: z.string(), // 必填
  // 只读展示件，引擎判定永不读；永久保存为默认；玩家删除只删展示件、事实条目软隐藏（隐藏收藏清单字段归 P1 增补）；丢失/被删走同事实包+模板+seed 重生成；导出可剥离
  渲染缓存全文: z.string().max(HISTORY_TEXT_MAX).default(''),
});

export const 编年史条目Schema = z.object({
  // append-only；L2 折叠 = 软折叠收冷区不物理删；玩家收藏豁免；媒介附件正文与玩家造物原文不参与折叠（折叠实装归 P1）
  // 知情过滤后才入册；covert 事不入册，declassify 后补「真相大白」新条
  序号: z.number().int(), // 单调递增主键
  时间: z.number().int().default(0), // 纪元分钟绝对时刻；0=哨兵；负值合法（史前/古代背景）
  标题: z.string().default(''),
  地点键: z.string().optional(),
  母题: z.string().optional(), // 开放串
  结果摘要行: z.string().default(''),
  关联实体键: z.array(z.string()).default([]),
  事件id: z.string().optional(),
  重要等级: z.string().default('重要'), // 路人/次要/重要/核心 同 NpcSchema.重要等级
  媒介附件: 媒介附件Schema.optional(),
});

// ══════════════════════════════════════════
// 覆写日志（附录H）
// ══════════════════════════════════════════

const 覆写日志条目Schema = z.object({
  时间: z.number().int().default(0), // 绝对纪元分钟
  授权源: z.string().default(''),
  级别: z.string().default(''),             // L1大额数值/L2改判定档/L3归零
  目标: z.string().default(''),
  理由: z.string().default(''),
  是否作弊: z.boolean().default(false),
});

// ══════════════════════════════════════════
// 全局层（顶层键 全局）
// ══════════════════════════════════════════

export const 全局Schema = z.object({
  秘密库: z.record(z.string(), 秘密库条目Schema).default({}),
  约定库: z.record(z.string(), 约定库条目Schema).default({}),
  继承包: 继承包Schema.default({}),
  家族树: 家族树Schema.default({}),
  覆写日志: z.array(覆写日志条目Schema).default([]),
  作弊标记: z.boolean().default(false), // 本周目不可逆
  编年史: z.array(编年史条目Schema).default([]), // append-only 既成事实记录
});

export type 全局Type = z.infer<typeof 全局Schema>;
export type 秘密库条目Type = z.infer<typeof 秘密库条目Schema>;
export type 约定库条目Type = z.infer<typeof 约定库条目Schema>;
