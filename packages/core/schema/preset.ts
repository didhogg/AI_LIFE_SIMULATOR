// 4.10 玩法预设 / 引擎配置层（不进存档）
// 校验用 schema；实际运行时由世界装配 WORLD_SETUP 注入引擎，不序列化进存档。
import { z } from 'zod';
import { 受治理句柄Schema } from './governedKeySpace.js';
import { 谓词串Schema } from './commonEntry.js';

// ── 粒度模板覆盖 ──
const 粒度模板条目Schema = z.object({
  跨度分钟: z.number().int().min(1).default(1440),
  行动点上限: z.number().int().min(1).default(4),
  叙事粒度提示: z.string().default(''),
});

export const 粒度模板覆盖Schema = z.record(
  z.string(), // 粒度名：即时/日常/发展/世代
  粒度模板条目Schema,
).default({});

// ── 难度系数组（M6·AA8·旋钮可变性：组边界可切·切点即分段点）──────────────────────
// 可变性裁定：难度系数组属"组边界可切换"旋钮（对局中允许改、生效在指令组边界）。
// 分段语义：难度切换在指令组边界生效 → 新组锚点 = 新难度分段点（与 U3 版本分段共用同一台分段机器）。
// 实际分段机器（组锚点写入/分段截断/段头快照）= U3，归 P0-9/P0-10 实装；本层只声明数值面。
// 指纹归属：快照锁定组（SNAPSHOT_FIELDS·开局锁定·随档整体快照；切换后新段新指纹）。
export const 难度系数组Schema = z.object({
  基础成功率调整: z.number().min(-50).max(50).default(0),
  秘密暴露系数: z.number().min(0).max(10).default(1),
  NPC_敌意系数: z.number().min(0).max(10).default(1),
  经济难度系数: z.number().min(0).max(10).default(1),
}).passthrough();

// ── 导入保真度三档（对撞·mod/卡导入检验口径）─────────────────────────────────────────
// compat_strict = 旧版严格兼容（禁任何新字段）
// compat_plus   = 兼容+扩展（允许已知扩展字段·禁未知字段）
// native        = 原生 V4.1（完整 schema·最严格验证）
export const 导入保真度枚举 = ['compat_strict', 'compat_plus', 'native'] as const;
export type 导入保真度 = (typeof 导入保真度枚举)[number];

// ── 属性轴表 + 检定配方表（6.26 / 6.45 / 6.48） ──
const 检定配方条目Schema = z.object({
  配方名: z.string().default(''),
  主属性: z.string().default(''),
  副属性列: z.array(z.object({
    轴名: z.string().default(''),
    权重: z.number().min(0).max(1).default(0),
    // 6.48 停用轴中性缺省：停用=true 时引擎读 中性缺省，不读轴数据
    停用: z.boolean().default(false),
    中性缺省: z.number().default(0),
  })).default([]),
  难度修正: z.number().default(0),
  母题标签: z.array(z.string()).default([]),
  // 6.45 拓扑: 即掷（当场掷骰·P0 实装）| 骰池（拍首预掷入池·P2 实装）
  拓扑: z.enum(['即掷', '骰池']).default('即掷'),
  // 6.45 宿主类型: 声明属性轴数据来源
  // 角色→NPC属性轴（P0-5 实装）; 组织/世界域→P0-1 schema 接线后接入
  宿主类型: z.enum(['角色', '组织', '世界域']).default('角色'),
});

export const 检定配方表Schema = z.record(z.string(), 检定配方条目Schema).default({});

export const 属性轴表Schema = z.array(z.object({
  轴名: z.string().default(''),
  说明: z.string().default(''),
  最大值: z.number().int().min(1).default(100),
  自然上限: z.number().int().min(1).default(20),
  允许年龄衰减: z.boolean().default(false),
  // Step 3-A·黄金窗口预埋·schema-only：缺省即 undefined（绝不给默认值），
  // 既有存档 canonicalize 不取材此字段，指纹零变。
  // Step 7(6.59)：形态 refine 已收紧（归一非空∧非JS保留键∧扁平命名正则）·
  //   成员校验 against registry 留 P0-6（命名空间='cascade句柄'）。
  cascade_on_change: z.array(受治理句柄Schema).optional(),
})).default([]);

// ── 派生量配方（发现B·M·4·随整包入指纹）──────────────────────────────────────────
// HP=f(体质)·精力=f(体质×0.7+心理×0.3)·等个人派生量均由此子表声明
// 改配方即改判定面 → 必须随 hashJudgmentBundle 入指纹
const 派生量配方条目Schema = z.object({
  配方名: z.string().default(''),          // 派生量名（HP/精力/专注度/…）
  主属性: z.string().default(''),          // 主轴（隐含权重=1·未加权时直取值）
  副属性列: z.array(z.object({
    轴名: z.string().default(''),
    权重: z.number().min(0).max(1).default(0), // 副轴权重·sum(副) ≤ 1
  })).default([]),
  基础值: z.number().default(0),           // 种族/职业等固定基底
  比例系数: z.number().min(0).default(1),  // 全属性值×系数后加基础值
}).strip();

export const 派生量配方Schema = z.record(z.string(), 派生量配方条目Schema).default({});

// ── 赛事结构模板（6.35） ──
const 赛事模板条目Schema = z.object({
  参与者选择器: z.string().default(''),
  赛制: z.string().default(''), // 淘汰/积分/循环/…；'' = 无预设（开放串·作者面）
  轮次: z.number().int().min(1).default(1),
  检定配方引用: z.string().default(''),
  排名表: z.record(z.string(), z.number()).default({}),
  奖励钩子: z.string().default(''),
});

export const 赛事结构模板Schema = z.record(z.string(), 赛事模板条目Schema).default({});

// ── 规则补丁（6.28·白名单参数面） ──
const 规则补丁条目Schema = z.object({
  补丁名: z.string().default(''),
  // K5: 最终生效源获胜语义——多补丁叠覆时以最终生效那个为准（P0-6 接线引擎应用逻辑）
  是否作弊: z.boolean().default(false),
  秘密类型黑名单: z.array(z.string()).default([]),
  触发器禁用列表: z.array(z.string()).default([]),
  钳制表覆盖: z.record(z.string(), z.unknown()).default({}),
  母题配额置零: z.array(z.string()).default([]),
  种族模板覆盖: z.record(z.string(), z.unknown()).default({}),
  其他参数覆盖: z.record(z.string(), z.unknown()).default({}),
  // K5 per-key 合并策略声明（GW·schema-only·fire defer B6-Step5）
  // 玩家优先级最高；canonicalize 取材→规则补丁哈希（FINGERPRINT_PRESET_FIELDS）·设值即改指纹·正确行为
  per_key_策略: z.record(z.string(), z.object({
    策略: z.enum(['覆盖', '钳制', '加权', '叠加', '锁', '后载']).optional(),
    优先级来源: z.enum(['官方', '作者', '玩家']).optional(),
  })).optional(),
});

export const 规则补丁Schema = z.record(z.string(), 规则补丁条目Schema).default({});

// ── 概率域夹逼（H4·随整包入指纹·数值住预设）──────────────────────────────────────
// 所有判定概率 clamp 至 [p_最小, p_最大]；小概率稳定式复用 fixed.ts stableProb
export const 概率域夹逼Schema = z.object({
  p_最小: z.number().min(0).max(1).default(0.0001),  // 0.01% 下界
  p_最大: z.number().min(0).max(1).default(0.9999),  // 99.99% 上界
}).default({});

// ── 账面安全界限（H1·入账前 clamp·数值住预设）──────────────────────────────────────
// 键=字段路径（"属性.体质" / "货币.金币" 等）；越软顶→ clamp + ⚠播报
// 空表=仅依赖 kv 层约束；不进 hashJudgmentBundle（属安全执行层·非判定面）
const 账面安全界限条目Schema = z.object({
  硬底: z.number().optional(),                       // 低于则 clamp（兜底）
  软顶: z.number().optional(),                       // 超过则 clamp + 广播 ⚠
  硬顶: z.number().optional(),                       // 超过则 clamp（更严·无播报）
  年化增长率警戒线: z.number().min(0).optional(),   // warnAnnualRate 触发阈值（缺省 1.0）
}).strip();

export const 账面安全界限Schema = z.record(z.string(), 账面安全界限条目Schema).default({});

// ══════════════════════════════════════════
// 骰面量化层 / 叙事层 / 开局层（4.11 · 6.41 · 6.42）
// ══════════════════════════════════════════

// 6.41⑦ 注入面防护：超过此长度的模板正文/风格提示词导入时拒收
export const 叙事模板正文长度上限 = 4000;

// 1a. 检定骰面（骰面量化层①）
const 暴击映射Schema = z.union([
  z.literal('关'),
  z.object({
    顶格升一档: z.boolean().default(true),
    底格降一档: z.boolean().default(true),
  }),
]);

export const 检定骰面Schema = z.object({
  判定骰型: z.union([z.literal(100), z.literal(20)]).default(100),
  显骰: z.boolean().default(false),
  暴击映射: 暴击映射Schema.default('关'),
});

// ══════════════════════════════════════════
// P0-5 检定判定层（余量制·双层钳制·进指纹）
// ══════════════════════════════════════════

// 检定档切分表（余量制：M = 公式值 − u，u ∈ [0,99]）
// 切分界是数据·住玩法预设层·可被规则补丁覆盖·进指纹
export const 检定档切分表Schema = z.object({
  大胜下限: z.number().int().default(40),   // M >= 大胜下限 → 大胜
  胜下限: z.number().int().default(15),     // 胜下限 <= M < 大胜下限 → 胜
  惨胜下限: z.number().int().default(1),    // 惨胜下限 <= M < 胜下限 → 惨胜
  败下限: z.number().int().default(-24),    // 败下限 <= M < 惨胜下限 → 败
  // M < 败下限 → 溃
}).default({});

// 双层钳制表（P0-5 占位·P0-6 闸逻辑接线）
// 字段级优先·重要等级兜底·进指纹
export const 钳制表Schema = z.object({
  按重要等级: z.object({
    路人: z.number().optional(),
    次要: z.number().optional(),
    重要: z.number().optional(),
    核心: z.number().optional(),
  }).default({}),
  按字段: z.record(
    z.string(), // 字段路径键（如 "属性.智慧" / "技能.*"）
    z.object({
      单次Δ上限: z.number().optional(),
      最小值: z.number().optional(),
      最大值: z.number().optional(),
    }),
  ).default({}),
}).default({});

// ══════════════════════════════════════════
// P0-1 4.10 缺口：六项补全
// ══════════════════════════════════════════

// 缺口三·死亡拦截器条目（缺口1/6.45·list）
// ⚠ 概率参数住检定配方表（进指纹），本结构只放配方引用，不直接写概率
export const 死亡拦截器条目Schema = z.object({
  注册者: z.string().default(''),    // 注册方标识（系统/mod/玩法预设键）
  优先级: z.number().int().min(0).default(0),
  条件引用: z.string().default(''),  // 触发契约四类·概率条件强制天命通道（配方引用键）
  目标动词: z.string().default(''),  // 穿越契约引用键
  主权降级: z.enum(['需确认', '凌驾抢话档']).optional(), // 主权地板占位·P0-7 fire（强制确认/凌驾抢话档·复用 N-8）·语义/层级 fire 时终定·全 .optional 无 default＝零迁移
}).strip();

// 缺口四·换角许可（6.45·缺省=单人单角）
export const 换角许可Schema = z.object({
  候选选择器: z.string().default(''),          // 开放串·候选角色选择器表达式
  冷却: z.number().int().min(0).default(0),    // 游戏时长（纪元分钟）
  次数上限: z.number().int().min(0).optional(),
  谢幕卡开关: z.boolean().default(true),
}).strip();

// ══════════════════════════════════════════
// 动词选项条目（AOHP preset 侧声明·无 option_id·由引擎派生）
// 口径：对应 ActionOptionSchema 去掉 option_id（该字段由 buildOptionId 确定性派生）
// 约束：≤99 条（受 rngFor [0,99] 精度·partialShuffleSample 无偏样本约束）
// ══════════════════════════════════════════

export const 动词选项条目Schema = z.object({
  verb:           z.string().default(''),           // 动词（来自 动词Id枚举·运行时校验）
  target_choices: z.array(z.string()).default([]),  // 目标变量全状态路径候选（变量驱动底座）
  tool_name:      z.string().default(''),           // 调用工具名（open string）
  params:         z.record(z.string(), z.unknown()).default({}), // 参数 map（含 关联实体[] 对手方路径）
  salient_args:   z.string().optional(),            // 显著参数文本·用于 option_id 派生
  value_slot:     z.string().optional(),            // 绑定的数值槽键
  min:            z.number().optional(),            // 数值槽最小值
  max:            z.number().optional(),            // 数值槽最大值
  display_text:   z.string().optional(),            // 显示标签（不纳入 option_id·纯展示）
}).strip();

export type 动词选项条目Type = z.infer<typeof 动词选项条目Schema>;

// ── 経済生成規則（内容包裸标量·经 resolve() 聚合·Step0 迁移）──────────────────────
export const 経済生成規則Schema = z.object({
  品类基线: z.record(z.string(), z.number()).optional(),
  资源紧张度权重: z.number().min(0).max(1).optional(),
  供需权重: z.number().min(0).max(1).optional(),
  战时修正权重: z.number().min(0).max(1).optional(),
  衰减率: z.number().min(0).max(1).optional(),
});
export type 経済生成規則Type = z.infer<typeof 経済生成規則Schema>;

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
  packs: z.array(z.string()).default([]),   // 内容包引用列表（按顺序·后列覆盖先列）
  rules: z.array(z.string()).optional(),    // 规则引用列表（按顺序·后列覆盖先载）
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
    监测轴:   z.string().optional(),    // Tier B: 轴名（如 '声望'/'民心'），经 descriptor.读数值轴 解析
    触发阈值: z.string().optional(),    // Tier B: DSL 谓词片段（如 '> 30%'·与监测轴合成完整谓词）
  })).optional(),
  // ── ③C STOPPED（DSL 版本·常量不匹配·待用户拍板后删）──────────────────────────
  DSL文法版本: z.string().default('1.0'),
  // §十A 分层方案·v1={min,max,clamp,pow,sqrt}全逐位恒等固定实现·增列超越函数时 bump
  求值器函数库版本: z.number().int().min(1).default(1),
});

export type 玩法预设Type = z.infer<typeof 玩法预设Schema>;
export type 检定配方条目Type = z.infer<typeof 检定配方条目Schema>;
export type 规则补丁条目Type = z.infer<typeof 规则补丁条目Schema>;
