// F-a effect 生产者侧: content_hash 自动填充·热加载重算
// H-c-4: effect deltas 过五道闸 clamp
// F-b AA6 工具: 计算 effect 包集哈希（供指纹变更断言使用）
//
// 五道闸接入口径（详规 securityBoundary.ts·子域4）：
//   ① Zod 形状 — 调用方 parse 阶段已完成（本函数不重做）
//   ② 白名单   — whitelist 非空时检查 path
//   ③ 前缀权限 — 首段 _ / $ 开头直接拒
//   ④ 钳制     — max_delta 截断数值型 value
//   ⑤ 原子令牌 — ok=false → 调用方拒绝整包落账
//
// 红线：不 import rng.ts / gate.ts / fixed.ts

import {
  computeEffectPackHash,
  聚合生效中内容包集哈希,
} from '../interfaces/contentPackHash.js';
import type { intervention_pack_v1Type } from '../schema/memory.js';

// ── F-a: content_hash 自动填充 ────────────────────────────────────────────────

/**
 * F-a: 计算并填充 effect 包的 content_hash。
 *
 * 算法：fnv1a32(canonicalize(排除 content_hash 字段后的所有字段))
 * 热加载重算纪律：每次包注册/更新时调用本函数重填，确保哈希与内容严格一致。
 * content_hash 变化 → 聚合哈希变化 → 生效中内容包集哈希变化 → hashPresetFingerprint 变化（AA6 链路）。
 */
export function fillEffectPackHash<T extends Record<string, unknown>>(
  pack: T,
): T & { content_hash: string } {
  const hash = computeEffectPackHash(pack);
  return { ...pack, content_hash: hash };
}

/**
 * F-a 热加载重算验证：对比旧 content_hash 与重算值是否一致。
 * 一致 = pack 内容未变；不一致 = 需要重填（热加载点调用本函数检测）。
 */
export function isEffectPackHashStale(
  pack: { content_hash?: string } & Record<string, unknown>,
): boolean {
  const expected = computeEffectPackHash(pack);
  return pack.content_hash !== expected;
}

// ── H-c-4: effect deltas 过五道闸 ─────────────────────────────────────────────

/** 单条 delta 经钳制后的结果 */
export interface ClampedDelta {
  readonly path: string;
  readonly op: string;
  readonly value: number | string;
  readonly max_delta?: number;
  readonly clamped: boolean; // true = 值已被截断
}

/** 五道闸结果 */
export interface EffectGateResult {
  readonly ok: boolean;                    // false → 整包被拒
  readonly clampedDeltas: readonly ClampedDelta[];
  readonly errors: readonly string[];
}

/** 白名单集（空集 = 仅做前缀校验·不做路径白名单·defer B6 registry fill） */
export type WhitelistSet = ReadonlySet<string>;

/**
 * H-c-4: effect deltas 过五道闸。
 *
 * 五道：
 *   ① Zod 形状  — 调用方 parse 完成，不重做
 *   ② 白名单    — whitelist 非空时 path 须命中（空集 = defer B6）
 *   ③ 前缀权限  — 首段 _ / $ 开头 → 拒绝
 *   ④ 钳制      — max_delta 截断数值型 value（越界不落）
 *   ⑤ 原子令牌  — ok=false → 调用方原子拒绝整包（all-or-nothing 契约）
 *
 * @param pack      intervention_pack_v1 (deltas 字段)
 * @param whitelist 受治理键白名单（来源 deriveModAwareWhitelist·defer B6 时传 new Set()）
 */
export function runEffectGates(
  pack: Pick<intervention_pack_v1Type, 'deltas'>,
  whitelist: WhitelistSet = new Set(),
): EffectGateResult {
  const errors: string[] = [];
  const clampedDeltas: ClampedDelta[] = [];

  for (const delta of pack.deltas ?? []) {
    const firstSeg = delta.path.split('.')[0] ?? '';

    // 闸③: 前缀权限（_/$前缀硬排除）
    if (firstSeg.startsWith('_') || firstSeg.startsWith('$')) {
      errors.push(`前缀权限[③]: path「${delta.path}」首段以「${firstSeg[0]}」开头·禁止 effect 写入`);
      clampedDeltas.push({
        path: delta.path, op: delta.op, value: delta.value, clamped: false,
        ...(delta.max_delta !== undefined ? { max_delta: delta.max_delta } : {}),
      });
      continue;
    }

    // 闸②: 白名单（仅非空 whitelist）
    if (whitelist.size > 0 && !whitelist.has(delta.path)) {
      errors.push(`白名单[②]: path「${delta.path}」不在受治理键空间白名单内`);
      clampedDeltas.push({
        path: delta.path, op: delta.op, value: delta.value, clamped: false,
        ...(delta.max_delta !== undefined ? { max_delta: delta.max_delta } : {}),
      });
      continue;
    }

    // 闸④: 钳制 max_delta（越界不落）
    let finalValue = delta.value;
    let wasClamped = false;
    if (delta.max_delta !== undefined && typeof delta.value === 'number') {
      const bounded = Math.max(-delta.max_delta, Math.min(delta.max_delta, delta.value));
      if (bounded !== delta.value) {
        finalValue = bounded;
        wasClamped = true;
      }
    }

    clampedDeltas.push({
      path: delta.path, op: delta.op, value: finalValue, clamped: wasClamped,
      ...(delta.max_delta !== undefined ? { max_delta: delta.max_delta } : {}),
    });
  }

  // 闸⑤: 原子令牌 — ok=false 时调用方拒绝整包落账
  return { ok: errors.length === 0, clampedDeltas, errors };
}

// ── F-b / AA6: 效果包集哈希工具 ──────────────────────────────────────────────

/**
 * F-b AA6 工具: 从已填充 content_hash 的 effect 包集合计算聚合哈希。
 *
 * AA6 双向断言口径：
 *   · 改 effect packs → 聚合哈希变 → 生效中内容包集哈希变 → hashPresetFingerprint 变（"该变时变"）
 *   · 改其他无关项   → 聚合哈希不变 → hashPresetFingerprint 不变（"不该变时不变"）
 *
 * 空集合 → '' (fail-open 确定性占位·同 contentPackHash.ts 契约)。
 */
export function computeEffectPackSetHash(
  packs: ReadonlyArray<{ content_hash?: string }>,
): string {
  return 聚合生效中内容包集哈希(packs);
}
