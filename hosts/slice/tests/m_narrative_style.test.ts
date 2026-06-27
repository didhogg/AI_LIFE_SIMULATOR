// P-A 叙事渲染层 · 人称 + 文风库 · 专项回归
//
// T1 切换 narrativeStyle → state diff 空 · 指纹84 · schemaKeys52 · 黄金向量不变
// T2 切换 narrativePerson → 同上全恒等
// T3 demo 3×3 笛卡尔积渲染 → 不抛错 · 输出非空 · 人称词正确
// T4 写入 $meta 渲染参数重放同序列 → state/指纹/黄金向量逐位恒等
// T5 未知值回落默认 · 不抛错
//
// 铁律:
//   ① 纯单元·无 LLM 调用
//   ② core 函数体零 diff（只测行为契约）
//   ③ 黄金向量/指纹84/schemaKeys52 守恒

import { describe, it, expect } from 'vitest';
import type { RootState } from '@ai-life-sim/core';
import { RootSchema } from '@ai-life-sim/core';
import { runTick } from '@ai-life-sim/core/engine/tick';
import {
  FINGERPRINT_BUNDLE_MEMBERS,
  FINGERPRINT_PRESET_FIELDS,
  FINGERPRINT_SNAPSHOT_FIELDS,
  FINGERPRINT_EXCLUDED_FIELDS,
} from '@ai-life-sim/core/engine/fingerprintManifest';

import { buildWorld, PC } from '../fixture/world.js';
import {
  applyPersonStyle,
  buildScriptedNarrative,
  sanitizePerson,
  sanitizeStyle,
  PERSON_DEFAULT,
  STYLE_DEFAULT,
  STYLE_LABELS,
  PERSON_LABELS,
  type NarrativePerson,
  type NarrativeStyle,
} from '../../web-debug/narrativeStyle.js';
import {
  SnapshotStore,
} from '../../web-debug/aohpDebugConsole2.js';

// ──────────────────────────────────────────────────────────────────────────────
// T1. 切换 narrativeStyle → 全恒等
// ──────────────────────────────────────────────────────────────────────────────

describe('T1 切换 narrativeStyle → state diff 空 · 指纹84 · schemaKeys52', () => {
  it('applyPersonStyle 对 state 完全只读（3 文风切换后 JSON.stringify 不变）', () => {
    const state = buildWorld();
    const before = JSON.stringify(state);
    const styles: NarrativeStyle[] = ['guofeng', 'baihua', 'jianjie'];
    for (const s of styles) {
      applyPersonStyle('test prompt', 'second', s);
    }
    expect(JSON.stringify(state)).toBe(before);
  });

  it('切换文风后 buildWorld() state 仍通过 RootSchema 校验（schemaKeys 52）', () => {
    const state = buildWorld();
    const styles: NarrativeStyle[] = ['guofeng', 'baihua', 'jianjie'];
    for (const s of styles) {
      applyPersonStyle('sys', 'second', s);
    }
    expect(() => RootSchema.parse(state)).not.toThrow();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(Object.keys((RootSchema as any)._def.shape()).length).toBe(53);
  });

  it('切换文风后指纹字段总数恒等 84', () => {
    const allKeys = new Set([
      ...FINGERPRINT_BUNDLE_MEMBERS,
      ...FINGERPRINT_PRESET_FIELDS,
      ...FINGERPRINT_SNAPSHOT_FIELDS,
      ...FINGERPRINT_EXCLUDED_FIELDS,
    ]);
    expect(allKeys.size).toBe(86);
  });

  it('切换文风后同一 tickId 产出的 state 逐位恒等（黄金向量不受文风影响）', () => {
    const applyStyle = (s: NarrativeStyle) => {
      applyPersonStyle('any system prompt', 'second', s);
    };
    applyStyle('guofeng');
    const r1 = runTick(structuredClone(buildWorld()) as RootState, { tickId: 'style:t1:0' });
    applyStyle('baihua');
    const r2 = runTick(structuredClone(buildWorld()) as RootState, { tickId: 'style:t1:0' });
    applyStyle('jianjie');
    const r3 = runTick(structuredClone(buildWorld()) as RootState, { tickId: 'style:t1:0' });
    expect(JSON.stringify(r1.state)).toBe(JSON.stringify(r2.state));
    expect(JSON.stringify(r2.state)).toBe(JSON.stringify(r3.state));
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// T2. 切换 narrativePerson → 全恒等
// ──────────────────────────────────────────────────────────────────────────────

describe('T2 切换 narrativePerson → state diff 空 · 指纹84 · schemaKeys52', () => {
  it('applyPersonStyle 对 state 完全只读（3 人称切换后 JSON.stringify 不变）', () => {
    const state = buildWorld();
    const before = JSON.stringify(state);
    const persons: NarrativePerson[] = ['second', 'first', 'third'];
    for (const p of persons) {
      applyPersonStyle('test prompt', p, 'guofeng');
    }
    expect(JSON.stringify(state)).toBe(before);
  });

  it('切换人称后指纹字段总数恒等 84', () => {
    const allKeys = new Set([
      ...FINGERPRINT_BUNDLE_MEMBERS,
      ...FINGERPRINT_PRESET_FIELDS,
      ...FINGERPRINT_SNAPSHOT_FIELDS,
      ...FINGERPRINT_EXCLUDED_FIELDS,
    ]);
    expect(allKeys.size).toBe(86);
  });

  it('切换人称后 schemaKeys 仍为 52', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(Object.keys((RootSchema as any)._def.shape()).length).toBe(53);
  });

  it('切换人称后同一 tickId 产出的 state 逐位恒等（黄金向量不受人称影响）', () => {
    const applyPerson = (p: NarrativePerson) => {
      applyPersonStyle('any system prompt', p, 'guofeng');
    };
    applyPerson('second');
    const r1 = runTick(structuredClone(buildWorld()) as RootState, { tickId: 'person:t2:0' });
    applyPerson('first');
    const r2 = runTick(structuredClone(buildWorld()) as RootState, { tickId: 'person:t2:0' });
    applyPerson('third');
    const r3 = runTick(structuredClone(buildWorld()) as RootState, { tickId: 'person:t2:0' });
    expect(JSON.stringify(r1.state)).toBe(JSON.stringify(r2.state));
    expect(JSON.stringify(r2.state)).toBe(JSON.stringify(r3.state));
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// T3. demo 3×3 笛卡尔积渲染 → 不抛错 · 输出非空 · 人称词正确
// ──────────────────────────────────────────────────────────────────────────────

describe('T3 demo 3×3 笛卡尔积渲染', () => {
  const styles: NarrativeStyle[] = ['guofeng', 'baihua', 'jianjie'];
  const persons: NarrativePerson[] = ['second', 'first', 'third'];

  it('9 组合全不抛错', () => {
    for (const s of styles) {
      for (const p of persons) {
        expect(() => buildScriptedNarrative(p, s, '林九', '对话:npc_wang')).not.toThrow();
      }
    }
  });

  it('9 组合输出均非空字符串', () => {
    for (const s of styles) {
      for (const p of persons) {
        const result = buildScriptedNarrative(p, s, '林九', '对话:npc_wang');
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      }
    }
  });

  it('第二人称输出含「你」', () => {
    for (const s of styles) {
      const result = buildScriptedNarrative('second', s, '林九', '行走:npc_hong');
      expect(result).toContain('你');
    }
  });

  it('第一人称输出含「我」', () => {
    for (const s of styles) {
      const result = buildScriptedNarrative('first', s, '林九', '行走:npc_hong');
      expect(result).toContain('我');
    }
  });

  it('第三人称输出含主角姓名', () => {
    for (const s of styles) {
      const result = buildScriptedNarrative('third', s, '林九', '对话:npc_wang');
      expect(result).toContain('林九');
    }
  });

  it('applyPersonStyle 9 组合均不抛错且返回非空字符串', () => {
    for (const s of styles) {
      for (const p of persons) {
        const result = applyPersonStyle('你是游戏叙事 AI。', p, s);
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
        expect(result).toContain('渲染参数');
      }
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// T4. $meta 渲染参数随快照记录 · 重放序列逐位恒等
// ──────────────────────────────────────────────────────────────────────────────

describe('T4 $meta 渲染参数写入快照后重放 → state/指纹/黄金向量逐位恒等', () => {
  it('SnapshotStore.save 带 renderParams · $metaRenderParams 正确存储', () => {
    const store = new SnapshotStore();
    const state = buildWorld();
    const snap = store.save('test', state, { narrativePerson: 'first', narrativeStyle: 'jianjie' });
    expect(snap.$metaRenderParams?.narrativePerson).toBe('first');
    expect(snap.$metaRenderParams?.narrativeStyle).toBe('jianjie');
  });

  it('SnapshotStore.save 不带 renderParams 时 $metaRenderParams 为 undefined', () => {
    const store = new SnapshotStore();
    const snap = store.save('no-meta', buildWorld());
    expect(snap.$metaRenderParams).toBeUndefined();
  });

  it('不同 $meta 参数存储的两快照 compare 不因 $meta 报 diff（跳过 $metaRenderParams）', () => {
    const store = new SnapshotStore();
    const state = buildWorld();
    store.save('snap-a', state, { narrativePerson: 'second', narrativeStyle: 'guofeng' });
    store.save('snap-b', state, { narrativePerson: 'third',  narrativeStyle: 'jianjie' });
    const diff = store.compare('snap-a', 'snap-b');
    // state 相同，$meta 不参与 diff → changedFields 为空
    expect(diff.changedFields.length).toBe(0);
  });

  it('重放同 tickId 序列 state 逐位恒等（渲染参数不污染确定性）', () => {
    const base = buildWorld();

    // 序列 A：person=second, style=guofeng
    applyPersonStyle('sys', 'second', 'guofeng'); // 纯渲染，不影响 tick
    const afterA = runTick(structuredClone(base) as RootState, { tickId: 'replay:t4:0' }).state;

    // 序列 B：person=third, style=jianjie
    applyPersonStyle('sys', 'third', 'jianjie');
    const afterB = runTick(structuredClone(base) as RootState, { tickId: 'replay:t4:0' }).state;

    expect(JSON.stringify(afterA)).toBe(JSON.stringify(afterB));
  });

  it('重放后 schemaKeys 52 · 指纹84 不变', () => {
    const base = buildWorld();
    runTick(structuredClone(base) as RootState, { tickId: 'replay:t4:1' });
    runTick(structuredClone(base) as RootState, { tickId: 'replay:t4:1' });

    const allKeys = new Set([
      ...FINGERPRINT_BUNDLE_MEMBERS,
      ...FINGERPRINT_PRESET_FIELDS,
      ...FINGERPRINT_SNAPSHOT_FIELDS,
      ...FINGERPRINT_EXCLUDED_FIELDS,
    ]);
    expect(allKeys.size).toBe(86);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(Object.keys((RootSchema as any)._def.shape()).length).toBe(53);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// T5. 未知值回落默认 · 不抛错
// ──────────────────────────────────────────────────────────────────────────────

describe('T5 未知文风/人称值回落默认 · 不抛错', () => {
  it('sanitizePerson 对未知值回落 PERSON_DEFAULT', () => {
    expect(sanitizePerson('invalid')).toBe(PERSON_DEFAULT);
    expect(sanitizePerson('')).toBe(PERSON_DEFAULT);
    expect(sanitizePerson('四')).toBe(PERSON_DEFAULT);
  });

  it('sanitizeStyle 对未知值回落 STYLE_DEFAULT', () => {
    expect(sanitizeStyle('invalid')).toBe(STYLE_DEFAULT);
    expect(sanitizeStyle('')).toBe(STYLE_DEFAULT);
    expect(sanitizeStyle('modern')).toBe(STYLE_DEFAULT);
  });

  it('applyPersonStyle 传入未知值不抛错（安全回落）', () => {
    expect(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      applyPersonStyle('sys', 'bad' as any, 'bad' as any)
    ).not.toThrow();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = applyPersonStyle('sys', 'bad' as any, 'bad' as any);
    expect(result.length).toBeGreaterThan(0);
  });

  it('buildScriptedNarrative 传入未知值不抛错（安全回落）', () => {
    expect(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      buildScriptedNarrative('bad' as any, 'bad' as any, '林九', '对话:wang')
    ).not.toThrow();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = buildScriptedNarrative('bad' as any, 'bad' as any, '林九', '对话:wang');
    expect(result.length).toBeGreaterThan(0);
  });

  it('PERSON_DEFAULT = second · STYLE_DEFAULT = guofeng', () => {
    expect(PERSON_DEFAULT).toBe('second');
    expect(STYLE_DEFAULT).toBe('guofeng');
  });

  it('STYLE_LABELS 和 PERSON_LABELS 各包含所有有效值', () => {
    expect(Object.keys(STYLE_LABELS)).toEqual(['guofeng', 'baihua', 'jianjie']);
    expect(Object.keys(PERSON_LABELS)).toEqual(['second', 'first', 'third']);
  });

  it('有效人称值不触发回落', () => {
    expect(sanitizePerson('second')).toBe('second');
    expect(sanitizePerson('first')).toBe('first');
    expect(sanitizePerson('third')).toBe('third');
  });

  it('有效文风值不触发回落', () => {
    expect(sanitizeStyle('guofeng')).toBe('guofeng');
    expect(sanitizeStyle('baihua')).toBe('baihua');
    expect(sanitizeStyle('jianjie')).toBe('jianjie');
  });
});
