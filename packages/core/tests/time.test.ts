import { describe, it, expect } from 'vitest';
import prand from 'pure-rand';
import {
  EPOCH_ANCHOR_YEAR,
  MINUTES_PER_DAY,
  MINUTES_PER_MONTH,
  MINUTES_PER_YEAR,
  TICK_MINUTES,
  GRANULARITY_STACK_MAX,
  MONTH_NAMES,
  isLeapYear,
  gregorianToEpochMin,
  epochMinToGregorian,
  parseChineseDateToEpochMin,
  getTickMinutes,
  makePeriodConverter,
  renderCalendar,
  type CalendarConfig,
  pushGranularity,
  popGranularity,
  makeDualClock,
  enterRpFocus,
  exitRpFocus,
  advanceWorld,
  advanceLens,
  decayLinear,
  compound,
  probOverSpan,
  isExpired,
  getSeason,
  getAge,
} from '../engine/time.js';

// ── isLeapYear ────────────────────────────────────────────────────────────────

describe('isLeapYear', () => {
  it('2000 is leap (div 400)', () => { expect(isLeapYear(2000)).toBe(true); });
  it('1900 is not leap (div 100, not 400)', () => { expect(isLeapYear(1900)).toBe(false); });
  it('2024 is leap (div 4, not 100)', () => { expect(isLeapYear(2024)).toBe(true); });
  it('2100 is not leap (div 100, not 400)', () => { expect(isLeapYear(2100)).toBe(false); });
  it('2023 is not leap', () => { expect(isLeapYear(2023)).toBe(false); });
  it('1970 is not leap', () => { expect(isLeapYear(1970)).toBe(false); });
});

// ── gregorianToEpochMin ───────────────────────────────────────────────────────

describe('gregorianToEpochMin', () => {
  it('1970-01-01 → 0 (epoch anchor)', () => {
    expect(gregorianToEpochMin(1970, 1, 1)).toBe(0);
  });
  it('1970-01-02 → 1440 (one day)', () => {
    expect(gregorianToEpochMin(1970, 1, 2)).toBe(MINUTES_PER_DAY);
  });
  it('1970-02-01 → 31 × 1440', () => {
    expect(gregorianToEpochMin(1970, 2, 1)).toBe(31 * MINUTES_PER_DAY);
  });
  it('pre-1970 year → 0', () => {
    expect(gregorianToEpochMin(1969, 12, 31)).toBe(0);
  });
  it('2000-01-01 → correct (spanning non-leap centuries)', () => {
    // Days from 1970 to 2000: 30 years
    // Leap years in [1970,1999]: 1972,1976,1980,1984,1988,1992,1996 = 7 leap years
    const days = 30 * 365 + 7;
    expect(gregorianToEpochMin(2000, 1, 1)).toBe(days * MINUTES_PER_DAY);
  });
  it('2000-02-29 valid (2000 is leap)', () => {
    const jan = gregorianToEpochMin(2000, 1, 1);
    expect(gregorianToEpochMin(2000, 2, 29)).toBe(jan + 59 * MINUTES_PER_DAY);
  });
  it('2000-03-01 day after leap day', () => {
    const jan = gregorianToEpochMin(2000, 1, 1);
    expect(gregorianToEpochMin(2000, 3, 1)).toBe(jan + 60 * MINUTES_PER_DAY);
  });
  it('1999-12-31 year boundary', () => {
    const y2k = gregorianToEpochMin(2000, 1, 1);
    expect(gregorianToEpochMin(1999, 12, 31)).toBe(y2k - MINUTES_PER_DAY);
  });
});

// ── epochMinToGregorian (roundtrip) ───────────────────────────────────────────

describe('epochMinToGregorian roundtrip', () => {
  const cases: [number, number, number][] = [
    [1970, 1, 1],
    [1970, 1, 2],
    [1970, 12, 31],
    [1999, 12, 31],
    [2000, 1, 1],
    [2000, 2, 29],   // leap day
    [2000, 3, 1],
    [2024, 2, 29],   // recent leap day
    [2025, 1, 1],
    [2100, 1, 1],    // 2100 not leap
  ];

  for (const [y, m, d] of cases) {
    it(`roundtrip ${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, () => {
      const em = gregorianToEpochMin(y, m, d);
      expect(epochMinToGregorian(em)).toEqual({ year: y, month: m, day: d });
    });
  }

  it('epoch 0 → 1970-01-01', () => {
    expect(epochMinToGregorian(0)).toEqual({ year: EPOCH_ANCHOR_YEAR, month: 1, day: 1 });
  });
  it('negative em → clamps to 1970-01-01', () => {
    expect(epochMinToGregorian(-1)).toEqual({ year: EPOCH_ANCHOR_YEAR, month: 1, day: 1 });
  });
  it('intra-day minutes resolve to same day', () => {
    const start = gregorianToEpochMin(2000, 6, 15);
    expect(epochMinToGregorian(start + 60)).toEqual({ year: 2000, month: 6, day: 15 });
    expect(epochMinToGregorian(start + MINUTES_PER_DAY - 1)).toEqual({ year: 2000, month: 6, day: 15 });
  });
});

// ── parseChineseDateToEpochMin ────────────────────────────────────────────────

describe('parseChineseDateToEpochMin', () => {
  it('1970年1月1日 → 0', () => {
    expect(parseChineseDateToEpochMin('1970年1月1日')).toBe(0);
  });
  it('1970年1月2日 → 1440', () => {
    expect(parseChineseDateToEpochMin('1970年1月2日')).toBe(MINUTES_PER_DAY);
  });
  it('trims whitespace', () => {
    expect(parseChineseDateToEpochMin('  1970年1月1日  ')).toBe(0);
  });
  it('invalid format → 0', () => {
    expect(parseChineseDateToEpochMin('1970/01/01')).toBe(0);
  });
  it('empty string → 0', () => {
    expect(parseChineseDateToEpochMin('')).toBe(0);
  });
  it('year < 1970 → 0', () => {
    expect(parseChineseDateToEpochMin('1969年12月31日')).toBe(0);
  });
  it('matches gregorianToEpochMin for same date', () => {
    expect(parseChineseDateToEpochMin('2000年2月29日')).toBe(gregorianToEpochMin(2000, 2, 29));
  });
});

// ── getTickMinutes ────────────────────────────────────────────────────────────

describe('getTickMinutes', () => {
  it('即时 → 5', () => { expect(getTickMinutes('即时')).toBe(5); });
  it('日常 → 1440', () => { expect(getTickMinutes('日常')).toBe(MINUTES_PER_DAY); });
  it('发展 → 43200', () => { expect(getTickMinutes('发展')).toBe(MINUTES_PER_MONTH); });
  it('月 → 43200 (alias)', () => { expect(getTickMinutes('月')).toBe(MINUTES_PER_MONTH); });
  it('年 → 518400', () => { expect(getTickMinutes('年')).toBe(MINUTES_PER_YEAR); });
  it('世代 → 518400 (alias)', () => { expect(getTickMinutes('世代')).toBe(MINUTES_PER_YEAR); });
  it('日 → 1440 (alias)', () => { expect(getTickMinutes('日')).toBe(MINUTES_PER_DAY); });
  it('unknown key falls back to MINUTES_PER_MONTH', () => {
    expect(getTickMinutes('___unknown___')).toBe(MINUTES_PER_MONTH);
  });
  it('TICK_MINUTES constants consistent with getTickMinutes', () => {
    for (const [key, val] of Object.entries(TICK_MINUTES)) {
      expect(getTickMinutes(key)).toBe(val);
    }
  });
});

// ── makePeriodConverter ───────────────────────────────────────────────────────

describe('makePeriodConverter', () => {
  it('p2e formula: worldMin - (周期数 - n) × tickMin', () => {
    const p2e = makePeriodConverter(100000, 10, 1440);
    expect(p2e(10)).toBe(100000);               // current tick = present
    expect(p2e(9)).toBe(100000 - 1440);         // one tick ago
    expect(p2e(0)).toBe(100000 - 10 * 1440);    // 10 ticks ago
  });
});

// ── renderCalendar ────────────────────────────────────────────────────────────

describe('renderCalendar', () => {
  it('Gregorian skin snapshot: 2000-03-15', () => {
    const cfg: CalendarConfig = {
      纪年法: '公元',
      纪元锚点: 0,
      年号表: [],
      月制: '格里历',
      显示模板: '{year}年{month}月{day}日',
    };
    const em = gregorianToEpochMin(2000, 3, 15);
    expect(renderCalendar(em, cfg)).toBe('2000年3月15日');
  });

  it('年号表 skin: 武德/贞观 era switch (game years ≥ 1970)', () => {
    // Game world: 武德元年 = game year 2018, 贞观元年 = game year 2027
    const 武德起始 = gregorianToEpochMin(2018, 1, 1);
    const 贞观起始 = gregorianToEpochMin(2027, 1, 1);
    const cfg: CalendarConfig = {
      纪年法: '年号制',
      纪元锚点: 贞观起始,
      年号表: [
        { 年号: '武德', 起始纪元分钟: 武德起始 },
        { 年号: '贞观', 起始纪元分钟: 贞观起始 },
      ],
      月制: '太阴历',
      显示模板: '{年号}{year}年{month}月{day}日',
    };
    // game 2029-03-01 = 贞观3年3月1日
    const em = gregorianToEpochMin(2029, 3, 1);
    expect(renderCalendar(em, cfg)).toBe('贞观3年3月1日');
  });

  it('custom era anchor (no 年号表): star calendar year 1 = 2100-01-01', () => {
    const anchorEm = gregorianToEpochMin(2100, 1, 1);
    const cfg: CalendarConfig = {
      纪年法: '星历',
      纪元锚点: anchorEm,
      年号表: [],
      月制: '星历月',
      显示模板: '星历{year}年第{month}月第{day}日',
    };
    // 2101-06-15 = 星历2年6月15日
    const em = gregorianToEpochMin(2101, 6, 15);
    expect(renderCalendar(em, cfg)).toBe('星历2年第6月第15日');
  });

  it('epoch minute 0 with Gregorian skin → 1970年1月1日', () => {
    const cfg: CalendarConfig = {
      纪年法: '公元', 纪元锚点: 0, 年号表: [],
      月制: '格里历', 显示模板: '{year}年{month}月{day}日',
    };
    expect(renderCalendar(0, cfg)).toBe('1970年1月1日');
  });

  it('{公元年} token always shows Gregorian year regardless of era', () => {
    // 贞观元年 = game year 2030; test at game year 2033 = 贞观4年
    const 贞观起始 = gregorianToEpochMin(2030, 1, 1);
    const cfg: CalendarConfig = {
      纪年法: '年号制', 纪元锚点: 贞观起始,
      年号表: [{ 年号: '贞观', 起始纪元分钟: 贞观起始 }],
      月制: '', 显示模板: '{公元年}/{year}',
    };
    const em = gregorianToEpochMin(2033, 1, 1);
    expect(renderCalendar(em, cfg)).toBe('2033/4');
  });
});

// ── granularity stack ─────────────────────────────────────────────────────────

describe('pushGranularity', () => {
  it('push valid 日常 to empty stack', () => {
    expect(pushGranularity([], '日常')).toEqual(['日常']);
  });
  it('push valid 即时 to existing stack', () => {
    expect(pushGranularity(['发展'], '即时')).toEqual(['发展', '即时']);
  });
  it('immutability: original array unchanged', () => {
    const original = ['发展'];
    pushGranularity(original, '即时');
    expect(original).toEqual(['发展']);
  });
  it('push invalid key → throws 未知粒度键', () => {
    expect(() => pushGranularity([], '超时空')).toThrow('未知粒度键');
  });
  it(`push beyond GRANULARITY_STACK_MAX (${GRANULARITY_STACK_MAX}) → throws`, () => {
    const full = Array(GRANULARITY_STACK_MAX).fill('日常');
    expect(() => pushGranularity(full, '即时')).toThrow('粒度栈深度超限');
  });
  it(`stack of ${GRANULARITY_STACK_MAX - 1} elements can still be pushed`, () => {
    const almostFull = Array(GRANULARITY_STACK_MAX - 1).fill('日常');
    expect(() => pushGranularity(almostFull, '即时')).not.toThrow();
  });
});

describe('popGranularity', () => {
  it('pop last element', () => {
    expect(popGranularity(['发展', '即时'])).toEqual(['发展']);
  });
  it('pop to empty', () => {
    expect(popGranularity(['日常'])).toEqual([]);
  });
  it('pop empty stack → throws 粒度栈为空', () => {
    expect(() => popGranularity([])).toThrow('粒度栈为空');
  });
  it('immutability: original array unchanged', () => {
    const original = ['发展', '即时'];
    popGranularity(original);
    expect(original).toEqual(['发展', '即时']);
  });
});

// ── dual clock ────────────────────────────────────────────────────────────────

describe('makeDualClock', () => {
  it('creates unfrozen clock at given epoch minute', () => {
    const c = makeDualClock(10000);
    expect(c.world.epochMin).toBe(10000);
    expect(c.world.frozen).toBe(false);
    expect(c.lens.epochMin).toBe(10000);
    expect(c.lens.focusStartWorldMin).toBe(0);
  });
});

describe('enterRpFocus', () => {
  it('freezes world clock and records entry point', () => {
    const c = makeDualClock(5000);
    const fc = enterRpFocus(c);
    expect(fc.world.frozen).toBe(true);
    expect(fc.world.epochMin).toBe(5000);
    expect(fc.lens.focusStartWorldMin).toBe(5000);
  });
});

describe('advanceLens', () => {
  it('advances lens epoch minute while world remains frozen', () => {
    const c = enterRpFocus(makeDualClock(5000));
    const c2 = advanceLens(c, 60);
    expect(c2.lens.epochMin).toBe(5060);
    expect(c2.world.epochMin).toBe(5000);
    expect(c2.world.frozen).toBe(true);
  });
});

describe('advanceWorld', () => {
  it('advances world when not frozen', () => {
    const c = makeDualClock(1000);
    const c2 = advanceWorld(c, 1440);
    expect(c2.world.epochMin).toBe(2440);
    expect(c2.world.frozen).toBe(false);
  });
  it('throws when world is frozen (RP_FOCUS active)', () => {
    const c = enterRpFocus(makeDualClock(1000));
    expect(() => advanceWorld(c, 1440)).toThrow('世界时钟已冻结');
  });
});

describe('exitRpFocus', () => {
  it('applies lens elapsed to world and unfreezes', () => {
    const c0 = makeDualClock(10000);
    const c1 = enterRpFocus(c0);
    const c2 = advanceLens(c1, 2880); // 2 days of lens time
    const c3 = exitRpFocus(c2, 2880);
    expect(c3.world.epochMin).toBe(12880);
    expect(c3.world.frozen).toBe(false);
    expect(c3.lens.focusStartWorldMin).toBe(0);
  });
  it('fast-forward invariant: lazy exit == tick-by-tick advance', () => {
    // 30 ticks of 1440 min each == one lazy exitRpFocus(43200)
    const tickByTick = (() => {
      let c = makeDualClock(0);
      for (let i = 0; i < 30; i++) c = advanceWorld(c, 1440);
      return c.world.epochMin;
    })();
    const lazy = (() => {
      const c0 = makeDualClock(0);
      const c1 = enterRpFocus(c0);
      return exitRpFocus(c1, 30 * 1440).world.epochMin;
    })();
    expect(lazy).toBe(tickByTick);
  });
});

// ── decayLinear ───────────────────────────────────────────────────────────────

describe('decayLinear', () => {
  it('zero span → value unchanged', () => {
    expect(decayLinear(50, 5, 0)).toBe(50);
  });
  it('positive rate, one month span', () => {
    expect(decayLinear(50, 5, MINUTES_PER_MONTH)).toBe(55);
  });
  it('negative rate (decay)', () => {
    expect(decayLinear(100, -10, MINUTES_PER_MONTH)).toBe(90);
  });
  it('fast-forward invariant: 1 annual tick == 12 monthly ticks (exact equality)', () => {
    const rate = 7.3;
    const annual = decayLinear(100, rate, MINUTES_PER_YEAR);
    const monthly12 = decayLinear(100, rate, MINUTES_PER_MONTH * 12);
    expect(annual).toBe(monthly12);
  });
  it('half-month span gives half the monthly delta', () => {
    const half = decayLinear(0, 12, MINUTES_PER_MONTH / 2);
    expect(half).toBeCloseTo(6, 10);
  });
});

// ── compound ──────────────────────────────────────────────────────────────────

describe('compound', () => {
  it('5% annual rate over 1 year → factor ≈ 1.05', () => {
    expect(compound(0.05, MINUTES_PER_YEAR)).toBeCloseTo(1.05, 10);
  });
  it('0% rate → factor = 1 always', () => {
    expect(compound(0, MINUTES_PER_YEAR)).toBe(1);
    expect(compound(0, MINUTES_PER_MONTH)).toBe(1);
  });
  it('half-year span: (1+r)^0.5', () => {
    const r = 0.10;
    expect(compound(r, MINUTES_PER_YEAR / 2)).toBeCloseTo(Math.pow(1.1, 0.5), 10);
  });
  it('equivalence: 12 monthly compounds ≈ 1 annual compound', () => {
    const r = 0.06;
    const annual = compound(r, MINUTES_PER_YEAR);
    // monthly rate = (1+r)^(1/12) - 1
    const monthlyFactor = compound(r, MINUTES_PER_MONTH);
    expect(Math.pow(monthlyFactor, 12)).toBeCloseTo(annual, 10);
  });
});

// ── probOverSpan ──────────────────────────────────────────────────────────────

describe('probOverSpan', () => {
  it('5% monthly × 12 months ≈ 45.96%', () => {
    expect(probOverSpan(0.05, 12)).toBeCloseTo(0.4596, 4);
  });
  it('0% prob → always 0 regardless of span', () => {
    expect(probOverSpan(0, 100)).toBe(0);
  });
  it('100% prob over any span → 1', () => {
    expect(probOverSpan(1, 5)).toBe(1);
  });
  it('10% monthly × 6 months ≈ 46.86%', () => {
    expect(probOverSpan(0.10, 6)).toBeCloseTo(0.4686, 4);
  });
  it('probability table: 20% × 1 month → 20%', () => {
    expect(probOverSpan(0.20, 1)).toBeCloseTo(0.20, 10);
  });
  it('probability table: 5% × 24 months ≈ 70.82%', () => {
    expect(probOverSpan(0.05, 24)).toBeCloseTo(1 - Math.pow(0.95, 24), 10);
  });
  it('result is always in [0, 1]', () => {
    for (const [p, n] of [[0.01, 100], [0.5, 10], [0.99, 3]] as [number, number][]) {
      const r = probOverSpan(p, n);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(1);
    }
  });
});

// ── isExpired ─────────────────────────────────────────────────────────────────

describe('isExpired', () => {
  it('deadline 0 → eternal, never expires (sentinel)', () => {
    expect(isExpired(0, 0)).toBe(false);
    expect(isExpired(0, 999999999)).toBe(false);
  });
  it('deadline == now → expired', () => {
    expect(isExpired(1440, 1440)).toBe(true);
  });
  it('deadline > now → not expired', () => {
    expect(isExpired(1441, 1440)).toBe(false);
  });
  it('deadline < now → expired', () => {
    expect(isExpired(1000, 2000)).toBe(true);
  });
  it('deadline = 1 (minimum non-sentinel) with now = 0 → not expired', () => {
    expect(isExpired(1, 0)).toBe(false);
  });
  it('deadline = 1 with now = 1 → expired', () => {
    expect(isExpired(1, 1)).toBe(true);
  });
});

// ── 甲1a: pre-1970 behavior (current: clamps — 甲1c anchor fix pending) ────────

describe('pre-1970 date handling (current limitation: clamps to 0)', () => {
  it('618-06-18: gregorianToEpochMin returns 0 (lossy — pre-anchor clamp)', () => {
    expect(gregorianToEpochMin(618, 6, 18)).toBe(0);
  });
  it('1691-01-01: gregorianToEpochMin returns 0 (lossy — pre-anchor clamp)', () => {
    expect(gregorianToEpochMin(1691, 1, 1)).toBe(0);
  });
  it('1969-12-31: returns 0 (one day before anchor, boundary clamp)', () => {
    expect(gregorianToEpochMin(1969, 12, 31)).toBe(0);
  });
  it('roundtrip lossy: all three pre-1970 dates collapse to 1970-01-01', () => {
    const anchor = { year: EPOCH_ANCHOR_YEAR, month: 1, day: 1 };
    for (const [y, m, d] of [[618, 6, 18], [1691, 1, 1], [1969, 12, 31]] as [number, number, number][]) {
      expect(epochMinToGregorian(gregorianToEpochMin(y, m, d))).toEqual(anchor);
    }
  });
});

// ── 乙4: property test (pure-rand, seed=42) ───────────────────────────────────

describe('property roundtrip: date→em→date (500 pure-rand samples, seed=42)', () => {
  it('em→date→em roundtrip: epochMin always equals dayStart of its Gregorian date', () => {
    const rng = prand.xoroshiro128plus(42);
    const maxDays = Math.floor(gregorianToEpochMin(2099, 12, 31) / MINUTES_PER_DAY);
    for (let i = 0; i < 500; i++) {
      const dayOffset = prand.unsafeUniformIntDistribution(0, maxDays, rng);
      const em = dayOffset * MINUTES_PER_DAY;
      const { year, month, day } = epochMinToGregorian(em);
      expect(gregorianToEpochMin(year, month, day)).toBe(em);
    }
  });
});

// ── 乙5: 天数历 + 月名渲染 ───────────────────────────────────────────────────

describe('renderCalendar — 天数历 {daysSinceAnchor} and {月名}', () => {
  it('天数历: "灾变后 Day N" snapshot (纪元锚点 = Day 0)', () => {
    const 灾变纪元 = gregorianToEpochMin(2050, 3, 15);
    const cfg: CalendarConfig = {
      纪年法: '天数历', 纪元锚点: 灾变纪元, 年号表: [], 月制: '',
      显示模板: '灾变后 Day {daysSinceAnchor}',
    };
    // 4021 days after anchor
    const em = 灾变纪元 + 4021 * MINUTES_PER_DAY;
    expect(renderCalendar(em, cfg)).toBe('灾变后 Day 4021');
  });

  it('天数历: Day 0 at the anchor itself', () => {
    const 锚 = gregorianToEpochMin(2050, 3, 15);
    const cfg: CalendarConfig = {
      纪年法: '天数历', 纪元锚点: 锚, 年号表: [], 月制: '',
      显示模板: 'Day {daysSinceAnchor}',
    };
    expect(renderCalendar(锚, cfg)).toBe('Day 0');
  });

  it('{月名} renders 正月 for month 1 and 腊月 for month 12', () => {
    const 贞观起始 = gregorianToEpochMin(2027, 1, 1);
    const cfg: CalendarConfig = {
      纪年法: '年号制', 纪元锚点: 贞观起始,
      年号表: [{ 年号: '贞观', 起始纪元分钟: 贞观起始 }],
      月制: '太阴历', 显示模板: '{年号}{year}年{月名}{day}日',
    };
    // game 2027-01-15 = 贞观元年正月15日
    expect(renderCalendar(gregorianToEpochMin(2027, 1, 15), cfg)).toBe('贞观1年正月15日');
    // game 2027-12-20 = 贞观元年腊月20日
    expect(renderCalendar(gregorianToEpochMin(2027, 12, 20), cfg)).toBe('贞观1年腊月20日');
  });

  it('MONTH_NAMES covers all 12 months with correct traditional names', () => {
    const expected = ['正月','二月','三月','四月','五月','六月','七月','八月','九月','十月','冬月','腊月'];
    for (let m = 1; m <= 12; m++) {
      expect(MONTH_NAMES[m]).toBe(expected[m - 1]);
    }
  });
});

// ── 甲2: getSeason ────────────────────────────────────────────────────────────

describe('getSeason', () => {
  it('北温带: 月份3/4/5 → 春', () => {
    for (const m of [3, 4, 5]) expect(getSeason(m, '北温带')).toBe('春');
  });
  it('北温带: 月份6/7/8 → 夏', () => {
    for (const m of [6, 7, 8]) expect(getSeason(m, '北温带')).toBe('夏');
  });
  it('北温带: 月份9/10/11 → 秋', () => {
    for (const m of [9, 10, 11]) expect(getSeason(m, '北温带')).toBe('秋');
  });
  it('北温带: 月份12/1/2 → 冬', () => {
    for (const m of [12, 1, 2]) expect(getSeason(m, '北温带')).toBe('冬');
  });
  it('默认（空字符串气候带）→ 北半球季节', () => {
    expect(getSeason(6, '')).toBe('夏');
    expect(getSeason(12, '')).toBe('冬');
  });
  it('南温带: 月份6 → 冬（南北反转）', () => {
    expect(getSeason(6, '南温带')).toBe('冬');
  });
  it('南半球: 月份12 → 夏（南北反转）', () => {
    expect(getSeason(12, '南半球')).toBe('夏');
  });
  it('南半球: 月份3 → 秋', () => {
    expect(getSeason(3, '南半球')).toBe('秋');
  });
  it('热带: 任意月份 → 无四季', () => {
    for (const m of [1, 6, 12]) expect(getSeason(m, '热带')).toBe('无四季');
  });
  it('南北半球季节完全相反（6月）', () => {
    expect(getSeason(6, '北温带')).toBe('夏');
    expect(getSeason(6, '南半球')).toBe('冬');
  });
});

// ── 甲2: getAge ───────────────────────────────────────────────────────────────

describe('getAge', () => {
  it('exact birthday: age increments on the birthday', () => {
    const birth = gregorianToEpochMin(2000, 6, 15);
    const birthday2030 = gregorianToEpochMin(2030, 6, 15);
    expect(getAge(birth, birthday2030)).toBe(30);
  });
  it('day before birthday: still one year younger', () => {
    const birth = gregorianToEpochMin(2000, 6, 15);
    const dayBefore = gregorianToEpochMin(2030, 6, 14);
    expect(getAge(birth, dayBefore)).toBe(29);
  });
  it('day after birthday: already incremented', () => {
    const birth = gregorianToEpochMin(2000, 6, 15);
    const dayAfter = gregorianToEpochMin(2030, 6, 16);
    expect(getAge(birth, dayAfter)).toBe(30);
  });
  it('before birth: returns 0', () => {
    const birth = gregorianToEpochMin(2010, 1, 1);
    const before = gregorianToEpochMin(2009, 12, 31);
    expect(getAge(birth, before)).toBe(0);
  });
  it('same minute as birth: returns 0', () => {
    const birth = gregorianToEpochMin(2000, 1, 1);
    expect(getAge(birth, birth)).toBe(0);
  });
  it('leap-day birthday (2000-02-29): ages on Mar 1 in non-leap years', () => {
    const birth = gregorianToEpochMin(2000, 2, 29);
    // 2001 is not leap — Feb has only 28 days; age check on Mar 1
    const mar1 = gregorianToEpochMin(2001, 3, 1);
    const feb28 = gregorianToEpochMin(2001, 2, 28);
    expect(getAge(birth, mar1)).toBe(1);
    expect(getAge(birth, feb28)).toBe(0);
  });
  it('age 0 at first minute of life', () => {
    const birth = gregorianToEpochMin(1990, 5, 20);
    expect(getAge(birth, birth + 1)).toBe(0);
  });
});

// ── 乙9: dual clock lens ≥ world invariant ────────────────────────────────────

describe('dual clock: lens ≥ world invariant during RP_FOCUS', () => {
  it('lens.epochMin ≥ world.epochMin holds throughout RP_FOCUS', () => {
    const c0 = makeDualClock(5000);
    // Initially equal
    expect(c0.lens.epochMin).toBeGreaterThanOrEqual(c0.world.epochMin);
    // After entering RP_FOCUS: still equal
    const c1 = enterRpFocus(c0);
    expect(c1.lens.epochMin).toBeGreaterThanOrEqual(c1.world.epochMin);
    // After advancing lens: lens > world (world frozen)
    const c2 = advanceLens(c1, 1440);
    expect(c2.lens.epochMin).toBeGreaterThan(c2.world.epochMin);
    // After more lens time: still holds
    const c3 = advanceLens(c2, 43200);
    expect(c3.lens.epochMin).toBeGreaterThanOrEqual(c3.world.epochMin);
    // On exit: world catches up to lens, equality restored
    const c4 = exitRpFocus(c3, 1440 + 43200);
    expect(c4.lens.epochMin).toBeGreaterThanOrEqual(c4.world.epochMin);
  });
});
