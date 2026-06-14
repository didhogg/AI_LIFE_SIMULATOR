// Community gate acceptance tests
// Verifies: ① dirty archive (覆盖=true & 内容分级=off) self-heals on load
//           ② assembler never injects override string even when dirty value is force-fed
import { describe, it, expect } from 'vitest';
import { migrate } from '../migration/migrate.js';
import { RootSchema } from '../schema/index.js';
import { assembleNarrativeCall } from '../prompt/index.js';

// ── Dirty archive fixture ──────────────────────────────────────────────────────
// 内容分级=off (default) + 允许玩家覆盖SystemPrompt=true → violates community gate
const DIRTY_SAVE: Record<string, unknown> = {
  _系统版本: '4.1',
  $玩家偏好: { 内容分级: 'off' },
  调用类型注册表: {
    叙事: {
      允许玩家覆盖SystemPrompt: true,
      玩家SystemPrompt覆盖: '【玩家注入】',
      assistant预填: '当然，',
    },
  },
};

describe('Community gate · ① dirty archive 加载自愈', () => {
  it('migrate 后 允许玩家覆盖SystemPrompt 被强制清为 false', () => {
    const { state } = migrate(DIRTY_SAVE);
    expect(state.调用类型注册表['叙事']?.允许玩家覆盖SystemPrompt).toBe(false);
  });

  it('migrate 后 $玩家偏好.内容分级 仍为 off（未被篡改）', () => {
    const { state } = migrate(DIRTY_SAVE);
    expect(state.$玩家偏好.内容分级).toBe('off');
  });

  it('migrate 后 log 包含至少一条 warn 指向 允许玩家覆盖SystemPrompt', () => {
    const { log } = migrate(DIRTY_SAVE);
    const warns = log.filter(l => l.level === 'warn' && l.path.includes('允许玩家覆盖SystemPrompt'));
    expect(warns.length).toBeGreaterThanOrEqual(1);
  });

  it('干净存档（内容分级=community + 覆盖=true）不产生 warn、不自愈', () => {
    const cleanSave = {
      _系统版本: '4.1',
      $玩家偏好: { 内容分级: 'community' },
      调用类型注册表: { 叙事: { 允许玩家覆盖SystemPrompt: true } },
    };
    const { state, log } = migrate(cleanSave);
    expect(state.调用类型注册表['叙事']?.允许玩家覆盖SystemPrompt).toBe(true);
    const warns = log.filter(l => l.level === 'warn' && l.path.includes('允许玩家覆盖SystemPrompt'));
    expect(warns.length).toBe(0);
  });
});

describe('Community gate · ② assembler 强塞脏值不注入', () => {
  // Force-feed the dirty values directly into a parsed state — bypasses migrate
  function makeDirtyState(内容分级: string, 允许覆盖: boolean) {
    return RootSchema.parse({
      $玩家偏好: { 内容分级 },
      调用类型注册表: {
        叙事: {
          允许玩家覆盖SystemPrompt: 允许覆盖,
          玩家SystemPrompt覆盖: '【注入】',
          assistant预填: '好的，',
        },
      },
    });
  }

  it('内容分级=off + 覆盖=true → systemPrompt 用 base，不注入覆盖串', () => {
    const state = makeDirtyState('off', true);
    const entry = state.调用类型注册表['叙事']!;
    const { systemPrompt } = assembleNarrativeCall('BASE_PROMPT', entry, state);
    expect(systemPrompt).toBe('BASE_PROMPT');
  });

  it('内容分级=off + 覆盖=true → assistantPrefill 为 undefined', () => {
    const state = makeDirtyState('off', true);
    const entry = state.调用类型注册表['叙事']!;
    const { assistantPrefill } = assembleNarrativeCall('BASE_PROMPT', entry, state);
    expect(assistantPrefill).toBeUndefined();
  });

  it('内容分级=light + 覆盖=true → 同样不注入', () => {
    const state = makeDirtyState('light', true);
    const entry = state.调用类型注册表['叙事']!;
    const { systemPrompt, assistantPrefill } = assembleNarrativeCall('BASE', entry, state);
    expect(systemPrompt).toBe('BASE');
    expect(assistantPrefill).toBeUndefined();
  });

  it('内容分级=community + 覆盖=true → 注入覆盖串和预填', () => {
    const state = makeDirtyState('community', true);
    const entry = state.调用类型注册表['叙事']!;
    const { systemPrompt, assistantPrefill } = assembleNarrativeCall('BASE', entry, state);
    expect(systemPrompt).toBe('【注入】');
    expect(assistantPrefill).toBe('好的，');
  });

  it('内容分级=community + 覆盖=false → 不注入', () => {
    const state = makeDirtyState('community', false);
    const entry = state.调用类型注册表['叙事']!;
    const { systemPrompt, assistantPrefill } = assembleNarrativeCall('BASE', entry, state);
    expect(systemPrompt).toBe('BASE');
    expect(assistantPrefill).toBeUndefined();
  });

  it('覆盖串缺失时 systemPrompt fallback 到 base（即使 community）', () => {
    const state = RootSchema.parse({
      $玩家偏好: { 内容分级: 'community' },
      调用类型注册表: { 叙事: { 允许玩家覆盖SystemPrompt: true } },
    });
    const entry = state.调用类型注册表['叙事']!;
    const { systemPrompt } = assembleNarrativeCall('BASE', entry, state);
    expect(systemPrompt).toBe('BASE');
  });
});
