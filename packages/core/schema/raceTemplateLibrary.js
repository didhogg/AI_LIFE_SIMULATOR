// PR-瘦身·种族模板库 · additive · dormant · 进 hashJudgmentBundle · 投影回填
// schemaKeys 守恒 52：种族模板库属装配层·不进 RootSchema
// 进 BUNDLE：投影种族模板库() 产出 与旧 种族模板Schema 逐位等价的 record·零重定基
//    dormant·投影结果需调用方主动传入 hashJudgmentBundle 的 种族模板 参数
// 纯 schema + 投影函数·无副作用·禁 Date.now / new Date / Math.random / window / document
import { z } from 'zod';
export const 种族模板ID正则 = /^[a-z][a-z0-9_]*$/;
// ── 发育阶段 Schema（对齐 preset.ts 发育阶段Schema·含 superRefine 语义闸） ─────────
const 发育阶段Schema = z.object({
    阶段名: z.string().default(''),
    起始年龄分钟: z.number().int().min(0).default(0),
    结束年龄分钟: z.number().int().min(0).optional(),
    属性系数: z.record(z.string(), z.number()).default({}),
}).superRefine((data, ctx) => {
    if (data.结束年龄分钟 !== undefined && data.结束年龄分钟 <= data.起始年龄分钟) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['结束年龄分钟'],
            message: `发育阶段: 结束年龄分钟 (${data.结束年龄分钟}) 须 > 起始年龄分钟 (${data.起始年龄分钟})`,
        });
    }
});
// ── 种族模板定义条目 = 信封 + 种族数据体（defaults 对齐旧 种族模板Schema value） ──────
// 数据体字段含 default 值·确保投影结果与旧 种族模板Schema.parse() 逐位等价
export const 种族模板定义条目Schema = z.object({
    // 信封
    名称: z.string(),
    版本: z.string().optional(),
    作者: z.string().optional(),
    描述: z.string().optional(),
    内容哈希: z.string().optional(),
    // 种族数据体（对齐 preset.ts 种族模板Schema 的 value·含默认值·dormant·进 BUNDLE 投影）
    寿命基准: z.number().int().min(1).default(75),
    衰老系数: z.number().min(0).max(10).default(1),
    发育阶段表: z.array(发育阶段Schema).default([]),
    遗传参数: z.record(z.string(), z.number()).default({}),
    最小生育年龄分钟: z.number().int().min(0).default(0),
});
// ── 种族模板库 = record<种族模板ID, 种族模板定义条目>.default({}) ─────────────────────
export const 种族模板库Schema = z.record(z.string().regex(种族模板ID正则, { message: '种族模板ID 须为蛇形 /^[a-z][a-z0-9_]*$/' }), 种族模板定义条目Schema).default({});
// ── 投影函数：record<种族ID, 种族模板定义条目> → record<种族ID, 种族数据体> ──────────────
// 剥离信封字段（名称/版本/作者/描述/内容哈希）·还原旧 种族模板Schema value 形态
// 0 重定基硬门：hashCanonical(投影结果) === hashCanonical(旧 种族模板字段值)
export function 投影种族模板库(lib) {
    const result = {};
    for (const [id, entry] of Object.entries(lib)) {
        if (!Object.prototype.hasOwnProperty.call(lib, id))
            continue;
        const { 名称: _名称, 版本: _版本, 作者: _作者, 描述: _描述, 内容哈希: _内容哈希, ...体 } = entry;
        result[id] = 体;
    }
    return result;
}
