// PR-瘦身·叙事分发库 · additive · dormant · 进内容哈希 · 不进 hashJudgmentBundle
// schemaKeys 守恒 52：叙事分发库属装配层·不进 RootSchema
//    dormant·不进 hashJudgmentBundle·整库 0 重定基
// 对应旧 preset.ts 叙事分发表Schema（FINGERPRINT_EXCLUDED_FIELDS 已列）
// 纯 schema + 类型·无副作用·禁 Date.now / new Date / Math.random / window / document
import { z } from 'zod';

export const 叙事分发ID正则 = /^[a-z][a-z0-9_]*$/;

// ── 叙事分发定义条目 = 信封 + 分发数据体（对齐 preset.ts 叙事分发条目Schema） ─────────
// 多锚点可指同一媒介；优先序 行动名＞设施＞事件标签，同级平局按键字典序
export const 叙事分发定义条目Schema = z.object({
  // 信封
  名称: z.string(),
  版本: z.string().optional(),
  描述: z.string().optional(),
  内容哈希: z.string().optional(),
  // 分发数据体（dormant·不进 hashJudgmentBundle）
  媒介键引用: z.string().default(''),
  优先级: z.number().int().optional(),
});

// ── 叙事分发库 = record<叙事分发ID, 叙事分发定义条目>.default({}) ────────────────────────
export const 叙事分发库Schema = z.record(
  z.string().regex(叙事分发ID正则, { message: '叙事分发ID 须为蛇形 /^[a-z][a-z0-9_]*$/' }),
  叙事分发定义条目Schema,
).default({});

export type 叙事分发定义条目Type = z.infer<typeof 叙事分发定义条目Schema>;
export type 叙事分发库Type       = z.infer<typeof 叙事分发库Schema>;
