// Ring 0 time-system primitives — pure functions, zero side effects.
// Epoch anchor: 1970-01-01 00:00:00 Gregorian = epoch minute 0.
// Pre-1970 dates return negative epoch minutes (full integer axis support).
// ESLint bans enforced by CI: Date.now(), new Date(), Math.random() absent.
import { fixedPow, stableProb } from './math/fixed.js';
// ── Constants ─────────────────────────────────────────────────────────────────
/** Gregorian year that epoch minute 0 maps to (1970-01-01). */
export const EPOCH_ANCHOR_YEAR = 1970;
export const MINUTES_PER_DAY = 1440;
export const MINUTES_PER_MONTH = 43200; // 30-day game month（商业月·固定·非 Gregorian 历法月）
export const MINUTES_PER_YEAR = 518400; // 12 × MINUTES_PER_MONTH（商业年 360日·非 Gregorian 365/366日·与 computeTickSpan Gregorian 历法对齐基准刻意不等价）
/**
 * Nominal tick duration in minutes, indexed by granularity key.
 * Used by migrate.ts backward conversion and probOverSpan standard-month denominator.
 * Engine runtime tick spans use calendar-aligned functions (computeTickSpan), not this table.
 */
export const MIGRATION_TICK_MINUTES = {
    即时: 5,
    日常: MINUTES_PER_DAY,
    发展: MINUTES_PER_MONTH,
    月: MINUTES_PER_MONTH,
    日: MINUTES_PER_DAY,
    年: MINUTES_PER_YEAR,
    世代: MINUTES_PER_YEAR,
};
export const VALID_GRANULARITIES = new Set(Object.keys(MIGRATION_TICK_MINUTES));
/** Maximum granularity stack depth before push throws. */
export const GRANULARITY_STACK_MAX = 8;
// ── Gregorian arithmetic ──────────────────────────────────────────────────────
export function isLeapYear(y) {
    return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}
function daysInMonth(year, month) {
    const md = [0, 31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return md[month] ?? 30;
}
/**
 * Gregorian date → absolute epoch minutes.
 * Supports the full integer range: pre-1970 dates return negative epoch minutes.
 * Canonical implementation — the sole source of truth for this conversion in core.
 */
export function gregorianToEpochMin(year, month, day) {
    let days;
    if (year >= EPOCH_ANCHOR_YEAR) {
        days = 0;
        for (let y = EPOCH_ANCHOR_YEAR; y < year; y++)
            days += isLeapYear(y) ? 366 : 365;
        for (let mo = 1; mo < month; mo++)
            days += daysInMonth(year, mo);
        days += day - 1;
    }
    else {
        // Sum days from year/month/day forward to 1970-01-01, then negate.
        let daysToAnchor = 0;
        for (let y = year; y < EPOCH_ANCHOR_YEAR; y++)
            daysToAnchor += isLeapYear(y) ? 366 : 365;
        let dayOfYear = day - 1;
        for (let mo = 1; mo < month; mo++)
            dayOfYear += daysInMonth(year, mo);
        days = dayOfYear - daysToAnchor;
    }
    return days * MINUTES_PER_DAY;
}
/** Absolute epoch minutes → Gregorian {year, month, day}. Supports negative epoch minutes. */
export function epochMinToGregorian(em) {
    let remaining = Math.floor(em / MINUTES_PER_DAY);
    let year = EPOCH_ANCHOR_YEAR;
    if (remaining >= 0) {
        for (;;) {
            const diy = isLeapYear(year) ? 366 : 365;
            if (remaining < diy)
                break;
            remaining -= diy;
            year++;
        }
    }
    else {
        while (remaining < 0) {
            year--;
            remaining += isLeapYear(year) ? 366 : 365;
        }
    }
    let month = 1;
    while (month <= 12) {
        const dim = daysInMonth(year, month);
        if (remaining < dim)
            break;
        remaining -= dim;
        month++;
    }
    return { year, month, day: remaining + 1 };
}
/** Parse "YYYY年MM月DD日" → absolute epoch minutes. Pre-1970 returns negative. Invalid format → 0. */
export function parseChineseDateToEpochMin(s) {
    const m = /^(\d+)年(\d+)月(\d+)日$/.exec(s.trim());
    if (!m)
        return 0;
    return gregorianToEpochMin(Number(m[1]), Number(m[2]), Number(m[3]));
}
/** Return nominal tick duration in minutes for a granularity key. Falls back to MINUTES_PER_MONTH. */
export function getTickMinutes(粒度) {
    return MIGRATION_TICK_MINUTES[粒度] ?? MINUTES_PER_MONTH;
}
/** periodToEpochMin factory: worldEpochMin − (周期数 − N) × tickMinutes */
export function makePeriodConverter(worldEpochMin, 周期数, tickMin) {
    return (n) => worldEpochMin - (周期数 - n) * tickMin;
}
// ── Calendar skin rendering ───────────────────────────────────────────────────
/** Traditional Chinese month names for the {月名} template token. */
export const MONTH_NAMES = {
    1: '正月', 2: '二月', 3: '三月', 4: '四月', 5: '五月', 6: '六月',
    7: '七月', 8: '八月', 9: '九月', 10: '十月', 11: '冬月', 12: '腊月',
};
/**
 * Render an epoch minute as a calendar display string.
 * {year}   = era-relative year (or Gregorian if no era config)
 * {公元年} = Gregorian year always
 * {年号}   = current era name from 年号表
 * {年号年} = year within the current 年号 era
 * {month} {day} = Gregorian month/day
 */
export function renderCalendar(epochMin, config) {
    const { year: gyear, month, day } = epochMinToGregorian(epochMin);
    let yearLabel = '';
    let relativeYear = gyear;
    if (config.年号表.length > 0) {
        let best;
        for (const entry of config.年号表) {
            if (entry.起始纪元分钟 <= epochMin &&
                (best === undefined || entry.起始纪元分钟 > best.起始纪元分钟)) {
                best = entry;
            }
        }
        if (best !== undefined) {
            yearLabel = best.年号;
            const eraStart = epochMinToGregorian(best.起始纪元分钟);
            relativeYear = gyear - eraStart.year + 1;
        }
    }
    else if (config.纪元锚点 > 0) {
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
export function pushGranularity(stack, 粒度) {
    if (!VALID_GRANULARITIES.has(粒度))
        throw new Error(`未知粒度键: ${粒度}`);
    if (stack.length >= GRANULARITY_STACK_MAX)
        throw new Error(`粒度栈深度超限: max ${GRANULARITY_STACK_MAX}`);
    return [...stack, 粒度];
}
export function popGranularity(stack) {
    if (stack.length === 0)
        throw new Error('粒度栈为空，无法 pop');
    return stack.slice(0, -1);
}
export function makeDualClock(worldEpochMin) {
    return {
        world: { epochMin: worldEpochMin, frozen: false },
        lens: { epochMin: worldEpochMin, focusStartWorldMin: 0 },
    };
}
/** Enter RP_FOCUS: freeze world clock, record entry point on lens. */
export function enterRpFocus(clock) {
    return {
        world: { ...clock.world, frozen: true },
        lens: { ...clock.lens, focusStartWorldMin: clock.world.epochMin },
    };
}
/**
 * Exit RP_FOCUS: apply lensElapsedMin to world clock in one lazy step,
 * matching the result of having advanced the world tick-by-tick.
 */
export function exitRpFocus(clock, lensElapsedMin) {
    return {
        world: { epochMin: clock.world.epochMin + lensElapsedMin, frozen: false },
        lens: { epochMin: clock.lens.epochMin, focusStartWorldMin: 0 },
    };
}
export function advanceWorld(clock, minutes) {
    if (clock.world.frozen)
        throw new Error('世界时钟已冻结（RP_FOCUS 中），不得直接推进');
    return { ...clock, world: { ...clock.world, epochMin: clock.world.epochMin + minutes } };
}
export function advanceLens(clock, minutes) {
    return { ...clock, lens: { ...clock.lens, epochMin: clock.lens.epochMin + minutes } };
}
// ── Decay & probability ───────────────────────────────────────────────────────
/**
 * Linear accumulation: value += ratePerMonth × (spanMin / MINUTES_PER_MONTH).
 * Fast-forward invariant: decayLinear(v, r, 518400) === decayLinear(v, r, 43200 × 12).
 */
export function decayLinear(value, ratePerMonth, spanMin) {
    return value + ratePerMonth * (spanMin / MINUTES_PER_MONTH);
}
/**
 * L-13 统一衰减累积器 — single implementation for 印象/意象/记忆 三处共用。
 *
 * Linear decay: Math.max(0, value − ratePerMinute × spanMin).
 * Optional recency factor via fixedPow (from fixed.ts) — callers MUST NOT use
 * Math.pow for recency; the optional param enforces one implementation only.
 *
 * @param value         current value (non-negative)
 * @param ratePerMinute per-minute linear subtraction rate; 0 = no linear decay
 * @param spanMin       tick span in minutes
 * @param recencyRate   optional per-tick exponential multiplier (e.g. 0.995 for memory);
 *                      applied once per tick via fixedPow — caller passes the rate, never hardcodes here
 */
export function decayStep(value, ratePerMinute, spanMin, recencyRate) {
    const afterLinear = Math.max(0, value - ratePerMinute * spanMin);
    return recencyRate !== undefined ? afterLinear * fixedPow(recencyRate, 1) : afterLinear;
}
/**
 * Compound-growth factor: (1 + annualRate)^(spanMin / MINUTES_PER_YEAR).
 * Returns a multiplier — caller does: newValue = oldValue * compound(rate, span).
 */
export function compound(annualRate, spanMin) {
    return fixedPow(1 + annualRate, spanMin / MINUTES_PER_YEAR);
}
/**
 * Probability of at least one occurrence over spanMonths given per-month probability.
 * Formula: 1 − (1 − monthProb)^spanMonths.
 * spanMonths = spanMinutes / MINUTES_PER_MONTH (caller converts via MIGRATION_TICK_MINUTES).
 */
export function probOverSpan(monthProb, spanMonths) {
    return stableProb(monthProb, spanMonths);
}
// ── Expiry check ──────────────────────────────────────────────────────────────
/**
 * True if deadline has passed relative to now.
 * Sentinel: deadline === 0 means eternal — never expires.
 * Negative deadlines (ancient absolute timestamps) expire normally when now >= deadline.
 */
export function isExpired(deadline, now) {
    return deadline === 0 ? false : now >= deadline;
}
// ── Floor-safe day arithmetic ─────────────────────────────────────────────────
/** Floor epoch minute to the start of its day. Safe for negative epoch minutes. */
export function dayFloor(epochMin) {
    return Math.floor(epochMin / MINUTES_PER_DAY) * MINUTES_PER_DAY;
}
/** Minutes elapsed since start of day (always in [0, 1439]). Safe for negative epoch minutes. */
export function timeOfDayMinutes(epochMin) {
    return epochMin - dayFloor(epochMin);
}
// ── Sentinel-safe epoch-minute write ─────────────────────────────────────────
/**
 * Collision guard: epoch minute 0 is the sentinel ("eternal" / "never happened").
 * Shift the anchor-coincident value to 1 so real event writes never overwrite the sentinel.
 */
export function writeEpochMinute(epochMin) {
    return epochMin === 0 ? 1 : epochMin;
}
// ── Deadline utilities ────────────────────────────────────────────────────────
/**
 * Earliest non-sentinel deadline from an array.
 * 0 is the eternal sentinel and is excluded from consideration.
 */
export function earliestDeadline(deadlines) {
    let result;
    for (const d of deadlines) {
        if (d !== 0 && (result === undefined || d < result))
            result = d;
    }
    return result;
}
/**
 * Minutes elapsed since lastEpochMin.
 * Returns null if lastEpochMin === 0 (sentinel: event has never happened).
 */
export function minutesSinceLast(lastEpochMin, nowEpochMin) {
    if (lastEpochMin === 0)
        return null;
    return nowEpochMin - lastEpochMin;
}
// ── Calendar tick boundaries ──────────────────────────────────────────────────
/** Next calendar month start from epochMin. Handles December → January rollover. */
export function nextMonthStart(epochMin) {
    const { year, month } = epochMinToGregorian(epochMin);
    if (month === 12)
        return gregorianToEpochMin(year + 1, 1, 1);
    return gregorianToEpochMin(year, month + 1, 1);
}
/**
 * Same calendar date one year later.
 * Feb 29 in a leap year maps to Feb 28 in non-leap target years.
 */
export function nextYearSameDay(epochMin) {
    const { year, month, day } = epochMinToGregorian(epochMin);
    const targetYear = year + 1;
    if (month === 2 && day === 29 && !isLeapYear(targetYear)) {
        return gregorianToEpochMin(targetYear, 2, 28);
    }
    return gregorianToEpochMin(targetYear, month, day);
}
/**
 * Compute the next tick span in minutes for a given granularity.
 * 即时: fixed 5 min. 日常/日: fixed 1440 min.
 * 发展/月: calendar-aligned to start of next month.
 * 世代/年: calendar-aligned to same day next year.
 * Span is truncated to the earliest non-sentinel expiry strictly after now.
 * spanMinutes is always ≥ 1.
 */
export function computeTickSpan({ nowEpochMin, granularity, deterministicExpiries }) {
    let boundary;
    if (granularity === '即时') {
        boundary = nowEpochMin + 5;
    }
    else if (granularity === '日常' || granularity === '日') {
        boundary = nowEpochMin + MINUTES_PER_DAY;
    }
    else if (granularity === '发展' || granularity === '月') {
        boundary = nextMonthStart(nowEpochMin);
    }
    else {
        boundary = nextYearSameDay(nowEpochMin); // 世代/年
    }
    const validExpiries = deterministicExpiries.filter(e => e !== 0 && e > nowEpochMin);
    let truncatedBy;
    let earliest = boundary;
    for (const e of validExpiries) {
        if (e < earliest) {
            earliest = e;
            truncatedBy = e;
        }
    }
    const spanMinutes = Math.max(1, earliest - nowEpochMin);
    return truncatedBy !== undefined ? { spanMinutes, truncatedBy } : { spanMinutes };
}
// ── P7-6f · N-7 月结自然月边界 + 历法对齐拍自动续拍 ──────────────────────────────
/**
 * 判断拍跨度是否跨越自然月边界（月结触发判据）。
 * prevEpochMin → nextEpochMin 区间内存在月首（1日00:00）则触发月结。
 * 纯函数·禁 Date.now·禁 localeCompare。
 */
export function isNaturalMonthBoundary(prevEpochMin, nextEpochMin) {
    if (nextEpochMin <= prevEpochMin)
        return false;
    const monthStart = nextMonthStart(prevEpochMin);
    return monthStart > prevEpochMin && monthStart <= nextEpochMin;
}
/**
 * 历法对齐拍自动续拍（对齐模式='历法对齐' 时使用）。
 *
 * 根据当前粒度计算下一个历法对齐续拍的纪元分钟（即 boundary = nextMonthStart / nextYearSameDay）。
 * 固定跨度粒度（即时/日常）直接返回 nowEpochMin + 固定量。
 * 同 computeTickSpan 口径，但不截断（调用方按需截断）。
 */
export function computeCalendarContinuation(nowEpochMin, granularity) {
    if (granularity === '即时')
        return nowEpochMin + 5;
    if (granularity === '日常' || granularity === '日')
        return nowEpochMin + MINUTES_PER_DAY;
    if (granularity === '发展' || granularity === '月')
        return nextMonthStart(nowEpochMin);
    return nextYearSameDay(nowEpochMin); // 世代/年
}
// ── Derived display values ────────────────────────────────────────────────────
const SEASON_NORTH = {
    1: '冬', 2: '冬', 3: '春', 4: '春', 5: '春',
    6: '夏', 7: '夏', 8: '夏', 9: '秋', 10: '秋', 11: '秋', 12: '冬',
};
const SEASON_SOUTH = {
    1: '夏', 2: '夏', 3: '秋', 4: '秋', 5: '秋',
    6: '冬', 7: '冬', 8: '冬', 9: '春', 10: '春', 11: '春', 12: '夏',
};
/**
 * Derive season label from month and climate zone (气候带).
 * Recognised zones: '南温带'|'南半球' → southern reversal; '热带' → '无四季';
 * anything else → northern temperate.
 */
export function getSeason(month, 气候带) {
    if (气候带 === '热带')
        return '无四季';
    if (气候带 === '南温带' || 气候带 === '南半球')
        return SEASON_SOUTH[month] ?? '未知';
    return SEASON_NORTH[month] ?? '未知';
}
/**
 * Derive age in whole years from birth epoch minute to now epoch minute.
 * Returns 0 if now is before birth (not yet born).
 * Handles leap-day birthdays (2000-02-29): ages normally on Mar 1 in non-leap years.
 */
export function getAge(birthEpochMin, nowEpochMin) {
    if (nowEpochMin <= birthEpochMin)
        return 0;
    const birth = epochMinToGregorian(birthEpochMin);
    const now = epochMinToGregorian(nowEpochMin);
    let age = now.year - birth.year;
    // Birthday not yet reached this year
    const birthMonth = birth.month;
    const birthDay = birth.day;
    if (now.month < birthMonth ||
        (now.month === birthMonth && now.day < birthDay)) {
        age -= 1;
    }
    return Math.max(0, age);
}
