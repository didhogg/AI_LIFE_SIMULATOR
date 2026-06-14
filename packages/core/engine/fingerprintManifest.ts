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
  // TODO(P0-6): 概率域夹逼 — 家在 P0-6 受治理键空间，届时加入签名 + 补断言
  // TODO(P0-7): 方式×速度换算表 — 家在 P0-7 速度模型，届时加入签名 + 补断言
  // TODO(P0-7): H7量纲表全量 — 家在 P0-7 量纲系统，届时加入签名 + 补断言
] as const;

// ── 预设整包组（顶层·从不快照）──────────────────────────────────────────────────
/** 预设整包组 — 传入 hashPresetFingerprint() 的预设侧字段（均为调用方预计算后传入）。 */
export const FINGERPRINT_PRESET_FIELDS = [
  '判定面整包',              // B1d: hashJudgmentBundle() 输出·调用方预计算后传入
  '生效中内容包集哈希',       // B1c: 全部已启用 mod 内容哈希? 的集合哈希
  '规则补丁哈希',             // K5: canonicalize(规则补丁) 的哈希·preset 已有 规则补丁Schema
  // TODO(Q5): 约定库谓词/选择器谓词 — 家在 P0-6 受治理键空间，届时接线 + 补断言
  //           归并表运行实例(S4b) 家在 P0-6 受治理键空间，同批接线
  // TODO(J5): 级联深度 N + 轮号 — preset 无此字段时延至 P0-6，届时接线 + 补断言
  // TODO(DSL): DSL 文法版本号 — 求值器归 P0-6/P0-7，届时接线 + 补断言
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
  '叙事偏好',           // AI 可见自由文本·纯叙事面
  '启用文风键',         // 文风切换·AI 可见·不影响检定
  '生效锚点',           // mod 签名字段·校验用·不影响判定（B1c 用集合哈希·不枚举单条）
  '基底契约',           // mod 签名字段·校验用·不影响判定
  '内容哈希',           // mod 单条签名字段·不直接进指纹（B1c 用聚合集合哈希）
] as const;

export type FingerprintBundleMember = (typeof FINGERPRINT_BUNDLE_MEMBERS)[number];
export type FingerprintPresetField = (typeof FINGERPRINT_PRESET_FIELDS)[number];
export type FingerprintSnapshotField = (typeof FINGERPRINT_SNAPSHOT_FIELDS)[number];
export type FingerprintExcludedField = (typeof FINGERPRINT_EXCLUDED_FIELDS)[number];
