// Ring 0 time-system primitives — pure functions, zero side effects.
// Epoch anchor: 1970-01-01 00:00:00 Gregorian = epoch minute 0.
// Pre-1970 dates return negative epoch minutes (full integer axis support).
// ESLint bans enforced by CI: Date.now(), new Date(), Math.random() absent.

// ── Constants ─────────────────────────────────────────────────────────────────

/** Gregorian year that epoch minute 0 maps to (1970-01-01). */
export const EPOCH_ANCHOR_YEAR = 1970;

export const MINUTES_PER_DAY = 1440;
export const MINUTES_PER_MONTH = 43200;   // 30-day game month
export const MINUTES_PER_YEAR = 518400;   // 12 × MINUTES_PER_MONTH

/**
 * Nominal tick duration in minutes, indexed by granularity key.
 * Used by migrate.ts backward conversion and probOverSpan standard-month denominator.
 * Engine runtime tick spans use calendar-aligned functions (computeTickSpan), not this table.
 */
export const MIGRATION_TICK_MINUTES: Readonly<Record<string, number>> = {
  即时: 5,
  日常: MINUTES_PER_DAY,
  发展: MINUTES_PER_MONTH,
  月: MINUTES_PER_MONTH,
  日: MINUTES_PER_DAY,
  年: MINUTES_PER_YEAR,
  世代: MINUTES_PER_YEAR,
} as const;

export const VALID_GRANULARITIES: ReadonlySet<string> = new Set(Object.keys(MIGRATION_TICK_MINUTES));

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
 * Supports the full integer range: pre-1970 dates return negative epoch minutes.
 * Canonical implementation — the sole source of truth for this conversion in core.
 */
export function gregorianToEpochMin(year: number, month: number, day: number): number {
  let days: number;
  if (year >= EPOCH_ANCHOR_YEAR) {
    days = 0;
    for (let y = EPOCH_ANCHOR_YEAR; y < year; y++) days += isLeapYear(y) ? 366 : 365;
    for (let mo = 1; mo < month; mo++) days += daysInMonth(year, mo);
    days += day - 1;
  } else {
    // Sum days from year/month/day forward to 1970-01-01, then negate.
    let daysToAnchor = 0;
    for (let y = year; y < EPOCH_ANCHOR_YEAR; y++) daysToAnchor += isLeapYear(y) ? 366 : 365;
    let dayOfYear = day - 1;
    for (let mo = 1; mo < month; mo++) dayOfYear += daysInMonth(year, mo);
    days = dayOfYear - daysToAnchor;
  }
  return days * MINUTES_PER_DAY;
}

/** Absolute epoch minutes → Gregorian {year, month, day}. Supports negative epoch minutes. */
export function epochMinToGregorian(em: number): { year: number; month: number; day: number } {
  let remaining = Math.floor(em / MINUTES_PER_DAY);
  let year = EPOCH_ANCHOR_YEAR;
  if (remaining >= 0) {
    for (;;) {
      const diy = isLeapYear(year) ? 366 : 365;
      if (remaining < diy) break;
      remaining -= diy;
      year++;
    }
  } else {
    while (remaining < 0) {
      year--;
      remaining += isLeapYear(year) ? 366 : 365;
    }
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

/** Parse "YYYY年MM月DD日" → absolute epoch minutes. Pre-1970 returns negative. Invalid format → 0. */
export function parseChineseDateToEpochMin(s: string): number {
  const m = /^(\d+)年(\d+)月(\d+)日$/.exec(s.trim());
  if (!m) return 0;
  return gregorianToEpochMin(Number(m[1]), Number(m[2]), Number(m[3]));
}

/** Return nominal tick duration in minutes for a granularity key. Falls back to MINUTES_PER_MONTH. */
export function getTickMinutes(粒度: string): number {
  return MIGRATION_TICK_MINUTES[粒度] ?? MINUTES_PER_MONTH;
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

/** Traditional Chinese month names for the {月名} template token. */
export const MONTH_NAMES: Readonly<Record<number, string>> = {
  1: '正月', 2: '二月', 3: '三月', 4: '四月', 5: '五月', 6: '六月',
  7: '七月', 8: '八月', 9: '九月', 10: '十月', 11: '冬月', 12: '腊月',
};

export interface CalendarConfig {
  纪年法: string;
  /** Epoch minutes corresponding to year-1 of this calendar era. 0 = same anchor as Gregorian. */
  纪元锚点: number;
  年号表: ReadonlyArray<{ 年号: string; 起始纪元分钟: number }>;
  月制: string;
  /**
   * Template string. Tokens:
   * {year} {month} {day} — era-relative year / numeric month / numeric day
   * {年号} {年号年} — era name / year-within-era
   * {公元年} — Gregorian year always
   * {月名}   — traditional Chinese month name (正月…腊月)
   * {daysSinceAnchor} — integer days since 纪元锚点 (天数历 / "Day N" format)
   */
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

  const daysSinceAnchor = config.纪元锚点 > 0
    ? Math.floor((epochMin - config.纪元锚点) / MINUTES_PER_DAY)
    : Math.floor(epochMin / MINUTES_PER_DAY);

  return config.显示模板
    .replace('{公元年}', String(gyear))
    .replace('{年号年}', String(relativeYear))
    .replace('{年号}', yearLabel)
    .replace('{year}', String(relativeYear))
    .replace('{month}', String(month))
    .replace('{day}', String(day))
    .replace('{月名}', MONTH_NAMES[month] ?? String(month))
    .replace('{daysSinceAnchor}', String(daysSinceAnchor));
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
 * Formula: 1 − (1 − monthProb)^spanMonths.
 * spanMonths = spanMinutes / MINUTES_PER_MONTH (caller converts via MIGRATION_TICK_MINUTES).
 */
export function probOverSpan(monthProb: number, spanMonths: number): number {
  return 1 - Math.pow(1 - monthProb, spanMonths);
}

// ── Expiry check ──────────────────────────────────────────────────────────────

/**
 * True if deadline has passed relative to now.
 * Sentinel: deadline === 0 means eternal — never expires.
 * Negative deadlines (ancient absolute timestamps) expire normally when now >= deadline.
 */
export function isExpired(deadline: number, now: number): boolean {
  return deadline === 0 ? false : now >= deadline;
}

// ── Floor-safe day arithmetic ─────────────────────────────────────────────────

/** Floor epoch minute to the start of its day. Safe for negative epoch minutes. */
export function dayFloor(epochMin: number): number {
  return Math.floor(epochMin / MINUTES_PER_DAY) * MINUTES_PER_DAY;
}

/** Minutes elapsed since start of day (always in [0, 1439]). Safe for negative epoch minutes. */
export function timeOfDayMinutes(epochMin: number): number {
  return epochMin - dayFloor(epochMin);
}

// ── Sentinel-safe epoch-minute write ─────────────────────────────────────────

/**
 * Collision guard: epoch minute 0 is the sentinel ("eternal" / "never happened").
 * Shift the anchor-coincident value to 1 so real event writes never overwrite the sentinel.
 */
export function writeEpochMinute(epochMin: number): number {
  return epochMin === 0 ? 1 : epochMin;
}

// ── Deadline utilities ────────────────────────────────────────────────────────

/**
 * Earliest non-sentinel deadline from an array.
 * 0 is the eternal sentinel and is excluded from consideration.
 */
export function earliestDeadline(deadlines: readonly number[]): number | undefined {
  let result: number | undefined;
  for (const d of deadlines) {
    if (d !== 0 && (result === undefined || d < result)) result = d;
  }
  return result;
}

/**
 * Minutes elapsed since lastEpochMin.
 * Returns null if lastEpochMin === 0 (sentinel: event has never happened).
 */
export function minutesSinceLast(lastEpochMin: number, nowEpochMin: number): number | null {
  if (lastEpochMin === 0) return null;
  return nowEpochMin - lastEpochMin;
}

// ── Calendar tick boundaries ──────────────────────────────────────────────────

/** Next calendar month start from epochMin. Handles December → January rollover. */
export function nextMonthStart(epochMin: number): number {
  const { year, month } = epochMinToGregorian(epochMin);
  if (month === 12) return gregorianToEpochMin(year + 1, 1, 1);
  return gregorianToEpochMin(year, month + 1, 1);
}

/**
 * Same calendar date one year later.
 * Feb 29 in a leap year maps to Feb 28 in non-leap target years.
 */
export function nextYearSameDay(epochMin: number): number {
  const { year, month, day } = epochMinToGregorian(epochMin);
  const targetYear = year + 1;
  if (month === 2 && day === 29 && !isLeapYear(targetYear)) {
    return gregorianToEpochMin(targetYear, 2, 28);
  }
  return gregorianToEpochMin(targetYear, month, day);
}

export interface TickSpanInput {
  nowEpochMin: number;
  granularity: string;
  deterministicExpiries: number[];
}

export interface TickSpanResult {
  spanMinutes: number;
  truncatedBy?: number;
}

/**
 * Compute the next tick span in minutes for a given granularity.
 * 即时: fixed 5 min. 日常/日: fixed 1440 min.
 * 发展/月: calendar-aligned to start of next month.
 * 世代/年: calendar-aligned to same day next year.
 * Span is truncated to the earliest non-sentinel expiry strictly after now.
 * spanMinutes is always ≥ 1.
 */
export function computeTickSpan({ nowEpochMin, granularity, deterministicExpiries }: TickSpanInput): TickSpanResult {
  let boundary: number;
  if (granularity === '即时') {
    boundary = nowEpochMin + 5;
  } else if (granularity === '日常' || granularity === '日') {
    boundary = nowEpochMin + MINUTES_PER_DAY;
  } else if (granularity === '发展' || granularity === '月') {
    boundary = nextMonthStart(nowEpochMin);
  } else {
    boundary = nextYearSameDay(nowEpochMin); // 世代/年
  }

  const validExpiries = deterministicExpiries.filter(e => e !== 0 && e > nowEpochMin);
  let truncatedBy: number | undefined;
  let earliest = boundary;
  for (const e of validExpiries) {
    if (e < earliest) { earliest = e; truncatedBy = e; }
  }
  const spanMinutes = Math.max(1, earliest - nowEpochMin);
  return truncatedBy !== undefined ? { spanMinutes, truncatedBy } : { spanMinutes };
}

// ── Derived display values ────────────────────────────────────────────────────

const SEASON_NORTH: Readonly<Record<number, string>> = {
  1: '冬', 2: '冬', 3: '春', 4: '春', 5: '春',
  6: '夏', 7: '夏', 8: '夏', 9: '秋', 10: '秋', 11: '秋', 12: '冬',
};
const SEASON_SOUTH: Readonly<Record<number, string>> = {
  1: '夏', 2: '夏', 3: '秋', 4: '秋', 5: '秋',
  6: '冬', 7: '冬', 8: '冬', 9: '春', 10: '春', 11: '春', 12: '夏',
};

/**
 * Derive season label from month and climate zone (气候带).
 * Recognised zones: '南温带'|'南半球' → southern reversal; '热带' → '无四季';
 * anything else → northern temperate.
 */
export function getSeason(month: number, 气候带: string): string {
  if (气候带 === '热带') return '无四季';
  if (气候带 === '南温带' || 气候带 === '南半球') return SEASON_SOUTH[month] ?? '未知';
  return SEASON_NORTH[month] ?? '未知';
}

/**
 * Derive age in whole years from birth epoch minute to now epoch minute.
 * Returns 0 if now is before birth (not yet born).
 * Handles leap-day birthdays (2000-02-29): ages normally on Mar 1 in non-leap years.
 */
export function getAge(birthEpochMin: number, nowEpochMin: number): number {
  if (nowEpochMin <= birthEpochMin) return 0;
  const birth = epochMinToGregorian(birthEpochMin);
  const now = epochMinToGregorian(nowEpochMin);
  let age = now.year - birth.year;
  // Birthday not yet reached this year
  const birthMonth = birth.month;
  const birthDay = birth.day;
  if (
    now.month < birthMonth ||
    (now.month === birthMonth && now.day < birthDay)
  ) {
    age -= 1;
  }
  return Math.max(0, age);
}
