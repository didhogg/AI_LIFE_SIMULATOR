// Ring 0 RNG primitives — pure functions, zero side effects.
// Uses pure-rand xorshift128plus; no Math.random() (banned by ESLint).
// Seed synthesis uses FNV-1a hash on a structured string to prevent XOR-folding collisions.
// Channel prefix convention: 检定:xxx / 触发:xxx / 天命:xxx
import * as prand from 'pure-rand';

const FATE_PREFIX = '天命:';

/** FNV-1a 32-bit hash — pure, zero dependencies. */
function fnv1a32(s: string): number {
  let h = 2166136261; // 32-bit FNV offset basis
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

/**
 * Derive a sub-seed from structured inputs.
 * Null-byte delimiters prevent field-boundary collisions.
 * Prevents XOR-folding: (tick=5, salt=1) ≠ (tick=4, salt=0).
 */
function deriveSubSeed(
  seed: number,
  tick: number,
  channel: string,
  salt: number,
): number {
  const input = `${seed}\x00${tick}\x00${channel}\x00${salt}`;
  return fnv1a32(input);
}

/**
 * Generate u ∈ [0, 99] for ordinary (non-fate) checks.
 * Mixes rerollSalt so each "重掷这一拍" press produces a new roll.
 * Throws if channel starts with '天命:' — use rngForFate instead.
 */
export function rngFor(
  seed: number,
  tick: number,
  channel: string,
  rerollSalt: number,
): number {
  if (channel.startsWith(FATE_PREFIX)) {
    throw new Error(`rngFor 拒绝天命通道，请使用 rngForFate：${channel}`);
  }
  const subSeed = deriveSubSeed(seed, tick, channel, rerollSalt);
  const rng = prand.xorshift128plus(subSeed);
  return prand.unsafeUniformIntDistribution(0, 99, rng);
}

/**
 * Generate u ∈ [0, 99] for fate checks (天命通道).
 * fateRerollIndex increments only when a 天命重掷券 is used.
 * Throws if channel does not start with '天命:'.
 * Never mixes ordinary rerollSalt — fate rolls don't change with player rerolls.
 */
export function rngForFate(
  seed: number,
  tick: number,
  channel: string,
  fateRerollIndex = 0,
): number {
  if (!channel.startsWith(FATE_PREFIX)) {
    throw new Error(
      `rngForFate 只接受天命通道（前缀 "天命:"），收到：${channel}`,
    );
  }
  const subSeed = deriveSubSeed(seed, tick, channel, fateRerollIndex);
  const rng = prand.xorshift128plus(subSeed);
  return prand.unsafeUniformIntDistribution(0, 99, rng);
}

/**
 * Compute fingerprint hash for preset judgment fields.
 * Used to populate _tick.难度系数组指纹 in P0-7 runTick.
 */
export function hashPresetFingerprint(fields: {
  检定配方表: unknown;
  难度系数组: unknown;
  钳制表: unknown;
  判定骰型: 100 | 20;
  检定档切分表: unknown;
}): string {
  const h = fnv1a32(JSON.stringify(fields));
  return h.toString(16).padStart(8, '0');
}
