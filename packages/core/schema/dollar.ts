// 4.9 $ 层与 $meta 层（AI 永不可见）
import { z } from 'zod';

// ── $运气 / $寿命预期 ──
export const $运气Schema = z.number().int().min(1).max(100).default(50);
export const $寿命预期Schema = z.number().int().min(1).max(200).default(75);

// ── $存档种子（P0-5·Ring 0 RNG 根种子） ──
// 0=哨兵；开局/读档时由 Ring 0 生成一次后只读（P0-7 接线）；AI 永不可见；纯函数遇 0 照常计算
export const $存档种子Schema = z.number().int().default(0);

// ── $聆听心声触发 / $浮现记忆ID ──
export const $聆听心声触发Schema = z.boolean().default(false);
export const $浮现记忆IDSchema = z.string().default('');

// ── $涟漪候选（6.37 涟漪引擎暂存缓冲） ──
export const $涟漪候选Schema = z.record(
  z.string(), // 目标实体键
  z.array(z.object({
    标签: z.string().default(''),
    极性: z.string().default(''),
    强度: z.number().min(0).max(100).default(0),
    可见性: z.string().default(''),
    来源拍号: z.number().int().min(0).default(0),
  })),
).default({});

// ── $RP暂存（微行为聚合缓冲，§2.3） ──
export const $RP暂存Schema = z.object({
  本场摘要: z.string().default(''),
  起始时间: z.number().int().default(0), // 绝对纪元分钟
  本场新登场: z.array(z.object({
    类型: z.string().default('NPC'),
    名称: z.string().default(''),
    摘要: z.string().default(''),
  })).default([]),
  聚合行动摘要: z.string().default(''), // 微行为聚合后向日程层记一笔
});

// ── $流速（前端层） ──
export const $流速Schema = z.object({
  模式: z.enum(['自动', '回合制']).default('回合制'),
  速度档: z.number().int().min(1).max(4).default(1), // ×1/×2/×3/×4
  自动暂停触发: z.array(z.string()).default([]), // 枚举项：遭遇战/HP阈值/秘密暴露/叙事生成失败/记账失败自动暂停（6.67）…
});

// ── $战斗暂存（schema版本化，退场即清） ──
export const $战斗暂存Schema = z.object({
  局部网格: z.string().default(''), // 序列化后的战斗地图
  单位: z.array(z.object({
    NPC键: z.string().default(''),
    q: z.number().int().default(0), // 六边形轴坐标
    r: z.number().int().default(0),
    朝向: z.number().int().min(0).max(5).default(0),
    临时HP: z.number().min(0).default(0),
  })).default([]),
  回合order: z.array(z.string()).default([]),
  terrain: z.string().optional(),  // 预留字段（6.2 schema 版本化）
  cover: z.string().optional(),
  zoc: z.string().optional(),
});

// ── $玩家偏好（引擎幕后加权，AI 不可见；拍板一）──
// 结构化权重由引擎在事件抽取/种子萌发时加权使用，绝不进 prompt。
// 自然语言偏好归 _叙事设置.叙事偏好（AI 可见）。
export const $玩家偏好Schema = z.object({
  // 母题→权重倍率；开放串键，事件包可自带新母题标签，无需改 schema
  母题权重: z.record(z.string(), z.number().min(0)).default({}),
  // 写实程度（0=纯幻想/轻松 / 1=写实/硬核）：全局残酷/难度系数
  // 引擎用于统一检定 DC 偏置、结果严酷度、负面涟漪强度；前端"简单/普通/困难"映射到此
  写实程度: z.number().min(0).max(1).default(0.5),
  // 写实度权重（0–100，引擎事件过滤用，粒度更细）
  写实度权重: z.number().min(0).max(100).default(50),
  // 事件偏好标签权重；同为开放串键
  事件偏好权重: z.record(z.string(), z.number().min(0)).default({}),
});

// ── $会话状态（6.1） ──
export const $会话状态Schema = z.object({
  最后交互时间戳: z.number().int().default(0), // 现实时间·宿主提供·禁止 Ring 0 内生成
  未读播报数: z.number().int().min(0).default(0),
  崩溃恢复指针: z.string().default(''),
  // 演出层草稿计数（原「本拍重掷序号」·发现D）= 纯叙事血统水印；
  // 玩家重掷时 +1；绝不传入 rngFor、绝不进判定、与全局回滚计数器正交（AA10）。
  // TODO(P0-5): 暂无消费点，预留字段。P0-9 回填叙事流血统标记时接线。
  演出层草稿计数: z.number().int().min(0).default(0), // 不随拍前快照回滚还原（blueprint 4.11③）

  // ── 缺口一·舞台状态?（G10 舞台几何校验·6.75）─────────────────────────────────
  // 实体物理舞台位置/属性：谁在房间、谁站门口、朝向等；供引擎几何校验（非战斗演出几何）
  // opt-in·单写者=引擎·派生/瞬态·场景重置·入指纹排除名单
  // 边界：$战斗暂存.单位 管战斗站位；本字段管非战斗演出几何
  舞台状态: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),

  // ── 缺口二·舞台可比较属性?（6.75）──────────────────────────────────────────────
  // 声明"哪些属性键参与机械几何判定"（如 位置/朝向）；其余属性纯叙事提示、不参与机械判定
  舞台可比较属性: z.array(z.string()).optional(),
});

// ── $预算控制台（6.7） ──
export const $预算控制台Schema = z.object({
  叙事密度档: z.string().default('中'), // 低/中/高/无限
  每游戏月叙事配额: z.number().int().min(0).default(10),
  软上限: z.number().int().min(0).default(50),
  硬上限: z.number().int().min(0).default(100),
  叙事模型: z.string().default(''),
  记账模型: z.string().default(''),
  旁观播报模型: z.string().default(''),
  累计token: z.number().int().min(0).default(0),
  本会话token: z.number().int().min(0).default(0),

  // ── 缺口五·重试策略?（6.67）─────────────────────────────────────────────────────
  // 玩家覆盖层：覆盖调用类型注册表里"超时重试策略"出厂默认值
  // 键 = 调用类型名（叙事质量二审/玩家代理回复/小剧场/…）
  重试策略: z.record(z.string(), z.object({
    自动重试上限: z.number().int().min(0).default(3),
    超时秒数: z.number().int().min(0).default(30),
    失败后行为: z.enum(['降级继续', '自动暂停弹重试面板']).default('降级继续'),
  })).optional(),
});

// ── $模型画像（6.8·玩家/社区填，引擎只拼接） ──
export const $模型画像Schema = z.record(
  z.string(), // provider 键（claude/gpt/gemini…）
  z.object({
    风格补正提示词: z.string().default(''),
    采样参数: z.record(z.string(), z.unknown()).default({}),
    禁词表: z.array(z.string()).default([]), // 6.41 反八股校验规则（非替换规则）·按 provider 分表
  }),
).default({});

// ── $沉浸模式 ──
export const $沉浸模式Schema = z.boolean().default(false);

// ── $天命重掷券（命运重掷限量券·复活闸软救济·AI 永不可见） ──
// 出厂张数与补充规则住玩法预设；每周目重置；$ 层 AI 永不可见
export const $天命重掷券Schema = z.object({
  剩余张数: z.number().int().min(0).default(0),
  已用记录: z.array(z.object({
    拍号: z.number().int(),
    事由: z.string(),
  })).default([]),
});

// ── $隐藏记忆库（AI 不可见·延时种子 + 彩蛋池） ──

const 延时种子条目Schema = z.object({
  载荷: z.string().default(''),
  类型: z.string().default('伏笔'),
  成熟日: z.number().int().default(0), // 绝对纪元分钟；0 = 立即成熟（无到期约束）
  权重: z.number().min(0).max(100).default(10),
  重要等级: z.string().default('中'),          // 普通/重要/命运
  已结算标记: z.number().int().min(0).max(1).default(0),
  幂等锚点: z.string().default(''),
  冲突组: z.string().default(''),
  冷却键: z.string().default(''),
  可合并标签: z.string().default(''),
  后果层级: z.string().default('中'),         // 轻/中/重/命运级
  era锚定: z.string().default(''),            // 原 possible_years 语义
  因果链id: z.string().default(''),
  因果深度: z.number().int().min(0).default(0),
  来源: z.object({
    命名空间: z.string().default(''),
    包id: z.string().default(''),
    事件id: z.string().default(''),
    模块: z.string().default(''),
  }).default({}),
});

const 彩蛋条目Schema = z.object({
  原记忆id: z.string().default(''),
  摘要: z.string().default(''),
  模糊钥匙: z.array(z.string()).default([]),
  关联地点: z.array(z.string()).default([]),
  关联物品: z.array(z.string()).default([]),
  关联意象: z.array(z.string()).default([]),
  关联NPC: z.array(z.string()).default([]),
  情绪基调: z.string().default(''),
  录入时间: z.number().int().default(0),
  冷却到期: z.number().int().default(0), // 绝对纪元分钟；0 = 无冷却
  可浮现: z.boolean().default(true),
  已浮现: z.boolean().default(false),
  上次浮现时间: z.number().int().default(0),
});

export const $隐藏记忆库Schema = z.object({
  延时种子: z.record(z.string(), 延时种子条目Schema).default({}),
  彩蛋池: z.record(z.string(), 彩蛋条目Schema).default({}),
});

// ── 存档头（4.9/U3a/N2·独立顶层键·任何快照之外）──
// 全局回滚计数器 = 全档唯一合法「快照外可变量」，永不随快照还原
export const 存档头Schema = z.object({
  全局回滚计数器: z.number().int().default(0),
  当前时间线id: z.string().default(''),   // 指向 $meta.周目谱系 节点
  谱系索引: z.record(z.string(), z.unknown()).default({}),
  引擎版本谱: z.array(z.string()).optional(),

  // U3a·迁移戳：源→目标版本迁移记录；墙钟时间纯展示，不参与判定
  迁移戳: z.array(z.object({
    源版本: z.string().default(''),
    目标版本: z.string().default(''),
    迁移映射哈希: z.string().default(''),
    墙钟时间: z.string().default(''), // 纯展示·禁止参与引擎判定
  })).optional(),

  // N2·系统事件镜像：只读白名单，引擎写，内容侧只读
  系统事件镜像: z.object({
    全局回滚次数: z.number().int().min(0).default(0),
    周目数: z.number().int().min(0).default(0),
    换角数: z.number().int().min(0).default(0),
    裸SL次数: z.number().int().min(0).default(0),
  }).optional(),
});

// ── $meta（跨周目存档层） ──
export const $metaSchema = z.object({
  总回合数: z.number().int().min(0).default(0), // 拍计数≠时间，禁止用拍数折算时长
  上帝之手次数: z.number().int().min(0).default(0),
  聆听心声次数: z.number().int().min(0).default(0),
  历代角色数: z.number().int().min(1).default(1),
  周目谱系: z.record(z.string(), z.object({  // 带 parent 指针的存档树
    parent: z.string().optional(),
    快照引用: z.string().default(''),
    创建时间: z.number().int().default(0),
    角色键: z.string().default(''),
  })).default({}),
  峰值记录: z.record(z.string(), z.number()).default({}), // 各维度峰值
});

export type $隐藏记忆库Type = z.infer<typeof $隐藏记忆库Schema>;
export type $metaType = z.infer<typeof $metaSchema>;
export type $天命重掷券Type = z.infer<typeof $天命重掷券Schema>;
