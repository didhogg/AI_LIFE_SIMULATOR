// N-5: 正剧拉回 × 场景检测器时点分离测试
// T1 = recentDensity（拉回前·近期密度）; T2 = finalIntentTags（拉回后·场景检测器读）
// 断言: 场景检测器读 T2 不回灌 T1 近期密度
import { describe, it, expect } from 'vitest';
import { computeNarrativePullback, PULLBACK_DENSITY_THRESHOLD } from '../engine/narrativePullback.js';
import { isNsfwScene } from '../prompt/index.js';
import { RootSchema } from '../schema/index.js';

function makeExplicit() {
  return RootSchema.parse({ $玩家偏好: { 内容分级: 'explicit' } });
}

function makeCommunity() {
  return RootSchema.parse({ $玩家偏好: { 内容分级: 'community' } });
}

// ── N-5 · 时点分离 ──────────────────────────────────────────────────────────

describe('N-5 · 正剧拉回 × 场景检测器时点分离', () => {
  it('T1 密度高 → 拉回触发 → T2 无 nsfw 标签 → 场景检测器不命中', () => {
    const { finalIntentTags, appliedPullback } = computeNarrativePullback(0.85, ['nsfw', 'romantic']);
    expect(appliedPullback).toBe(true);
    expect(finalIntentTags).not.toContain('nsfw');
    // 场景检测器读 T2（不含 nsfw）→ 不命中
    expect(isNsfwScene(makeExplicit(), finalIntentTags)).toBe(false);
  });

  it('T1 密度低 → 不拉回 → T2 = 原始标签 → 场景检测器按 T2 命中', () => {
    const { finalIntentTags, appliedPullback } = computeNarrativePullback(0.3, ['nsfw']);
    expect(appliedPullback).toBe(false);
    expect(finalIntentTags).toContain('nsfw');
    expect(isNsfwScene(makeExplicit(), finalIntentTags)).toBe(true);
  });

  it('T1 密度高但 T2 只剩非 nsfw 标签 → 场景检测器不命中', () => {
    const { finalIntentTags } = computeNarrativePullback(0.9, ['nsfw', 'action', 'drama']);
    expect(finalIntentTags).not.toContain('nsfw');
    expect(finalIntentTags).toContain('action');
    expect(finalIntentTags).toContain('drama');
    expect(isNsfwScene(makeExplicit(), finalIntentTags)).toBe(false);
  });

  it('T1 密度高但原始无 nsfw 标签 → T2 = 原始 + pullback·场景检测器仍不命中', () => {
    const { finalIntentTags, appliedPullback } = computeNarrativePullback(0.9, ['action', 'drama']);
    expect(appliedPullback).toBe(true);
    expect(finalIntentTags).toContain('pullback');
    expect(isNsfwScene(makeExplicit(), finalIntentTags)).toBe(false);
  });

  it('community 分级 + T2 含 explicit 标签 → 场景检测器命中', () => {
    const { finalIntentTags } = computeNarrativePullback(0.3, ['explicit']); // no pullback
    expect(isNsfwScene(makeCommunity(), finalIntentTags)).toBe(true);
  });

  it('时点不回灌：T2 类型为 string[]，不含 T1 密度数值', () => {
    const { finalIntentTags } = computeNarrativePullback(0.9, ['nsfw']);
    // T2 是字符串数组，类型上无法含 number
    expect(finalIntentTags.every(t => typeof t === 'string')).toBe(true);
    expect(finalIntentTags).not.toContain('0.9');
  });

  it('拉回保留非 nsfw/explicit 标签（不过度清洗）', () => {
    const { finalIntentTags } = computeNarrativePullback(0.8, ['nsfw', 'romantic', 'drama', 'explicit-scene']);
    expect(finalIntentTags).toContain('romantic');
    expect(finalIntentTags).toContain('drama');
    expect(finalIntentTags).not.toContain('nsfw');
    expect(finalIntentTags).not.toContain('explicit-scene'); // contains 'explicit'
    expect(finalIntentTags).toContain('pullback');
  });
});

// ── 阈值边界 ─────────────────────────────────────────────────────────────────

describe('N-5 · 拉回阈值边界', () => {
  it('密度 = 阈值 → 不触发（边界不含等号）', () => {
    const { appliedPullback } = computeNarrativePullback(PULLBACK_DENSITY_THRESHOLD, ['nsfw']);
    expect(appliedPullback).toBe(false);
  });

  it('密度 > 阈值（微超）→ 触发', () => {
    const { appliedPullback } = computeNarrativePullback(PULLBACK_DENSITY_THRESHOLD + 0.001, ['nsfw']);
    expect(appliedPullback).toBe(true);
  });

  it('密度 = 0 → 不触发', () => {
    const { appliedPullback } = computeNarrativePullback(0, ['nsfw']);
    expect(appliedPullback).toBe(false);
  });

  it('密度 = 1.0 → 触发', () => {
    const { appliedPullback } = computeNarrativePullback(1.0, ['nsfw']);
    expect(appliedPullback).toBe(true);
  });

  it('空 intentTags + 高密度 → pullback 标记唯一输出', () => {
    const { finalIntentTags } = computeNarrativePullback(0.9, []);
    expect(finalIntentTags).toEqual(['pullback']);
  });
});

// ── 确定性 ───────────────────────────────────────────────────────────────────

describe('N-5 · computeNarrativePullback · 确定性', () => {
  it('相同输入两次调用结果相等', () => {
    const r1 = computeNarrativePullback(0.8, ['nsfw', 'action']);
    const r2 = computeNarrativePullback(0.8, ['nsfw', 'action']);
    expect(r1).toEqual(r2);
  });

  it('不修改原始标签数组（纯函数·无副作用）', () => {
    const original = ['nsfw', 'romantic'];
    const frozen = [...original];
    computeNarrativePullback(0.9, original);
    expect(original).toEqual(frozen);
  });
});
