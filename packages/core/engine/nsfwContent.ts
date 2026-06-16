// NSFW 内容隔离模块 — P0 baseline 基准线
// 所有 NSFW 默认内容串、预填串、破限引子默认值 集中住此文件。
// 未来 P1/P2 SFW/light 构建可通过 tree-shake 剔除此文件实现内容剔除。
//
// 纪律（防回归）：
//   - NSFW 内容串字面量只允许出现在本文件。
//   - 其他文件引用请 import，不得内联硬编码。
//   - CI 核查命令（P1+ 内容上线后启用）：
//       grep -rn '[u0000-￿]\{20,\}' packages/core/schema/ packages/core/prompt/ \
//         packages/core/engine/ --include="*.ts" \
//         | grep -v 'nsfwContent\|\.test\.' | grep -v '//' 的大段注释
//       → 人工核查命中项是否为 NSFW 内容串

// ── 编译期基准线常量 ─────────────────────────────────────────────────────────
// P0 硬编码为 'full'（四档全开）。
// P1/P2 可通过构建时宏（build define）注入 'sfw' 或 'light' 实现分档 tree-shake。
// 不接 build define·不做构建剔除：这是 P0 单一接缝点，剔除在 P1/P2 实施。

/** P0–P2 内容档位基准线 */
export type NsfwBaseline = 'sfw' | 'light' | 'full';

/**
 * 当前构建的内容档位基准线。
 * P0: 'full'（所有四个档位均可用）
 * P1 SFW 包: 'sfw'   → availableContentRatings() = ['off']
 * P1 light 包: 'light' → availableContentRatings() = ['off', 'light']
 */
export const NSFW_BASELINE: NsfwBaseline = 'full';

/** 每个基准线对应的可用内容档子集（用于存档 clamp / migrate 验证） */
export const CONTENT_RATING_SUBSETS = {
  sfw:   ['off'],
  light: ['off', 'light'],
  full:  ['off', 'light', 'explicit', 'community'],
} as const satisfies Record<NsfwBaseline, ReadonlyArray<string>>;

/**
 * 返回当前基准线下可用的内容档位列表。
 * 调用方用于存档 clamp（越界档→降级）和 UI 档位菜单过滤。
 */
export function availableContentRatings(): ReadonlyArray<string> {
  return CONTENT_RATING_SUBSETS[NSFW_BASELINE];
}

// ── per-provider 破限引子默认串 ───────────────────────────────────────────────
// P0: 全部为空字符串占位。
// P1: 真实内容由 provider 包注入（单一接缝：只改此文件）。
// 约定: 组装器按模型族读取此处默认值；玩家在 $模型画像.破限引子 中配置的值优先覆盖默认。

/** Claude 系列·system 块注入内容（P1 填入实际破限引子） */
export const DEFAULT_CLAUDE_SYSTEM_ADDON = '';

/** Claude 系列·assistant 预填串（continue prefill） */
export const DEFAULT_CLAUDE_ASSISTANT_PREFILL = '';

/** Gemini 系列·assistant 预填串 */
export const DEFAULT_GEMINI_ASSISTANT_PREFILL = '';

/** GLM 系列·assistant 预填串 */
export const DEFAULT_GLM_ASSISTANT_PREFILL = '';

// ── 档位提示词追加串 ──────────────────────────────────────────────────────────
// explicit/community 档启用时追加到 system prompt 的风格框架串。
// P0: 空字符串占位。P1: 填入成人小说家框架提示词。

/** explicit 档风格补正追加串（content_rating=explicit 时注入） */
export const DEFAULT_EXPLICIT_STYLE_ADDON = '';

/** community 档风格补正追加串（content_rating=community 时注入） */
export const DEFAULT_COMMUNITY_STYLE_ADDON = '';

// ── 统一出口对象（方便 import * as nsfwContent 后整体检视） ───────────────────
export const DEFAULT_NSFW_CONTENT = {
  claudeSystemAddon:        DEFAULT_CLAUDE_SYSTEM_ADDON,
  claudeAssistantPrefill:   DEFAULT_CLAUDE_ASSISTANT_PREFILL,
  geminiAssistantPrefill:   DEFAULT_GEMINI_ASSISTANT_PREFILL,
  glmAssistantPrefill:      DEFAULT_GLM_ASSISTANT_PREFILL,
  explicitStyleAddon:       DEFAULT_EXPLICIT_STYLE_ADDON,
  communityStyleAddon:      DEFAULT_COMMUNITY_STYLE_ADDON,
} as const;
