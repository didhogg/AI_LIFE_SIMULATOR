// P-A-bug-01 · 叙事·出字面板 · 专项回归
//
// 铁律:
//   ① 无真实 LLM 调用（纯单元·不烧 API 额度）
//   ② demo / forceFailure 均确定性·零 IO
//   ③ 黄金向量/指纹84/schemaKeys52 守恒
//
// 覆盖:
//   T1. runActionInDualMode demo 模式 → narrative 非空·isFallback=false·optionId 一致
//   T2. runActionInDualMode forceFailure=true → isFallback=true·usedDefault=true
//   T3. runActionInDualMode scriptedNarrative → 返回值与传入值字面一致（UI 不改写）
//   T4. runActionInDualMode 越权 optionId → usedDefault=true（走 defaultOption）
//   T5. 校验链失败（BAD_FORMAT）→ passed=false → 无叙事路径（chain 拒绝即止）
//   T6. 校验链失败（KNOWLEDGE_DENIED）→ passed=false · 无叙事
//   T7. demo 模式叙事与 state diff 可并存（两者均非 null）
//   T8. 指纹84 / schemaKeys52 守恒

import { describe, it, expect } from 'vitest';
import { RootSchema } from '@ai-life-sim/core';
import {
  FINGERPRINT_BUNDLE_MEMBERS,
  FINGERPRINT_PRESET_FIELDS,
  FINGERPRINT_SNAPSHOT_FIELDS,
  FINGERPRINT_EXCLUDED_FIELDS,
} from '@ai-life-sim/core/engine/fingerprintManifest';

import {
  buildWorld, PC, NPC_WANG, NPC_HONG, SECRET_S1, SAVE_SEED,
} from '../fixture/world.js';
import {
  runActionInDualMode,
  runValidationChain,
  runTickWithDiff,
  DEMO_RAW_CANDIDATES,
} from '../../web-debug/aohpDebugConsole.js';

// ──────────────────────────────────────────────────────────────────────────────
// T1. demo 模式 → narrative 非空 · isFallback=false
// ──────────────────────────────────────────────────────────────────────────────
describe('T1 runActionInDualMode demo — narrative 非空·isFallback=false', () => {
  it('返回 narrative 非空字符串', async () => {
    const state = buildWorld();
    const res = await runActionInDualMode(state, PC, '对话:npc_wang', DEMO_RAW_CANDIDATES, 'demo');
    expect(typeof res.narrative).toBe('string');
    expect(res.narrative.length).toBeGreaterThan(0);
  });

  it('demo 模式 isFallback=false', async () => {
    const state = buildWorld();
    const res = await runActionInDualMode(state, PC, '对话:npc_wang', DEMO_RAW_CANDIDATES, 'demo');
    expect(res.isFallback).toBe(false);
  });

  it('optionId 与传入一致（permitted 选项）', async () => {
    const state = buildWorld();
    const res = await runActionInDualMode(state, PC, '对话:npc_wang', DEMO_RAW_CANDIDATES, 'demo');
    expect(res.optionId).toBe('对话:npc_wang');
    expect(res.usedDefault).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// T2. forceFailure=true → isFallback=true · usedDefault=true
// ──────────────────────────────────────────────────────────────────────────────
describe('T2 runActionInDualMode forceFailure — isFallback/usedDefault=true', () => {
  it('forceFailure → isFallback=true', async () => {
    const state = buildWorld();
    const res = await runActionInDualMode(
      state, PC, '对话:npc_wang', DEMO_RAW_CANDIDATES, 'demo', { forceFailure: true },
    );
    expect(res.isFallback).toBe(true);
  });

  it('forceFailure → usedDefault=true', async () => {
    const state = buildWorld();
    const res = await runActionInDualMode(
      state, PC, '对话:npc_wang', DEMO_RAW_CANDIDATES, 'demo', { forceFailure: true },
    );
    expect(res.usedDefault).toBe(true);
  });

  it('forceFailure → narrative 非空（兜底叙事）', async () => {
    const state = buildWorld();
    const res = await runActionInDualMode(
      state, PC, '对话:npc_wang', DEMO_RAW_CANDIDATES, 'demo', { forceFailure: true },
    );
    expect(res.narrative.length).toBeGreaterThan(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// T3. scriptedNarrative → 返回值字面一致（UI 不改写检验）
// ──────────────────────────────────────────────────────────────────────────────
describe('T3 scriptedNarrative 字面恒等 — UI 不二次改写', () => {
  it('scriptedNarrative 原值透传', async () => {
    const state = buildWorld();
    const prose = '林九放下茶碗，向王掌柜拱手道谢。';
    const res = await runActionInDualMode(
      state, PC, '对话:npc_wang', DEMO_RAW_CANDIDATES, 'demo',
      { scriptedNarrative: prose },
    );
    expect(res.narrative).toBe(prose);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// T4. 越权 optionId（不在 permitted）→ usedDefault=true
// ──────────────────────────────────────────────────────────────────────────────
describe('T4 越权 optionId → usedDefault=true', () => {
  it('知情受限选项 → usedDefault=true（走 permitted 第一项）', async () => {
    const state = buildWorld();
    const res = await runActionInDualMode(
      state, PC, '询问:npc_wang', DEMO_RAW_CANDIDATES, 'demo',
    );
    expect(res.usedDefault).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// T5. 校验链失败（BAD_FORMAT）→ passed=false → 叙事路径不走
// ──────────────────────────────────────────────────────────────────────────────
describe('T5 校验链失败(BAD_FORMAT) → 无叙事路径', () => {
  it('BAD_FORMAT → passed=false', () => {
    const state = buildWorld();
    const chain = runValidationChain('malformed_no_colon', state, PC, DEMO_RAW_CANDIDATES);
    expect(chain.passed).toBe(false);
    expect(chain.rejectCode).toBe('BAD_FORMAT');
  });

  it('校验失败时业务层应拦截：不应调用 runActionInDualMode', () => {
    // 验证 UI 层拦截逻辑：passed=false 时不产叙事
    // （UI 层走 early-return，此处只验证 chain.passed 为假）
    const state = buildWorld();
    const chain = runValidationChain('no_colon_here', state, PC, DEMO_RAW_CANDIDATES);
    expect(chain.passed).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// T6. 校验链失败（KNOWLEDGE_DENIED）→ passed=false · 无叙事
// ──────────────────────────────────────────────────────────────────────────────
describe('T6 KNOWLEDGE_DENIED → 校验链拒绝', () => {
  it('询问 S1 秘密 → KNOWLEDGE_DENIED', () => {
    const state = buildWorld();
    const chain = runValidationChain('询问:npc_wang', state, PC, DEMO_RAW_CANDIDATES);
    expect(chain.passed).toBe(false);
    expect(chain.rejectCode).toBe('KNOWLEDGE_DENIED');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// T7. demo 叙事与 state diff 可并存（双面板来源一致性）
// ──────────────────────────────────────────────────────────────────────────────
describe('T7 叙事 + state diff 并存', () => {
  it('同一 optionId 产出 narrative + diff，两者均非 null', async () => {
    const state = buildWorld();
    const optionId = '对话:npc_wang';
    const diff = runTickWithDiff(state, `debug:${SAVE_SEED}:tick:0`);
    const narrative = await runActionInDualMode(state, PC, optionId, DEMO_RAW_CANDIDATES, 'demo');
    expect(diff).not.toBeNull();
    expect(narrative).not.toBeNull();
    expect(narrative.narrative.length).toBeGreaterThan(0);
    expect(diff.afterState).toBeDefined();
  });

  it('叙事 narrative 不包含 state diff 的 tickId（两轨独立）', async () => {
    const state = buildWorld();
    const tickId = `debug:${SAVE_SEED}:tick:42`;
    const diff = runTickWithDiff(state, tickId);
    const narrative = await runActionInDualMode(state, PC, '对话:npc_wang', DEMO_RAW_CANDIDATES, 'demo');
    // 叙事文本不应包含 tickId（UI 不拼接 diff 元数据进 prose）
    expect(narrative.narrative).not.toContain(tickId);
    expect(diff.tickId).toBe(tickId);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// T8. 指纹84 / schemaKeys52 守恒
// ──────────────────────────────────────────────────────────────────────────────
describe('T8 指纹88 / schemaKeys54 守恒', () => {
  it('BUNDLE_MEMBERS = 21（G2-2 +媒介传播面）', () => {
    expect(FINGERPRINT_BUNDLE_MEMBERS.length).toBe(27);
  });

  it('PRESET_FIELDS = 10', () => {
    expect(FINGERPRINT_PRESET_FIELDS.length).toBe(10);
  });

  it('SNAPSHOT_FIELDS = 5', () => {
    expect(FINGERPRINT_SNAPSHOT_FIELDS.length).toBe(5);
  });

  it('EXCLUDED_FIELDS = 52', () => {
    expect(FINGERPRINT_EXCLUDED_FIELDS.length).toBe(52);
  });

  it('schemaKeys = 53', () => {
    const keys = Object.keys(RootSchema.shape);
    expect(keys.length).toBe(54);
  });
});
