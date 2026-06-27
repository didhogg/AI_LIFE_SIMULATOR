// 4.9 $ 层与 $meta 层（AI 永不可见）
import { z } from 'zod';
import { 渲染模式枚举 } from './memory.js';
import { factFragmentSchema } from './commonEntry.js';

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
    矫诏: z.boolean().optional(),            // G2-3 S2: 伪诏标志（true=官方信道走伪路径·未声明=退回旧行为·零迁移）
    // C2-0 additive seam: factFragment v2 载荷 (T1/T9·进指纹·factFragment化)
    factFragment: factFragmentSchema.optional(),
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
  // R5-c 确定性：快照锚 pin 整场（P0-7 runTick 接线）
  // 战斗开启时 pin 此刻的存档种子和拍号，整场所有骰从此锚派发
  // TODO(P0-7): CombatResolver.init() 写入快照锚；回放时以锚重播全场骰序保证逐位等幂
  快照锚: z.object({
    种子: z.number().int().optional(),    // pin 时的 $存档种子
    锚拍号: z.number().int().optional(),  // CombatResolver.init() 时的当前拍号
  }).optional(),
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
  // 🎚️ 玩家主权·NSFW疲劳系数（0=关闭疲劳·1=默认·2=双倍疲劳；入指纹排除名单=偏好层）
  // 消费点：乘进NPC疲劳累积速率与到期事件硬闯催熟权重（P0-7结算管线接线）
  疲劳系数: z.number().min(0).max(2).default(1),
  // 🎚️ 内容分级门（B桶状态·叙事面·不影响判定·入排除名单）
  // enum驱动专家门：community档才解锁允许玩家覆盖SystemPrompt（唯一入口·防双控件）
  // 强制约束：内容分级 !== 'community' → 调用类型注册表条目 允许玩家覆盖SystemPrompt 须 false
  //   （RootSchemaStrict superRefine 验证·旧档迁移：关→off/SFW→light/NSFW→explicit）
  内容分级: z.enum(['off', 'light', 'explicit', 'community']).default('off'),
  // 🎚️ NSFW降级模型开关（玩家三态·偏好层·入排除名单·⊥内容分级独立）
  // 关：恒用默认模型，软拒 → 重roll叙事（同模型·不切模型）
  // 失败兜底：软拒/拒答命中 → 切 $预算控制台.NSFW降级目标模型键
  // 场景预判：叙事前跑场景检测器，命中即预路由；仍失败再重roll
  // 路由决策快照写 tick_log（硬约束③）；切换必明示原因（硬约束①）；
  // 目标模型无 key 时开关自动降级为不可用（硬约束②）
  NSFW降级模型: z.object({
    启用: z.boolean().default(false),
    触发模式: z.enum(['场景预判', '失败兜底']).default('失败兜底'),
  }).default({}),
  // DP 动态提示词（GW·schema-only·偏好层·fire defer B6 DP拉取管线）
  // $玩家偏好 不在 BUNDLE/PRESET/SNAPSHOT 任一取材组 = 隐性排除·指纹不变；
  // EXCLUDED 文档条目 defer B6-Step7（effect包活线合法开 fingerprintManifest.ts 时顺手补）。
  动态提示词: z.object({
    启用: z.boolean().optional(),
    云端源: z.string().optional(),
    刷新频率: z.number().int().min(0).optional(),
    已缓存版本: z.string().optional(),
    已缓存内容哈希: z.string().optional(),
  }).optional(),
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
  // ── N-8: 连续失败暂停计数器归属（P1 接线·P0 仅注释锁定语义）──────────────────
  // 「连续叙事调用失败 N 次自动暂停」的计数器 = 演出层状态（Ring 1），
  // ⚠️ 永不进盐、永不随拍前快照存取、不写 _tick_log.路由快照。
  // 与盐源（_存档头.全局回滚计数器）和路由快照（_tick_log.路由快照）严格两分：
  //   计数器跨拍累积但随 UI 重置，不影响确定性重放。
  // N 由本字段（失败后行为='自动暂停弹重试面板' + 自动重试上限组合）驱动。
  // 「连续失败 N 次自动暂停」弹面板行为实装见 P1 · 接 6.67 枚举 + 双按钮时再落地。
  // NSFW降级目标模型键（连接$模型画像·指向已配 key 的 provider 键；无 key 时开关不可用·入排除名单）
  NSFW降级目标模型键: z.string().optional(),
  // ── P0-1 黄金窗口·调批字段（全入指纹排除名单·不影响判定面）─────────────────────
  采样覆盖层: z.record(z.string(), z.object({  // 键=调用类型名·逐类型覆盖采样参数
    温度: z.number().min(0).max(2).optional(),
    top_p: z.number().min(0).max(1).optional(),
    频率惩罚: z.number().min(-2).max(2).optional(),
    存在惩罚: z.number().min(-2).max(2).optional(),
  })).optional(),
  切片预算覆盖层: z.record(z.string(), z.object({  // 键=调用类型名·逐类型覆盖切片预算
    软上限tokens: z.number().int().min(0).optional(),
    硬上限tokens: z.number().int().min(0).optional(),
    截断优先级: z.array(z.string()).default([]),
  })).optional(),
  渲染模式覆盖: z.enum(渲染模式枚举).optional(),  // 全局渲染模式覆盖·叙事面·不影响判定
});

// ── $模型画像（6.8·玩家/社区填，引擎只拼接） ──
// 整个 $模型画像 以 $ 前缀 invisible·AI 永不可见·子字段无需单独入指纹排除名单
// （fingerprintManifest 仍收录 $模型画像禁词表/$模型画像采样参数 作显式文档）
export const $模型画像Schema = z.record(
  z.string(), // provider 键（claude/gpt/gemini…）
  z.object({
    风格补正提示词: z.string().default(''),
    // ── P0-1·provider 级采样参数（类型化核心键 + 自由透传字典）──
    // 入指纹排除名单（见 fingerprintManifest.$模型画像采样参数）·不影响判定面
    采样参数: z.object({
      温度: z.number().min(0).max(2).optional(),
      top_p: z.number().min(0).max(1).optional(),
      top_k: z.number().int().min(1).optional(),
      频率惩罚: z.number().min(-2).max(2).optional(),
      存在惩罚: z.number().min(-2).max(2).optional(),
      最大回复tokens: z.number().int().min(1).optional(),
    }).default({}),
    附加采样参数: z.record(z.string(), z.unknown()).optional(), // 自由透传: MinP/TypicalP/TFS/DRY/XTC/Mirostat
    停止序列: z.array(z.string()).optional(),
    // P0-1 黄金窗口·内容评级（per-provider·叙事面·不影响判定）
    内容容忍度: z.string().optional(),  // 开放串：SFW/NSFW/...·provider 级配置
    硬审查标注: z.string().optional(),  // 强制审查规则备注
    解禁提示词: z.string().optional(),  // 风格补正/解禁用追加提示词
    禁词表: z.array(z.string()).default([]), // 6.41 反八股校验规则（非替换规则）·按 provider 分表
    // 🤖 破限引擎化·per-provider 破限引子（入指纹排除名单·AI永不可见·随内容分级强度档启用）
    // 消费点：P0-8组装器按模型族自动挑引子+注入角色（Claude=system+assistant预填·Gemini/GLM=assistant预填主）
    破限引子: z.object({
      思维链引子: z.string().optional(),                         // 推理链解锁提示词前缀
      注入角色: z.enum(['system', 'assistant']).optional(),     // 注入位置（system块/assistant预填）
      预填串: z.string().optional(),                            // continue prefill 文本
      // DP 引子来源（GW·schema-only·$ 前缀 invisible·整体已入 EXCLUDED line110·无需再单独记录）
      来源: z.string().optional(),                              // 'built-in' | 'cloud' | 云端策略包 ID
      云端策略包: z.object({
        版本: z.string().optional(),
        内容哈希: z.string().optional(),
      }).optional(),
    }).optional(),
    // ── 反代端点档（对撞②·apiKeyRef 走 R5-a 机密区存档外·全四字段进指纹排除名单 B1e）──────
    protocol: z.enum(['openai-compatible', 'anthropic', 'gemini']).optional(),
    baseURL:   z.string().optional(),  // 反代/自托管地址·指纹排除（同预设走不同反代须重放判等）
    apiKeyRef: z.string().optional(),  // 机密区引用键（R5-a·存档外存储·永不序列化进存档）
    modelId:   z.string().optional(),  // 实际模型 ID·指纹排除（同预设走不同反代须重放判等）
  }),
).default({});

// ── $生图配置（P2 字段预埋·实装 P2）──
export const $生图配置Schema = z.object({
  启用: z.boolean().optional(),
  生成模式: z.enum(['肖像', '自拍', '场景', '背景', '最后消息可视化']).optional(),
  源: z.string().optional(),                // 生图提供者标识（开放串）
  配图密度: z.string().optional(),           // '低'/'中'/'高'（开放串）
  节奏参数: z.record(z.string(), z.unknown()).optional(),
}).default({});

// ── $语音配置（P2 字段预埋·实装 P2）──
export const $语音配置Schema = z.object({
  TTS源: z.string().optional(),             // TTS 提供者标识（开放串）
  STT模式: z.enum(['关', '点击说话', '长按说话', '连续监听']).optional(),
  触发词: z.array(z.string()).optional(),
  触发词门控: z.boolean().optional(),
}).default({});

// ── $RAG配置（P2 字段预埋·实装 P2）──
export const $RAG配置Schema = z.object({
  启用: z.boolean().optional(),
  全局知识库: z.array(z.string()).optional(),                            // 全局作用域知识库 ID 列表
  角色知识库: z.record(z.string(), z.array(z.string())).optional(),     // NPC键 → 知识库 ID 列表
  聊天附件: z.boolean().optional(),                                     // 是否纳入聊天上传文件
  embedding提供者: z.string().optional(),
  分块参数: z.object({
    块大小: z.number().int().min(1).optional(),
    重叠: z.number().int().min(0).optional(),
    阈值: z.number().min(0).max(1).optional(),
  }).optional(),
  注入模板: z.string().optional(),
  注入位置: z.enum(['系统提示头', '系统提示尾', '对话上下文首条']).optional(),
}).default({});

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
    包id: z.string().default(''),        // legacy alias — kept ≥1 version (D-3 backfill)
    来源包: z.string().optional(),        // D-3: canonical field (mirrors 键条目Schema.来源包)
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
  // 装配器规格：彩蛋池落层 = 引擎装配器直写（$运气 §三-17 同族特例）；五道闸只管关系/实体/账面部分
  彩蛋池: z.record(z.string(), 彩蛋条目Schema).default({}),
});

// ── 存档头（4.9/U3a/N2·独立顶层键·任何快照之外）──
// 全局回滚计数器 = 全档唯一合法「快照外可变量」，永不随快照还原
// P0-9 TODO: 存档层实装时，_存档头 必须走存档外序列化通道，与快照树完全隔离；
//            不得进入快照 diff / 回滚 / 重放管线，否则防白掷机制失效。
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

  // U3a·时间线分块版本戳：记录当前分块写入时的引擎版本·用于分块完整性校验与跨版本迁移
  时间线分块版本戳: z.string().optional(),

  // N2·系统事件镜像：终身累计·只读 vs G9b 树内换角计数器(每线重计) 两量并存·非双写 (AA11)
  // 引擎写·内容侧只读白名单；随存档整体保存·绝不随快照回滚
  系统事件镜像: z.object({
    全局回滚次数: z.number().int().min(0).default(0),
    周目数: z.number().int().min(0).default(0),
    换角数: z.number().int().min(0).default(0),
    裸SL次数: z.number().int().min(0).default(0),
  }).optional(),

  // F-c层2: 版本分段记录（单台·U3·版本段⊕难度段共用·D1）
  // 段头锁定引擎版本+Schema版本+难度系数组指纹+前段哈希·哈希链断→拒载+显示警示（D4）
  // 观测史：只搬运·永不重算（C2·additive-only·零迁移）
  版本段记录: z.array(z.object({
    段序号: z.number().int().min(0),
    引擎版本: z.string().optional(),
    Schema版本: z.string().optional(),
    // hashCanonical over (引擎版本, Schema版本, 难度系数组指纹, 前段哈希) — chain integrity
    段头指纹: z.string().default(''),
    // hashCanonical(prev 段头指纹); genesis segment = ''
    前段哈希: z.string().default(''),
    // M6·C5: difficulty coefficient snapshot fingerprint at segment boundary
    难度系数组指纹: z.string().optional(),
  })).optional(),
});

// ── $meta（跨周目存档层） ──
export const $metaSchema = z.object({
  总回合数: z.number().int().min(0).default(0), // 拍计数≠时间，禁止用拍数折算时长
  上帝之手次数: z.number().int().min(0).default(0),
  聆听心声次数: z.number().int().min(0).default(0),
  历代角色数: z.number().int().min(1).default(1),
  周目谱系: z.record(z.string(), z.object({  // 带 parent 指针的存档树（6.47 单树定稿）
    parent: z.string().optional(),
    快照引用: z.string().default(''),
    创建时间: z.number().int().default(0),
    角色键: z.string().default(''),
    父快照拍号: z.number().int().optional(), // 6.47·分叉起点的拍号（SL/穿越/换角时写入）
    分支原因: z.string().optional(),          // 6.47·分支触发原因（SL/穿越/换角/…）
  })).default({}),
  峰值记录: z.record(z.string(), z.number()).default({}), // 各维度峰值
});

// ── $AI创作状态（DSL AI 创作层·玩家运行态覆盖·进存档·不进指纹·$ 前缀排除写） ──
// 谓词override表: AI 产物·进确定性重放流·进存档（铁律③·绝不放 $临时会话）
// 条目AI控制表: 玩家三态开关·进存档·不进指纹（叠加在作者底线之上）
export const $AI创作状态Schema = z.object({
  谓词override表: z.record(z.string(), z.string()).optional(),
  条目AI控制表: z.record(z.string(), z.boolean()).optional(),
}).optional();
export type $AI创作状态Type = z.infer<typeof $AI创作状态Schema>;

export type $战斗暂存Type = z.infer<typeof $战斗暂存Schema>;
export type $隐藏记忆库Type = z.infer<typeof $隐藏记忆库Schema>;
export type $metaType = z.infer<typeof $metaSchema>;
export type $天命重掷券Type = z.infer<typeof $天命重掷券Schema>;
