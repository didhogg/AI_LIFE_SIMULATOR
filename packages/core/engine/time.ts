// Ring 0 time-system primitives — pure functions, zero side effects.
// Epoch anchor: 1970-01-01 00:00:00 Gregorian = epoch minute 0.
// ESLint bans enforced by CI: Date.now(), new Date(), Math.random() absent.

// ── Constants ─────────────────────────────────────────────────────────────────

/** Gregorian year that epoch minute 0 maps to (1970-01-01). */
export const EPOCH_ANCHOR_YEAR = 1970;

export const MINUTES_PER_DAY = 1440;
export const MINUTES_PER_MONTH = 43200;   // 30-day game month
export const MINUTES_PER_YEAR = 518400;   // 12 × MINUTES_PER_MONTH

/** Tick duration in epoch minutes, indexed by granularity key. */
export const TICK_MINUTES: Readonly<Record<string, number>> = {
  即时: 5,
  日常: MINUTES_PER_DAY,
  发展: MINUTES_PER_MONTH,
  月: MINUTES_PER_MONTH,
  日: MINUTES_PER_DAY,
  年: MINUTES_PER_YEAR,
  世代: MINUTES_PER_YEAR,
} as const;

export const VALID_GRANULARITIES: ReadonlySet<string> = new Set(Object.keys(TICK_MINUTES));

/** Maximum granularity stack depth before push throws. */
export const GRANULARITY_STACK_MAX = 8;

// ── Gregorian arithmetic ──────────────────────────────────────────────────────

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  const md = [0, 31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return md[month] ?? 30;
}

/**
 * Gregorian date → absolute epoch minutes.
 * Canonical implementation — the sole source of truth for this conversion in core.
 * Returns 0 for dates before 1970-01-01.
 */
export function gregorianToEpochMin(year: number, month: number, day: number): number {
  if (year < EPOCH_ANCHOR_YEAR) return 0;
  let days = 0;
  for (let y = EPOCH_ANCHOR_YEAR; y < year; y++) days += isLeapYear(y) ? 366 : 365;
  for (let mo = 1; mo < month; mo++) days += daysInMonth(year, mo);
  days += day - 1;
  return days * MINUTES_PER_DAY;
}

/** Absolute epoch minutes → Gregorian {year, month, day}. */
export function epochMinToGregorian(em: number): { year: number; month: number; day: number } {
  if (em < 0) return { year: EPOCH_ANCHOR_YEAR, month: 1, day: 1 };
  let remaining = Math.floor(em / MINUTES_PER_DAY);
  let year = EPOCH_ANCHOR_YEAR;
  for (;;) {
    const diy = isLeapYear(year) ? 366 : 365;
    if (remaining < diy) break;
    remaining -= diy;
    year++;
  }
  let month = 1;
  while (month <= 12) {
    const dim = daysInMonth(year, month);
    if (remaining < dim) break;
    remaining -= dim;
    month++;
  }
  return { year, month, day: remaining + 1 };
}

/** Parse "YYYY年MM月DD日" → absolute epoch minutes (base 1970-01-01 = 0). */
export function parseChineseDateToEpochMin(s: string): number {
  const m = /^(\d+)年(\d+)月(\d+)日$/.exec(s.trim());
  if (!m) return 0;
  return gregorianToEpochMin(Number(m[1]), Number(m[2]), Number(m[3]));
}

/** Return tick duration in epoch minutes for a granularity key. Falls back to MINUTES_PER_MONTH. */
export function getTickMinutes(粒度: string): number {
  return TICK_MINUTES[粒度] ?? MINUTES_PER_MONTH;
}

/** periodToEpochMin factory: worldEpochMin − (周期数 − N) × tickMinutes */
export function makePeriodConverter(
  worldEpochMin: number,
  周期数: number,
  tickMin: number,
): (n: number) => number {
  return (n: number): number => worldEpochMin - (周期数 - n) * tickMin;
}

// ── Calendar skin rendering ───────────────────────────────────────────────────

export interface CalendarConfig {
  纪年法: string;
  /** Epoch minutes corresponding to year-1 of this calendar era. 0 = same anchor as Gregorian. */
  纪元锚点: number;
  年号表: ReadonlyArray<{ 年号: string; 起始纪元分钟: number }>;
  月制: string;
  /** Template string. Tokens: {year} {month} {day} {年号} {年号年} {公元年} */
  显示模板: string;
}

/**
 * Render an epoch minute as a calendar display string.
 * {year}   = era-relative year (or Gregorian if no era config)
 * {公元年} = Gregorian year always
 * {年号}   = current era name from 年号表
 * {年号年} = year within the current 年号 era
 * {month} {day} = Gregorian month/day
 */
export function renderCalendar(epochMin: number, config: CalendarConfig): string {
  const { year: gyear, month, day } = epochMinToGregorian(epochMin);

  let yearLabel = '';
  let relativeYear = gyear;

  if (config.年号表.length > 0) {
    let best: { 年号: string; 起始纪元分钟: number } | undefined;
    for (const entry of config.年号表) {
      if (
        entry.起始纪元分钟 <= epochMin &&
        (best === undefined || entry.起始纪元分钟 > best.起始纪元分钟)
      ) {
        best = entry;
      }
    }
    if (best !== undefined) {
      yearLabel = best.年号;
      const eraStart = epochMinToGregorian(best.起始纪元分钟);
      relativeYear = gyear - eraStart.year + 1;
    }
  } else if (config.纪元锚点 > 0) {
    const anchorGreg = epochMinToGregorian(config.纪元锚点);
    relativeYear = gyear - anchorGreg.year + 1;
  }

  return config.显示模板
    .replace('{公元年}', String(gyear))
    .replace('{年号年}', String(relativeYear))
    .replace('{年号}', yearLabel)
    .replace('{year}', String(relativeYear))
    .replace('{month}', String(month))
    .replace('{day}', String(day));
}

// ── Granularity stack ─────────────────────────────────────────────────────────

export function pushGranularity(stack: readonly string[], 粒度: string): string[] {
  if (!VALID_GRANULARITIES.has(粒度)) throw new Error(`未知粒度键: ${粒度}`);
  if (stack.length >= GRANULARITY_STACK_MAX) throw new Error(`粒度栈深度超限: max ${GRANULARITY_STACK_MAX}`);
  return [...stack, 粒度];
}

export function popGranularity(stack: readonly string[]): string[] {
  if (stack.length === 0) throw new Error('粒度栈为空，无法 pop');
  return stack.slice(0, -1);
}

// ── Dual clock ────────────────────────────────────────────────────────────────

export interface WorldClock {
  epochMin: number;
  frozen: boolean;   // true during RP_FOCUS; only lens clock advances
}

export interface LensClock {
  epochMin: number;
  /** World epoch min at RP_FOCUS entry; 0 when not in RP_FOCUS. */
  focusStartWorldMin: number;
}

export interface DualClock {
  world: WorldClock;
  lens: LensClock;
}

export function makeDualClock(worldEpochMin: number): DualClock {
  return {
    world: { epochMin: worldEpochMin, frozen: false },
    lens: { epochMin: worldEpochMin, focusStartWorldMin: 0 },
  };
}

/** Enter RP_FOCUS: freeze world clock, record entry point on lens. */
export function enterRpFocus(clock: DualClock): DualClock {
  return {
    world: { ...clock.world, frozen: true },
    lens: { ...clock.lens, focusStartWorldMin: clock.world.epochMin },
  };
}

/**
 * Exit RP_FOCUS: apply lensElapsedMin to world clock in one lazy step,
 * matching the result of having advanced the world tick-by-tick.
 */
export function exitRpFocus(clock: DualClock, lensElapsedMin: number): DualClock {
  return {
    world: { epochMin: clock.world.epochMin + lensElapsedMin, frozen: false },
    lens: { epochMin: clock.lens.epochMin, focusStartWorldMin: 0 },
  };
}

export function advanceWorld(clock: DualClock, minutes: number): DualClock {
  if (clock.world.frozen) throw new Error('世界时钟已冻结（RP_FOCUS 中），不得直接推进');
  return { ...clock, world: { ...clock.world, epochMin: clock.world.epochMin + minutes } };
}

export function advanceLens(clock: DualClock, minutes: number): DualClock {
  return { ...clock, lens: { ...clock.lens, epochMin: clock.lens.epochMin + minutes } };
}

// ── Decay & probability ───────────────────────────────────────────────────────

/**
 * Linear accumulation: value += ratePerMonth × (spanMin / MINUTES_PER_MONTH).
 * Fast-forward invariant: decayLinear(v, r, 518400) === decayLinear(v, r, 43200 × 12).
 */
export function decayLinear(value: number, ratePerMonth: number, spanMin: number): number {
  return value + ratePerMonth * (spanMin / MINUTES_PER_MONTH);
}

/**
 * Compound-growth factor: (1 + annualRate)^(spanMin / MINUTES_PER_YEAR).
 * Returns a multiplier — caller does: newValue = oldValue * compound(rate, span).
 */
export function compound(annualRate: number, spanMin: number): number {
  return Math.pow(1 + annualRate, spanMin / MINUTES_PER_YEAR);
}

/**
 * Probability of at least one occurrence over spanMonths given per-month probability.
 * Formula: 1 − (1 − monthProb)^spanMonths
 */
export function probOverSpan(monthProb: number, spanMonths: number): number {
  return 1 - Math.pow(1 - monthProb, spanMonths);
}

// ── Expiry check ──────────────────────────────────────────────────────────────

/**
 * True if deadline has passed relative to now.
 * Sentinel: deadline === 0 means eternal — never expires.
 */
export function isExpired(deadline: number, now: number): boolean {
  return deadline > 0 ? now >= deadline : false;
}
