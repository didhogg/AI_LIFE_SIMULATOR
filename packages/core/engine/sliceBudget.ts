// P0-8 Batch 3: 切片预算 B1–B6 四级供给阶梯
// 组装侧·切片降级不进指纹（R7-b 组装律·与确定性判定层解耦）
//
// 超限降级顺序（拍板③）: lore谓词 → 近K历史 → 编年史
// 超限不崩·只裁剪·保留 core/npc/cog/secrets（不可降级件）
//
// 确定性六禁: 无 Date.now / Math.random / 平台超越函数 / localeCompare / 裸 JSON.stringify / NFC normalize

/** 可降级切片键（B1–B6 供给阶梯·降级顺序定义于 DEGRADATION_ORDER） */
export type SliceKey = 'lore' | 'nearK' | 'chronicle' | 'npc' | 'cog' | 'secrets' | 'core';

export interface SlicePart {
  key: SliceKey;
  content: string;
}

export interface SliceBudgetSpec {
  /** 软上限 token 数（超出后按优先级降级） */
  softLimitTokens: number;
}

export interface SliceBudgetResult {
  parts: SlicePart[];
  /** 被降级的切片键列表（记录口径·供日志·不进指纹） */
  degradedKeys: SliceKey[];
}

/** 降级优先级（靠前=先降·低优先级先截）- 拍板③铁律 */
export const DEGRADATION_ORDER: readonly SliceKey[] = ['lore', 'nearK', 'chronicle'] as const;

/**
 * 粗估 token 数。
 * CJK / 假名 / 全角约 1 char/token；ASCII / 标点约 0.25 char/token。
 * 纯函数·同文同值·不依赖外部状态·不进指纹。
 */
export function estimateTokens(text: string): number {
  let count = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (
      (code >= 0x4E00 && code <= 0x9FFF) ||   // CJK Unified Ideographs
      (code >= 0x3000 && code <= 0x303F) ||   // CJK Symbols and Punctuation
      (code >= 0x3040 && code <= 0x30FF) ||   // Hiragana + Katakana
      (code >= 0xFF00 && code <= 0xFFEF) ||   // Halfwidth and Fullwidth Forms
      (code >= 0x2E80 && code <= 0x2EFF)      // CJK Radicals Supplement
    ) {
      count += 1; // CJK 等约 1 token/char
    } else {
      count += 0.25; // ASCII / 标点约 0.25 token/char
    }
  }
  return Math.ceil(count);
}

/**
 * 计算切片部件列表总 token 数。
 */
export function estimateSliceTokens(parts: SlicePart[]): number {
  return parts.reduce((sum, p) => sum + estimateTokens(p.content), 0);
}

/**
 * 按超限降级顺序裁剪切片部件（B1–B6 四级供给阶梯）。
 *
 * 降级顺序（拍板③铁律）: lore谓词 → 近K历史 → 编年史
 *   - lore  → 整体去除（谓词切片是整组·不可半留）
 *   - nearK → 历史条数减半（最少保留1行）
 *   - chronicle → 整体去除（末位压缩）
 *
 * 不进指纹（组装律·R7-b）：返回值仅用于叙事注入·禁传入 hashPresetFingerprint。
 */
export function applySliceBudget(
  parts: SlicePart[],
  budget: SliceBudgetSpec,
): SliceBudgetResult {
  let current = [...parts];
  const degradedKeys: SliceKey[] = [];

  for (const key of DEGRADATION_ORDER) {
    if (estimateSliceTokens(current) <= budget.softLimitTokens) break;

    if (key === 'lore') {
      const before = current.length;
      current = current.filter(p => p.key !== 'lore');
      if (current.length < before) degradedKeys.push('lore');
    } else if (key === 'nearK') {
      const idx = current.findIndex(p => p.key === 'nearK');
      if (idx >= 0) {
        const orig = current[idx]!;
        const lines = orig.content.split('\n').filter(l => l.length > 0);
        const keep = Math.max(1, Math.floor(lines.length / 2));
        if (keep < lines.length) {
          current = [
            ...current.slice(0, idx),
            { key: 'nearK', content: lines.slice(-keep).join('\n') },
            ...current.slice(idx + 1),
          ];
          degradedKeys.push('nearK');
        }
      }
    } else if (key === 'chronicle') {
      const before = current.length;
      current = current.filter(p => p.key !== 'chronicle');
      if (current.length < before) degradedKeys.push('chronicle');
    }
  }

  return { parts: current, degradedKeys };
}
