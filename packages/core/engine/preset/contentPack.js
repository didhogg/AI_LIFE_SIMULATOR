// PR-瘦身-A1/A2·剥离③ · 内容包库 schema
// 模块菜单 100% 从引擎单一源 RootSchema.shape 派生·零手写清单
// 两级 fail：顶层键 ∉ RootSchema → fail-closed / 子键词表 → fail-open
// dormant: 不接 runTick · 不进 hashPresetFingerprint / hashJudgmentBundle
// 纯 schema + 派生常量·无副作用·禁 Date.now/Math.random/window/document
import { z } from 'zod';
import { RootSchema } from '../../schema/index.js';
import { 种子视图 } from './seedView.js';
import { 経済生成規則Schema, } from '../../schema/preset.js';
// ── 历法皮肤（附录 C） ──
export const 历法皮肤Schema = z.object({
    纪年法: z.string().default(''),
    纪元锚点: z.number().int().min(0).default(0),
    年号表: z.array(z.object({
        名称: z.string().default(''),
        起始纪元分钟: z.number().int().min(0).default(0),
    })).default([]),
    月制: z.string().default(''),
    显示模板: z.string().default(''),
});
// ── 财富分档参数 ──
export const 财富分档参数Schema = z.object({
    分档列表: z.array(z.object({
        档名: z.string().default(''),
        净资产下限: z.number().default(0),
        净资产上限: z.number().optional(),
        标准生活开销: z.number().min(0).default(0),
    })).default([]),
    默认基准币种: z.string().default(''),
});
// ── 欠债阈值与利息周期（6.25） ──
export const 欠债参数Schema = z.object({
    透支触发阈值: z.number().default(-1000), // 低于此值挂追债
    追债冷却分钟: z.number().int().min(0).default(43200),
    大额借贷下限: z.number().min(0).default(10000),
    利息周期分钟: z.number().int().min(1).default(43200),
    默认利率: z.number().min(0).default(0.05), // 年化
});
// ── 穿越契约（6.36） ──
export const 穿越契约Schema = z.object({
    属性映射: z.record(z.string(), z.string()).default({}), // 旧轴名→新轴名
    货币处理: z.string().default(''), // 丢失/按汇率/保留/归零
    技能等价表: z.record(z.string(), z.string()).default({}),
    携带白名单: z.array(z.string()).default([]),
    时间比率: z.number().min(0).default(1),
    随附规则补丁: z.string().optional(), // 规则补丁 ID 引用
});
// ── 开局装配数据（6.42） ──
const 序章模板Schema = z.object({
    模式: z.enum(['固定文本', '锚点引导', 'AI自由']).default('AI自由'),
    正文: z.string().optional(),
    锚点契约: z.string().optional(),
    引擎槽位: z.array(z.string()).default([]),
});
export const 开局装配数据Schema = z.object({
    // 凸成本点购曲线；不进 _tick.难度系数组指纹（6.42⑧）
    凸成本点购曲线: z.array(z.unknown()).default([]),
    出厂行动卡集: z.array(z.string()).default([]),
    序章模板: 序章模板Schema.default({}),
});
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
    可写键: z.array(z.string()).optional(), // 受治理路径声明·layer-2 轨道一致性校验
    轨道: z.enum(['gameplay', 'cosmetic', 'view', 'macro']).optional(), // 轻轨禁带可写键
});
// 模块菜单键集 — 100% 派生自 RootSchema.shape·引擎加模块自动扩菜单
export const 模块菜单键集 = Object.keys(RootSchema.shape);
// ── 模块种子校验逻辑（共用·不直接作 SuperRefinement 避免 TS 重载歧义） ─────────
// 两级 fail：顶层键 ∉ RootSchema.shape → fail-closed；子键词表 → fail-open
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
// 剥离③ 裸标量字段（optional·last-write-wins 由 load order 决·dormant·不接 resolve）
export const 内容包条目Schema = z.object({
    ...内容包元数据Schema.shape,
    模块种子: z.record(z.string(), z.unknown()).optional(),
    // ── 裸标量（剥离③·additive·dormant·resolve() 聚合时取最后声明包的值） ──────────
    历法皮肤: 历法皮肤Schema.optional(),
    财富分档参数: 财富分档参数Schema.optional(),
    欠债参数: 欠债参数Schema.optional(),
    穿越契约: 穿越契约Schema.optional(),
    开局装配数据: 开局装配数据Schema.optional(),
    経済生成規則: 経済生成規則Schema.optional(),
    // ── ③1D 休眠裸标量（Step1D 迁入·additive·dormant·resolve() 聚合时取最后声明包的值） ──
    世界遗产白名单出厂值: z.array(z.string()).optional(),
    事件来源权重出厂值: z.object({
        事件包: z.number().min(0).max(100),
        AI自发: z.number().min(0).max(100),
    }).optional(),
    角色激活配置: z.object({
        激活上限: z.number().min(0).max(100).optional(),
        沉默下限: z.number().min(0).max(100).optional(),
    }).optional(),
    // 作者底线·完整键→boolean·false=锁死禁AI改·true=明示允许·不进指纹（内容层·进 content_hash）
    AI控制策略: z.record(z.string(), z.boolean()).optional(),
}).superRefine((data, ctx) => 运行种子校验(data.模块种子, ctx));
// ── 内容包库 = record<pack_id, 内容包条目> ───────────────────────────────────────
export const 内容包库Schema = z.record(z.string(), 内容包条目Schema).default({});
// ── 薄清单 schema（单一权威·resolve.ts interface 薄清单 迁入此处·避免双声明漂移） ──────
// packs 必填·其余引用列表 optional·基底版本 optional
export const 薄清单Schema = z.object({
    packs: z.array(z.string()),
    rules: z.array(z.string()).optional(),
    ui: z.array(z.string()).optional(),
    tools: z.array(z.string()).optional(),
    achievements: z.array(z.string()).optional(),
    items: z.array(z.string()).optional(),
    media: z.array(z.string()).optional(),
    学业制式: z.array(z.string()).optional(),
    职级体系: z.array(z.string()).optional(),
    实体模板: z.array(z.string()).optional(),
    文风: z.array(z.string()).optional(),
    二审维度: z.array(z.string()).optional(),
    小剧场剧本: z.array(z.string()).optional(),
    选项集: z.array(z.string()).optional(),
    种族模板: z.array(z.string()).optional(),
    战术包: z.array(z.string()).optional(),
    叙事分发: z.array(z.string()).optional(),
    母题词汇: z.array(z.string()).optional(),
    母题配额: z.array(z.string()).optional(),
    离场演化契约: z.array(z.string()).optional(),
    社会角色: z.array(z.string()).optional(),
    基底版本: z.string().optional(),
});
