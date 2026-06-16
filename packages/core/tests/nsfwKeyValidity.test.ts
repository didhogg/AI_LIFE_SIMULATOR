// N-3: key 运行时失效测试
// 覆盖: 配了 key 但运行时失效 → 回落关态；explicitReason 标注失效原因；向后兼容
import { describe, it, expect } from 'vitest';
import { RootSchema } from '../schema/index.js';
import { selectNarrativeModel } from '../prompt/index.js';
import type { KeyValidityChecker } from '../prompt/index.js';

function makeState(overrides: {
  enabled?: boolean;
  mode?: '场景预判' | '失败兜底';
  targetKey?: string;
} = {}) {
  const { enabled = true, mode = '失败兜底', targetKey = 'claude-nsfw' } = overrides;
  return RootSchema.parse({
    $玩家偏好: { NSFW降级模型: { 启用: enabled, 触发模式: mode } },
    $预算控制台: { NSFW降级目标模型键: targetKey },
    $模型画像: { [targetKey]: { 风格补正提示词: 'test' } },
  });
}

const SOFT_REJECT_OPTS = { softRejectDetected: true, scenePredictedNsfw: false };
const SCENE_OPTS       = { softRejectDetected: false, scenePredictedNsfw: true };

// ── N-3 · key 失效降级 ───────────────────────────────────────────────────────

describe('N-3 · key 运行时失效 → 回落关态', () => {
  it('key 已撤销 → nsfw-disabled，explicitReason 含「key失效已回落」', () => {
    const checker: KeyValidityChecker = () => ({ valid: false, failReason: 'revoked' });
    const d = selectNarrativeModel(makeState(), SOFT_REJECT_OPTS, checker);
    expect(d.routedVia).toBe('nsfw-disabled');
    expect(d.modelKey).toBeNull();
    expect(d.explicitReason).toContain('key失效已回落');
  });

  it('key 已过期 → nsfw-disabled，explicitReason 含 key 名 + 失效原因', () => {
    const checker: KeyValidityChecker = () => ({ valid: false, failReason: 'expired' });
    const d = selectNarrativeModel(makeState(), SOFT_REJECT_OPTS, checker);
    expect(d.routedVia).toBe('nsfw-disabled');
    expect(d.explicitReason).toContain('key失效已回落');
    expect(d.explicitReason).toContain('claude-nsfw');
  });

  it('key 额度耗尽 → nsfw-disabled，explicitReason 含「key失效已回落」', () => {
    const checker: KeyValidityChecker = () => ({ valid: false, failReason: 'quota_exhausted' });
    const d = selectNarrativeModel(makeState(), SOFT_REJECT_OPTS, checker);
    expect(d.routedVia).toBe('nsfw-disabled');
    expect(d.explicitReason).toContain('key失效已回落');
  });

  it('未知失效原因 → nsfw-disabled，explicitReason 含「key失效已回落」', () => {
    const checker: KeyValidityChecker = () => ({ valid: false, failReason: 'unknown' });
    const d = selectNarrativeModel(makeState(), SCENE_OPTS, checker);
    expect(d.routedVia).toBe('nsfw-disabled');
    expect(d.explicitReason).toContain('key失效已回落');
  });

  it('场景预判模式下 key 失效 → 同样降级（不因触发模式不同而绕过）', () => {
    const checker: KeyValidityChecker = () => ({ valid: false, failReason: 'revoked' });
    const d = selectNarrativeModel(makeState({ mode: '场景预判' }), SCENE_OPTS, checker);
    expect(d.routedVia).toBe('nsfw-disabled');
    expect(d.explicitReason).toContain('key失效已回落');
  });

  it('禁静默路由到死 key：explicitReason 不为空且含 key 名', () => {
    const checker: KeyValidityChecker = () => ({ valid: false, failReason: 'revoked' });
    const d = selectNarrativeModel(makeState(), SOFT_REJECT_OPTS, checker);
    expect(d.explicitReason.length).toBeGreaterThan(0);
    expect(d.explicitReason).toContain('claude-nsfw');
  });
});

// ── N-3 · key 有效·向后兼容 ─────────────────────────────────────────────────

describe('N-3 · key 有效 / 向后兼容', () => {
  it('key 有效时校验通过 → 正常路由（nsfw-fallback）', () => {
    const checker: KeyValidityChecker = () => ({ valid: true });
    const d = selectNarrativeModel(makeState({ mode: '失败兜底' }), SOFT_REJECT_OPTS, checker);
    expect(d.routedVia).toBe('nsfw-fallback');
    expect(d.modelKey).toBe('claude-nsfw');
  });

  it('key 有效·场景预判命中 → nsfw-preempt（正常路由）', () => {
    const checker: KeyValidityChecker = () => ({ valid: true });
    const d = selectNarrativeModel(makeState({ mode: '场景预判' }), SCENE_OPTS, checker);
    expect(d.routedVia).toBe('nsfw-preempt');
    expect(d.modelKey).toBe('claude-nsfw');
  });

  it('未传 keyChecker → 原有逻辑不变（向后兼容）', () => {
    // No keyChecker — selectNarrativeModel behaves exactly as before N-3
    const d = selectNarrativeModel(makeState({ mode: '失败兜底' }), SOFT_REJECT_OPTS);
    expect(d.routedVia).toBe('nsfw-fallback');
    expect(d.modelKey).toBe('claude-nsfw');
  });

  it('关态时 keyChecker 不被调用（关态优先·无需 live 校验）', () => {
    let checkerCalled = false;
    const checker: KeyValidityChecker = () => {
      checkerCalled = true;
      return { valid: false, failReason: 'revoked' };
    };
    const state = makeState({ enabled: false });
    const d = selectNarrativeModel(state, SOFT_REJECT_OPTS, checker);
    expect(d.routedVia).toBe('default'); // 关态优先
    expect(checkerCalled).toBe(false);
  });

  it('key 不在 $模型画像 → 静态检查已拒绝，keyChecker 不被调用', () => {
    let checkerCalled = false;
    const checker: KeyValidityChecker = () => {
      checkerCalled = true;
      return { valid: true };
    };
    const stateNoPortrait = RootSchema.parse({
      $玩家偏好: { NSFW降级模型: { 启用: true, 触发模式: '失败兜底' } },
      $预算控制台: { NSFW降级目标模型键: 'ghost-model' },
      $模型画像: {}, // ghost-model not in portrait
    });
    const d = selectNarrativeModel(stateNoPortrait, SOFT_REJECT_OPTS, checker);
    expect(d.routedVia).toBe('nsfw-disabled');
    expect(checkerCalled).toBe(false); // static check fires first
  });
});
