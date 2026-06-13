// AA6: Fingerprint membership manifest — explicit enrollment roster for hashPresetFingerprint().
// Discipline: adding a new fingerprint member MUST update both const arrays below AND the
// property tests in tests/fingerprint.property.test.ts. No silent additions allowed.

/** 预设整包组 — 从不快照的预设判定字段；调用方直接从 玩法预设 传入。 */
export const FINGERPRINT_PRESET_FIELDS = [
  '检定配方表',
  '检定档切分表',
  // ── Reserved slots (not yet in schema; add to this array when implemented): ──────
  // '历法模板',      // calendar / era template
  // '粒度模板',      // time-granularity template
  // '母题配额表',    // motif quota table
  // '媒体渠道表',    // media-channel routing table
] as const;

/** 快照锁定组 — 开局锁定·随档快照；调用方从档内快照传入，绝不读 live 预设。 */
export const FINGERPRINT_SNAPSHOT_FIELDS = [
  '难度系数组',
  '判定骰型',
  '暴击映射', // B1b·进指纹；field reserved — type definition deferred to P1
  '钳制表',
] as const;

/**
 * 排除名单 — 显式不进指纹成员。
 * 纪律：出现在此名单的字段永远不得传入 hashPresetFingerprint；
 *   若误加入 preset/snapshot 组，property 测试将立即报红。
 */
export const FINGERPRINT_EXCLUDED_FIELDS = [
  '显骰',           // 展示层·纯 UI；不影响判定逻辑
  '叙事分发表',     // 媒介路由规则；不影响检定结果
  '媒介登记表',     // 叙事模板；不影响检定结果
  '叙事偏好',       // AI 可见自由文本；纯叙事面
  '演出层草稿计数', // 纯叙事血统水印（原「本拍重掷序号」·发现D）；永不进盐/判定
  '叙事密度档',     // 预算/节奏控制；不影响判定
  '启用文风键',     // 文风切换开关；AI 可见；不影响检定
] as const;

export type FingerprintPresetField = (typeof FINGERPRINT_PRESET_FIELDS)[number];
export type FingerprintSnapshotField = (typeof FINGERPRINT_SNAPSHOT_FIELDS)[number];
export type FingerprintExcludedField = (typeof FINGERPRINT_EXCLUDED_FIELDS)[number];
