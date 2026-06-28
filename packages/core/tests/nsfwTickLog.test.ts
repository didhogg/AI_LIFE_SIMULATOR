// N-1/N-2 tick_log routing semantics
// N-1: route locked on first tick assembly; all same-tick swipes reuse it; scene detector runs once
// N-2: live preference ⊥ frozen tick_log route; replay reads tick_log, not current state
import { describe, it, expect, vi } from 'vitest';
import { RootSchema } from '../schema/index.js';
import {
  assembleTickRoute,
  replayRoute,
  isNsfwScene,
  selectNarrativeModel,
} from '../prompt/index.js';

// ── Helper ────────────────────────────────────────────────────────────────────

function makeState(overrides: {
  enabled?: boolean;
  mode?: '场景预判' | '失败兜底';
  targetKey?: string;
  rating?: 'off' | 'light' | 'explicit' | 'community';
  tickId?: string;
} = {}) {
  const {
    enabled = false,
    mode = '失败兜底',
    targetKey = 'claude-nsfw',
    rating = 'off',
    tickId = 'tick-001',
  } = overrides;

  const base = RootSchema.parse({
    $玩家偏好: {
      内容分级: rating,
      NSFW降级模型: { 启用: enabled, 触发模式: mode },
    },
    $预算控制台: { NSFW降级目标模型键: targetKey },
    $模型画像: { [targetKey]: { 风格补正提示词: 'test' } },
  });

  return { ...base, _tick: { ...base._tick, id: tickId } };
}

// ── N-1: 一拍路由定格 ─────────────────────────────────────────────────────────

describe('N-1 · 一拍路由定格', () => {
  it('同一拍连续 3 次 swipe → modelKey/routedVia/explicitReason 逐字节恒等', () => {
    const state0 = makeState({ enabled: false });

    const { decision: d1, updatedState: s1 } = assembleTickRoute(state0, []);
    const { decision: d2, updatedState: s2 } = assembleTickRoute(s1, []);
    const { decision: d3 } = assembleTickRoute(s2, []);

    expect(d1.modelKey).toBe(d2.modelKey);
    expect(d2.modelKey).toBe(d3.modelKey);
    expect(d1.routedVia).toBe(d2.routedVia);
    expect(d2.routedVia).toBe(d3.routedVia);
    expect(d1.explicitReason).toBe(d2.explicitReason);
    expect(d2.explicitReason).toBe(d3.explicitReason);
  });

  it('场景检测器在一拍内只跑一次（spy 计数 = 1）', () => {
    const spy = vi.fn(isNsfwScene);
    const state0 = makeState({ enabled: true, mode: '场景预判', rating: 'explicit' });

    const { updatedState: s1 } = assembleTickRoute(state0, ['nsfw'], spy);
    const { updatedState: s2 } = assembleTickRoute(s1, ['nsfw'], spy);
    assembleTickRoute(s2, ['nsfw'], spy);

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('首次组装后路由快照写入 tick_log', () => {
    const state0 = makeState({ enabled: false, tickId: 'tick-snap' });
    const { updatedState } = assembleTickRoute(state0, []);

    const entry = updatedState._系统.tick_log.find(e => e.tick_id === 'tick-snap');
    expect(entry?.路由快照).toBeDefined();
    expect(entry?.路由快照?.routedVia).toBe('default');
    expect(entry?.路由快照?.modelKey).toBeNull();
    expect(typeof entry?.路由快照?.explicitReason).toBe('string');
  });

  it('重复组装不新增 tick_log 条目（幂等）', () => {
    const state0 = makeState({ tickId: 'tick-idem' });
    const { updatedState: s1 } = assembleTickRoute(state0, []);
    const { updatedState: s2 } = assembleTickRoute(s1, []);

    const entries = s2._系统.tick_log.filter(e => e.tick_id === 'tick-idem');
    expect(entries).toHaveLength(1);
  });

  it('场景预判命中时快照记录 nsfw-preempt 路由', () => {
    const spy = vi.fn().mockReturnValue(true); // force scene detection hit
    const state0 = makeState({ enabled: true, mode: '场景预判', rating: 'explicit', tickId: 'tick-preempt' });

    const { decision, updatedState } = assembleTickRoute(state0, [], spy);
    expect(decision.routedVia).toBe('nsfw-preempt');

    const entry = updatedState._系统.tick_log.find(e => e.tick_id === 'tick-preempt');
    expect(entry?.路由快照?.routedVia).toBe('nsfw-preempt');
  });
});

// ── N-2: live 偏好 ⊥ tick_log 冻结路由 ────────────────────────────────────────

describe('N-2 · live 偏好 ⊥ tick_log 冻结路由', () => {
  it('关态历史拍 replay → 切换偏好后仍读冻结 default 路由（不漂移）', () => {
    // Record: 关态 tick → default route
    const stateOld = makeState({ enabled: false, tickId: 'tick-old' });
    const { updatedState: recorded } = assembleTickRoute(stateOld, []);

    // Player switches to 开·失败兜底 (live preference change)
    const liveState = {
      ...recorded,
      $玩家偏好: {
        ...recorded.$玩家偏好!,
        NSFW降级模型: { 启用: true, 触发模式: '失败兜底' as const },
      },
    };

    // Replay reads frozen tick_log — must ignore live switch
    const oldEntry = liveState._系统.tick_log.find(e => e.tick_id === 'tick-old')!;
    const replayed = replayRoute(oldEntry);

    expect(replayed).not.toBeNull();
    expect(replayed!.routedVia).toBe('default');
    expect(replayed!.modelKey).toBeNull();
  });

  it('切换偏好后新拍才走新路由', () => {
    // Record old tick with 关态
    const stateOld = makeState({ enabled: false, tickId: 'tick-old2' });
    const { updatedState: recorded } = assembleTickRoute(stateOld, []);

    // Switch to 开·失败兜底, advance to new tick
    const liveState = {
      ...recorded,
      _tick: { ...recorded._tick, id: 'tick-new' },
      $玩家偏好: {
        ...recorded.$玩家偏好!,
        NSFW降级模型: { 启用: true, 触发模式: '失败兜底' as const },
      },
    };

    // New tick: new preference takes effect (softReject simulated)
    const newDecision = selectNarrativeModel(liveState, { softRejectDetected: true, scenePredictedNsfw: false });
    expect(newDecision.routedVia).toBe('nsfw-fallback');
    expect(newDecision.modelKey).toBe('claude-nsfw');
  });

  it('replayRoute on entry without 路由快照 → null', () => {
    const bareEntry = { tick_id: 'old-bare', 拍计数: 0, 结果摘要: '', 系数组指纹: '' };
    expect(replayRoute(bareEntry)).toBeNull();
  });

  it('replayRoute 返回副本，不共享引用（mutation-proof）', () => {
    const state0 = makeState({ tickId: 'tick-copy' });
    const { updatedState } = assembleTickRoute(state0, []);
    const entry = updatedState._系统.tick_log.find(e => e.tick_id === 'tick-copy')!;

    const r1 = replayRoute(entry);
    const r2 = replayRoute(entry);
    expect(r1).not.toBe(r2);
    expect(r1).toEqual(r2);
  });

  it('场景预判历史拍 replay → 切到关态后仍读冻结 nsfw-preempt 路由', () => {
    // Record: 场景预判命中 → nsfw-preempt
    const spy = vi.fn().mockReturnValue(true);
    const stateOn = makeState({ enabled: true, mode: '场景预判', rating: 'explicit', tickId: 'tick-preempt2' });
    const { updatedState: recorded } = assembleTickRoute(stateOn, [], spy);

    // Player turns off NSFW switch
    const liveOff = {
      ...recorded,
      $玩家偏好: { ...recorded.$玩家偏好!, NSFW降级模型:{ 启用: false, 触发模式: '失败兜底' as const } },
    };

    const oldEntry = liveOff._系统.tick_log.find(e => e.tick_id === 'tick-preempt2')!;
    const replayed = replayRoute(oldEntry);

    expect(replayed!.routedVia).toBe('nsfw-preempt');
    expect(replayed!.modelKey).toBe('claude-nsfw');
  });
});

// ── isNsfwScene · 场景检测器 ──────────────────────────────────────────────────

describe('isNsfwScene · 场景检测器', () => {
  it('内容分级=off → 永不命中（标签任意）', () => {
    const state = makeState({ rating: 'off' });
    expect(isNsfwScene(state, ['nsfw', 'explicit'])).toBe(false);
  });

  it('内容分级=light → 永不命中', () => {
    const state = makeState({ rating: 'light' });
    expect(isNsfwScene(state, ['nsfw'])).toBe(false);
  });

  it('内容分级=explicit + nsfw 标签 → 命中', () => {
    const state = makeState({ rating: 'explicit' });
    expect(isNsfwScene(state, ['nsfw'])).toBe(true);
  });

  it('内容分级=community + explicit 标签 → 命中', () => {
    const state = makeState({ rating: 'community' });
    expect(isNsfwScene(state, ['explicit'])).toBe(true);
  });

  it('内容分级=explicit + 含 -nsfw 复合标签 → 命中', () => {
    const state = makeState({ rating: 'explicit' });
    expect(isNsfwScene(state, ['scene-nsfw'])).toBe(true);
  });

  it('内容分级=explicit + 无 nsfw/explicit 标签 → 不命中', () => {
    const state = makeState({ rating: 'explicit' });
    expect(isNsfwScene(state, ['romantic', 'action', 'drama'])).toBe(false);
  });

  it('空标签数组 → 不命中', () => {
    const state = makeState({ rating: 'explicit' });
    expect(isNsfwScene(state, [])).toBe(false);
  });
});
