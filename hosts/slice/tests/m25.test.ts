// M2.5 + M2.6 覆盖性闸集成测试
// M2.5: 汉字金额识别 + Arabic 不回归
// M2.6: 单位识别 + fail-closed（单位非文→不可确认→covered:false）
import { describe, it, expect } from 'vitest';
import { gateCoverage } from '../ledger/gate.js';
import { TickProposalSchema } from '../ledger/proposalSchema.js';

function makeP(amounts: number[]) {
  return TickProposalSchema.parse({
    transfers: amounts.map((a, i) => ({ from: `a${i}`, to: `b${i}`, amount: a, reason: '' })),
  });
}

// ── M2.5: 阿拉伯数字不回归 ────────────────────────────────────────────────────

describe('Gate③ M2.5: 阿拉伯数字不回归', () => {
  it('叙事「2文」提案「2」→ covered:true', () => {
    expect(gateCoverage('给了2文小费', makeP([2])).covered).toBe(true);
  });

  it('叙事「50文」提案「50」→ covered:true', () => {
    expect(gateCoverage('账单50文', makeP([50])).covered).toBe(true);
  });

  it('叙事「2文」提案「50」→ covered:false, missing=[2]', () => {
    const r = gateCoverage('给了2文小费', makeP([50]));
    expect(r.covered).toBe(false);
    if (!r.covered) {
      expect(r.missing).toContain(2);
      expect(r.reason).toBeUndefined(); // 单位正确，是数值漏项
    }
  });

  it('叙事无金额 → covered:true', () => {
    expect(gateCoverage('大家休息', makeP([])).covered).toBe(true);
  });
});

// ── M2.5: 汉字金额识别 ────────────────────────────────────────────────────────

describe('Gate③ M2.5: 汉字金额识别', () => {
  it('「两文铜钱」提案单「50文」→ 漏项 [2]', () => {
    const r = gateCoverage('林九从钱袋里掏出两文铜钱，递给红姨。', makeP([50]));
    expect(r.covered).toBe(false);
    if (!r.covered) {
      expect(r.missing).toContain(2);
      expect(r.reason).toBeUndefined();
    }
  });

  it('「两文铜钱」提案单「2」→ covered:true', () => {
    expect(gateCoverage('林九掏出两文铜钱给红姨。', makeP([2])).covered).toBe(true);
  });

  it('「三文」提案「3」→ covered:true', () => {
    expect(gateCoverage('打赏三文', makeP([3])).covered).toBe(true);
  });

  it('「十文」提案「10」→ covered:true', () => {
    expect(gateCoverage('酒钱十文', makeP([10])).covered).toBe(true);
  });

  it('「叁佰文」提案「300」→ covered:true（中性叙事，无语义标记词）', () => {
    // M2.7: 「欠款」含债权词 → 改用中性叙事；债权用例见 m27.test.ts
    expect(gateCoverage('花了叁佰文', makeP([300])).covered).toBe(true);
  });

  it('混合「两文…10文」提案「2,10」→ covered:true', () => {
    expect(
      gateCoverage('先给两文定金，后付10文尾款', makeP([2, 10])).covered
    ).toBe(true);
  });

  it('混合「两文…10文」提案只有「10」→ 漏 2', () => {
    const r = gateCoverage('先给两文定金，后付10文尾款', makeP([10]));
    expect(r.covered).toBe(false);
    if (!r.covered) expect(r.missing).toContain(2);
  });
});

// ── M2.6: 单位不可确认 → fail-closed ─────────────────────────────────────────

describe('Gate③ M2.6: 单位不可确认（fail-closed）', () => {
  it('「三百块」提案「300」→ 单位不可确认→covered:false', () => {
    const r = gateCoverage('花了三百块', makeP([300]));
    expect(r.covered).toBe(false);
    if (!r.covered) {
      expect(r.reason).toBe('单位不可确认');
      expect(r.missing).toEqual([]); // 非数值漏项，是单位问题
    }
  });

  it('「三百块」提案空 → 同样 covered:false（不得 fail-open）', () => {
    const r = gateCoverage('花了三百块', makeP([]));
    expect(r.covered).toBe(false);
    if (!r.covered) expect(r.reason).toBe('单位不可确认');
  });

  it('「50块」→ 单位不可确认', () => {
    const r = gateCoverage('付了50块', makeP([50]));
    expect(r.covered).toBe(false);
    if (!r.covered) expect(r.reason).toBe('单位不可确认');
  });

  it('「一贯钱」→ 单位不可确认', () => {
    const r = gateCoverage('欠了一贯钱', makeP([]));
    expect(r.covered).toBe(false);
    if (!r.covered) expect(r.reason).toBe('单位不可确认');
  });

  it('混合「2文 + 三百块」→ 不可确认单位优先→covered:false', () => {
    // 即使 2文 正确，只要存在不可确认单位就整体 fail-closed
    const r = gateCoverage('给了2文，还花了三百块', makeP([2]));
    expect(r.covered).toBe(false);
    if (!r.covered) expect(r.reason).toBe('单位不可确认');
  });
});

// ── 降级路径（重写后仍不符 → degraded:true）────────────────────────────────

describe('Gate③: 降级路径不崩', () => {
  it('文单位漏项：首次 covered:false，missing 可追踪，degraded=false', () => {
    const r = gateCoverage('林九掏出两文铜钱给红姨。', makeP([]));
    expect(r.covered).toBe(false);
    if (!r.covered) {
      expect(r.missing).toContain(2);
      expect(r.degraded).toBe(false);
      expect(r.reason).toBeUndefined();
    }
  });

  it('文单位：调用方重试仍失败后标 degraded:true — 结构合法不崩', () => {
    const r = gateCoverage('林九掏出两文铜钱给红姨。', makeP([]));
    expect(r.covered).toBe(false);
    if (!r.covered) {
      const degraded = { ...r, degraded: true as const };
      expect(degraded.degraded).toBe(true);
      expect(degraded.missing.length).toBeGreaterThan(0);
    }
  });

  it('不可确认单位：调用方重试仍失败后标 degraded:true — 结构合法不崩', () => {
    const r = gateCoverage('花了三百块', makeP([300]));
    expect(r.covered).toBe(false);
    if (!r.covered) {
      const degraded = { ...r, degraded: true as const };
      expect(degraded.degraded).toBe(true);
      expect(degraded.reason).toBe('单位不可确认');
    }
  });
});
