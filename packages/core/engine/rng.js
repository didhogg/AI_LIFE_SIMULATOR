// Ring 0 RNG primitives — pure functions, zero side effects.
// Uses pure-rand xorshift128plus; no Math.random() (banned by ESLint).
// Seed synthesis uses FNV-1a hash on a structured string to prevent XOR-folding collisions.
//
// Channel prefix convention:
//   检定:xxx    — ordinary skill check (rngFor)
//   触发:xxx    — event/trigger check (rngFor)
//   天命:xxx    — life-or-death / cycle-level fate check (rngForFate ONLY)
//
// 天命通道命名规范（生死/周目级概率判定强制走天命通道）:
//   天命:生死判定    — NPC 死亡/生存拦截判定
//   天命:周目开启    — 新周目/穿越触发判定
//   天命:天命重掷    — 玩家使用天命重掷券重掷
// 规则：锚定封印时拍号（originating tick，非当前拍号），fateRerollIndex 是
//        天命重掷券使用计数（≠ 普通 rerollSalt），两盐源严格隔离不混用。
import * as prand from 'pure-rand';
import { canonicalize } from './text/canonicalize.js';
/** 天命通道前缀常量（生死/周目级概率判定专用·强制使用 rngForFate） */
export const FATE_PREFIX = '天命:';
/** FNV-1a 32-bit hash — pure, zero dependencies. */
function fnv1a32(s) {
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
 * roundIndex disambiguates multiple rolls for the same channel in a single tick
 * (e.g. consecutive combat rounds — R5 determinism).
 */
function deriveSubSeed(seed, tick, channel, salt, roundIndex) {
    const input = `${seed}\x00${tick}\x00${channel}\x00${salt}\x00${roundIndex}`;
    return fnv1a32(input);
}
/**
 * Extract rerollSalt from _存档头.全局回滚计数器 (盐源规范).
 *
 * 盐源规范（R5 确定性）:
 *   - rngFor() 的 rerollSalt 必须来自 _存档头.全局回滚计数器
 *   - 计数器每次重掷/存档加载时 +1，且不随快照回滚还原（结构性阻止骰子农场）
 *   - 禁止将 $会话状态.演出层草稿计数 传入此参数（见 AA10）
 *
 * P0-9 接线：runTick 实装后引擎自动传递，调用方届时可移除手动调用。
 */
export function saltFromArchiveHeader(header) {
    return header.全局回滚计数器;
}
/**
 * Generate u ∈ [0, 99] for ordinary (non-fate) checks.
 *
 * rerollSalt = _存档头.全局回滚计数器 (via saltFromArchiveHeader).
 *   Increments on every reroll/重掷; NEVER restored by snapshot rollback —
 *   structurally blocks dice-farming. P0-9 will wire automatically via runTick.
 *
 * roundIndex (R5 确定性): disambiguates multiple rolls for the same channel in
 *   a single tick (e.g. combat rounds). Defaults to 0; increment for each
 *   subsequent roll in the same (seed, tick, channel, salt) tuple.
 *
 * ⚠️  演出层草稿计数 ($会话状态.演出层草稿计数) is a pure narrative watermark and
 *   MUST NOT be passed here as rerollSalt. See AA10.
 *
 * Throws if channel starts with '天命:' — use rngForFate instead.
 * 生死/周目级判定强制走 rngForFate（锚拍号、不混 rerollSalt）。
 */
export function rngFor(seed, tick, channel, rerollSalt, roundIndex = 0) {
    if (channel.startsWith(FATE_PREFIX)) {
        throw new Error(`rngFor 拒绝天命通道，请使用 rngForFate：${channel}`);
    }
    const subSeed = deriveSubSeed(seed, tick, channel, rerollSalt, roundIndex);
    const rng = prand.xorshift128plus(subSeed);
    return prand.unsafeUniformIntDistribution(0, 99, rng);
}
/**
 * Generate u ∈ [0, 99] for fate checks (天命通道).
 *
 * 天命通道规范（生死/周目级判定强制使用此函数）:
 *   - tick        = 封印时拍号（originating tick，发起命运判定时的拍号，不是当前拍号）
 *   - fateRerollIndex = $天命重掷券.已用记录.length — 仅天命重掷券使用时递增
 *   - 不混 rerollSalt（_存档头.全局回滚计数器）：普通重掷不改变天命骰
 *
 * Throws if channel does not start with '天命:'.
 */
export function rngForFate(seed, tick, channel, fateRerollIndex = 0) {
    if (!channel.startsWith(FATE_PREFIX)) {
        throw new Error(`rngForFate 只接受天命通道（前缀 "天命:"），收到：${channel}`);
    }
    const subSeed = deriveSubSeed(seed, tick, channel, fateRerollIndex, 0);
    const rng = prand.xorshift128plus(subSeed);
    return prand.unsafeUniformIntDistribution(0, 99, rng);
}
/** 触发通道前缀常量（世界信息概率触发专用·强制使用 rngForTrigger） */
export const TRIGGER_PREFIX = '触发:';
/**
 * 世界信息概率触发检定（触发通道·锚拍号混盐·P0-5 概率原语）。
 *
 * 三项使用规范（WI·R8·6.76）:
 *   1. anchorTick = 事件种子播种时刻（严禁传入当前拍号；用播种时的 tick 锁定骰序）
 *   2. pSpan      = 折算后累积概率 [0,1]；快进 N 期时先 `probOverSpan(p_period, N)` 再传入
 *                   （直接裸判每拍 = 用 p_period 代替 pSpan，快进失真·违禁 R8）
 *   3. rerollSalt = _存档头.全局回滚计数器（via saltFromArchiveHeader·同 rngFor 盐源）
 *
 * 精度约束：rngFor 返回 [0,99]；精度 = 1/100 = 1%。
 *   pSpan < 0.01 时 `(roll/100) < pSpan` 恒假 → 事件不触发（最小精度兜底·已知限制）。
 *   次级精度场景请传入 probOverSpan 折算后的多期累积概率（通常 ≥ 1%）。
 *
 * Throws if channel does not start with '触发:'.
 */
export function rngForTrigger(seed, anchorTick, // 事件种子播种时刻·非当前拍号
channel, // 必须 '触发:xxx' 前缀（4类触发契约通道）
pSpan, // 累积概率 [0,1]；已过 probOverSpan 折算
rerollSalt, // _存档头.全局回滚计数器
roundIndex = 0) {
    if (!channel.startsWith(TRIGGER_PREFIX)) {
        throw new Error(`rngForTrigger 只接受触发通道（前缀 "触发:"），收到：${channel}`);
    }
    const roll = rngFor(seed, anchorTick, channel, rerollSalt, roundIndex);
    return (roll / 100) < pSpan;
}
/**
 * B1d: Compute canonical hash of all judgment-facing preset fields (判定面整包).
 * Caller pre-computes this and passes the result to hashPresetFingerprint() as 判定面整包.
 *
 * Fields pending schema:
 *   - TODO(P0-7): 方式×速度换算表 — add when P0-7 speed model lands + 补断言
 *   - TODO(P0-7): H7量纲表全量 — add when P0-7 dimension system lands + 补断言
 */
export function hashJudgmentBundle(fields) {
    return fnv1a32(canonicalize(fields)).toString(16).padStart(8, '0');
}
/**
 * Compute fingerprint hash for all judgment-relevant fields (发现A 两分 · B1 extended).
 *
 * Caller responsibilities:
 *   1. Pre-compute 判定面整包 via hashJudgmentBundle() from live 玩法预设.
 *   2. Pre-compute 生效中内容包集哈希 by sorting + canonicalizing all active pack（mod／事件包／战术包／补丁集／纪元包／effect包）内容哈希? values (B1c).
 *   3. Pre-compute 规则补丁哈希 via fnv1a32(canonicalize(规则补丁)) if applicable (K5).
 *   4. Pass snapshot fields from the archive snapshot, NOT from live preset.
 *
 * Used to populate _tick.难度系数组指纹 in P0-7 runTick.
 */
/**
 * General-purpose canonical hash for any serializable value.
 * Uses the same FNV-1a + canonicalize pipeline as hashJudgmentBundle / hashPresetFingerprint.
 * Intended for archive checksums and non-judgment hashing needs.
 */
export function hashCanonical(value) {
    return fnv1a32(canonicalize(value)).toString(16).padStart(8, '0');
}
export function hashPresetFingerprint(fields) {
    return fnv1a32(canonicalize(fields)).toString(16).padStart(8, '0');
}
