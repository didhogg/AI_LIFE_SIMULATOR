// 4.3 角色层（主角 = 组件齐全的 NPC 特例）
import { z } from 'zod';
import { 不可逆Schema } from './verb.js';
import { 受治理句柄Schema, 是JS保留键 } from './governedKeySpace.js';
import { 意象条目Schema, factFragmentSchema, 谓词串Schema, 变量参数键Schema } from './commonEntry.js';
export { 意象条目Schema } from './commonEntry.js';
// ── actor 记录键 superRefine（AA4·禁 JS 保留键·防原型污染） ──
const actor记录键Schema = z.string().superRefine((k, ctx) => {
    if (是JS保留键(k)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `actor记录键: 命中 JS 保留键黑名单「${k}」` });
    }
});
// ══════════════════════════════════════════
// 公共子 schema（被其他文件引用）
// ══════════════════════════════════════════
// 修饰通道引用（特质效果 / 状态标签效果复用）
export const 修饰通道引用Schema = z.object({
    通道: z.string().default(''),
    op: z.enum(['乘', '加', '设上限', '设下限', '开关']).default('加'),
    强度: z.number().default(0),
});
// ══════════════════════════════════════════
// NPC 各组件 schema
// ══════════════════════════════════════════
const 属性Schema = z.object({
    体质: z.number().int().min(0).max(100).default(10),
    智慧: z.number().int().min(0).max(100).default(10),
    感知: z.number().int().min(0).max(100).default(10),
    魅力: z.number().int().min(0).max(120).default(10),
    心理: z.number().int().min(0).max(100).default(10),
});
const 派生Schema = z.object({
    HP: z.number().min(0).default(100),
    HP上限: z.number().min(1).default(100),
    精力: z.number().min(0).default(100),
    精力上限: z.number().min(1).default(100),
    颜值: z.number().min(0).max(100).default(50),
    // 智商 🗑️ 不再单独存储，并入智慧轴口径
});
const 行动点Schema = z.object({
    当前: z.number().int().min(0).default(15),
    上限: z.number().int().min(0).default(15), // 0 = 无限（策略预设）
});
const 性格五轴Schema = z.object({
    开放: z.number().min(0).max(100).default(50),
    尽责: z.number().min(0).max(100).default(50),
    外向: z.number().min(0).max(100).default(50),
    宜人: z.number().min(0).max(100).default(50),
    神经质: z.number().min(0).max(100).default(50),
    // L-1/L-6 · facet 子结构（optional·零迁移·5 轴对外·防双轨·补充粒度而非替换轴）
    facet: z.record(actor记录键Schema, z.number().min(0).max(100)).optional(),
});
const 特质效果Schema = z.object({
    属性修正: z.record(actor记录键Schema, z.number()).default({}),
    成长率或上限修正: z.array(修饰通道引用Schema).default([]),
    检定修正: z.array(修饰通道引用Schema).default([]),
    事件钩子: z.string().default(''),
});
const 特质条目Schema = z.object({
    类别: z.string().default('后天'), // 天赋/性格/后天/身体/压力
    来源: z.string().default(''),
    强度: z.number().default(0),
    稀有度: z.string().default(''),
    已觉醒: z.boolean().default(true),
    效果: 特质效果Schema.default({}),
    // Step 4·黄金窗口预埋·schema-only：本体不可逆子类实例（灵根/血脉等）携带此 flag，
    // 轻伤等可治愈项不带（§十一 防过度标记）。缺省即 undefined，既有存档零迁移。
    不可逆: 不可逆Schema.optional(),
    // Step 5·通道 A 第②类「特质/状态子类」占位键，复用本 schema 作子类宿主，不新建表。
    // 序②(6.59) 已收紧为受治理句柄Schema（形态约束·成员校验 defer P0-6·B6·Phase B-d）
    子类键: 受治理句柄Schema.optional(),
});
const 情绪条目Schema = z.object({
    情绪名: z.string().default(''),
    极性: z.string().default('负'),
    数值: z.number().default(0),
    影响: z.array(修饰通道引用Schema).default([]),
    到期: z.number().int().default(0), // 绝对纪元分钟；0 = 永久
    来源: z.string().default(''),
    可叠加: z.boolean().default(false),
});
const 状态标签条目Schema = z.object({
    效果: z.array(修饰通道引用Schema).default([]),
    到期: z.number().int().default(0), // 绝对纪元分钟；0 = 永久
    来源: z.string().default(''),
    // Step 4·黄金窗口预埋·schema-only：本体不可逆子类实例（死亡/断肢/致残等）携带此 flag，
    // 轻伤等可治愈项不带（§十一 防过度标记）。缺省即 undefined，既有存档零迁移。
    不可逆: 不可逆Schema.optional(),
    // Step 5·通道 A 第②类「特质/状态子类」占位键，复用本 schema 作子类宿主，不新建表。
    // 序②(6.59) 已收紧为受治理句柄Schema（形态约束·成员校验 defer P0-6·B6·Phase B-d）
    子类键: 受治理句柄Schema.optional(),
});
const 技能施放Schema = z.object({
    精力消耗: z.number().min(0).default(0),
    检定属性: z.string().default(''),
    成本: z.string().default(''),
    冷却: z.number().int().min(0).default(0), // 游戏时长（纪元分钟）
    失败后果: z.array(z.string()).default([]),
});
const 技能条目Schema = z.object({
    熟练度: z.number().min(0).max(100).default(0),
    等级: z.number().int().min(0).max(10).default(0),
    类别: z.string().default('通用'), // 开放串
    来源: z.string().default(''),
    施放: 技能施放Schema.default({}),
});
const 物品条目Schema = z.object({
    数量: z.number().int().min(0).default(1),
    重要级别: z.string().default('普通'),
    类别: z.string().default(''),
    效果: 修饰通道引用Schema.default({}),
    到期: z.number().int().default(0), // 绝对纪元分钟；0 = 永久
    遗失保护: z.boolean().default(false),
    可携意象: z.array(意象条目Schema).default([]), // 6.29
    物品状态: z.enum(['持有', '遗失', '销毁']).optional().default('持有'), // L-15·三态·零迁移
    // P9-1 · 运行期扩展参数容器（additive·0 重定基·actor 不进 hashJudgmentBundle）
    扩展参数: z.record(变量参数键Schema, z.union([z.number(), z.string(), z.boolean()])).default({}),
});
const 衣物槽Schema = z.object({
    物品名: z.string().default(''),
    描述: z.string().default(''),
});
const 爱好条目Schema = z.object({
    极性: z.string().default('中立'),
    类别: z.string().default(''),
    投入度: z.number().min(0).max(100).default(0),
    状态: z.string().default('活跃'),
    描述: z.string().default(''),
});
const 信念条目Schema = z.object({
    类型: z.string().default('价值观体系'),
    虔诚或认同: z.number().min(0).max(100).default(0),
    核心主张: z.array(z.string()).default([]),
    戒律: z.array(z.string()).default([]),
    立场轴: z.string().default(''),
    动摇度: z.number().min(0).max(100).default(0),
});
const 学籍Schema = z.object({
    在学状态: z.string().default(''),
    学段: z.string().default(''),
    学校: z.string().default(''),
    年级: z.string().default(''),
    专业: z.string().default(''),
});
const 考试记录条目Schema = z.object({
    名称: z.string().default(''),
    类别: z.string().default(''),
    科目或项目: z.string().default(''),
    发生时间: z.number().int().default(0), // 绝对纪元分钟
    原始分: z.number().optional(),
    是否通过: z.number().int().min(-1).max(1).default(-1),
    评定: z.string().default(''),
    证书产出: z.string().default(''),
});
const 学历档案条目Schema = z.object({
    学段: z.string().default(''),
    学校: z.string().default(''),
    专业: z.string().default(''),
    入学时间: z.number().int().default(0), // 绝对纪元分钟；0 = 未记录
    毕业时间: z.number().int().default(0), // 绝对纪元分钟；0 = 未记录
    状态: z.string().default('在读'),
    学位: z.string().default(''),
});
const 资质证书条目Schema = z.object({
    类别: z.string().default(''),
    等级: z.string().default(''),
    获得时间: z.number().int().default(0), // 绝对纪元分钟；0 = 未记录
    有效期到期: z.number().int().default(0), // 绝对纪元分钟；0 = 永久有效
    颁发机构: z.string().default(''),
});
const 学业概况Schema = z.object({
    当前阶段: z.string().default(''),
    学业档位: z.string().default(''),
    升学进度: z.object({
        下一关卡: z.string().default(''),
        目标: z.string().default(''),
    }).default({}),
});
const 学业Schema = z.object({
    学籍: 学籍Schema.default({}),
    在修科目: z.record(actor记录键Schema, z.object({
        发生时间: z.number().int().default(0), // 绝对纪元分钟
        备注: z.string().default(''),
    })).default({}),
    考试记录: z.record(actor记录键Schema, 考试记录条目Schema).default({}),
    升学记录: z.record(actor记录键Schema, z.object({
        关卡: z.string().default(''),
        结果: z.string().default(''),
        时间: z.number().int().default(0), // 绝对纪元分钟
    })).default({}),
    学历档案: z.record(actor记录键Schema, 学历档案条目Schema).default({}),
    资质证书: z.record(actor记录键Schema, 资质证书条目Schema).default({}),
    学业概况: 学业概况Schema.default({}),
});
const 任职条目Schema = z.object({
    体系ID: z.string().default(''),
    级序: z.number().int().min(0).default(0),
    职位: z.string().default(''),
    雇主: z.string().default(''), // 组织实体键
    性质: z.string().default('主业'), // 主业/副业/兼职/派遣/自雇/实习/义务
    工时档: z.string().default(''),
    在职状态: z.string().default('在职'),
    报酬: z.string().default(''),
    绩效: z.number().min(-5).max(5).default(0),
    入职时间: z.number().int().default(0), // 绝对纪元分钟；0 = 未记录
});
const 职业Schema = z.object({
    任职: z.array(任职条目Schema).default([]),
    职业履历: z.record(actor记录键Schema, z.object({
        职位: z.string().default(''),
        雇主: z.string().default(''),
        入职时间: z.number().int().default(0), // 绝对纪元分钟；0 = 未记录
        离职时间: z.number().int().default(0), // 绝对纪元分钟；0 = 未记录
        离任方式: z.string().default(''),
    })).default({}),
});
const 目标Schema = z.object({
    长期: z.array(z.string()).default([]), // 开放串
    短期: z.array(z.string()).default([]), // 开放串
});
const 居留身份条目Schema = z.object({
    国籍: z.string().default(''), // 政权组织实体键
    签证类型: z.string().default(''),
    到期: z.number().int().default(0), // 绝对纪元分钟；0 = 永久
});
const 声誉Schema = z.object({
    人望: z.number().min(-100).max(100).default(0),
    知名度: z.number().min(0).max(100).default(0),
    极性: z.string().default(''), // 正面/负面/中性
    标签: z.string().default(''),
});
const 婚姻条目Schema = z.object({
    配偶: z.string().default(''), // NPC 键
    状态: z.string().default(''),
    缔结: z.number().int().default(0), // 绝对纪元分钟；0 = 未记录
    终止: z.number().int().default(0), // 绝对纪元分钟；0 = 未终止
    主权降级: z.enum(['需确认', '凌驾抢话档']).optional(), // 主权地板占位·P0-7 fire（强制确认/凌驾抢话档·复用 N-8）·语义/层级 fire 时终定·全 .optional 无 default＝零迁移
});
const 关系条目Schema = z.object({
    对象键: z.string().default(''),
    类型: z.string().default(''), // 开放串（人类可读关系名）
    强度: z.number().min(-100).max(100).default(0),
    极性: z.string().default(''),
    信任: z.number().min(0).max(100).default(0),
    深度: z.number().min(0).max(100).default(0),
    // C2-0 additive seam: typed edge classification (引擎结构化分类·⊥ 人读 类型 字段)
    边类型: z.enum(['强', '弱', '桥接', '在场临时弱']).optional(),
});
const 所属组织条目Schema = z.object({
    组织键: z.string().default(''),
    职务: z.string().default(''),
    派系: z.string().default(''),
});
const 职务条目Schema = z.object({
    组织节点键: z.string().default(''),
    职务名: z.string().default(''),
    局部权力值: z.number().min(0).max(100).default(0),
});
const 忠诚条目Schema = z.object({
    $真实值: z.number().min(0).max(100).default(50), // AI 不可见，引擎维护
    伪装度: z.number().min(0).max(100).default(0),
});
// 作息模板：模式→时段→{状态:概率}
const 作息Schema = z.record(actor记录键Schema, // 模式键：常态/战时/逃亡/监禁/守孝 etc.
z.record(actor记录键Schema, // 时段：早/午/晚 etc.
z.record(actor记录键Schema, z.number().min(0).max(100)))).default({});
const 登场契约Schema = z.object({
    日期: z.number().int().min(0).optional(), // 绝对纪元分钟
    条件: z.string().default(''),
    地点: z.string().default(''), // 节点键
});
// 占位形态（K4/6.52·NPC 侧）
const NPC占位形态Schema = z.object({
    名称: z.string().default(''),
    实体类型: z.string().default('NPC'), // 开放串
    硬约束: z.array(z.string()).default([]),
    来源拍号: z.number().int().default(0),
    _模板引用: z.string().optional(), // K2/K3·血统只读·AI 不可改模板来源
    _模板快照: z.unknown().optional(), // K4·包卸载后脱包兜底·只读
});
// ── 6.72 酒馆角色卡迁移可空段 ───────────────────────────────────────────────
// 关系声明：Z2 五类方向槽，导入时建关系边＋双向认知档案
export const 关系声明条目Schema = z.object({
    对象: z.string().default(''), // NPC键 / 'user' / 'char' 占位
    方向: z.enum(['单向→', '单向←', '双向', '敌对', '从属']).default('双向'),
    类型: z.string().default(''), // 开放串关系名
    强度: z.number().min(-100).max(100).default(0),
    备注: z.string().default(''),
});
// 既往记忆种子：有界数组；来源固定为'导入预设'
export const 既往记忆种子条目Schema = z.object({
    摘要: z.string().default(''),
    发生时间_约: z.string().default(''), // 模糊描述，非绝对时刻
    相对事件序号: z.number().int().optional(), // 事件间相对先后序；跨档 portable·不绑绝对纪元
    重要度: z.number().int().min(1).max(3).default(1),
    情绪色彩: z.string().default(''),
    来源: z.string().default('导入预设'), // 枚举值：导入预设 / 事件id / 听闻自
});
// 占位解析槽：user/char → 实体键（渲染拍现取显示名）
export const 占位解析槽Schema = z.object({
    user: z.string().optional(),
    char: z.string().optional(),
});
const NPC记忆条目Schema = z.object({
    记忆id: z.string().default(''),
    摘要: z.string().default(''),
    发生时间: z.number().int().default(0), // 绝对纪元分钟
    类型: z.string().default('互动'),
    情绪色彩: z.string().default(''),
    重要度: z.number().int().min(1).max(3).default(1),
    权重: z.number().min(0).max(100).default(50),
    永久: z.boolean().default(false),
    上次唤起时间: z.number().int().default(0), // 绝对纪元分钟
});
const 体征Schema = z.object({
    身高: z.number().min(0).default(0), // cm
    体重: z.number().min(0).default(0), // kg
    _BMI: z.number().min(0).default(0), // 引擎只读
    体型标签: z.string().default(''),
    体型效果: z.array(修饰通道引用Schema).default([]),
    // 发育阶段 🧮 派生（种族模板发育表），不存储
});
const 养育Schema = z.object({
    教育投入: z.number().min(0).max(100).default(0),
    陪伴度: z.number().min(0).max(100).default(0),
    管教风格: z.string().default(''),
    言传身教: z.array(z.string()).default([]),
});
const 亲子Schema = z.object({
    来源: z.string().default('血亲'), // 血亲/养子/继子/过继/义子
    其他双亲: z.string().default(''), // NPC 键
    入族时间: z.number().int().default(0), // 绝对纪元分钟
});
const 继承预案Schema = z.object({
    继承顺位: z.number().int().min(0).default(0),
    指定继承人: z.boolean().default(false),
    继承意愿: z.string().default(''),
});
// ══════════════════════════════════════════
// NPC 完整 schema
// ══════════════════════════════════════════
export const NpcSchema = z.object({
    // ── 身份骨架 ──
    姓名: z.string().default(''),
    称呼: z.string().default(''),
    性别: z.string().default(''),
    种族: z.string().default('人类'), // 开放串
    角色ID: z.string().default(''),
    世代: z.number().int().min(1).default(1),
    出生日期: z.number().int().default(0), // 绝对纪元分钟；0 = 未记录
    出生地: z.string().default(''), // 节点键
    外貌: z.string().default(''),
    背景: z.string().default(''),
    备注: z.string().default(''),
    存活状态: z.enum(['在世', '失踪', '已故']).default('在世'),
    死亡时间: z.number().int().default(0), // 绝对纪元分钟；0 = 健在
    死因: z.string().default(''),
    位置: z.string().default(''), // 节点键（原主角位置/轨迹挂到此处）
    轨迹: z.array(z.object({
        节点: z.string().default(''),
        时间: z.number().int().default(0), // 绝对纪元分钟
    })).default([]),
    虚拟位置: z.string().optional(), // 赛博化身专用
    立绘引用: z.string().optional(), // 生图接口位，P2 前不实现
    // P0-1 黄金窗口·生图/语音字段预埋（实装 P2）
    视觉锚定特征: z.record(actor记录键Schema, z.string()).optional(), // 生图提示词锚定特征表（开放键值对）
    声线: z.string().optional(), // RVC 声线模型 ID
    // ── 数值面 ──
    属性: 属性Schema.default({}),
    派生: 派生Schema.default({}),
    行动点: 行动点Schema.default({}),
    性格五轴: 性格五轴Schema.default({}),
    // 性格标签 🧮 派生（五轴阈值映射），不存储
    特质: z.record(actor记录键Schema, 特质条目Schema).default({}),
    情绪栈: z.array(情绪条目Schema).default([]),
    状态标签: z.record(actor记录键Schema, 状态标签条目Schema).default({}),
    技能: z.record(actor记录键Schema, 技能条目Schema).default({}),
    疾病: z.record(actor记录键Schema, z.object({
        类型: z.string().default('急性'),
        已确诊: z.boolean().default(false),
        病程剩余: z.number().int().min(0).default(0), // 纪元分钟；0 = 慢性
        受伤部位: z.string().default(''),
        后遗症: z.string().default(''),
    })).default({}),
    体征: 体征Schema.default({}),
    // ── 资产与社会面 ──
    物品: z.record(actor记录键Schema, 物品条目Schema).default({}),
    衣物: z.record(actor记录键Schema, 衣物槽Schema).default({}),
    爱好: z.record(actor记录键Schema, 爱好条目Schema).default({}),
    信念: z.record(actor记录键Schema, 信念条目Schema).default({}),
    学业: 学业Schema.default({}),
    职业: 职业Schema.default({}),
    目标: 目标Schema.default({}),
    居留身份: z.array(居留身份条目Schema).default([]),
    头衔: z.array(z.string()).default([]),
    称号: z.string().default(''),
    成就: z.record(actor记录键Schema, z.object({
        解锁时间: z.number().int().default(0), // 绝对纪元分钟；0 = 未记录
        描述: z.string().default(''),
    })).default({}),
    里程碑: z.record(actor记录键Schema, z.object({
        时间: z.number().int().default(0), // 绝对纪元分钟；0 = 未记录
        标题: z.string().default(''),
        描述: z.string().default(''),
    })).default({}),
    业力: z.number().default(0),
    声誉: 声誉Schema.default({}),
    婚姻: z.array(婚姻条目Schema).default([]),
    // ── 关系与组织 ──
    // 6.65 W4·强度跌破门槛 → 转 L2 归档摘要、不留活跃边；边数上限住预设
    关系: z.array(关系条目Schema).default([]),
    所属组织: z.array(所属组织条目Schema).default([]),
    职务: z.array(职务条目Schema).default([]),
    忠诚: z.record(actor记录键Schema, 忠诚条目Schema).default({}),
    // 受制于 🧮 派生视图（七源关系图聚合），不存储
    // 秘密索引 🧮 派生（filter 全局.秘密库），不存储
    // ── LOD 与生成 ──
    // LOD-B4b: LOD档位 已迁移至 LOD表[npcKey].档位（migrate.ts backfillLodTableNpcState）
    重要等级: z.string().default('路人'), // 路人/次要/重要/核心
    召回权重: z.number().min(0).max(100).default(50),
    意象: z.array(意象条目Schema).default([]), // 公共印象（6.29）
    作息: 作息Schema.default({}),
    当前作息模式: z.string().default('常态'),
    履历: z.array(z.string()).default([]), // 滚动短句
    登场契约: 登场契约Schema.optional(),
    占位形态: NPC占位形态Schema.optional(), // K4/6.52·与登场契约正交
    记忆: z.array(NPC记忆条目Schema).default([]),
    上次互动: z.number().int().default(0), // 绝对纪元分钟；0 = 从未互动
    // ── 对撞③ 姓名披露策略 ──────────────────────────────────────────────────────────
    // open=主动自我介绍; selective=仅特定条件下报名; secretive=永不主动报名
    介绍策略: z.enum(['open', 'selective', 'secretive']).optional(),
    // ── 越界动词族·案底状态（对撞·越界行为历史记录·演出层·入指纹排除名单）──────────────
    案底: z.object({
        状态: z.enum(['清白', '过期', '案底']).default('清白'),
        过期时间: z.number().int().default(0), // 绝对纪元分钟；0=永不过期
        记录: z.array(z.object({
            类型: z.string().default(''), // 罪名开放串
            时间: z.number().int().default(0),
            严重度: z.number().min(0).max(100).default(50),
        })).default([]),
    }).optional(),
    // ── 6.72 卡格式可空段 ──────────────────────────────────────────────────────
    // 禁与旧"固定开场白?{}"双轨；来源枚举须含'导入预设'
    关系声明: z.array(关系声明条目Schema).optional(), // Z2 五类方向槽
    既往记忆种子: z.array(既往记忆种子条目Schema).optional(), // 有界·来源=导入预设
    开场白: z.array(z.string()).optional(), // 素材包数组
    占位解析槽: 占位解析槽Schema.optional(), // user/char→实体键
    // ── C2-0 additive seam: 幕后行动种子 (offstage behavior seeds·G7 前置·零运行占位) ──
    // 引擎只读；G7 offstageSettler 据此驱动幕后演化（默认示例：报仇/告发/逃离/结盟/趋附/探查/流转潜伏）。
    _幕后行动种子: z.array(z.object({
        类型: z.string(), // 开放串；mod 作者可定义自有幕后意图
        触发条件: 谓词串Schema.optional(), // DSL v1 谓词串（G7 接线·P0 占位）
        优先级: z.number().int().min(0).default(0),
        后果种子: z.string().optional(), // consequenceSeed 引用键（G7 接线）
    })).optional(),
    _幕后冷却: z.record(z.string(), z.number().int()).optional(), // 行动键→冷却到期纪元分钟
    _幕后发生区域: z.string().optional(), // 区域键（与预设 PR-0 共用命名）
    // ── 焦点 / 子嗣型扩展位 ──
    复活点: z.number().int().min(0).default(0), // B类计数；0 = 无复活次数
    死亡豁免前置: z.string().default(''),
    养育: 养育Schema.optional(),
    亲子: 亲子Schema.optional(),
    继承预案: 继承预案Schema.optional(),
    // P9-1 · NPC 运行期扩展参数容器（additive·0 重定基·actor 不进 hashJudgmentBundle）
    扩展参数: z.record(变量参数键Schema, z.union([z.number(), z.string(), z.boolean()])).default({}),
});
// ── 已故 NPC 归档（L2 冻结层） ──
export const 已故NPC归档Schema = z.record(actor记录键Schema, z.object({
    称呼: z.string().default(''),
    死亡时间: z.number().int().default(0), // 绝对纪元分钟；0 = 健在
    关键记忆指针: z.string().default(''),
    幽灵形态: z.boolean().default(false), // true = 不实例化，永驻占位
})).default({}).transform(r => Object.assign(Object.create(null), r));
// ── 死亡事件（6.45·缺口1·拦截=配方引用·⚠概率住检定配方表·不直接写）──────────────
export const 死亡事件Schema = z.object({
    时间: z.number().int().default(0), // 绝对纪元分钟；0=哨兵
    死因: z.string().default(''),
    拦截: z.string().optional(), // 死亡拦截器条目.条件引用·配方键（概率住检定配方表·不直接写）
}).strip();
// ── 席位表（6.53 C1）──────────────────────────────────────────────────────────
// 会话本地视角·引擎结算不读·单机=单一席位「本机」退化·多人=表内多席位零迁移
export const 席位表Schema = z.record(actor记录键Schema, // 席位id；单机时为'本机'
z.object({
    焦点角色键: z.string().default(''), // NPC键指针
    控制者: z.enum(['人类', 'AI', '空']).default('人类'),
    连接状态: z.string().default('本地'), // 本地/在线/离线/旁观
})).default({}).transform(r => Object.assign(Object.create(null), r));
// ── 认知档案（6.12/6.37） ──
// 印象涟漪写入分级（6.65 W1）：
//   个体条目三条件：①一跳内 ②涉事方 ③超强度阈值
//   广域：落区域/组织级聚合条目；个体读取=聚合×个体修正现算派生
//   含自我认知 [主角][主角]
const 印象条目Schema = z.object({
    标签: z.string().default(''),
    极性: z.string().default(''),
    强度: z.number().min(0).max(100).default(0),
    // 来源合法值：事件id / '听闻自:<NPC键>' / 媒体渠道键 / '导入预设'（6.72）
    来源: z.string().default(''),
    获知时间: z.number().int().default(0), // 绝对纪元分钟
    衰减速率: z.number().min(0).default(0),
    // L-2a · 观测行为发生时刻（绝对纪元分钟·⊥「获知时间」·optional·零迁移）
    // 获知时间 = 信息传入认知的时刻；观测拍号 = 观测行为实际发生的时刻（可早于获知时间）
    观测拍号: z.number().int().optional(),
    // L-2b · 观测时刻目标状态快照（白名单子集·非全状态·防快照膨胀/指纹噪声·optional·零迁移）
    当时快照: z.object({
        所在地点: z.string().optional(), // 观测时目标所在地点键
        情绪键: z.string().optional(), // 观测时目标情绪状态键
    }).optional(),
    // L-22 · 信息来源渠道分类（enum·optional·零迁移·⊥「来源」字段自由串）
    来源类型: z.enum(['一手观测', '二手转述', '玩家陈述']).optional(),
    // C2-3 · factFragment v2 载荷（additive·optional·进认知档案指纹·T1 认知投影层接线）
    factFragment: factFragmentSchema.optional(),
});
const 认知档案条目Schema = z.object({
    了解度: z.number().min(0).max(100).default(0),
    误差表: z.record(actor记录键Schema, z.number()).default({}), // 字段→认知值偏差
    印象: z.array(印象条目Schema).default([]), // 6.37 条目制式
    时效: z.number().int().default(0), // 绝对时刻·0=永不过期哨兵
    // ── 对撞③ 姓名知识机制（P0 schema 接缝·渲染期投影·不 baked 进冻结叙事串）─────────────
    // 视觉指代 = 认识前·叙事用「那人」「黑衣男子」等
    // 已知姓名 = 自报家门后·叙事可用真名+称呼建议
    // 铁律: 姓名知识是渲染期投影 over 实体键，永不写进冻结播报串
    姓名知识: z.enum(['视觉指代', '已知姓名']).default('已知姓名'),
    // 日记/记忆区分 mentioned_known_names ⊥ mentioned_visual_refs
    mentioned_known_names: z.array(z.string()).optional(), // 本条目提及已知姓名的实体键列表
    mentioned_visual_refs: z.array(z.string()).optional(), // 本条目提及视觉指代的实体键列表
});
export const 认知档案Schema = z.record(actor记录键Schema, // 观察者 NPC 键
z.record(actor记录键Schema, // 目标 NPC 键（含 self → 自我认知）
认知档案条目Schema)).default({}).transform(r => Object.assign(Object.create(null), r));
// ── 顶层导出 ──
export const NpcRecordSchema = z.record(actor记录键Schema, NpcSchema)
    .default({})
    .transform(r => Object.assign(Object.create(null), r));
