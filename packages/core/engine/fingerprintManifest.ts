// AA6: Fingerprint membership manifest — explicit enrollment roster.
// Discipline: adding/removing any member MUST update BOTH the arrays below AND
// the property tests in tests/fingerprint.property.test.ts. No silent additions.

// ── B1d 判定面整包成员（hashJudgmentBundle() 的字段清单）──────────────────────────
/** 判定面整包成员（B1d）— hashJudgmentBundle() 覆盖的全判定面字段。
 *  修改此数组时必须同步更新 tests/fingerprint.property.test.ts 的 BUNDLE_MUTATIONS。 */
export const FINGERPRINT_BUNDLE_MEMBERS = [
  '历法皮肤',
  '粒度模板覆盖',
  '种族模板',
  '母题配额',
  '媒体渠道表',
  '检定配方表',             // 含出厂派生配方
  '检定档切分表',
  '欠债参数',               // 欠债阈值·利息周期
  '换角许可',
  '世界遗产白名单出厂值',
  '赛事结构模板',
  '派生量配方',             // 发现B·M·4·HP/精力等派生量公式·改配方即改判定面
  '概率域夹逼',             // H4·判定概率 clamp 至 [p_最小, p_最大]·改域即改判定面
  '约定谓词集',             // Q5·约定库谓词/选择器谓词定义表·判定面·改定义即改判定
  '级联限制',               // J5·级联深度N+轮号上限·判定面·改上限即改判定
  '归并表',                 // S4b·归并规则表·判定面·改归并即改判定
  '纠缠闭包弱边阈值',       // 6.66·累积强度 < 阈值截断弱边·判定面·默认0.2·改阈值即改判定
  'side_effects注册集',     // F-b·P7-5c: 所有生效 mod verb option.side_effects handlerRef 集合·改集合即改判定面
  'lore谓词集合',           // D-a-lore: _lore知识库全条目触发谓词集·{loreKey→谓词串} canonicalize→hash·改谓词即改判定·R7-b gate判定路径
  '受控接口能力集注册集',   // D-a-lore: active mod lore条目.能力集[].类型 集合·R6/R10判定面·类比F-b side_effects注册集·不与side_effects重叠
  // TODO(P0-7): 方式×速度换算表 — 家在 P0-7 速度模型，届时加入签名 + 补断言
  // TODO(P0-7): H7量纲表全量 — 家在 P0-7 量纲系统，届时加入签名 + 补断言
  '媒介传播面',               // G2-2: 媒介登记表{是否传播,传播系数}投影·判定面·进 hashJudgmentBundle
  '情绪维度表',               // 作者可配·record<维度,{pos,neg,coeff}>·涟漪Δ维度派生情绪名·判定面
  '人口密度系数表',            // 作者可配·record<规模,number>·区域传播强度调制·判定面
  '场景传播系数表',            // 作者可配·record<开放度,number>·二跳强度乘子·判定面
  'IC边类型率表',             // 作者可配·record<边类型,number>·IC基础传播率·判定面
  '复杂传播标签集',            // 作者可配·string[]·Centola-Macy多桥门槛标签集·判定面
  '体质分档断点',              // 作者可配·{tiers:number[]}·θ_i计算口径·判定面
  '组织层级边类型集',           // 作者可配·string[]·追加边类型进层级集合·判定面（buildOrgChildGraph 门控）
] as const;

// ── 预设整包组（顶层·从不快照）──────────────────────────────────────────────────
/** 预设整包组 — 传入 hashPresetFingerprint() 的预设侧字段（均为调用方预计算后传入）。 */
export const FINGERPRINT_PRESET_FIELDS = [
  '判定面整包',              // B1d: hashJudgmentBundle() 输出·调用方预计算后传入
  '生效中内容包集哈希',       // B1c: 全部已启用包（mod／事件包／战术包／补丁集／纪元包／effect包）内容哈希? 的集合哈希
  '规则补丁哈希',             // K5: canonicalize(规则补丁) 的哈希·preset 已有 规则补丁Schema
  'DSL文法版本',              // DSL v1.0 冻结文法版本·求值器解析口径·改版即改判定
  '求值器函数库版本',          // §十A·v1={min,max,clamp,pow,sqrt}逐位恒等·增列超越函数时 bump·旧档锁旧版语义重放
  '中文数字解析规则版',        // 对撞⑦·三百/叁佰/3百→300 归一·不确定=假分叉·改版即改判定口径
  '引擎版本',                  // U3·F-c层1·封段时活动引擎版本·版本变则分段指纹变·字段已在位·分段触发逻辑随P0-3/U3·当前所有preset该字段=undefined
  'Schema版本',                // U3·F-c层1·封段时Schema版本·版本变则分段指纹变·字段已在位·分段触发逻辑随P0-3/U3·当前所有preset该字段=undefined
  // TODO(P0-6): 6.62 纪元包集版本 — era package version fingerprint placeholder
  'AOHP選項id集',    // P0-8-B4·菜单选项稳定键集合·排序后进指纹·选项重排不破指纹（顺序无关·multiset）
  '动词选项集哈希',  // 阶段1·mod 作者声明的确定性候选选项集整包哈希·hashCanonical(玩法预设.动词选项集)·改集合即改判定面
] as const;

// ── 快照锁定组（开局锁定·随档快照）──────────────────────────────────────────────
/** 快照锁定组 — 开局锁定·随档快照；调用方从档内快照传入，绝不读 live 预设。 */
export const FINGERPRINT_SNAPSHOT_FIELDS = [
  '难度系数组',               // B1a·明文在册（直接纳入·不二次哈希）
  '判定骰型',                 // B1a·补三员之一
  '暴击映射',                 // B1b·SNAPSHOT 组·判定口径·本轮类型收紧
  '钳制表',                   // B1a·补三员之二
  '预设数值面域上下界',        // B1a·补三员之三（属性轴表.最大值/自然上限·判定域上下界）
] as const;

// ── 排除名单（B1e·显式列全）──────────────────────────────────────────────────────
/**
 * 排除名单（B1e）— 显式列全。改动这些字段·指纹绝不变。
 * 纪律：出现在此名单的字段永远不得传入 hashPresetFingerprint / hashJudgmentBundle；
 *   若误加入成员组，property 测试将立即报红。
 */
export const FINGERPRINT_EXCLUDED_FIELDS = [
  '显骰',              // B1b: UI 展示层·不影响判定逻辑（B1b 明确移入排除名单）
  '叙事密度档',         // 切片预算档·预算/节奏控制·不影响判定
  '凸成本曲线',         // 开局装配成本·不影响判定（6.42⑧ 明确排除·schema 键：凸成本点购曲线）
  '演出层草稿计数',     // 纯叙事血统水印·永不进盐/判定
  '渲染模式',           // 叙事渲染偏好·不影响检定（schema 家待 P0-X）
  '采样参数',           // 模型调参·不影响判定逻辑
  '重试策略',           // 预算控制·不影响判定
  '切片预算覆盖',       // 预算覆盖参数·不影响检定
  '文风库',             // 叙事面容器·不影响检定
  '媒介登记表',         // 叙事面容器·不影响检定
  '叙事分发表',         // 叙事面容器·不影响检定
  '序章模板',           // 叙事面容器·不影响检定
  '$模型画像禁词表',    // 叙事面·按 provider 禁词·不影响检定
  '$模型画像采样参数',  // P0-1·provider 级采样参数（温度/top_p/频率惩罚/存在惩罚/最大回复tokens）·$ 前缀 invisible·不影响判定
  '叙事偏好',           // AI 可见自由文本·纯叙事面
  '启用文风键',         // 文风切换·AI 可见·不影响检定
  '生效锚点',           // mod 签名字段·校验用·不影响判定（B1c 用集合哈希·不枚举单条）
  '基底契约',           // mod 签名字段·校验用·不影响判定
  '内容哈希',           // mod 单条签名字段·不直接进指纹（B1c 用聚合集合哈希）
  // P0-1 黄金窗口·调批字段（LLM 路由/采样/预算参数·不影响判定面）
  '最大回复tokens',   // per-call-type max output tokens·LLM 路由参数·不影响判定面
  '思维链',           // 推理链开关+努力档·LLM 路由参数·不影响判定面
  '切片预算',         // per-call-type token 预算·不影响判定（区别于已有「切片预算覆盖」字段）
  '采样覆盖层',       // $预算控制台·按调用类型覆盖采样参数·叙事/路由层·不影响判定
  '切片预算覆盖层',   // $预算控制台·按调用类型覆盖切片预算·叙事/路由层·不影响判定
  '渲染模式覆盖',     // $预算控制台全局渲染模式覆盖·叙事面·不影响判定
  // B-1 lore 知识库接口元数据（仅排除能力路由/命名空间元数据·并非排除整库）
  // lore.触发谓词 = gate判定路径·已纳 BUNDLE_MEMBERS 为 lore谓词集合（D-a-lore）；下方排除仅限「叙事/路由层」两字段
  'lore能力集',         // [TOOL] 能力类型白名单·能力路由元数据·叙事调度层·不影响判定面（与受控接口能力集注册集不同：此为单条目声明元数据·非active集合）
  'output_tag命名空间', // output_tag 变量命名空间·S/K 批治理元数据·不影响判定
  // P0-1 黄金窗口·酒馆功能字段（叙事/LLM路由层·不影响判定面）
  '内容分级',      // B桶状态·内容分级开关·叙事面·不影响判定
  '情绪键',        // 叙事注解·立绘/BGM/Live2D消费·不影响判定
  '表情键',        // 叙事注解·同上·不影响判定
  '附加采样参数',  // 自由透传采样参数·LLM路由·不影响判定
  '停止序列',      // 停止序列·LLM路由·不影响判定
  // P3 叙事控制簇（玩家拨动只落偏好/演出层·永不进盐·不影响判定面）
  '母题词汇表',    // 叙事主题词汇扩充表·叙事面·不影响检定
  '实体模板库',    // NPC/组织模板库占位·结构待P0-7·不影响判定
  '二审维度库',    // 叙事质量二审维度注册表·叙事面·不影响判定
  '小剧场剧本库',  // 玩家触发小剧场剧本·叙事面·不影响判定
  // 🎚️ 玩家主权（叙事层⊥判定层·B1d同族·拨动永不进盐）
  '疲劳系数',              // NSFW疲劳倍率旋钮·$玩家偏好·叙事/偏好层·不影响判定面
  'NSFW降级模型',          // 玩家三态开关(启用+触发模式)·$玩家偏好·叙事路由层·⊥内容分级·不影响判定
  'NSFW降级目标模型键',    // 目标 provider key·$预算控制台·路由配置·不影响判定面
  '允许玩家覆盖SystemPrompt', // 专家模式门控·叙事专用·不影响判定
  '玩家SystemPrompt覆盖',  // 覆盖串·叙事层·不影响判定
  // 🤖 破限引擎化（叙事层专用·永不进判定盐）
  'assistant预填',         // continue prefill·叙事专用·不影响判定
  '破限引子',              // per-provider{思维链引子,注入角色,预填串}·$模型画像·叙事层·不影响判定
  // ── 对撞② 反代端点字段族（路由配置·不影响判定）──────────────────────────────────────
  'baseURL',      // 反代/自托管地址·LLM路由配置·不影响判定面
  'apiKeyRef',    // 机密区引用键·存档外存储·不影响判定面
  'modelId',      // 实际模型ID·LLM路由配置·不影响判定面
  'protocol',     // 接入协议·LLM路由配置·不影响判定面
  // ── 对撞⑥ 临时容器（易失态·不进盐）────────────────────────────────────────────────
  '$临时会话',    // sessionStorage同类·易失态·崩溃即弃·不影响判定
  // ── 越界动词族·案底状态（演出层·不影响判定面）──────────────────────────────────────
  '案底',         // 演出层犯罪记录·不影响判定（判定走检定配方表）
  // ── DSL AI 创作层·玩家运行态覆盖（进存档·不进判定面·$ 前缀排除写·铁律②）──────────────
  '$AI创作状态',  // 玩家谓词override表+条目AI控制表·进存档回放·不影响判定盐（铁律②·AI开关永不进指纹）
  // ── LOD-B2.5 · 调度层（LOD 全程排外·阈值调控/敏感度 bias/条件④ 均不影响判定面）────
  '模块绑定策略',  // LOD-B2.5·PR-5c-1·敏感度 bias·阈值调控层·不影响判定面
  // 🎚️ 玩家运行态功能开关覆盖（$玩家偏好·进存档·不进判定面·$ 前缀 invisible）
  '功能开关override表', // 玩家运行态功能开关覆盖·认知迷雾/舞台追踪/二审严格度/观战推进模式·不影响判定
] as const;

export type FingerprintBundleMember = (typeof FINGERPRINT_BUNDLE_MEMBERS)[number];
export type FingerprintPresetField = (typeof FINGERPRINT_PRESET_FIELDS)[number];
export type FingerprintSnapshotField = (typeof FINGERPRINT_SNAPSHOT_FIELDS)[number];
export type FingerprintExcludedField = (typeof FINGERPRINT_EXCLUDED_FIELDS)[number];
