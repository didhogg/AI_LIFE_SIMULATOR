// 4.8 记忆·事件·调度层
import { z } from 'zod';
import { 受治理路径Schema, 是JS保留键 } from './governedKeySpace.js';

// ── 记录键 superRefine（AA4·禁 JS 保留键·防原型污染） ──
// key schema 方式：在 Zod 构造 record 结果前拦截，正确处理 __proto__ 等保留键。
// add-constraint only：z.infer 仍 string，零迁移。
const 记录键Schema = z.string().superRefine((raw, ctx) => {
  if (是JS保留键(raw)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `记录键: 命中 JS 保留键黑名单「${raw}」` });
  }
});

// ══════════════════════════════════════════
// 工作记忆 / 长期归档通用条目（计时重标定为绝对时间）
// ══════════════════════════════════════════

export const 记忆条目Schema = z.object({
  记忆id: z.string().default(''),
  发生时间: z.number().int().default(0), // 绝对纪元分钟（原"周期"重标定）
  标题: z.string().default(''),
  摘要: z.string().default(''),
  涉及人物: z.string().default(''),
  涉及地点: z.string().default(''),
  重要度: z.string().default('普通'), // 普通/重要/命运
  关联地点: z.array(z.string()).default([]),
  关联物品: z.array(z.string()).default([]),
  关联意象: z.array(z.string()).default([]),
  关联NPC: z.array(z.string()).default([]),
  情绪基调: z.string().default(''),
  思念权重: z.number().min(0).max(100).default(0),
  // L-4 · 重要度分（importance score·0-100·default 50）= 召回排序主权重。
  // LLM 创建记忆时写入此字段；P0-7 接线后读取排序；L-21（冻结+指纹）依赖本字段先完成数值化（已满足）。
  权重: z.number().min(0).max(100).default(50),
  // L-21 · 重要度分冻结标志（创建即冻结·永不重算·P0-7 P7-5d 接线）
  // additive-only·全 optional·零迁移；true = 已冻结（freezeImportanceScore 写入）·undefined/false = 待冻结。
  权重_冻结: z.boolean().optional(),
  上次浮现时间: z.number().int().default(0),
  可浮现: z.boolean().default(true),
  因果: z.object({
    起因事件id: z.string().default(''),
    关联种子id: z.string().default(''),
    导致后果: z.string().default(''),
  }).default({}),
  // ── 对撞③ 姓名知识分轨（⊥ 认知档案，记忆条目粒度）──────────────────────────────────
  mentioned_known_names: z.array(z.string()).optional(),
  mentioned_visual_refs: z.array(z.string()).optional(),
});

// 长期归档扩展字段
const 归档记忆条目Schema = 记忆条目Schema.extend({
  归档时间: z.number().int().default(0), // 绝对纪元分钟
  来源时间范围: z.string().default(''),
});

// ══════════════════════════════════════════
// 工作记忆 / 长期归档（顶层键）
// ══════════════════════════════════════════

export const 工作记忆Schema = z.array(记忆条目Schema).default([]);

export const 长期归档Schema = z.array(归档记忆条目Schema).default([]);

// ══════════════════════════════════════════
// 日程（指令台·4.8）
// ══════════════════════════════════════════

const 意图条目Schema = z.object({
  行动: z.string().default(''),
  地点: z.string().default(''),          // 节点键
  同行NPC: z.array(z.string()).default([]),
  行动点消耗: z.number().int().min(0).default(1),
  指令类型: z.string().default(''),
  关联实体: z.string().default(''),      // 实体键或资产名
  调度对象: z.array(z.string()).default([]),
  目标: z.string().default(''),
  使用物品或技能: z.string().default(''),
  指令参数: z.record(z.string(), z.unknown()).default({}),
});

export const 日程Schema = z.record(
  z.string(), // 槽位键（上午/下午/晚上/自定义）
  z.array(意图条目Schema),
).default({});

// ══════════════════════════════════════════
// 行动卡库（单源，取代旧双轨行动卡片池）
// ══════════════════════════════════════════

const 行动卡条目Schema = z.object({
  名称: z.string().default(''),
  类别: z.string().default(''),
  行动点消耗: z.number().int().min(0).max(20).default(1),
  占用槽位: z.number().int().min(1).max(5).default(1),
  适用粒度: z.array(z.string()).default([]),
  关联属性: z.string().default(''),
  关联技能: z.string().default(''),
  关联地点: z.string().default(''),
  关联NPC: z.string().default(''),
  检定模板: z.string().default(''),
  收益标签: z.string().default(''),
  风险标签: z.string().default(''),
  _来源包: z.string().default(''),   // K2/K3·mod 血统键·只读·AI 不可改 mod 归属
});

export const 行动卡库Schema = z.record(z.string(), 行动卡条目Schema).default({});

// ══════════════════════════════════════════
// 播报条目（tagged union by 渠道·6.9/6.40）
// 渠道 = required discriminant（旧 渠道标签 optional string 升格为 literal）
// 旧存档迁移：缺 渠道 字段的条目在 migrate.ts 补默认值 '系统'
// ══════════════════════════════════════════

// 共享基础字段（所有渠道共用）
const 播报基础 = z.object({
  播报id: z.string().default(''),
  重要度: z.string().default('普通'),
  发生时间: z.number().int().default(0),
  // P0 预埋·行为实现在 P1：缺省视为挂起；AI 仅可提案，硬闯由引擎第④闸按白名单终裁
  打断级别: z.enum(['挂起', '闪念', '硬闯']).optional(),
  // P0 预埋·行为实现在 P1：绝对纪元分钟；超期由引擎降级系统文本强制出队
  最迟期限: z.number().int().optional(), // 绝对纪元分钟；0=哨兵/永不降级
  已读: z.boolean().default(false),
  // 缺口6·6.45·暗骰=玩家看不到骰点结果·全暗=玩家看不到任何内容
  遮蔽样式: z.enum(['明牌', '暗骰', '全暗']).optional(),
  // P0-1 黄金窗口·情绪/表情键（叙事注解·供立绘/BGM/Live2D统一消费·不影响判定）
  情绪键: z.string().optional(),
  表情键: z.string().optional(),
});

export const 播报条目Schema = z.discriminatedUnion('渠道', [
  // 系统：引擎日志/通知；也是旧存档默认迁移目标
  播报基础.extend({ 渠道: z.literal('系统'), 内容: z.string().default('') }),
  // 对话：NPC/角色台词广播
  播报基础.extend({
    渠道: z.literal('对话'),
    说话者键: z.string().default(''),     // 实体键
    说话者称谓: z.string().default(''),
    对白内容: z.string().default(''),
  }),
  // 旁白：叙事性旁白段落
  播报基础.extend({
    渠道: z.literal('旁白'),
    内容: z.string().default(''),
    叙述视角: z.string().default(''),
  }),
  // 媒介：报刊/情报/书信等格式化媒介
  播报基础.extend({
    渠道: z.literal('媒介'),
    媒介附件引用键: z.string().default(''), // 媒介登记表键
    渲染缓存摘要: z.string().default(''),
  }),
  // 思绪：主角内心独白（仅渲染，不广播给其他实体）
  播报基础.extend({
    渠道: z.literal('思绪'),
    内容: z.string().default(''),
    可见性: z.string().default('私有'),   // 私有/可被特定角色感知
  }),
]);

// ══════════════════════════════════════════
// 落账记录条目（6.75/6.76·actor_source 四值枚举）
// ══════════════════════════════════════════

export const 落账记录条目Schema = z.object({
  // 6.76 第四值「NPC自主/系统驱动」新增
  // ⚠️ 观战内容入主角认知?是🧮派生量（靠"是否在场"现算），不进 schema
  // P5 二审规则（6.76续）: 叙事质量二审重写内容时·不得改写 actor_source（保持原写入方）
  //   且不单独新增落账记录条目（直接覆写原条目内容·⊄单写者链·不参与 AA1 落账事件流）
  actor_source: z.enum(['玩家', '玩家确认', '模型代写', 'NPC自主/系统驱动']).default('NPC自主/系统驱动'),
  时间: z.number().int().default(0),    // 绝对纪元分钟；0=哨兵
  目标路径: z.string().default(''),     // "实体键.字段路径"·落账目标定位
});

// ══════════════════════════════════════════
// 仲裁器（附录B′·延后队列已删除）
// ══════════════════════════════════════════

export const 仲裁器Schema = z.object({
  冷却表: z.record(z.string(), z.number().int()).default({}), // 冷却键→到期纪元分钟
  本轮种子包: z.array(z.string()).default([]),    // 本拍成熟的种子 ID 列表
  播报队列: z.array(播报条目Schema).default([]),  // 待播报条目

  // ── 缺口一·触发扫描器状态（G-4·6.61）────────────────────────────────────────
  // 随拍前快照回滚、随时间线分叉、只迁形状不重算（J3/J6）
  触发扫描器状态: z.object({
    // 观测史（曾看到什么），不是当前值；key = "实体键.字段路径"
    上次观测值表: z.record(z.string(), z.unknown()).default({}),
    挂起命中队列: z.array(z.unknown()).default([]),
  }).optional(),

  // ── 缺口五·落账记录（6.75/6.76）─────────────────────────────────────────────
  落账记录: z.array(落账记录条目Schema).default([]),
});

// ══════════════════════════════════════════
// 调用类型注册表（6.75/6.69·三具名类型+开放扩展）
// ══════════════════════════════════════════

// 渲染模式枚举（6.69）
export const 渲染模式枚举 = ['直读流', '占位整达', '静默'] as const;

// 副作用级别枚举（单一权威·核心调用条目/effect 包共用·禁第二份内联）
// none=纯只读; sandbox=引擎可回滚; irreversible=外部不可逆（产出进冻结载荷·禁重掏）
export const 副作用级别枚举Schema = z.enum(['none', 'sandbox', 'irreversible']);

// 核心调用条目（记账/检定/谜底校准/结算·不含叙事专用字段）
// TS 编译期口径锁：核心调用条目Type 结构上不含允许玩家覆盖/玩家SystemPrompt覆盖/assistant预填
const 核心调用条目Schema = z.object({
  模型档位: z.string().default(''),           // 开放串：快速/标准/高质量
  温度: z.number().min(0).max(2).default(0.7),
  上下文组装器: z.string().default(''),        // 组装器标识（开放串·引擎内部注册键）
  输出schema: z.string().default(''),          // 输出约束 schema ID（开放串）
  // 超时重试策略 = 出厂默认值；玩家覆盖层住 $预算控制台（4.9·本轮不做）
  超时重试策略: z.string().default(''),        // 开放串描述：超时秒/最大重试次/退避策略
  渲染模式: z.enum(渲染模式枚举).optional(),  // 6.69·可空
  // ── P0-1 黄金窗口·调批字段（全入指纹排除名单·不影响判定面）────────────────────────
  采样参数: z.object({                         // 精细采样覆盖（覆盖优先级高于顶层温度字段）
    温度: z.number().min(0).max(2).optional(),
    top_p: z.number().min(0).max(1).optional(),
    top_k: z.number().int().min(1).optional(),
    频率惩罚: z.number().min(-2).max(2).optional(),
    存在惩罚: z.number().min(-2).max(2).optional(),
  }).optional(),
  附加采样参数: z.record(z.string(), z.unknown()).optional(), // 自由透传: MinP/TypicalP/TFS/DRY/XTC/Mirostat
  停止序列: z.array(z.string()).optional(),
  最大回复tokens: z.number().int().min(1).optional(),
  思维链: z.object({
    启用: z.boolean().optional(),
    努力档: z.string().optional(),             // 'low'/'medium'/'high'（提供商相关·开放串）
  }).optional(),
  切片预算: z.object({
    软上限tokens: z.number().int().min(0).optional(),
    硬上限tokens: z.number().int().min(0).optional(),
    截断优先级: z.array(z.string()).default([]),
  }).optional(),
  // ── 副作用级别元数据（受控接口注册表·对撞·stub 接缝）──────────────────────────────────
  // none=纯只读; sandbox=引擎可回滚; irreversible=外部不可逆（产出进冻结载荷·禁重掏）
  副作用级别: 副作用级别枚举Schema.optional(),
});

// 叙事调用条目（扩展核心·叙事专用字段仅此分支可用·防泄进结算管线）
// 运行时注册表以叙事条目 schema 为基准（超集·向下兼容核心条目·不拆运行时 schema 文件）
const 叙事调用条目Schema = 核心调用条目Schema.extend({
  // ── 🎚️ 玩家主权·叙事专用（记账/检定/谜底/结算 TS 类型结构上不含·由核心条目类型保证）──
  // P0-6 导入闸校验：携带此字段族的条目须为「叙事」调用类型（防覆盖泄进结算管线）
  允许玩家覆盖SystemPrompt: z.boolean().default(false), // 专家模式门·缺省关·community档驱动
  玩家SystemPrompt覆盖: z.string().optional(),          // 覆盖串·叙事调用时替换引擎内置SystemPrompt
  // ── 🤖 破限引擎化·assistant预填·叙事专用（伪assistant消息/continue prefill）─────────
  // 消费点：P0-8组装器仅叙事调用拼接此字段；核心调用永不带预填
  assistant预填: z.string().optional(),
});

// "+3" 具名调用类型键（冻结名称·蓝图 6.75）：
//   ①叙事质量二审  ②玩家代理回复  ③小剧场
// 其余键由 mod 扩展注入（开放 record）
// 运行时以叙事条目 schema 为基准（超集·核心条目零迁移向下兼容）
export const 调用类型注册表Schema = z.record(记录键Schema, 叙事调用条目Schema)
  .default({});

// ── 类型导出（TS 编译期口径锁·scope 断言用）──────────────────────────────────────────
export type 核心调用条目Type = z.infer<typeof 核心调用条目Schema>;
export type 叙事调用条目Type = z.infer<typeof 叙事调用条目Schema>;

// ══════════════════════════════════════════
// Ring2 在途调用信封（AA1·6.75/6.76）
// ══════════════════════════════════════════

export const Ring2在途调用信封Schema = z.object({
  // AA10·结算层世代(回滚计数器+拍锚) 与 演出层草稿计数(X5) 两层正交·互不回填
  // 调用世代 = 全局回滚计数器读数 + 拍锚（不是单调递增计数器）
  // 回滚/fork/关账后过期返回一律丢弃；绝不用演出层草稿计数回填
  调用世代: z.number().int().optional(),
  // P6 重试预算绑世代（6.76续）: swipe=新世代→重置计数=0·同世代自动退回 ≤1 次重试
  // 消费点：P0-8 叙事质量二审 retry 判断：同世代重试计数 ≥1 时不再重试·直接降级
  重试计数: z.number().int().min(0).default(0),
}).default({});

// ══════════════════════════════════════════
// K6 pack_id 命名空间正则（批⑤·Step 1·接 6.59 IM3 白名单·蛇形小写起头）
// 适用范围：非空 pack_id 校验；空串 '' 作合法哨兵（D2 不预收）
// TODO(P0-6·IM3)：pack_id 命名空间化（mod 命名空间前缀/注册表接线）留 P0-6
// ══════════════════════════════════════════
const pack_id正则 = /^[a-z][a-z0-9_]*$/;

// ══════════════════════════════════════════
// mod 注册表（6.6/6.62/6.74/B1c·ATTR_WHITELIST 退役）
// ══════════════════════════════════════════

const mod条目Schema = z.object({
  pack_id: z.string().regex(pack_id正则, { message: 'pack_id 须为蛇形 /^[a-z][a-z0-9_]*$/' }), // K6 Step2·必填·去 default·backfillPackId 迁移前置保证合规
  版本: z.string().default('').refine(v => {
    if (v === '') return true;
    return /^\d+\.\d+\.\d+$/.test(v);
  }, { message: '版本须为 X.Y.Z semver 格式（或空串）' }),
  启用: z.boolean().default(true),
  优先级: z.number().int().min(0).default(0),
  依赖: z.array(z.string()).default([]),
  冲突: z.array(z.string()).default([]),
  命名空间: z.string().default(''),
  作者: z.string().default(''),

  // ── 缺口四·签名三字段（6.74·键名冻结·入指纹排除名单）──────────────────────
  // 真实性/血统元数据·不进判定；验签逻辑 P0-6 导入闸实装
  作者公钥: z.string().optional(),
  签名: z.string().optional(),
  签名算法: z.string().optional(), // 缺省 Ed25519

  // ── 6.62/B1c 字段（顺手补·现骨架未有）──────────────────────────────────────
  生效锚点: z.string().optional(),   // 6.62·mod 激活的 era/tick 锚点
  基底契约: z.string().optional().refine(v => {
    if (v === undefined || v === '') return true;
    // Validate: space-AND of comparators (>=, >, <=, <, =) + X.Y.Z; reject ^/~/||/prerelease
    if (/[\^~]/.test(v) || v.includes('||') || v.includes('-')) return false;
    return v.trim().split(/\s+/).every(part => /^(>=|<=|>|<|=)?\d+\.\d+\.\d+$/.test(part));
  }, { message: '基底契约须为 semver range 表达式（如 >=1.0.0 <2.0.0），不支持 ^/~/||/prerelease' }),   // 6.62·对官方基底包 semver 依赖描述
  内容哈希: z.string().optional(),   // B1c·包内容完整性哈希

  // ── B2·S5 字段 ───────────────────────────────────────────────────────────
  可写键: z.array(受治理路径Schema).optional(), // 可写键贡献字段·B6 导入闸消费·运行时 defer
  轨道: z.enum(['gameplay', 'cosmetic', 'view', 'macro']).default('gameplay'), // 蓝图 6.78·静态判轨
}).superRefine((data, ctx) => {
  // 轨道一致性（静态形状校验·闸分流 defer B6）：
  //   轻轨（cosmetic/view/macro）禁带可写键；零可写键的轻轨允许。
  //   TODO(B3/B6): 零 effect + 零判定输入引用 的轻轨检查在 B3/B6 补。
  if (data.轨道 !== 'gameplay' && (data.可写键?.length ?? 0) > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['可写键'],
      message: `轨道「${data.轨道}」为轻轨，禁带可写键（请改用 gameplay 重轨）`,
    });
  }
});

export const mod注册表Schema = z.record(记录键Schema, mod条目Schema)
  .superRefine((val, ctx) => {
    // K6⑤: record key must equal pack_id; backfillPackId aligns migration-time entries.
    // Non-migration paths (B6 import gate) are caught here before parse succeeds.
    for (const [key, entry] of Object.entries(val)) {
      if (entry.pack_id !== key) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key, 'pack_id'],
          message: `K6⑤: mod record key "${key}" !== pack_id "${entry.pack_id}"`,
        });
      }
    }
  })
  .default({});

// ── K4 mod 墓碑 schema（B2·S1·schema-only·零接线·零写入·写入点留 B2·S3）──────────────
// 落墓碑语义（S3 钉死·本步只建结构，不写入）：
//   · 写 _mod墓碑库 = 落审计记录，不删/不改 mod注册表本身；
//   · _mod墓碑库 可从 (mod注册表 + computeLoadOrder) 确定性重建（律庚：迁移不改真相层）；
//   · 运行时不加载被拒 mod 仍由 computeLoadOrder().rejected[] 负责；
//     墓碑库只做可审计持久化（AA3·禁静默丢弃）。
// B2·S3 实装：migrate() 管线写入自环/依赖被拒墓碑；mod注册表 superRefine 收紧 key===pack_id。

export const mod墓碑原因枚举 = [
  '自环',           // K6①：依赖[] 含自身
  '依赖被拒',       // K6①·级联：某依赖项被拒，依赖它的 mod 也被拒
  '冲突',           // 与另一 mod 声明互斥关系
  'key不等pack_id', // K6⑤：record key !== pack_id（强制收紧后不一致拒收）
  'semver不兼容',   // B3 预留：基底契约 semver 不满足
  '覆写授权越权',   // B5·M2：mod 经普通通道宣称覆写/天命授权但授权源无效
  '冻结键改名',     // E-e：mod 对已冻结规范键（不可变:true）做归并别名重映射（拒改名）
  '其他',           // 兜底·确定性描述须在 诊断 字段说明
] as const;
export type mod墓碑原因Type = (typeof mod墓碑原因枚举)[number];

export const mod墓碑条目Schema = z.object({
  记录键: z.string(),              // mod注册表 record key（必填·身份主键）
  pack_id: z.string().optional(),  // 落墓碑时已知则记，否则不填
  原因: z.enum(mod墓碑原因枚举),   // 确定性枚举·必填
  诊断: z.string().optional(),     // 可选确定性文本（禁 wall-clock·禁随机·禁顺序敏感内容）
}).strict();
export type mod墓碑条目Type = z.infer<typeof mod墓碑条目Schema>;

export const _mod墓碑库Schema = z.record(记录键Schema, mod墓碑条目Schema);
export type _mod墓碑库Type = z.infer<typeof _mod墓碑库Schema>;

// ── effect 包格式（对撞④·intervention_pack.v1·落地过 clamp·过闸逻辑 P0-6）──────────
// 对撞纪律：clamp/错误收集复用 P0-5 fixed.ts 同一份实现，禁第二实现
// 黄金窗口预埋（P0-6 焊死前·schema-only）：以下新字段全可空，老档零迁移；
// 本批不接线 — agent_delta/money_delta/flags_add 与 deltas[] 的取代/共存关系留给 P0-6 接线时裁定。
const intervention_pack_delta条目Schema = z.object({
  // 目标路径·Step 6(6.59) add-constraint：形态 refine（归一非空∧非JS保留键∧符合命名正则）
  // ·存储仍 string·零迁移·fail-open（registry 成员级校验留 P0-6 导入闸）
  path: 受治理路径Schema,
  op: z.enum(['set', 'add', 'sub', 'clamp', 'lock']),
  value: z.union([z.number(), z.string()]), // 标量 | DSL v1 表达式串（复用 engine/dsl/eval.ts 同一套文法，禁第二实现）
  max_delta: z.number().optional(), // 单次Δ上限·P0-6 过五道闸钳制时消费，本批不接线
});

export const intervention_pack_v1Schema = z.object({
  agent_delta: z.record(记录键Schema, z.record(记录键Schema, z.unknown())).optional(),
  money_delta: z.record(记录键Schema, z.number()).optional(),
  flags_add:   z.array(z.string()).optional(),

  pack_id: z.string().regex(pack_id正则, { message: 'pack_id 须为蛇形 /^[a-z][a-z0-9_]*$/' }), // K6③·S2·必填·去空串豁免·去 default·对齐 mod条目单一权威口径
  deltas: z.array(intervention_pack_delta条目Schema).optional(),
  trigger: z.string().optional(), // DSL v1 谓词串·与 lore.ts 触发条件/触发谓词同一套文法，P0-6 实装求值器前仅占位
  side_effect_level: 副作用级别枚举Schema.optional(),
  content_hash: z.string().optional(), // 占位·本批不接线，留给 P0-6 进 B1c 生效中包集哈希
}).strict().superRefine((data, ctx) => {
  // M3 结构不变量校验（纯结构违例·语义越权写墓碑归 M2·活线 fire defer B6）
  // 规范同 interfaces/patchInvariant.ts（公开 API）。
  const M3_FORWARD_ONLY = ['编年史.序号', '落账记录.序号'] as const;
  for (const [i, delta] of (data.deltas ?? []).entries()) {
    const firstSeg = delta.path.split('.')[0] ?? '';
    if (firstSeg.startsWith('_') || firstSeg.startsWith('$')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['deltas', i, 'path'],
        message: `M3: 路径「${delta.path}」首段以「_」或「$」开头，为结构不变量硬排除字段，禁止写入`,
      });
    }
    if ((M3_FORWARD_ONLY as readonly string[]).includes(delta.path) && delta.op === 'sub') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['deltas', i, 'op'],
        message: `M3: 路径「${delta.path}」为 forward-only 键，禁止 sub 操作`,
      });
    }
  }
});
export type intervention_pack_v1Type = z.infer<typeof intervention_pack_v1Schema>;

export type 记忆条目Type = z.infer<typeof 记忆条目Schema>;
export type 意图条目Type = z.infer<typeof 意图条目Schema>;
export type 播报条目Type = z.infer<typeof 播报条目Schema>;
export type 仲裁器Type = z.infer<typeof 仲裁器Schema>;
export type 落账记录条目Type = z.infer<typeof 落账记录条目Schema>;
