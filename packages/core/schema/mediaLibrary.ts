// PR-瘦身·媒体库 · additive · dormant · 进内容哈希 · 不进 hashJudgmentBundle
// schemaKeys 守恒 52：媒体库属装配层·不进 RootSchema
// 定义层（作者声明·传播面+渲染面）⊥ preset.媒介登记表（旧轨·暂留·双轨剥离再迁移）
// 命名避撞：preset.ts 已有 媒介登记条目Schema·本文件用 媒体定义条目Schema 区分
// 纯 schema + 类型·无副作用·禁 Date.now / new Date / Math.random / window / document
import { z } from 'zod';

export const 媒体ID正则 = /^[a-z][a-z0-9_]*$/;

// ── 媒体定义条目 ── 四层：信封 + 媒介类型事实 + 传播面（dormant） + 渲染面（opaque）──────────
// ① 信封 typed（resolve 三层校验 + content_hash 可复现面）
// ② 媒介类型·事实（开放串·去枚举·报纸/书/告示榜/地图/论坛/书信 仅注释示例·禁 enum）
// ③ 传播面·事实（dormant·勿接线·值域严格复用 preset.媒介登记条目 + preset.媒体渠道表）
//    整库不接 媒介传播面·不接 tick → 0 重定基；传播面字段只是 schema 占位
// ④ 渲染面·认知 opaque（容纳 模板正文/槽位/文风/禁词/配图/渲染缓存；
//    注入面防护 max 4000 留双轨剥离 reader 侧·本库 opaque 不强校验·与 UI库/工具库一致）
export const 媒体定义条目Schema = z.object({
  // ① 信封
  名称: z.string(),
  版本: z.string().optional(),
  作者: z.string().optional(),
  描述: z.string().optional(),
  内容哈希: z.string().optional(),    // mod 可复现面·进内容包哈希（computeEffectPackHash）

  // ② 媒介类型·事实（开放串·去枚举·报纸/书/告示榜/地图/论坛/书信 仅注释示例）
  媒介类型: z.string().optional(),

  // ③ 传播面·事实（dormant·勿接线·值域复用 preset.媒介登记条目 + 媒体渠道表）
  是否传播:   z.boolean().optional(),
  传播系数:   z.number().min(0).max(10).optional(),   // 对齐 preset.媒介登记表.传播系数（0-10）
  受众选择器: z.string().optional(),                  // 对齐 preset.媒体渠道表.受众选择器
  延迟分钟:   z.number().int().min(0).optional(),     // 对齐 preset.媒体渠道表.延迟分钟
  失真率:     z.number().min(0).max(1).optional(),    // 对齐 preset.媒介登记表.失真率（0-1）

  // ④ 渲染面·认知 opaque（引擎零解释·不进指纹·守作者内容自由）
  渲染载荷: z.record(z.string(), z.unknown()).optional(),
});

// ── 媒体库 = record<媒体ID, 媒体定义条目>.default({}) ─────────────────────────────
export const 媒体库Schema = z.record(
  z.string().regex(媒体ID正则, { message: '媒体ID 须为蛇形 /^[a-z][a-z0-9_]*$/' }),
  媒体定义条目Schema,
).default({});

export type 媒体定义条目Type = z.infer<typeof 媒体定义条目Schema>;
export type 媒体库Type       = z.infer<typeof 媒体库Schema>;
