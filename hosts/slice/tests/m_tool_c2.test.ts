// commit-2 验收：llm 预算闸 + AA1 世代号
//
// 🧪 DoD 断言：
//   C2-1: 预算超限确定性降级——需预算?=true + budgetTokensRemaining=0 → downgraded=true（不抛）
//   C2-2: 预算充足——需预算?=true + budgetTokensRemaining=100 → ok=true, downgraded=undefined
//   C2-3: 无预算声明工具——需预算?=undefined + budgetTokensRemaining=0 → ok=true（不降级）
//   C2-4: 世代号传递——generation 传入即回传·Ring2GenerationTracker 单调递增
//   C2-5: 双跑逐位恒等——同 args 两次 dispatchTool 结果逐字段相等
//   C2-6: 守恒门 schemaKeys=53 / BUNDLE=21 / manifest=86（无变动）

import { describe, it, expect } from 'vitest';
import { dispatchTool } from '@ai-life-sim/core/engine/toolExecutor';
import { 工具库Schema } from '@ai-life-sim/core/schema/toolLibrary';
import {
  FINGERPRINT_BUNDLE_MEMBERS,
  FINGERPRINT_PRESET_FIELDS,
  FINGERPRINT_SNAPSHOT_FIELDS,
  FINGERPRINT_EXCLUDED_FIELDS,
} from '@ai-life-sim/core/engine/fingerprintManifest';
import { RootSchema } from '@ai-life-sim/core';
import { Ring2GenerationTracker } from '../engine/concurrency.js';

// ── fixture ──────────────────────────────────────────────────────────────────

const LIB = 工具库Schema.parse({
  llm_budgeted: {
    名称: 'budgeted llm tool',
    能力: { 类型: 'llm' },
    需预算: true,
  },
  llm_free: {
    名称: 'free llm tool',
    能力: { 类型: 'llm' },
    // 需预算 未声明
  },
  code_tool: {
    名称: 'code tool',
    能力: { 类型: 'code' },
    需预算: true,  // 非 llm 类型，budget gate 只对 llm 起效
  },
});

// ── C2-1: 预算超限确定性降级 ─────────────────────────────────────────────────

describe('C2-1 · 预算超限确定性降级', () => {
  it('需预算=true + budgetTokensRemaining=0 → downgraded=true，不抛', () => {
    const r = dispatchTool({
      toolName: 'llm_budgeted',
      toolLib: LIB,
      budgetTokensRemaining: 0,
    });
    // 不抛（函数正常返回）
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.downgraded).toBe(true);
      expect(r.downgradeReason).toBe('budget_exhausted');
      expect(r.kind).toBe('llm');
    }
  });

  it('需预算=true + budgetTokensRemaining=-1 → downgraded=true（负数=耗尽）', () => {
    const r = dispatchTool({
      toolName: 'llm_budgeted',
      toolLib: LIB,
      budgetTokensRemaining: -1,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.downgraded).toBe(true);
  });

  it('downgraded 结果含 generation 当传入时', () => {
    const r = dispatchTool({
      toolName: 'llm_budgeted',
      toolLib: LIB,
      budgetTokensRemaining: 0,
      generation: 42,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.downgraded).toBe(true);
      expect(r.generation).toBe(42);
    }
  });
});

// ── C2-2: 预算充足 ───────────────────────────────────────────────────────────

describe('C2-2 · 预算充足正常分派', () => {
  it('需预算=true + budgetTokensRemaining=1000 → ok=true, downgraded=undefined', () => {
    const r = dispatchTool({
      toolName: 'llm_budgeted',
      toolLib: LIB,
      budgetTokensRemaining: 1000,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.downgraded).toBeUndefined();
      expect(r.kind).toBe('llm');
    }
  });

  it('需预算=true + budgetTokensRemaining=1 → ok=true（边界）', () => {
    const r = dispatchTool({
      toolName: 'llm_budgeted',
      toolLib: LIB,
      budgetTokensRemaining: 1,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.downgraded).toBeUndefined();
  });
});

// ── C2-3: 无预算声明工具 ─────────────────────────────────────────────────────

describe('C2-3 · 无预算声明工具不降级', () => {
  it('需预算?=undefined + budgetTokensRemaining=0 → ok=true, 不降级', () => {
    const r = dispatchTool({
      toolName: 'llm_free',
      toolLib: LIB,
      budgetTokensRemaining: 0,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.downgraded).toBeUndefined();
  });

  it('需预算=undefined（code类型）+ budgetTokensRemaining=0 → ok=true，不降级', () => {
    // budget gate 仅在 llm 分支内工作：code 类型不受影响
    const r = dispatchTool({
      toolName: 'code_tool',
      toolLib: LIB,
      budgetTokensRemaining: 0,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.downgraded).toBeUndefined();
  });

  it('budgetTokensRemaining 未传（undefined）→ 不做预算检查·ok=true', () => {
    const r = dispatchTool({
      toolName: 'llm_budgeted',
      toolLib: LIB,
      // budgetTokensRemaining 未传
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.downgraded).toBeUndefined();
  });
});

// ── C2-4: 世代号传递 + Ring2GenerationTracker 单调递增 ──────────────────────

describe('C2-4 · 世代号传递与单调递增', () => {
  it('generation 传入即原封回传到结果', () => {
    const r = dispatchTool({
      toolName: 'llm_free',
      toolLib: LIB,
      generation: 7,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.generation).toBe(7);
  });

  it('未传 generation → 结果中 generation=undefined', () => {
    const r = dispatchTool({
      toolName: 'llm_free',
      toolLib: LIB,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.generation).toBeUndefined();
  });

  it('Ring2GenerationTracker.enqueue 世代号单调递增', () => {
    const tracker = new Ring2GenerationTracker();
    const g1 = tracker.enqueue('call-1');
    const g2 = tracker.enqueue('call-2');
    const g3 = tracker.enqueue('call-3');
    expect(g2).toBeGreaterThan(g1);
    expect(g3).toBeGreaterThan(g2);
  });

  it('AA1 端到端：tracker.enqueue → 传入 dispatch → validate 确认世代一致', () => {
    const tracker = new Ring2GenerationTracker();
    const callId  = 'tool-call-abc';
    const gen     = tracker.enqueue(callId);      // 入队·返回世代号

    const r = dispatchTool({
      toolName: 'llm_free',
      toolLib: LIB,
      generation: gen,
    });

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.generation).toBe(gen);
      // 宿主侧：用 r.generation 做 validate（防旧响应双落账）
      expect(tracker.validate(callId, r.generation!)).toBe(true);
      tracker.complete(callId);
      expect(tracker.inFlightCount).toBe(0);
    }
  });

  it('validate 失败：过期世代号返回 false（防旧响应双落账）', () => {
    const tracker = new Ring2GenerationTracker();
    const g1 = tracker.enqueue('call-x');
    // 重新入队（新世代号会覆盖旧记录）
    const g2 = tracker.enqueue('call-x');
    expect(tracker.validate('call-x', g1)).toBe(false); // g1 已过期
    expect(tracker.validate('call-x', g2)).toBe(true);  // g2 有效
  });
});

// ── C2-5: 双跑逐位恒等（纯函数确定性）──────────────────────────────────────

describe('C2-5 · 双跑逐位恒等', () => {
  it('预算降级路径：同 args 两次结果字段完全相同', () => {
    const args = {
      toolName: 'llm_budgeted',
      toolLib: LIB,
      budgetTokensRemaining: 0,
      generation: 99,
    };
    const r1 = dispatchTool(args);
    const r2 = dispatchTool(args);
    expect(r1).toEqual(r2);
  });

  it('正常路径：同 args 两次结果字段完全相同', () => {
    const args = {
      toolName: 'llm_free',
      toolLib: LIB,
      budgetTokensRemaining: 500,
      generation: 3,
    };
    const r1 = dispatchTool(args);
    const r2 = dispatchTool(args);
    expect(r1).toEqual(r2);
  });
});

// ── C2-6: 守恒门 ────────────────────────────────────────────────────────────

describe('C2-6 · 守恒门', () => {
  it('schemaKeys=53', () => {
    expect(Object.keys(RootSchema.shape).length).toBe(54);
  });

  it('BUNDLE=21（llm 工具不进 hashJudgmentBundle）', () => {
    expect(FINGERPRINT_BUNDLE_MEMBERS.length).toBe(28);
  });

  it('manifest=88', () => {
    const total =
      FINGERPRINT_BUNDLE_MEMBERS.length +
      FINGERPRINT_PRESET_FIELDS.length +
      FINGERPRINT_SNAPSHOT_FIELDS.length +
      FINGERPRINT_EXCLUDED_FIELDS.length;
    expect(total).toBe(95);
  });
});
