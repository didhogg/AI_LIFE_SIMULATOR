// PR-瘦身-A1 · 内容包库 schema
// 模块菜单 100% 从引擎单一源 RootSchema.shape 派生·零手写清单
// 两级 fail：顶层键 ∉ RootSchema → fail-closed / 子键词表 → fail-open
// dormant: 不接 runTick · 不进 hashPresetFingerprint / hashJudgmentBundle
// 纯 schema + 派生常量·无副作用·禁 Date.now/Math.random/window/document
import { z } from 'zod';
import { RootSchema } from '../../schema/index.js';
import { 种子视图 } from './seedView.js';
const pack_id正则 = /^[a-z][a-z0-9_]*$/;
// 内容包元数据 — 来源鉴权/依赖声明
export const 内容包元数据Schema = z.object({
    pack_id: z.string().regex(pack_id正则, { message: 'pack_id 须为蛇形 /^[a-z][a-z0-9_]*$/' }),
    版本: z.string().default('0.1.0'),
    名称: z.string().default(''),
    作者: z.string().default(''),
    描述: z.string().default(''),
    依赖: z.array(z.string()).default([]),
    冲突: z.array(z.string()).default([]),
    内容哈希: z.string().optional(),
});
// 模块菜单键集 — 100% 派生自 RootSchema.shape·引擎加模块自动扩菜单
export const 模块菜单键集 = Object.keys(RootSchema.shape);
// 内容包内容 — 模块种子 record<模块键, 载荷>
// 两级 fail 口径：
//   顶层键 ∉ RootSchema.shape  → fail-closed（严·防无效模块键溢入）
//   子键（币种/母题/地点类别/稀有度…） → fail-open（沿 governedKeySpace 设计·受治理路径仅验形态）
export const 内容包内容Schema = z.object({
    // 模块参数集改由菜单驱动校验（非 z.unknown 黑洞）：每键路由至 种子视图(RootSchema.shape[键])
    模块种子: z.record(z.string(), z.unknown()).optional(),
}).superRefine((data, ctx) => {
    if (!data.模块种子)
        return;
    const shape = RootSchema.shape;
    for (const [key, value] of Object.entries(data.模块种子)) {
        if (!(key in shape)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['模块种子', key],
                message: `模块键「${key}」不在 RootSchema.shape（fail-closed）`,
            });
            continue;
        }
        // 路由至对应模块的种子视图
        // 单实例模块（ZodObject 派生）→ 种子视图返回 partial object
        // 多实例模块（ZodRecord 派生）→ 种子视图返回 record<id, partial entry>
        const seedSchema = 种子视图(shape[key]);
        const result = seedSchema.safeParse(value);
        if (!result.success) {
            for (const issue of result.error.issues) {
                ctx.addIssue({
                    ...issue,
                    path: ['模块种子', key, ...(issue.path ?? [])],
                });
            }
        }
    }
});
// 内容包条目 = 元数据 + 内容（完整声明避免 merge 后 superRefine 丢失）
export const 内容包条目Schema = z.object({
    pack_id: z.string().regex(pack_id正则, { message: 'pack_id 须为蛇形 /^[a-z][a-z0-9_]*$/' }),
    版本: z.string().default('0.1.0'),
    名称: z.string().default(''),
    作者: z.string().default(''),
    描述: z.string().default(''),
    依赖: z.array(z.string()).default([]),
    冲突: z.array(z.string()).default([]),
    内容哈希: z.string().optional(),
    模块种子: z.record(z.string(), z.unknown()).optional(),
}).superRefine((data, ctx) => {
    if (!data.模块种子)
        return;
    const shape = RootSchema.shape;
    for (const [key, value] of Object.entries(data.模块种子)) {
        if (!(key in shape)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['模块种子', key],
                message: `模块键「${key}」不在 RootSchema.shape（fail-closed）`,
            });
            continue;
        }
        const seedSchema = 种子视图(shape[key]);
        const result = seedSchema.safeParse(value);
        if (!result.success) {
            for (const issue of result.error.issues) {
                ctx.addIssue({
                    ...issue,
                    path: ['模块种子', key, ...(issue.path ?? [])],
                });
            }
        }
    }
});
// 内容包库 = record<pack_id, 内容包条目>
export const 内容包库Schema = z.record(z.string(), 内容包条目Schema).default({});
