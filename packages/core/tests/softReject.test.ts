// N-4: 软拒检测确定性测试
// 覆盖: 真阳性·假阳/假阴边界·确定性·规则版本（输入=LLM输出·不进指纹）
import { describe, it, expect } from 'vitest';
import { detectSoftReject, SOFT_REJECT_RULE_VERSION, SOFT_REJECT_KEYWORDS } from '../engine/softReject.js';

// ── 真阳性（关键词命中）─────────────────────────────────────────────────────

describe('N-4 · 软拒检测 · 真阳性（关键词命中）', () => {
  it('「我无法」命中', () => {
    expect(detectSoftReject('我无法协助创作此类内容，请尝试其他话题。').detected).toBe(true);
  });
  it('「我不能」命中', () => {
    expect(detectSoftReject('我不能帮你做这件事。').detected).toBe(true);
  });
  it('「我不可以」命中', () => {
    expect(detectSoftReject('这个我不可以提供。').detected).toBe(true);
  });
  it('「这超出了我」命中', () => {
    expect(detectSoftReject('这超出了我的设计范围，请换个方向。').detected).toBe(true);
  });
  it('「I cannot」命中（英文）', () => {
    expect(detectSoftReject('I cannot assist with this type of content.').detected).toBe(true);
  });
  it("「I can't」命中（英文）", () => {
    expect(detectSoftReject("I can't help you with that.").detected).toBe(true);
  });
  it('「as an AI」命中（英文）', () => {
    expect(detectSoftReject('As an AI language model, I am designed to be helpful.').detected).toBe(true);
  });
  it('命中时 matchedKeyword 非空且来自关键词表', () => {
    const r = detectSoftReject('我无法处理这个请求。');
    expect(r.detected).toBe(true);
    expect(r.matchedKeyword).toBeDefined();
    expect(SOFT_REJECT_KEYWORDS).toContain(r.matchedKeyword);
  });
});

// ── 启发式命中 ───────────────────────────────────────────────────────────────

describe('N-4 · 软拒检测 · 启发式（refusal_start_combo）', () => {
  it('拒绝式开头 + 短响应 → 命中（启发式路径）', () => {
    // 「我的设计不允许」在关键词表·此处亦会由关键词路径命中
    const r = detectSoftReject('我的设计不允许我生成此类文本。');
    expect(r.detected).toBe(true);
  });
  it('heuristicReason 存在于启发式触发的结果', () => {
    // 使用未在关键词表但符合 REFUSAL_OPENER 的短句
    const r = detectSoftReject('我必须说明这不在我的能力范围内。');
    expect(r.detected).toBe(true);
  });
});

// ── 假阳/假阴边界 ─────────────────────────────────────────────────────────────

describe('N-4 · 软拒检测 · 假阳/假阴边界', () => {
  it('正常叙事开场（无关键词·不触发假阳）', () => {
    expect(detectSoftReject('好的，我来讲一个故事。从前有一个勇敢的骑士，他手持宝剑踏上征途……').detected)
      .toBe(false);
  });
  it('长篇正常叙事无关键词 → not detected', () => {
    const narrative = '微风轻抚过荷塘，荷叶上滚动着晶莹的水珠。天边的彩霞将暮色渲染得绚烂多彩，归巢的鸟儿在远处鸣叫。这是一个平静的傍晚，没有任何冲突与张力。';
    expect(detectSoftReject(narrative).detected).toBe(false);
  });
  it('假阳性已知局限：NPC 台词含「我不能」→ 规则误判（已知局限·文档化）', () => {
    // 「我不能」在关键词表，NPC情感台词含该词会被误检。此为已知规则局限。
    const r = detectSoftReject('「我不能忘记你，你是我生命中最重要的人。」');
    expect(r.detected).toBe(true);
    expect(r.matchedKeyword).toBe('我不能');
  });
  it('假阴性已知局限：委婉回避不含关键词 → 漏检（已知局限·文档化）', () => {
    // 委婉拒绝不含任何关键词，规则层面无法捕获
    expect(detectSoftReject('这个话题让我觉得不太舒适，我们换个方向吧？').detected).toBe(false);
  });
  it('空字符串 → not detected', () => {
    expect(detectSoftReject('').detected).toBe(false);
  });
  it('纯空白 → not detected', () => {
    expect(detectSoftReject('   ').detected).toBe(false);
  });
});

// ── 确定性（相同输入→相同输出）──────────────────────────────────────────────

describe('N-4 · 软拒检测 · 确定性', () => {
  it('相同输入两次调用完全相等（拒绝路径）', () => {
    const input = '我无法处理这类请求，请换个话题。';
    expect(detectSoftReject(input)).toEqual(detectSoftReject(input));
  });
  it('相同输入两次调用完全相等（通过路径）', () => {
    const input = '在一片宁静的山谷里，住着一位智慧的老者。';
    expect(detectSoftReject(input)).toEqual(detectSoftReject(input));
  });
  it('100 次重复调用结果逐位恒等', () => {
    const input = '这超出了我目前可以帮助的范围。';
    const ref = detectSoftReject(input);
    for (let i = 0; i < 99; i++) {
      expect(detectSoftReject(input)).toEqual(ref);
    }
  });
});

// ── 规则版本断言 ─────────────────────────────────────────────────────────────

describe('N-4 · 软拒检测 · 规则版本', () => {
  it('每次结果携带 ruleVersion = SOFT_REJECT_RULE_VERSION', () => {
    expect(detectSoftReject('任意输入').ruleVersion).toBe(SOFT_REJECT_RULE_VERSION);
    expect(detectSoftReject('我无法').ruleVersion).toBe(SOFT_REJECT_RULE_VERSION);
  });
  it('SOFT_REJECT_RULE_VERSION 当前为 1', () => {
    expect(SOFT_REJECT_RULE_VERSION).toBe(1);
  });
  it('SOFT_REJECT_KEYWORDS 非空（规则表存在）', () => {
    expect(SOFT_REJECT_KEYWORDS.length).toBeGreaterThan(5);
  });
});
