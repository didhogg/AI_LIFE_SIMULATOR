// PR-瘦身·物品库 · additive · dormant · 进内容哈希 · 不进 hashJudgmentBundle
// schemaKeys 守恒 52：物品库属装配层·不进 RootSchema
// 物品定义层（作者声明）⊥ actor.物品（per-actor 运行期持有 record·actor.ts:438）·零打架
// 命名避撞：actor.ts 已有运行期 物品条目Schema·本文件用 物品定义条目Schema 区分
// 纯 schema + 类型·无副作用·禁 Date.now / new Date / Math.random / window / document
import { z } from 'zod';
import { 变量模板Schema } from './commonEntry.js';

export const 物品ID正则 = /^[a-z][a-z0-9_]*$/;

// ── 物品定义条目 ── 四层：信封 + 作者声明定义事实 + 展示层（opaque）────────────────
// ① 信封 typed（resolve 三层校验 + content_hash 可复现面）
// ② 作者声明定义事实（镜像 actor.物品条目 中"可由定义钤印"的字段·开放串·去枚举）
//    actor.物品条目 运行期字段（数量/到期实例值/可携意象/物品状态）属 per-actor 不镜像
// ③ 展示层·认知 opaque（显示名/图标/flavor·引擎零解释·不进指纹）
export const 物品定义条目Schema = z.object({
  // ① 信封
  名称: z.string(),
  版本: z.string().optional(),
  作者: z.string().optional(),
  描述: z.string().optional(),
  内容哈希: z.string().optional(),     // mod 可复现面·进内容包哈希（computeEffectPackHash）

  // ② 作者声明定义事实（开放串·去枚举·守玩家主权③）
  类别:           z.string().optional(),          // 对齐 actor.物品条目.类别（开放串）
  默认重要级别:   z.string().optional(),          // 对齐 actor.物品条目.重要级别
  稀有度:         z.string().optional(),          // 开放串·稀有度库 P0-8+ 未建·暂不引用命名空间（反枚举）
  默认到期:       z.number().int().optional(),    // 对齐 actor.物品条目.到期（绝对纪元分钟·0=永久）
  默认遗失保护:   z.boolean().optional(),         // 对齐 actor.物品条目.遗失保护
  // 修饰通道引用Schema 全对齐 deferred（actor 端引用 schema 未导出·仿成就库.解锁后果引用）
  默认效果引用:   z.array(z.unknown()).optional(),

  // ③ 展示层·认知 opaque（引擎零解释·不进指纹·守作者自由）
  展示: z.record(z.string(), z.unknown()).optional(),

  // P9-1 · 参数集变量模板（作者定义层·挂载于物品定义条目·dormant 接入·additive·0 重定基）
  变量模板: 变量模板Schema.optional(),
});

// ── 物品库 = record<物品ID, 物品定义条目>.default({}) ───────────────────────────
export const 物品库Schema = z.record(
  z.string().regex(物品ID正则, { message: '物品ID 须为蛇形 /^[a-z][a-z0-9_]*$/' }),
  物品定义条目Schema,
).default({});

export type 物品定义条目Type = z.infer<typeof 物品定义条目Schema>;
export type 物品库Type       = z.infer<typeof 物品库Schema>;
