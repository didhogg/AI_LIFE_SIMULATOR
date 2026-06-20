// Web debug host (state tree viewer + button panel) — placeholder until P0-11
//
// ── NSFW Ring0 調試覆蓋接口（預留·P1 Ring0 門實裝時接入）──────────────────────────
//
// 設計決議（P0-8-B4 拍板⑤·NSFW UI defer P1）：
//   Ring0 門本體 defer P1；此接口僅作預留，P1 Ring0 實裝時 Ring0 判定函數應調用
//   isDebugNsfwOverrideActive()，若返回 true 則直接放行所有內容（不過任何過濾）。
//
// 安全隔離（絕對不影響正式打包產物）：
//   本文件僅在 hosts/web-debug 宿主環境中引入。
//   正式宿主（hosts/tavern / 未來 P0-11 薄殼）不引用本文件。
//   禁止在 packages/core 或 hosts/slice 中 import 此文件。
//
// 激活條件（任一满足即放行）：
//   1. window.__DEBUG_NSFW === true
//   2. URL 查詢參數包含 nsfw=1

declare global {
  interface Window {
    // 調試覆蓋旗標·僅 web-debug 宿主可設；正式打包無此旗標
    __DEBUG_NSFW?: boolean;
  }
}

/**
 * 檢查是否處於 NSFW 調試覆蓋狀態。
 *
 * P1 Ring0 門接線指引：
 *   ```ts
 *   // 在 Ring0 門判定函數頂部添加：
 *   if (isDebugNsfwOverrideActive()) return { allowed: true, reason: 'debug_override' };
 *   ```
 *
 * @returns true 表示 Ring0 門應直接放行（不過任何 NSFW 過濾）
 */
export function isDebugNsfwOverrideActive(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.__DEBUG_NSFW === true) return true;
  if (typeof URLSearchParams !== 'undefined' && typeof window.location !== 'undefined') {
    return new URLSearchParams(window.location.search).get('nsfw') === '1';
  }
  return false;
}

export {};
