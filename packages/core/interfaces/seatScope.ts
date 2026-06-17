// B5 · C6 第②闸席位作用域谓词（纯·per-seat 提案资格·接 03d502c）
//
// 接 actor.ts:523 席位表Schema（席位表Type = Record<string, {焦点角色键, 控制者, 连接状态}>）。
// 活线 gate② 接入 defer B6；本步只交纯谓词函数。
// 跨席位效果应经交互动词被动方检定——本谓词不负责，fire defer B6。
//
// 红线：不 import rng/hashPresetFingerprint/gate/fingerprintManifest；不碰 hosts/；不改 actor.ts schema。

import type { 席位表Type } from '../schema/actor.js';

// ── 结果类型 ─────────────────────────────────────────────────────────────────

export type SeatScopeResult =
  | { readonly eligible: true }
  | { readonly eligible: false; readonly reason: string };

// ── C6 per-seat 谓词 ──────────────────────────────────────────────────────────

/**
 * C6 第②闸席位作用域谓词：判定席位 seatId 对目标角色键 targetCharKey 是否有提案资格。
 *
 * 规则：
 *   ① 席位表 ≤1 条目 → 单机退化 → 全权限（eligible: true）
 *   ② seatId 不在席位表 → 无效席位 → 不合格
 *   ③ 席位.焦点角色键 === targetCharKey → 合格
 *   ④ 席位.焦点角色键 === '' → 无焦点席位 → 不合格（无法确定作用域）
 *   ⑤ 其他 → 跨席位越权 → 不合格
 *
 * 纯函数·确定性·无副作用·无 wall-clock。
 */
export function checkC6SeatScope(
  seatId: string,
  席位表: 席位表Type,
  targetCharKey: string,
): SeatScopeResult {
  // 码点序遍历确保确定性
  const seatCount = Object.keys(席位表).length;
  if (seatCount <= 1) {
    return { eligible: true }; // 单机退化·全权限
  }
  const seat = 席位表[seatId];
  if (seat === undefined) {
    return { eligible: false, reason: `席位「${seatId}」不在席位表，无效提案席位` };
  }
  if (seat.焦点角色键 === targetCharKey) {
    return { eligible: true };
  }
  if (seat.焦点角色键 === '') {
    return { eligible: false, reason: `席位「${seatId}」无焦点角色（焦点角色键为空），无法确定提案作用域` };
  }
  return {
    eligible: false,
    reason: `席位「${seatId}」焦点角色「${seat.焦点角色键}」与目标角色「${targetCharKey}」不符，跨席位越权`,
  };
}
