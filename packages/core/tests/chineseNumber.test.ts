// M2.7 中文数字解析器 — 规则版本 3
// 单元 + 回归测试（无 LLM 调用）
import { describe, it, expect } from 'vitest';
import {
  parseChineseAmount,
  extractMoneyAmounts,
  prepareNarrative,
  isCanonicalUnit,
  CANONICAL_UNITS,
  RE_CHANGE_GIVING,
  RE_DEBT,
  RE_ADVANCE,
  RE_TOTAL,
  CHINESE_NUMBER_RULE_VERSION,
  type MoneyAmount,
} from '../engine/text/chineseNumber.js';

// ── 版本常量 ──────────────────────────────────────────────────────────────────
describe('规则版本', () => {
  it('CHINESE_NUMBER_RULE_VERSION = 3（M2.7 语义词表 + 入口归一 bump）', () => {
    expect(CHINESE_NUMBER_RULE_VERSION).toBe(3);
  });
});

// ── prepareNarrative：入口归一（M2.7）─────────────────────────────────────────

describe('prepareNarrative: NFKC 归一', () => {
  it('全角数字 ５０ → 半角 50', () => {
    expect(prepareNarrative('５０文')).toBe('50文');
  });

  it('全角空格（U+3000）→ 普通空格', () => {
    // 5[ideographic-space]0[ideographic-space]文 → 5[space]0[space]文
    expect(prepareNarrative('5　0　文')).toBe('50 文');
  });

  it('ASCII 数字间空格折叠 → 紧邻', () => {
    expect(prepareNarrative('5 0 文')).toBe('50 文');
  });

  it('三段数字空格折叠（两遍）', () => {
    expect(prepareNarrative('1 2 3 文')).toBe('123 文');
  });

  it('全角括号 （50文） → 半角 (50文)', () => {
    expect(prepareNarrative('（50文）')).toBe('(50文)');
  });

  it('零宽字符去除', () => {
    // U+200B between chars
    expect(prepareNarrative('50文')).toBe('50文');
  });

  it('trim 首尾空白', () => {
    expect(prepareNarrative('  50文  ')).toBe('50文');
  });

  it('幂等：多次归一结果相同', () => {
    const once  = prepareNarrative('５０文');
    const twice = prepareNarrative(once);
    expect(once).toBe(twice);
  });
});

// ── extractMoneyAmounts：NFKC 召回（M2.7 新增）──────────────────────────────

describe('extractMoneyAmounts: NFKC 全角召回（M2.7）', () => {
  it('全角数字 「５０文」→ [{value:50, unit:"文"}]', () => {
    expect(extractMoneyAmounts('花了５０文'))
      .toEqual<MoneyAmount[]>([{ value: 50, unit: '文' }]);
  });

  it('全角空格 「5　0　文」→ [{value:50, unit:"文"}]（NFKC+折叠）', () => {
    expect(extractMoneyAmounts('花了5　0　文'))
      .toEqual<MoneyAmount[]>([{ value: 50, unit: '文' }]);
  });

  it('全角括号 「（50文）」→ [{value:50, unit:"文"}]', () => {
    expect(extractMoneyAmounts('（50文）'))
      .toEqual<MoneyAmount[]>([{ value: 50, unit: '文' }]);
  });

  it('「5 两」（普通空格）→ [{value:5, unit:两}] 仍走 fail-closed', () => {
    const r = extractMoneyAmounts('5 两');
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ value: 5 });
    expect(isCanonicalUnit(r[0]!.unit)).toBe(false);
  });
});

// ── 语义词表（M2.7）──────────────────────────────────────────────────────────

describe('RE_CHANGE_GIVING：找零/退你方向词', () => {
  it.each([
    '找你三十文', '找零', '找了零', '退你', '退给了', '找他',
  ])('"%s" 命中', (s) => expect(RE_CHANGE_GIVING.test(s)).toBe(true));

  it.each([
    '给了三十文', '借了', '一共三百文', '付了五十文',
  ])('"%s" 不命中', (s) => expect(RE_CHANGE_GIVING.test(s)).toBe(false));
});

describe('RE_DEBT：债权词', () => {
  it.each([
    '赊账', '赊了三十文', '赊的', '欠款三百', '欠了五文', '欠着', '借了钱', '借给了',
  ])('"%s" 命中', (s) => expect(RE_DEBT.test(s)).toBe(true));

  it.each([
    '借此机会', '借道', '给了三十文', '付了五十文',
  ])('"%s" 不命中', (s) => expect(RE_DEBT.test(s)).toBe(false));
});

describe('RE_ADVANCE：代付词', () => {
  it.each([
    '垫付五十文', '代付了', '先垫了', '帮付了',
  ])('"%s" 命中', (s) => expect(RE_ADVANCE.test(s)).toBe(true));

  it.each([
    '给了五十文', '借了', '找你',
  ])('"%s" 不命中', (s) => expect(RE_ADVANCE.test(s)).toBe(false));
});

describe('RE_TOTAL：总价词 + 数字 lookahead', () => {
  it.each([
    '一共三百文', '共计50文', '合计三百文', '总计200文', '共三百两',
    '价银共二百两',  // 测试用例（spec 原文）
  ])('"%s" 命中', (s) => expect(RE_TOTAL.test(s)).toBe(true));

  it.each([
    '大家共同出资', '共享', '共欢乐',
  ])('"%s" 不命中（数字 lookahead 未匹配）', (s) =>
    expect(RE_TOTAL.test(s)).toBe(false));
});

// ── 单位分类 ──────────────────────────────────────────────────────────────────

describe('isCanonicalUnit', () => {
  it.each([['文', true], ['文钱', true]])('isCanonicalUnit("%s") = %s', (u, expected) => {
    expect(isCanonicalUnit(u)).toBe(expected);
  });

  it.each([
    ['块', false], ['两', false], ['贯', false], ['吊', false],
    ['元', false], ['银', false], ['铜', false], ['钱', false],
    ['', false], ['文文', false],
  ])('isCanonicalUnit("%s") = false', (u) => {
    expect(isCanonicalUnit(u)).toBe(false);
  });

  it('CANONICAL_UNITS 包含 文/文钱', () => {
    expect(CANONICAL_UNITS.has('文')).toBe(true);
    expect(CANONICAL_UNITS.has('文钱')).toBe(true);
    expect(CANONICAL_UNITS.has('块')).toBe(false);
  });
});

// ── parseChineseAmount（版本 1 规则不变）────────────────────────────────────

describe('parseChineseAmount: 单位数', () => {
  it.each([
    ['两', 2], ['贰', 2], ['俩', 2],
    ['三', 3], ['叁', 3],
    ['四', 4], ['五', 5], ['六', 6],
    ['七', 7], ['八', 8], ['九', 9],
    ['一', 1], ['壹', 1],
  ])('"%s" → %d', (token, expected) => {
    expect(parseChineseAmount(token)).toBe(expected);
  });

  it('"0" → null', () => expect(parseChineseAmount('0')).toBeNull());
});

describe('parseChineseAmount: 纯阿拉伯', () => {
  it.each([['2', 2], ['50', 50], ['100', 100], ['1000', 1000]])('"%s" → %d', (t, e) => expect(parseChineseAmount(t)).toBe(e));
});

describe('parseChineseAmount: 十位', () => {
  it.each([
    ['十', 10], ['拾', 10], ['十二', 12], ['十五', 15],
    ['二十', 20], ['三十', 30], ['九十九', 99],
  ])('"%s" → %d', (t, e) => expect(parseChineseAmount(t)).toBe(e));
});

describe('parseChineseAmount: 百位', () => {
  it.each([
    ['三百', 300], ['叁佰', 300], ['3百', 300],
    ['百', 100], ['佰', 100], ['五百', 500], ['两百', 200], ['三百二十', 320],
  ])('"%s" → %d', (t, e) => expect(parseChineseAmount(t)).toBe(e));
});

describe('parseChineseAmount: 千/万/零占位', () => {
  it.each([
    ['千', 1000], ['三千', 3000], ['一千五百', 1500], ['3千', 3000],
    ['万', 10000], ['两万', 20000],
    ['一千零一', 1001], ['一百零五', 105],
  ])('"%s" → %d', (t, e) => expect(parseChineseAmount(t)).toBe(e));
});

describe('parseChineseAmount: 不可识别 → null', () => {
  it.each([['钱'], ['文'], ['铜钱'], ['abc'], ['！'], ['']])('"%s" → null', (t) => expect(parseChineseAmount(t)).toBeNull());
});

// ── extractMoneyAmounts：规范单位（M2.5/M2.6 不回归）─────────────────────────

describe('extractMoneyAmounts: 阿拉伯 + 文（不回归）', () => {
  it('「2文」→ [{value:2, unit:"文"}]', () => {
    expect(extractMoneyAmounts('林九给了2文小费'))
      .toEqual<MoneyAmount[]>([{ value: 2, unit: '文' }]);
  });

  it('「50文」→ [{value:50, unit:"文"}]', () => {
    expect(extractMoneyAmounts('账单共50文'))
      .toEqual<MoneyAmount[]>([{ value: 50, unit: '文' }]);
  });

  it('去重', () => {
    const r = extractMoneyAmounts('收了3文，又给了3文，再添2文');
    expect([...r].sort((a, b) => a.value - b.value))
      .toEqual<MoneyAmount[]>([{ value: 2, unit: '文' }, { value: 3, unit: '文' }]);
  });

  it('无金额 → []', () => expect(extractMoneyAmounts('大家好好休息')).toEqual([]));
});

describe('extractMoneyAmounts: 文钱（规范）', () => {
  it('「5文钱」→ [{value:5, unit:"文钱"}]', () => {
    expect(extractMoneyAmounts('给了5文钱'))
      .toEqual<MoneyAmount[]>([{ value: 5, unit: '文钱' }]);
  });
});

describe('extractMoneyAmounts: 汉字金额 + 文（M2.5 不回归）', () => {
  it('「两文铜钱」→ [{value:2, unit:"文"}]（段①优先）', () => {
    expect(extractMoneyAmounts('掏出两文铜钱给红姨'))
      .toEqual<MoneyAmount[]>([{ value: 2, unit: '文' }]);
  });

  it.each([
    ['给了两文', 2], ['打赏三文', 3], ['酒钱十文', 10], ['共计百文', 100],
  ])('"%s" → value %d, unit 文', (text, val) => {
    const r = extractMoneyAmounts(text);
    expect(r[0]).toMatchObject({ value: val, unit: '文' });
  });

  it('混合两文…10文 → 两条规范记录', () => {
    const r = extractMoneyAmounts('先给两文定金，后付10文尾款');
    expect([...r].sort((a, b) => a.value - b.value))
      .toEqual<MoneyAmount[]>([{ value: 2, unit: '文' }, { value: 10, unit: '文' }]);
  });
});

describe('extractMoneyAmounts: 不可确认单位（M2.6 不回归）', () => {
  it('「三百块」→ unit=块, isCanonicalUnit=false', () => {
    const r = extractMoneyAmounts('花了三百块');
    expect(r).toHaveLength(1);
    expect(r[0]?.value).toBe(300);
    expect(isCanonicalUnit(r[0]!.unit)).toBe(false);
  });

  it('「两文铜钱」不被段②误读 → 只有 unit=文', () => {
    const r = extractMoneyAmounts('两文铜钱');
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ value: 2, unit: '文' });
  });
});

// 注：覆盖性闸集成回归 → hosts/slice/tests/m25.test.ts
// 注：M2.7 语义/方向/实体 gate 集成测试 → hosts/slice/tests/m27.test.ts
