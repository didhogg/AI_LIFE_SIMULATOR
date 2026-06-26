// PR-瘦身·社会角色库 · additive · dormant · 进内容哈希 · 不进 hashJudgmentBundle
// schemaKeys 守恒 52：社会角色库属装配层·不进 RootSchema
//    dormant·不进存档·不进 hashJudgmentBundle·整库 0 重定基
// 合并旧 preset.ts 三表（社会角色定义表/权重表/效应量表）为单 by-ID 库
//   每个库条目 key = 社会角色键·条目含 名称/描述（前 定义表）+ 场景权重（前 权重表）+ 效应量（前 效应量表）
// 纯 schema + 投影函数·无副作用·禁 Date.now / new Date / Math.random / window / document
import { z } from 'zod';

export const 社会角色ID正则 = /^[a-z][a-z0-9_]*$/;

// ── 社会角色定义条目 = 信封 + 三表字段融合 ──────────────────────────────────────────────
export const 社会角色定义条目Schema = z.object({
  // 信封（名称 = 前 社会角色定义表.名称·必填）
  名称: z.string(),
  版本: z.string().optional(),
  作者: z.string().optional(),
  // 前 社会角色定义表.描述
  描述: z.string().optional(),
  内容哈希: z.string().optional(),
  // 前 社会角色权重表.{角色键: {场景键: 权重}}（当前条目的内层 record）
  场景权重: z.record(z.string(), z.number()).optional(),
  // 前 社会角色效应量表.{角色键: 效应量}（当前条目的标量值）
  效应量: z.number().optional(),
});

// ── 社会角色库 = record<社会角色ID, 社会角色定义条目>.default({}) ─────────────────────────
export const 社会角色库Schema = z.record(
  z.string().regex(社会角色ID正则, { message: '社会角色ID 须为蛇形 /^[a-z][a-z0-9_]*$/' }),
  社会角色定义条目Schema,
).default({});

// ── 投影函数（三个·还原旧三表·供等价金测·dormant·不进 hashJudgmentBundle） ──────────────

// 投影→旧 社会角色定义表（record<角色ID, {名称, 描述?}>）
export function 投影社会角色定义表(lib: 社会角色库Type): Record<string, { 名称: string; 描述?: string }> {
  const result: Record<string, { 名称: string; 描述?: string }> = {};
  for (const [id, entry] of Object.entries(lib)) {
    if (!Object.prototype.hasOwnProperty.call(lib, id)) continue;
    result[id] = { 名称: entry.名称, ...(entry.描述 !== undefined ? { 描述: entry.描述 } : {}) };
  }
  return result;
}

// 投影→旧 社会角色权重表（record<角色ID, record<场景键, 权重>>）
// 条目 场景权重 为 undefined 或空时·该角色不进输出
export function 投影社会角色权重表(lib: 社会角色库Type): Record<string, Record<string, number>> {
  const result: Record<string, Record<string, number>> = {};
  for (const [id, entry] of Object.entries(lib)) {
    if (!Object.prototype.hasOwnProperty.call(lib, id)) continue;
    if (entry.场景权重 && Object.keys(entry.场景权重).length > 0) {
      result[id] = entry.场景权重;
    }
  }
  return result;
}

// 投影→旧 社会角色效应量表（record<角色ID, 效应量>）
// 条目 效应量 为 undefined 时·该角色不进输出
export function 投影社会角色效应量表(lib: 社会角色库Type): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [id, entry] of Object.entries(lib)) {
    if (!Object.prototype.hasOwnProperty.call(lib, id)) continue;
    if (entry.效应量 !== undefined) {
      result[id] = entry.效应量;
    }
  }
  return result;
}

export type 社会角色定义条目Type = z.infer<typeof 社会角色定义条目Schema>;
export type 社会角色库Type       = z.infer<typeof 社会角色库Schema>;
