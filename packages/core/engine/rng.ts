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
 * roundIndex disambiguates multiple rolls for the same channel in a single tick
 * (e.g. consecutive combat rounds — R5 determinism).
 */
function deriveSubSeed(
  seed: number,
  tick: number,
  channel: string,
  salt: number,
  roundIndex: number,
): number {
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
export function saltFromArchiveHeader(
  header: { 全局回滚计数器: number },
): number {
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
export function rngFor(
  seed: number,
  tick: number,
  channel: string,
  rerollSalt: number,
  roundIndex = 0,
): number {
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
export function rngForTrigger(
  seed: number,
  anchorTick: number,   // 事件种子播种时刻·非当前拍号
  channel: string,      // 必须 '触发:xxx' 前缀（4类触发契约通道）
  pSpan: number,        // 累积概率 [0,1]；已过 probOverSpan 折算
  rerollSalt: number,   // _存档头.全局回滚计数器
  roundIndex = 0,
): boolean {
  if (!channel.startsWith(TRIGGER_PREFIX)) {
    throw new Error(`rngForTrigger 只接受触发通道（前缀 "触发:"），收到：${channel}`);
  }
  const roll = rngFor(seed, anchorTick, channel, rerollSalt, roundIndex);
  return (roll / 100) < pSpan;
}

// ── B1b: 暴击映射 判定口径类型（镜像 preset.ts:暴击映射Schema·避免跨层依赖）──────
export type 暴击映射判定型 = '关' | { 顶格升一档: boolean; 底格降一档: boolean };

/**
 * B1d: Compute canonical hash of all judgment-facing preset fields (判定面整包).
 * Caller pre-computes this and passes the result to hashPresetFingerprint() as 判定面整包.
 *
 * Fields pending schema:
 *   - TODO(P0-7): 方式×速度换算表 — add when P0-7 speed model lands + 补断言
 *   - TODO(P0-7): H7量纲表全量 — add when P0-7 dimension system lands + 补断言
 */
export function hashJudgmentBundle(fields: {
  历法皮肤: unknown;
  粒度模板覆盖: unknown;
  种族模板: unknown;
  母题配额: unknown;
  媒体渠道表: unknown;
  检定配方表: unknown;              // 含出厂派生配方
  检定档切分表: unknown;
  欠债参数: unknown;                // 欠债阈值·利息周期
  换角许可?: unknown;
  世界遗产白名单出厂值?: unknown;
  赛事结构模板: unknown;
  派生量配方: unknown;              // 发现B·M·4·HP/精力等派生量公式
  概率域夹逼: unknown;              // H4·判定概率 clamp 域 [p_最小, p_最大]
  纠缠闭包弱边阈值: unknown;        // 6.66·累积强度 < 阈值截断弱边·默认0.2
  约定谓词集?: unknown;             // Q5·约定库谓词/选择器谓词定义表
  级联限制?: unknown;               // J5·级联深度N+轮号上限
  归并表?: unknown;                 // S4b·归并规则表
  /** F-b·P7-5c: 所有生效 mod 中 verb option.side_effects handlerRef 集合·集合变→判定面变 */
  side_effects注册集?: unknown;
  /** D-a-lore: _lore知识库全条目触发谓词集合·{loreKey→谓词串} 映射·改谓词即改判定面·R7-b gate判定路径 */
  lore谓词集合?: unknown;
  /** D-a-lore: active mod lore条目.能力集[].类型 集合·R6/R10判定面·类比F-b side_effects注册集·与side_effects不重叠 */
  受控接口能力集注册集?: unknown;
  /** G2-2: 媒介登记表{是否传播,传播系数}投影·{mediaKey:{是否传播?,传播系数?}}·判定面·改传播配置即改判定 */
  媒介传播面?: unknown;
  // TODO(P0-7): 方式×速度换算表 — 家在 P0-7 速度模型，届时加入签名 + 补断言
  // TODO(P0-7): H7量纲表全量 — 家在 P0-7 量纲系统，届时加入签名 + 补断言
}): string {
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
export function hashCanonical(value: unknown): string {
  return fnv1a32(canonicalize(value)).toString(16).padStart(8, '0');
}

export function hashPresetFingerprint(fields: {
  /** B1d: 判定面整包哈希·调用方通过 hashJudgmentBundle() 预计算后传入 */
  判定面整包: string;
  /** B1c: 全部已启用包（mod／事件包／战术包／补丁集／纪元包／effect包）的 内容哈希? 的集合哈希·调用方聚合后传入 */
  生效中内容包集哈希: string;
  /** K5: canonicalize(规则补丁) 的哈希·preset 已有 规则补丁Schema */
  规则补丁哈希?: string;
  /** DSL: DSL v1.0 冻结文法版本 */
  DSL文法版本?: string;
  /** §十A: 求值器函数库版本·v1={min,max,clamp,pow,sqrt}逐位恒等·增列超越函数时 bump */
  求值器函数库版本?: number;
  /** N-4: 软拒/拒答检测器规则版本·确定性规则·版本变则判定口径变·随 U3 版本分段 */
  软拒检测规则版本?: number;
  /** 对撞⑦: 中文数字解析规则版·三百/叁佰/3百→300 归一·改版即改判定口径 */
  中文数字解析规则版?: number;
  /** U3·F-c层1: 封段时活动引擎版本·版本变则分段指纹变·字段已在位·分段触发逻辑随P0-3/U3·当前所有preset该字段=undefined */
  引擎版本?: string;
  /** U3·F-c层1: 封段时Schema版本·版本变则分段指纹变·字段已在位·分段触发逻辑随P0-3/U3·当前所有preset该字段=undefined */
  Schema版本?: string;
  /** P0-8-B4: AOHP 菜单选项稳定键集合·排序后进指纹·选项重排不破指纹（顺序无关·multiset） */
  AOHP選項id集?: string[];
  /** 阶段1: mod 作者声明的确定性候选选项集整包哈希·hashCanonical(玩法预设.动词选项集)·改集合即改判定面 */
  动词选项集哈希?: string;
  /** 快照锁定组·开局锁定·随档快照；调用方从档内快照传入，绝不读 live 预设 */
  snapshot: {
    /** B1a·明文在册·直接纳入 */
    难度系数组: unknown;
    /** B1a·补三员之一 */
    判定骰型: 100 | 20;
    /** B1b·SNAPSHOT 组·判定口径·本轮类型收紧（关=无暴击·对象=启用参数） */
    暴击映射: 暴击映射判定型;
    /** B1a·补三员之二 */
    钳制表: unknown;
    /** B1a·补三员之三·属性轴表.最大值/自然上限·判定域上下界 */
    预设数值面域上下界: unknown;
  };
}): string {
  return fnv1a32(canonicalize(fields)).toString(16).padStart(8, '0');
}
