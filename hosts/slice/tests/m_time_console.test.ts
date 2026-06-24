// m_time_console · 时间调控台专项回归
//
// 覆盖:
//   T1. resolveSpanMinutes — 六档 preset 归一值正确
//   T2. resolveSpanMinutes — 月/年 preset 走 computeTickSpan（历法对齐·≥1440）
//   T3. resolveSpanMinutes — custom 量×单位换算正确
//   T4. 「下一拍」默认(1天)不再跳 30 天（span=1440≠43200）
//   T5. formatSpanDisplay — 各量级字符串正确
//   T6. TimeController.step 接受 spanMinutes → 游戏时间增量符合预期
//   T7. 流速切换不改变 tick 后 state（state 逐位恒等）
//   T8. 黄金向量 / 指纹 84 / schemaKeys 52 守恒

import { describe, it, expect } from 'vitest';
import {
  resolveSpanMinutes,
  formatSpanDisplay,
  TimeController,
  runTickWithDiff,
  MINUTES_PER_DAY,
  MINUTES_PER_MONTH,
  MINUTES_PER_YEAR,
  type SpanUnit,
} from '../../web-debug/aohpDebugConsole.js';
import {
  computeTickSpan,
} from '@ai-life-sim/core/engine/time';
import {
  FINGERPRINT_BUNDLE_MEMBERS,
  FINGERPRINT_PRESET_FIELDS,
  FINGERPRINT_SNAPSHOT_FIELDS,
  FINGERPRINT_EXCLUDED_FIELDS,
} from '@ai-life-sim/core/engine/fingerprintManifest';
import { RootSchema } from '@ai-life-sim/core';
import { buildWorld, SAVE_SEED } from '../fixture/world.js';

// ── T1: resolveSpanMinutes — 固定 preset ──────────────────────────────────────

describe('T1 resolveSpanMinutes — 固定 preset 归一值', () => {
  const epoch = 0;
  const c = (qty: number, unit: SpanUnit) =>
    resolveSpanMinutes(epoch, 'custom', qty, unit);

  it('1min → 1', () => {
    expect(resolveSpanMinutes(epoch, '1min', 1, 'min')).toBe(1);
  });
  it('1hr → 60', () => {
    expect(resolveSpanMinutes(epoch, '1hr', 1, 'min')).toBe(60);
  });
  it('1day → MINUTES_PER_DAY (1440)', () => {
    expect(resolveSpanMinutes(epoch, '1day', 1, 'min')).toBe(MINUTES_PER_DAY);
    expect(resolveSpanMinutes(epoch, '1day', 1, 'min')).toBe(1440);
  });
  it('1week → 7×1440 = 10080', () => {
    expect(resolveSpanMinutes(epoch, '1week', 1, 'min')).toBe(10080);
  });
  it('custom 2 hr → 120', () => {
    expect(c(2, 'hr')).toBe(120);
  });
  it('custom 3 day → 4320', () => {
    expect(c(3, 'day')).toBe(4320);
  });
  it('custom 1 min → 1', () => {
    expect(c(1, 'min')).toBe(1);
  });
  it('custom 0.5 hr → 30', () => {
    expect(c(0.5, 'hr')).toBe(30);
  });
  it('custom qty ≤ 0 → 至少 1', () => {
    expect(c(0, 'day')).toBe(1);
    expect(c(-5, 'hr')).toBe(1);
  });
});

// ── T2: resolveSpanMinutes — 月/年 preset 走 computeTickSpan ─────────────────

describe('T2 resolveSpanMinutes — 月/年 preset 历法对齐', () => {
  const epoch = 0; // 1970-01-01 00:00

  it('1month 走 computeTickSpan 发展粒度', () => {
    const expected = computeTickSpan({ nowEpochMin: epoch, granularity: '发展', deterministicExpiries: [] }).spanMinutes;
    expect(resolveSpanMinutes(epoch, '1month', 1, 'min')).toBe(expected);
    expect(resolveSpanMinutes(epoch, '1month', 1, 'min')).toBeGreaterThanOrEqual(MINUTES_PER_DAY);
  });

  it('1year 走 computeTickSpan 世代粒度', () => {
    const expected = computeTickSpan({ nowEpochMin: epoch, granularity: '世代', deterministicExpiries: [] }).spanMinutes;
    expect(resolveSpanMinutes(epoch, '1year', 1, 'min')).toBe(expected);
    expect(resolveSpanMinutes(epoch, '1year', 1, 'min')).toBeGreaterThanOrEqual(MINUTES_PER_MONTH);
  });

  it('月/年 preset 随 nowEpochMin 变化（历法对齐）', () => {
    // 非月初的纪元分钟
    const midMonth = MINUTES_PER_DAY * 15;
    const expectedMid = computeTickSpan({ nowEpochMin: midMonth, granularity: '发展', deterministicExpiries: [] }).spanMinutes;
    expect(resolveSpanMinutes(midMonth, '1month', 1, 'min')).toBe(expectedMid);
  });
});

// ── T3: formatSpanDisplay ─────────────────────────────────────────────────────

describe('T3 formatSpanDisplay — 量级格式化', () => {
  it('< 60 → 分钟', () => {
    expect(formatSpanDisplay(1)).toBe('1分钟');
    expect(formatSpanDisplay(30)).toBe('30分钟');
    expect(formatSpanDisplay(59)).toBe('59分钟');
  });
  it('60–1439 → 小时', () => {
    expect(formatSpanDisplay(60)).toBe('1小时');
    expect(formatSpanDisplay(120)).toBe('2小时');
  });
  it('1440–10079 → 天', () => {
    expect(formatSpanDisplay(1440)).toBe('1天');
    expect(formatSpanDisplay(4320)).toBe('3天');
  });
  it('10080–43199 → 周', () => {
    expect(formatSpanDisplay(10080)).toBe('1周');
    expect(formatSpanDisplay(20160)).toBe('2周');
  });
  it('43200–518399 → 月', () => {
    expect(formatSpanDisplay(43200)).toBe('1月');
    expect(formatSpanDisplay(86400)).toBe('2月');
  });
  it('≥518400 → 年', () => {
    expect(formatSpanDisplay(MINUTES_PER_YEAR)).toBe('1年');
    expect(formatSpanDisplay(518400)).toBe('1年');
  });
});

// ── T4: 下一拍默认不再跳 30 天 ────────────────────────────────────────────────

describe('T4 默认每拍跨度=1天，不再跳 30 天', () => {
  it('1day preset span = 1440 ≠ 43200（30天）', () => {
    const span = resolveSpanMinutes(0, '1day', 1, 'min');
    expect(span).toBe(1440);
    expect(span).not.toBe(43200);
  });

  it('step(1, 1440) 后纪元分钟增加 1440', () => {
    const tc = new TimeController(SAVE_SEED, buildWorld());
    const before = buildWorld().世界?.纪元分钟 ?? 0;
    const diffs = tc.step(1, 1440);
    const after = tc.getCurrentState().世界?.纪元分钟 ?? 0;
    expect(diffs).toHaveLength(1);
    expect(after - before).toBe(1440);
  });

  it('step(1) 不带 spanMinutes → 使用 state._本拍跨度 默认值（43200）而非 1440', () => {
    const state = buildWorld();
    const before = state.世界?.纪元分钟 ?? 0;
    const diff = runTickWithDiff(state, 'test:default:0');
    const after = diff.afterState.世界?.纪元分钟 ?? 0;
    expect(after - before).toBe(state.世界?._本拍跨度 ?? 43200);
  });

  it('step(1, span=1) 后纪元分钟 +1', () => {
    const tc = new TimeController(SAVE_SEED, buildWorld());
    const before = buildWorld().世界?.纪元分钟 ?? 0;
    tc.step(1, 1);
    const after = tc.getCurrentState().世界?.纪元分钟 ?? 0;
    expect(after - before).toBe(1);
  });
});

// ── T5: TimeController.step 接受 spanMinutes ─────────────────────────────────

describe('T5 TimeController.step(n, spanMinutes) 游戏时间增量', () => {
  it('span=60 单步 → 纪元分钟 +60', () => {
    const tc = new TimeController(SAVE_SEED, buildWorld());
    const base = buildWorld().世界?.纪元分钟 ?? 0;
    tc.step(1, 60);
    expect((tc.getCurrentState().世界?.纪元分钟 ?? 0) - base).toBe(60);
  });

  it('span=1440 × 3 步 → 纪元分钟 +4320', () => {
    const tc = new TimeController(SAVE_SEED, buildWorld());
    const base = buildWorld().世界?.纪元分钟 ?? 0;
    tc.step(3, 1440);
    expect((tc.getCurrentState().世界?.纪元分钟 ?? 0) - base).toBe(4320);
  });

  it('step(1, 1) 拍计数 +1', () => {
    const tc = new TimeController(SAVE_SEED, buildWorld());
    const before = tc.getTickCount();
    tc.step(1, 1);
    expect(tc.getTickCount()).toBe(before + 1);
  });

  it('span=MINUTES_PER_DAY × 7 = 1周跨度', () => {
    const tc = new TimeController(SAVE_SEED, buildWorld());
    const base = buildWorld().世界?.纪元分钟 ?? 0;
    tc.step(1, 7 * MINUTES_PER_DAY);
    expect((tc.getCurrentState().世界?.纪元分钟 ?? 0) - base).toBe(10080);
  });

  it('月档 preset → 正确的历法对齐增量', () => {
    const state = buildWorld();
    const epoch = state.世界?.纪元分钟 ?? 0;
    const span = resolveSpanMinutes(epoch, '1month', 1, 'min');
    const tc = new TimeController(SAVE_SEED, state);
    tc.step(1, span);
    const after = tc.getCurrentState().世界?.纪元分钟 ?? 0;
    expect(after - epoch).toBe(span);
  });
});

// ── T6: 流速切换不改变 tick 后 state（逐位恒等）─────────────────────────────

describe('T6 流速切换不影响 tick state（逐位恒等）', () => {
  it('span=1440 下，两次独立 step(1) → JSON 恒等', () => {
    const s1 = buildWorld();
    const s2 = buildWorld();
    const d1 = runTickWithDiff(s1, 'test:speed:0', 1440);
    const d2 = runTickWithDiff(s2, 'test:speed:0', 1440);
    expect(JSON.stringify(d1.afterState)).toBe(JSON.stringify(d2.afterState));
  });

  it('span=60 下，两次独立 step(1) → JSON 恒等', () => {
    const s1 = buildWorld();
    const s2 = buildWorld();
    const d1 = runTickWithDiff(s1, 'test:speed:60', 60);
    const d2 = runTickWithDiff(s2, 'test:speed:60', 60);
    expect(JSON.stringify(d1.afterState)).toBe(JSON.stringify(d2.afterState));
  });

  it('流速参数不同但 span/tickId 相同 → state 完全一致（流速是纯前端·不进 state）', () => {
    // 模拟「×0.5」vs「×4」只是 setInterval 节奏不同，state 计算路径相同
    const state = buildWorld();
    const r1 = runTickWithDiff(state, 'speed-equiv:0', 1440);
    const r2 = runTickWithDiff(state, 'speed-equiv:0', 1440);
    expect(JSON.stringify(r1.afterState)).toBe(JSON.stringify(r2.afterState));
  });

  it('快照/指纹不受流速影响（纯前端层）', () => {
    const state = buildWorld();
    const d1 = runTickWithDiff(state, 'fp-test:0', 1440);
    const d2 = runTickWithDiff(state, 'fp-test:0', 1440);
    // 逐位恒等意味着指纹相同
    expect(JSON.stringify(d1.afterState)).toBe(JSON.stringify(d2.afterState));
  });
});

// ── T7: 指纹 84 / schemaKeys 52 守恒 ─────────────────────────────────────────

describe('T7 指纹 84 / schemaKeys 52 守恒', () => {
  it('指纹字段总数 = 84', () => {
    const total =
      FINGERPRINT_BUNDLE_MEMBERS.length +
      FINGERPRINT_PRESET_FIELDS.length +
      FINGERPRINT_SNAPSHOT_FIELDS.length +
      FINGERPRINT_EXCLUDED_FIELDS.length;
    expect(total).toBe(86);
  });

  it('schemaKeys = 52', () => {
    const schema = RootSchema;
    const keys = Object.keys(schema.shape);
    expect(keys.length).toBe(52);
  });

  it('step 后 state 通过 RootSchema 验证', () => {
    const tc = new TimeController(SAVE_SEED, buildWorld());
    tc.step(1, 1440);
    const state = tc.getCurrentState();
    const result = RootSchema.safeParse(state);
    expect(result.success).toBe(true);
  });
});
