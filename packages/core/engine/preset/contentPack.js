// PR-瘦身-A1/A2 · 内容包库 schema
// 模块菜单 100% 从引擎单一源 RootSchema.shape 派生·零手写清单
// 两级 fail：顶层键 ∉ RootSchema → fail-closed / 子键词表 → fail-open
// dormant: 不接 runTick · 不进 hashPresetFingerprint / hashJudgmentBundle
// 纯 schema + 派生常量·无副作用·禁 Date.now/Math.random/window/document
import { z } from 'zod';
import { RootSchema } from '../../schema/index.js';
import { 种子视图 } from './seedView.js';
const pack_id正则 = /^[a-z][a-z0-9_]*$/;
// ── 内容包元数据 — 来源鉴权/依赖声明 ──────────────────────────────────────────
export const 内容包元数据Schema = z.object({
    pack_id: z.string().regex(pack_id正则, { message: 'pack_id 须为蛇形 /^[a-z][a-z0-9_]*$/' }),
    版本: z.string().default('0.1.0'),
    名称: z.string().default(''),
    作者: z.string().default(''),
    描述: z.string().default(''),
    依赖: z.array(z.string()).default([]),
    冲突: z.array(z.string()).default([]),
    内容哈希: z.string().optional(),
    // A2 layer-2 校验字段（additive·可空·resolve() 消费·不进 hashJudgmentBundle）
    基底契约: z.string().optional().refine(v => {
        if (v === undefined || v === '')
            return true;
        if (/[\^~]/.test(v) || v.includes('||') || v.includes('-'))
            return false;
        return v.trim().split(/\s+/).every(part => /^(>=|<=|>|<|=)?\d+\.\d+\.\d+$/.test(part));
    }, { message: '基底契约须为 semver range（>=1.0.0 <2.0.0）·不支持 ^/~/||/prerelease' }),
    可写键: z.array(z.string()).optional(),
    轨道: z.enum(['gameplay', 'cosmetic', 'view', 'macro']).optional(),
});
// 模块菜单键集 — 100% 派生自 RootSchema.shape·引擎加模块自动扩菜单
export const 模块菜单键集 = Object.keys(RootSchema.shape);
// ── 模块种子校验逻辑（共用·不直接作 SuperRefinement 避免 TS 重载歧义） ─────────
function 运行种子校验(seeds, ctx) {
    if (!seeds)
        return;
    const shape = RootSchema.shape;
    for (const [key, value] of Object.entries(seeds)) {
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
}
// ── 内容包内容 — 模块种子 record<模块键, 载荷> ──────────────────────────────────
export const 内容包内容Schema = z.object({
    模块种子: z.record(z.string(), z.unknown()).optional(),
}).superRefine((data, ctx) => 运行种子校验(data.模块种子, ctx));
// ── 内容包条目 = 元数据 + 内容（共用 运行种子校验·消除字段重复） ──────────────────
export const 内容包条目Schema = z.object({
    ...内容包元数据Schema.shape,
    模块种子: z.record(z.string(), z.unknown()).optional(),
}).superRefine((data, ctx) => 运行种子校验(data.模块种子, ctx));
// ── 内容包库 = record<pack_id, 内容包条目> ───────────────────────────────────────
export const 内容包库Schema = z.record(z.string(), 内容包条目Schema).default({});
