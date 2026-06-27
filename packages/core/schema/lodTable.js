// LOD-B1 · LOD表 顶层键 · additive · dormant · 不进指纹（隐性排外）
// schemaKeys 守恒：53（+1 LOD表）
// 不接 lodScheduler（B2）· 旧 actor/org/map 占位字段原地保留（B4）
// 禁 Date.now / new Date / Math.random / window / document
import { z } from 'zod';
// ── 合一占位形态（NPC/org/map 三胞胎并集）─────────────────────────────────────
// 专属字段一律 optional，不给跨型默认值
// （NPC 默'NPC'·org 默'组织'·map 无此字段 → 三型值冲突 → optional 让各型自表达）
export const 合一占位形态Schema = z.object({
    // 共享（三型均有·唯一带 default 的字段）
    名称: z.string().default(''),
    // NPC / org 专属
    实体类型: z.string().optional(),
    硬约束: z.array(z.string()).optional(),
    来源拍号: z.number().int().optional(),
    _模板引用: z.string().optional(), // 血统只读·有下划线
    _模板快照: z.unknown().optional(), // K4 包卸载后脱包兜底·只读
    // map 专属（地形 / 拓扑种子；与 _模板引用 并存·不合并）
    父节点: z.string().optional(),
    相对方位: z.string().optional(),
    seed: z.string().optional(),
    模板引用: z.string().optional(), // map 无下划线版（⊥ _模板引用）
});
// ── LOD态条目 ────────────────────────────────────────────────────────────────
export const LOD态条目Schema = z.object({
    模块键: z.string(),
    档位: z.enum(['粗', '实体']).default('粗'),
    保温到期拍号: z.number().int().optional(),
    占位形态: 合一占位形态Schema.optional(),
    粗节点引用: z.string().optional(),
});
// ── LOD表（顶层键·record<任意模块键, LOD态条目>）───────────────────────────
export const LOD表Schema = z.record(z.string(), LOD态条目Schema).default({});
