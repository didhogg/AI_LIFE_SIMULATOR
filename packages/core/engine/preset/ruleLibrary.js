// PR-瘦身-底座-2b · 规则库 schema + 双轨搬入（12 张规则表种子视图）
// additive-only: 厚预设字段一律不动·双轨并存
// dormant: 不接 runTick · 不进 hashPresetFingerprint / hashJudgmentBundle
// 纯 schema + 派生常量·无副作用·禁 Date.now/Math.random/window/document
// schemaKeys 守恒 52：规则库属装配层·不进 RootSchema
import { z } from 'zod';
import { 受治理句柄Schema } from '../../schema/governedKeySpace.js';
import { 粒度模板覆盖Schema } from '../../schema/preset.js';
import { 种子视图 } from './seedView.js';
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
    配方名: z.string().default(''), // 派生量名（HP/精力/专注度/…）
    主属性: z.string().default(''), // 主轴（隐含权重=1·未加权时直取值）
    副属性列: z.array(z.object({
        轴名: z.string().default(''),
        权重: z.number().min(0).max(1).default(0), // 副轴权重·sum(副) ≤ 1
    })).default([]),
    基础值: z.number().default(0), // 种族/职业等固定基底
    比例系数: z.number().min(0).default(1), // 全属性值×系数后加基础值
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
    p_最小: z.number().min(0).max(1).default(0.0001), // 0.01% 下界
    p_最大: z.number().min(0).max(1).default(0.9999), // 99.99% 上界
}).default({});
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
// 检定档切分表（余量制：M = 公式值 − u，u ∈ [0,99]）
// 切分界是数据·住玩法预设层·可被规则补丁覆盖·进指纹
export const 检定档切分表Schema = z.object({
    大胜下限: z.number().int().default(40), // M >= 大胜下限 → 大胜
    胜下限: z.number().int().default(15), // 胜下限 <= M < 大胜下限 → 胜
    惨胜下限: z.number().int().default(1), // 惨胜下限 <= M < 胜下限 → 惨胜
    败下限: z.number().int().default(-24), // 败下限 <= M < 惨胜下限 → 败
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
    按字段: z.record(z.string(), // 字段路径键（如 "属性.智慧" / "技能.*"）
    z.object({
        单次Δ上限: z.number().optional(),
        最小值: z.number().optional(),
        最大值: z.number().optional(),
    })).default({}),
}).default({});
// 缺口三·死亡拦截器条目（缺口1/6.45·list）
// ⚠ 概率参数住检定配方表（进指纹），本结构只放配方引用，不直接写概率
export const 死亡拦截器条目Schema = z.object({
    注册者: z.string().default(''), // 注册方标识（系统/mod/玩法预设键）
    优先级: z.number().int().min(0).default(0),
    条件引用: z.string().default(''), // 触发契约四类·概率条件强制天命通道（配方引用键）
    目标动词: z.string().default(''), // 穿越契约引用键
    主权降级: z.enum(['需确认', '凌驾抢话档']).optional(), // 主权地板占位·P0-7 fire（强制确认/凌驾抢话档·复用 N-8）·语义/层级 fire 时终定·全 .optional 无 default＝零迁移
}).strip();
// 缺口四·换角许可（6.45·缺省=单人单角）
export const 换角许可Schema = z.object({
    候选选择器: z.string().default(''), // 开放串·候选角色选择器表达式
    冷却: z.number().int().min(0).default(0), // 游戏时长（纪元分钟）
    次数上限: z.number().int().min(0).optional(),
    谢幕卡开关: z.boolean().default(true),
}).strip();
const rule_id正则 = /^[a-z][a-z0-9_]*$/;
// ── 规则元数据 — mirror 内容包元数据口径（rule_id 正则同 pack_id） ─────────────
export const 规则元数据Schema = z.object({
    rule_id: z.string().regex(rule_id正则, { message: 'rule_id 须为蛇形 /^[a-z][a-z0-9_]*$/' }),
    版本: z.string().default('0.1.0'),
    名称: z.string().default(''),
    作者: z.string().default(''),
    描述: z.string().default(''),
    依赖: z.array(z.string()).default([]),
    冲突: z.array(z.string()).default([]),
    内容哈希: z.string().optional(),
    // A2 口径对齐（additive·可空·resolve() 消费·不进 hashJudgmentBundle）
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
// ── 规则面 — 12 张规则表 + 归并表 各自 种子视图 的 optional 组合 ──────────────
// 一条目可携任意子集；作者加规则 = 加一条目；零枚举
// 各字段经 种子视图() 剥除 ZodDefault / ZodEffects·全字段 optional·无 0 default 污染
export const 规则面Schema = z.object({
    // 玩法预设 :480 难度系数组
    难度系数组: 种子视图(难度系数组Schema).optional(),
    // 玩法预设 :482 属性轴表
    属性轴表: 种子视图(属性轴表Schema).optional(),
    // 玩法预设 :483 检定配方表
    检定配方表: 种子视图(检定配方表Schema).optional(),
    // 玩法预设 :484 派生量配方
    派生量配方: 种子视图(派生量配方Schema).optional(),
    // 玩法预设 :496 赛事结构模板
    赛事结构模板: 种子视图(赛事结构模板Schema).optional(),
    // 玩法预设 :498 规则补丁
    规则补丁: 种子视图(规则补丁Schema).optional(),
    // 玩法预设 :500 检定骰面
    检定骰面: 种子视图(检定骰面Schema).optional(),
    // 玩法预设 :508 检定档切分表
    检定档切分表: 种子视图(检定档切分表Schema).optional(),
    // 玩法预设 :509 钳制表
    钳制表: 种子视图(钳制表Schema).optional(),
    // 玩法预设 :510 概率域夹逼
    概率域夹逼: 种子视图(概率域夹逼Schema).optional(),
    // 玩法预设 :535 死亡拦截器条目（list）
    死亡拦截器条目: 种子视图(z.array(死亡拦截器条目Schema)).optional(),
    // 玩法预设 :537 换角许可
    换角许可: 种子视图(换角许可Schema).optional(),
    // 玩法预设 :522 归并表（一并纳入）
    归并表: z.record(z.string(), z.unknown()).optional(),
    // ── ③1A 判定面补完（粒度/纠缠闭包/约定谓词/级联限制·Step1A 迁入·dormant）──────
    粒度模板覆盖: 种子视图(粒度模板覆盖Schema).optional(),
    纠缠闭包弱边阈值: z.number().min(0).max(1).optional(),
    约定谓词集: z.record(z.string(), z.string()).optional(),
    级联限制: z.object({
        最大深度: z.number().int().min(0),
        最大轮数: z.number().int().min(0),
    }).optional(),
});
// ── 规则条目 = 规则元数据 + 规则面 ──────────────────────────────────────────────
// 规则面 schema 自带结构校验（种子视图 passthrough）·与 内容包条目Schema 同族模式
export const 规则条目Schema = z.object({
    ...规则元数据Schema.shape,
    规则面: 规则面Schema.optional(),
});
// ── 规则库 = record<rule_id, 规则条目>.default({}) ──────────────────────────────
export const 规则库Schema = z.record(z.string().regex(rule_id正则), 规则条目Schema).default({});
// 规则面键集（17 项：12 张规则表 + 归并表 + ③1A 四字段·供外部引用·派生自 规则面Schema.shape）
export const 规则面键集 = Object.keys(规则面Schema.shape);
