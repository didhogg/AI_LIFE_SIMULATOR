// 4.10 玩法预设 / 引擎配置层（不进存档）
// 校验用 schema；实际运行时由世界装配 WORLD_SETUP 注入引擎，不序列化进存档。
import { z } from 'zod';
import { 受治理句柄Schema } from './governedKeySpace.js';

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

// ── 种族模板（6.30·世代钳制） ──
const 发育阶段Schema = z.object({
  阶段名: z.string().default(''),
  起始年龄分钟: z.number().int().min(0).default(0), // 相对纪元分钟
  结束年龄分钟: z.number().int().min(0).optional(),
  属性系数: z.record(z.string(), z.number()).default({}),
}).superRefine((data, ctx) => {
  // L-25 跨字段语义：结束年龄分钟须严格 > 起始年龄分钟（结构有效≠语义合法·防「零时长/逆序」阶段）
  if (data.结束年龄分钟 !== undefined && data.结束年龄分钟 <= data.起始年龄分钟) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['结束年龄分钟'],
      message: `发育阶段: 结束年龄分钟 (${data.结束年龄分钟}) 须 > 起始年龄分钟 (${data.起始年龄分钟})`,
    });
  }
});

export const 种族模板Schema = z.record(
  z.string(), // 种族键
  z.object({
    寿命基准: z.number().int().min(1).default(75),        // 以纪元分钟表示的自然年
    衰老系数: z.number().min(0).max(10).default(1),
    发育阶段表: z.array(发育阶段Schema).default([]),
    遗传参数: z.record(z.string(), z.number()).default({}),
    最小生育年龄分钟: z.number().int().min(0).default(0),  // 6.30 世代钳制
  }),
).default({});

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

// ── 母题配额（6.14） ──
export const 母题配额Schema = z.record(
  z.string(), // 母题键
  z.object({
    基础权重: z.number().min(0).default(1),
    每游戏年上限: z.number().int().min(0).default(0), // 0 = 不限
    互斥组: z.string().default(''),
  }),
).default({});

// ── 媒体渠道表（6.9） ──
export const 媒体渠道表Schema = z.record(
  z.string(), // 渠道键
  z.object({
    名称: z.string().default(''),
    受众选择器: z.string().default(''),
    延迟分钟: z.number().int().min(0).default(0),
    失真率: z.number().min(0).max(1).default(0),
  }),
).default({});

// ── 战术包 ──
const 战术条目Schema = z.object({
  名称: z.string().default(''),
  前置: z.object({
    地形: z.array(z.string()).default([]),
    兵种: z.array(z.string()).default([]),
    情报阈值: z.number().min(0).max(100).default(0),
  }).default({}),
  修正包: z.record(z.string(), z.number()).default({}),
  风险: z.string().default(''),
  母题标签: z.array(z.string()).default([]),
});

export const 战术包Schema = z.record(z.string(), 战术条目Schema).default({});

// ── 学业制式库（§三-14 迁入） ──
const 学业制式条目Schema = z.object({
  阶段名: z.string().default(''),
  描述: z.string().default(''),
  时长分钟: z.number().int().min(0).default(0),
  前置条件: z.array(z.string()).default([]),
  解锁技能: z.array(z.string()).default([]),
  考核检定: z.string().default(''),
});

export const 学业制式库Schema = z.record(z.string(), 学业制式条目Schema).default({});

// ── 职级体系库（迁入） ──
const 职级条目Schema = z.object({
  职级名: z.string().default(''),
  组织类型: z.string().default(''),
  晋升模式: z.string().default('考核制'), // 考核制/资历制/竞选制/战功制
  前置职级: z.string().default(''),
  晋升检定: z.string().default(''),
  薪资系数: z.number().min(0).default(1),
  权限标签: z.array(z.string()).default([]),
});

export const 职级体系库Schema = z.record(z.string(), 职级条目Schema).default({});

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

// ── 赛事结构模板（6.35） ──
const 赛事模板条目Schema = z.object({
  参与者选择器: z.string().default(''),
  赛制: z.enum(['淘汰', '积分', '循环']).default('淘汰'),
  轮次: z.number().int().min(1).default(1),
  检定配方引用: z.string().default(''),
  排名表: z.record(z.string(), z.number()).default({}),
  奖励钩子: z.string().default(''),
});

export const 赛事结构模板Schema = z.record(z.string(), 赛事模板条目Schema).default({});

// ── 穿越契约（6.36） ──
export const 穿越契约Schema = z.object({
  属性映射: z.record(z.string(), z.string()).default({}), // 旧轴名→新轴名
  货币处理: z.string().default(''), // 丢失/按汇率/保留/归零
  技能等价表: z.record(z.string(), z.string()).default({}),
  携带白名单: z.array(z.string()).default([]),
  时间比率: z.number().min(0).default(1),
  随附规则补丁: z.string().optional(), // 规则补丁 ID 引用
});

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

// 1b. 媒介登记表（6.44）— 键 = 媒介键（报纸/个人日记/告示板/论坛/书信…）
const 媒介登记条目Schema = z.object({
  模板正文: z.string().max(叙事模板正文长度上限), // 6.41⑦ 注入面防护
  必填槽位: z.array(z.string()).default([]),
  引擎槽位: z.array(z.string()).default([]),
  文风键引用: z.string().optional(),
  禁词表引用: z.string().optional(),
  渠道标签: z.string().optional(),
  配图意图: z.string().optional(),
  渲染缓存上限: z.number().int().min(0).optional(),
  // G2-2 传播面（进 BUNDLE 指纹 via hashJudgmentBundle 媒介传播面参数·非叙事面）
  是否传播: z.boolean().optional(),           // true = 可发起社会传播; false/undefined = 叙事专用·零贡献
  传播系数: z.number().min(0).max(10).optional(), // Bass p_external 权重 [0-10]
});

export const 媒介登记表Schema = z.record(z.string(), 媒介登记条目Schema).default({});

// 1b-2. 叙事分发表（6.44）— 键 = 场景锚点（行动名/设施类型/事件标签）
// 多锚点可指同一媒介；优先序 行动名＞设施＞事件标签，同级平局按键字典序（6.41②）
const 叙事分发条目Schema = z.object({
  媒介键引用: z.string().default(''),
  优先级: z.number().int().optional(),
});

export const 叙事分发表Schema = z.record(z.string(), 叙事分发条目Schema).default({});

// 1c. 母题词汇表
export const 母题词汇表Schema = z.record(
  z.string(), // 母题键
  z.object({
    词条: z.array(z.string()).default([]),
    调味提示词: z.string().optional(),
  }),
).default({});

// 1d. 实体模板库（结构待 P0-7+ 补全，先占位）
export const 实体模板库Schema = z.object({
  NPC模板: z.array(z.unknown()).default([]),
  组织模板: z.array(z.unknown()).default([]),
  物品模板: z.array(z.unknown()).default([]),
});

// 1e. 开局装配数据（6.42）
const 序章模板Schema = z.object({
  模式: z.enum(['固定文本', '锚点引导', 'AI自由']).default('AI自由'),
  正文: z.string().optional(),
  锚点契约: z.string().optional(),
  引擎槽位: z.array(z.string()).default([]),
});

export const 开局装配数据Schema = z.object({
  // 真相待建：待 A2/P0-7 接线后补全类型；运行期必过五道闸落账，禁直塞存档树（6.42①）
  家境装配包: z.array(z.unknown()).default([]),
  // 凸成本点购曲线；不进 _tick.难度系数组指纹（6.42⑧）
  凸成本点购曲线: z.array(z.unknown()).default([]),
  出厂行动卡集: z.array(z.string()).default([]),
  序章模板: 序章模板Schema.default({}),
});

// 1f. 文风库（6.44，原叙事风格预设库更名）
const 文风条目Schema = z.object({
  键: z.string().default(''),
  名称: z.string().default(''),
  风格提示词: z.string().max(叙事模板正文长度上限), // 6.41⑦同款
  禁词表引用: z.string().optional(),
  默认开: z.boolean().default(false),
});

export const 文风库Schema = z.array(文风条目Schema).default([]);

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

// 缺口一·二审维度库（6.75）
// 开放·不枚举：反玛丽苏/反油腻/单拍物理矛盾等都是条目，非写死固定项
// 检测方式二分：机械=跑规则；审稿提示词=喂另一个 AI 评（无权重/评分标尺）
export const 二审维度条目Schema = z.object({
  键: z.string().default(''),
  名称: z.string().default(''),
  检测方式: z.enum(['机械', '审稿提示词']),
  规则或提示词: z.string().default(''),
  阈值: z.number().optional(),
  默认开: z.boolean().optional(),
  // L-8 · 越界分类法（enum·非开放串·确定性·L-28 Cheating枚举依赖此）
  // L-28: 路径+席位已被五道闸结构（runProposalGate·Gate②白名单+C6）覆盖；
  //        Cheating 枚举在此处落地以供 P0-6 二审维度库引用
  越界类型: z.enum(['Off-Topic', 'Cheating']).optional(),
}).strip();

// 缺口二·小剧场剧本库（6.75）
// 玩家主动点击触发的脑洞剧本（无触发条件、无NPC角色表）
export const 小剧场剧本条目Schema = z.object({
  键: z.string().default(''),       // 剧本ID
  名称: z.string().default(''),
  图标: z.string().default(''),
  分类: z.string().default(''),
  描述: z.string().default(''),
  提示词: z.string().default(''),
  读历史默认: z.boolean().optional(),
  输出格式: z.string().default(''),
}).strip();

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
  target_choices: z.array(z.string()).default([]),  // 目标实体键候选（一或多）
  tool_name:      z.string().default(''),           // 调用工具名（open string）
  params:         z.record(z.string(), z.unknown()).default({}), // 参数 map
  salient_args:   z.string().optional(),            // 显著参数文本·用于 option_id 派生
  value_slot:     z.string().optional(),            // 绑定的数值槽键
  min:            z.number().optional(),            // 数值槽最小值
  max:            z.number().optional(),            // 数值槽最大值
  display_text:   z.string().optional(),            // 显示标签（不纳入 option_id·纯展示）
}).strip();

export type 动词选项条目Type = z.infer<typeof 动词选项条目Schema>;

// ══════════════════════════════════════════
// 玩法预设根（顶层）
// ══════════════════════════════════════════

export const 玩法预设Schema = z.object({
  预设ID: z.string().default(''),
  名称: z.string().default(''),
  版本: z.string().default('0.1.0'),
  作者: z.string().default(''),
  描述: z.string().default(''),
  历法皮肤: 历法皮肤Schema.default({}),
  种族模板: 种族模板Schema,
  粒度模板覆盖: 粒度模板覆盖Schema,
  难度系数组: 难度系数组Schema.default({}),
  行动点上限: z.number().int().min(1).default(4),
  属性轴表: 属性轴表Schema,
  检定配方表: 检定配方表Schema,
  派生量配方: 派生量配方Schema,           // 发现B·M·4·HP=f(体质)/精力=f(体质×0.7+心理×0.3)·随整包入指纹
  母题配额: 母题配额Schema,
  媒体渠道表: 媒体渠道表Schema,
  战术包: 战术包Schema,
  学业制式库: 学业制式库Schema,
  职级体系库: 职级体系库Schema,
  财富分档参数: 财富分档参数Schema.default({}),
  欠债参数: 欠债参数Schema.default({}),
  事件来源权重出厂值: z.object({
    事件包: z.number().min(0).max(100).default(50),
    AI自发: z.number().min(0).max(100).default(50),
  }).default({}),
  赛事结构模板: 赛事结构模板Schema,
  穿越契约: 穿越契约Schema.optional(),
  规则补丁: 规则补丁Schema,
  // ── 4.11 · 6.41 · 6.42 · 6.44 新增容器字段 ──
  检定骰面: 检定骰面Schema.default({}),
  媒介登记表: 媒介登记表Schema,
  叙事分发表: 叙事分发表Schema,
  母题词汇表: 母题词汇表Schema,
  实体模板库: 实体模板库Schema.default({}),
  开局装配数据: 开局装配数据Schema.default({}),
  文风库: 文风库Schema,
  // ── P0-5 检定判定层 ──
  检定档切分表: 检定档切分表Schema,
  钳制表: 钳制表Schema,
  概率域夹逼: 概率域夹逼Schema,          // H4·随整包入指纹·判定概率 clamp 至 [p_最小, p_最大]
  // 6.66·纠缠闭包弱边阈值（判定面·随整包入指纹）
  // 累积强度 < 阈值 即截断弱边、界定闭包半径防扩散全图；口径同涟漪稀疏化阈值
  纠缠闭包弱边阈值: z.number().min(0).max(1).default(0.2),
  账面安全界限: 账面安全界限Schema,       // H1·入账前 clamp·不进指纹（安全执行层·非判定面）

  // ── 指纹族补完（Q5/J5/S4b·入 hashJudgmentBundle·判定面整包·零迁移）──────────────
  约定谓词集: z.record(z.string(), z.string()).optional(),  // Q5·约定库谓词/选择器谓词定义表
  级联限制: z.object({                                       // J5·级联深度N+轮号上限
    最大深度: z.number().int().min(0).default(8),
    最大轮数: z.number().int().min(0).default(32),
  }).optional(),
  归并表: z.record(z.string(), z.unknown()).optional(),      // S4b·归并规则表
  DSL文法版本: z.string().default('1.0'),                   // DSL v1.0 frozen
  // §十A 分层方案·与 DSL 文法版本并列·随 U3 版本分段
  // v1 = {min,max,clamp,pow,sqrt} 全逐位恒等固定实现；增列超越函数时 bump 版本号
  // 旧档锁旧版本语义重放，防优化后重放旧档产生假分叉
  求值器函数库版本: z.number().int().min(1).default(1),

  // ── P0-1 4.10 缺口 ──────────────────────────────────────────────────────────
  // 缺口一·二审维度库（6.75·开放·叙事质量二审维度注册表）
  二审维度库: z.array(二审维度条目Schema).optional(),
  // 缺口二·小剧场剧本库（6.75·玩家主动点击触发）
  小剧场剧本库: z.array(小剧场剧本条目Schema).optional(),
  // 缺口三·死亡拦截器（6.45·list·谁能拦死亡的预设注册表）
  死亡拦截器条目: z.array(死亡拦截器条目Schema).optional(),
  // 缺口四·换角许可（6.45·缺省=单人单角）
  换角许可: 换角许可Schema.optional(),
  // 缺口五·世界遗产白名单出厂值（6.45·路径列表·mod可覆盖）
  // 继承结算时拷贝成 secret.ts 继承包.世界遗产白名单 运行实例（非双写）
  世界遗产白名单出厂值: z.array(z.string()).optional(),
  // 顺手·离场演化契约出厂模板（6.45·契约来路②兜底·record(组织类型→模板)）
  离场演化契约出厂模板: z.record(z.string(), z.unknown()).optional(),

  // ── Phase-L 补漏批 ────────────────────────────────────────────────────────
  // L-1/L-6 · 社会角色参数（叙事旋钮·不进 hashJudgmentBundle·派生公式 defer P0-10）
  // w_i,k = 角色类型 i 在社会角色 k 上的贡献权重；δ = 效应量（角色变化→属性影响系数）
  社会角色定义表: z.record(z.string(), z.object({
    名称: z.string().default(''),
    描述: z.string().optional(),
  })).optional(),
  社会角色权重表: z.record(z.string(), z.record(z.string(), z.number())).optional(),
  社会角色效应量表: z.record(z.string(), z.number()).optional(),

  // L-7 · 角色激活阈值（叙事旋钮·不进 hashJudgmentBundle·定点+迟滞带·复用 fixed.ts·禁第二实现）
  // 激活上限: 热度≥此值 → 角色进入「激活」态；沉默下限: 热度<此值 → 进入「沉默」态
  // 派生公式（角色热度→激活态谓词）defer（依赖信念派生·P0-7+）
  角色激活配置: z.object({
    激活上限: z.number().min(0).max(100).optional(),
    沉默下限: z.number().min(0).max(100).optional(),
  }).optional(),

  // ── 动词选项集（AOHP·mod 作者经动词表声明的确定性候选选项集）──────────────────
  // 进 PRESET 指纹（hashCanonical(动词选项集) → hashPresetFingerprint 的 动词选项集哈希）
  // 菜单生成时：取此集合，走 seeded rngFor 子集采样 → 派生 option_id → 权威 option_id 集
  // LLM 只能在权威集内回 option_id；越界 option_id → executeActionOption 降级纯叙事不写账
  // option_id 派生规则（buildOptionId）：verb:targetEntityId[:salient_args]
  // 最多 99 条（受 rngFor [0,99] 精度约束·菜单不应超此数量）
  动词选项集: z.array(动词选项条目Schema).max(99).optional(),

  // ── PR-0 · 预设元数据 v2 留位（additive·空跑·消费留 G2 / PR-1~5）────────────────
  // 不进任何 fingerprint 数组（非判定面·留位·G2 接线后按需升格）
  父预设: z.string().optional(),            // 父预设 ID（预设继承/派生体系·PR-1 消费）
  创建时预设版本: z.string().optional(),     // 预设包创建时的规格版本（元数据·不进指纹）
  派生标记: z.boolean().optional(),         // true = 由父预设 additive 派生
  默认模板: z.boolean().optional(),         // true = 世界装配时优先选用此预设
  LOD保温窗口: z.number().int().min(0).optional(),              // PR-4 · 区域 LOD 保温窗口（拍数·缺省=引擎常量 LOD_WARM_WINDOW_DEFAULT·不进指纹）
  经济生成规则: z.object({                                    // P3-1 经济派生规则（PR-3·additive·不进指纹）
    品类基线: z.record(z.string(), z.number()).optional(),    // 品类→基线价格（覆盖 区域物价.基准价）
    资源紧张度权重: z.number().min(0).max(1).optional(),      // [0,1]·资源紧张度信号权重
    供需权重: z.number().min(0).max(1).optional(),            // [0,1]·供需信号权重
    战时修正权重: z.number().min(0).max(1).optional(),        // [0,1]·战时激活权重
    衰减率: z.number().min(0).max(1).optional(),              // [0,1]·修正系数每拍衰减率（闭式·禁逐拍累积）
  }).optional(),
  社会熵默认值: z.number().min(0).max(1).optional(),          // G2 Bass 均值场社会熵基准值（传播系数输入）
});

export type 玩法预设Type = z.infer<typeof 玩法预设Schema>;
export type 检定配方条目Type = z.infer<typeof 检定配方条目Schema>;
export type 规则补丁条目Type = z.infer<typeof 规则补丁条目Schema>;
