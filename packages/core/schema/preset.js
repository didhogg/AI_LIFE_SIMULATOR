// 4.10 玩法预设 / 引擎配置层（不进存档）
// 校验用 schema；实际运行时由世界装配 WORLD_SETUP 注入引擎，不序列化进存档。
import { z } from 'zod';
import { 谓词串Schema } from './commonEntry.js';
// ── 粒度模板覆盖 ──
const 粒度模板条目Schema = z.object({
    跨度分钟: z.number().int().min(1).default(1440),
    行动点上限: z.number().int().min(1).default(4),
    叙事粒度提示: z.string().default(''),
});
export const 粒度模板覆盖Schema = z.record(z.string(), // 粒度名：即时/日常/发展/世代
粒度模板条目Schema).default({});
// ── 导入保真度三档（对撞·mod/卡导入检验口径）─────────────────────────────────────────
// compat_strict = 旧版严格兼容（禁任何新字段）
// compat_plus   = 兼容+扩展（允许已知扩展字段·禁未知字段）
// native        = 原生 V4.1（完整 schema·最严格验证）
export const 导入保真度枚举 = ['compat_strict', 'compat_plus', 'native'];
// ── 账面安全界限（H1·入账前 clamp·数值住预设）──────────────────────────────────────
// 键=字段路径（"属性.体质" / "货币.金币" 等）；越软顶→ clamp + ⚠播报
// 空表=仅依赖 kv 层约束；不进 hashJudgmentBundle（属安全执行层·非判定面）
const 账面安全界限条目Schema = z.object({
    硬底: z.number().optional(), // 低于则 clamp（兜底）
    软顶: z.number().optional(), // 超过则 clamp + 广播 ⚠
    硬顶: z.number().optional(), // 超过则 clamp（更严·无播报）
    年化增长率警戒线: z.number().min(0).optional(), // warnAnnualRate 触发阈值（缺省 1.0）
}).strip();
export const 账面安全界限Schema = z.record(z.string(), 账面安全界限条目Schema).default({});
// 6.41⑦ 注入面防护：超过此长度的模板正文/风格提示词导入时拒收
export const 叙事模板正文长度上限 = 4000;
// ══════════════════════════════════════════
// 动词选项条目（AOHP preset 侧声明·无 option_id·由引擎派生）
// 口径：对应 ActionOptionSchema 去掉 option_id（该字段由 buildOptionId 确定性派生）
// 约束：≤99 条（受 rngFor [0,99] 精度·partialShuffleSample 无偏样本约束）
// ══════════════════════════════════════════
export const 动词选项条目Schema = z.object({
    verb: z.string().default(''), // 动词（来自 动词Id枚举·运行时校验）
    target_choices: z.array(z.string()).default([]), // 目标变量全状态路径候选（变量驱动底座）
    tool_name: z.string().default(''), // 调用工具名（open string）
    params: z.record(z.string(), z.unknown()).default({}), // 参数 map（含 关联实体[] 对手方路径）
    salient_args: z.string().optional(), // 显著参数文本·用于 option_id 派生
    value_slot: z.string().optional(), // 绑定的数值槽键
    min: z.number().optional(), // 数值槽最小值
    max: z.number().optional(), // 数值槽最大值
    display_text: z.string().optional(), // 显示标签（不纳入 option_id·纯展示）
}).strip();
// ── 経済生成規則（内容包裸标量·经 resolve() 聚合·Step0 迁移）──────────────────────
export const 経済生成規則Schema = z.object({
    品类基线: z.record(z.string(), z.number()).optional(),
    资源紧张度权重: z.number().min(0).max(1).optional(),
    供需权重: z.number().min(0).max(1).optional(),
    战时修正权重: z.number().min(0).max(1).optional(),
    衰减率: z.number().min(0).max(1).optional(),
});
// ══════════════════════════════════════════
// 玩法预设根（顶层）
// ══════════════════════════════════════════
export const 玩法预设Schema = z.object({
    // ── ① 骨架（拼装器/冰箱清单·没声明=不存在）────────────────────────────────────
    预设ID: z.string().default(''),
    名称: z.string().default(''),
    版本: z.string().default('0.1.0'),
    作者: z.string().default(''),
    描述: z.string().default(''),
    migration_version: z.number().int().min(0).default(0),
    // ── 薄清单（装配层·指向内容包库+规则库·由 resolve() 处理）─────────────────────
    packs: z.array(z.string()).default([]), // 内容包引用列表（按顺序·后列覆盖先列）
    rules: z.array(z.string()).optional(), // 规则引用列表（按顺序·后列覆盖先载）
    // ── PR-0 · 预设元数据 v2（additive·空跑·消费留 G2 / PR-1~5）───────────────────
    父预设: z.string().optional(),
    创建时预设版本: z.string().optional(),
    派生标记: z.boolean().optional(),
    默认模板: z.boolean().optional(),
    LOD保温窗口: z.number().int().min(0).optional(),
    // LOD-B2.5 · 模块绑定策略（PR-5c-1·additive·排外·opt-in 漂移触发·不进指纹）
    // record key '*' = 全模块默认；per-module key 覆盖全局默认；缺省=不参与漂移（实体永全态）
    // Tier A: 触发谓词（DSL 完整谓词串·直接驱动）
    // Tier B: 监测轴 + 触发阈值（合成 '漂移.{监测轴} {触发阈值}'·DSL 谓词片段）
    // 无任何字段 → resolveLodPredicate → null → 引擎跳过·不评估·不 demote
    模块绑定策略: z.record(z.string(), z.object({
        触发谓词: 谓词串Schema.optional(), // Tier A: 完整 DSL 谓词·evalPredStr 驱动·排外路径·不进 collectLorePredicates
        监测轴: z.string().optional(), // Tier B: 轴名（如 '声望'/'民心'），经 descriptor.读数值轴 解析
        触发阈值: z.string().optional(), // Tier B: DSL 谓词片段（如 '> 30%'·与监测轴合成完整谓词）
    })).optional(),
    // ── ③C STOPPED（DSL 版本·常量不匹配·待用户拍板后删）──────────────────────────
    DSL文法版本: z.string().default('1.0'),
    // §十A 分层方案·v1={min,max,clamp,pow,sqrt}全逐位恒等固定实现·增列超越函数时 bump
    求值器函数库版本: z.number().int().min(1).default(1),
});
