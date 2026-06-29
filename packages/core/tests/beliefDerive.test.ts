// R3-b: beliefDerive 极性结构化验收测试
// 覆盖：polaritySign / oppositePolarityStr / deriveBeliefState R层直读结构

import { describe, it, expect } from 'vitest';
import {
  polaritySign,
  oppositePolarityStr,
  deriveBeliefState,
} from '@ai-life-sim/core/engine/beliefDerive';

// ── polaritySign ──────────────────────────────────────────────────────────────

describe('polaritySign · 极性枚举→数值符号', () => {
  it('负 → -1', () => expect(polaritySign('负')).toBe(-1));
  it('中负 → -1', () => expect(polaritySign('中负')).toBe(-1));
  it('正 → +1', () => expect(polaritySign('正')).toBe(1));
  it('中正 → +1', () => expect(polaritySign('中正')).toBe(1));
  it('中 → 0', () => expect(polaritySign('中')).toBe(0));
  it('undefined → 0（fail-safe）', () => expect(polaritySign(undefined)).toBe(0));
  it('空串 → 0（fail-safe）', () => expect(polaritySign('')).toBe(0));

  it('同极同向：两条都正→两个符号都 +1（不被强行反向）', () => {
    expect(polaritySign('正')).toBe(1);
    expect(polaritySign('中正')).toBe(1);
  });

  it('同极同向：两条都负→两个符号都 -1（不被强行反向）', () => {
    expect(polaritySign('负')).toBe(-1);
    expect(polaritySign('中负')).toBe(-1);
  });
});

// ── oppositePolarityStr ───────────────────────────────────────────────────────

describe('oppositePolarityStr · 极性字符串取反', () => {
  it('正 ↔ 负', () => {
    expect(oppositePolarityStr('正')).toBe('负');
    expect(oppositePolarityStr('负')).toBe('正');
  });
  it('中正 ↔ 中负', () => {
    expect(oppositePolarityStr('中正')).toBe('中负');
    expect(oppositePolarityStr('中负')).toBe('中正');
  });
  it('中 → 空串（中性无对立）', () => expect(oppositePolarityStr('中')).toBe(''));
  it('未知字符串 → 空串（fail-safe）', () => expect(oppositePolarityStr('未知')).toBe(''));
});

// ── deriveBeliefState · R 层直读极性结构 ─────────────────────────────────────

describe('deriveBeliefState · R层结构化极性·零子串裁决', () => {
  // 暴露用例：极性字段='负' 但标签不含'负'字 → 仍推断出警惕（读结构非读串）
  it('暴露用例·极性字段=负 但标签="慷慨" → 推断警惕（引擎读 极性 字段非字符串匹配）', () => {
    const cog = {
      npc_a: {
        印象: [{ 标签: '慷慨', 极性: '负', 强度: 80 }],
      },
    };
    const { 推理 } = deriveBeliefState(cog, {}, 'pc');
    expect(推理.length).toBe(1);
    expect(推理[0]!.inference).toContain('需保持警惕');
  });

  it('极性=正 → 推断信任（含 中正）', () => {
    for (const pol of ['正', '中正'] as const) {
      const cog = { npc_a: { 印象: [{ 标签: '声誉', 极性: pol, 强度: 90 }] } };
      const { 推理 } = deriveBeliefState(cog, {}, 'pc');
      expect(推理.length).toBe(1);
      expect(推理[0]!.inference).toContain('是可信任的对象');
    }
  });

  it('极性=负·中负 → 推断警惕（中间档不漏）', () => {
    for (const pol of ['负', '中负'] as const) {
      const cog = { npc_a: { 印象: [{ 标签: '声誉', 极性: pol, 强度: 90 }] } };
      const { 推理 } = deriveBeliefState(cog, {}, 'pc');
      expect(推理.length).toBe(1);
      expect(推理[0]!.inference).toContain('需保持警惕');
    }
  });

  it('极性=中 → 不产生推理（中性印象不推断立场）', () => {
    const cog = { npc_a: { 印象: [{ 标签: '声誉', 极性: '中', 强度: 90 }] } };
    const { 推理 } = deriveBeliefState(cog, {}, 'pc');
    expect(推理.length).toBe(0);
  });

  it('极性缺失(undefined) → fail-safe 不推理（不 crash）', () => {
    const cog = { npc_a: { 印象: [{ 标签: '声誉', 强度: 90 }] } };
    const { 推理 } = deriveBeliefState(cog as any, {}, 'pc');
    expect(推理.length).toBe(0);
  });

  it('感知条目的极性字段直接携带·fact 仅为标签文本（无嵌入极性串）', () => {
    const cog = { npc_a: { 印象: [{ 标签: '威胁', 极性: '负', 强度: 85 }] } };
    const { 感知 } = deriveBeliefState(cog, {}, 'pc');
    expect(感知.length).toBe(1);
    expect(感知[0]!.fact).toBe('威胁');         // 纯标签·不含极性中文串
    expect(感知[0]!.极性).toBe('负');           // 结构字段独立携带
    expect(感知[0]!.fact).not.toContain('（');  // 无旧 stringify 痕迹
  });

  it('强度低于 trust_threshold → 不进入推理（R层阈值门控仍有效）', () => {
    // belief_trust_threshold 默认 60；强度 50 ≤ 60 → 不推理
    const cog = { npc_a: { 印象: [{ 标签: '声誉', 极性: '负', 强度: 50 }] } };
    const { 推理 } = deriveBeliefState(cog, {}, 'pc');
    expect(推理.length).toBe(0);
  });
});
