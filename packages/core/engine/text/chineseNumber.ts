/**
 * 中文数字解析器 — 规则版本 3
 *
 * 版本 3 新增：入口 NFKC 归一 + 语义方向/性质词表（fail-closed）
 *   prepareNarrative：全角→半角 / 全角空格去零宽 / ASCII 数字空格折叠 / trim
 *   RE_CHANGE_GIVING：找你/找零/退你/退给 → 收入方向，不记支出
 *   RE_DEBT：赊账/欠款/欠了/欠着/借了/借给 → 债权，不记现金
 *   RE_ADVANCE：垫付/代付/先垫/帮付 → 代付，不记普通现金
 *   RE_TOTAL：共/一共/合计 + 数字 → 总价，防分项重复计数
 *
 * 版本 2 口径（保留）：extractMoneyAmounts 返回 MoneyAmount[]（value + unit）；
 *   CANONICAL_UNITS = {文, 文钱}；其余单位→不可确认。
 *
 * 版本 1 口径（保留）：parseChineseAmount 规则不变。
 *
 * THIS FILE IS THE SOLE WHITELIST for the 中文数字解析规则版 fingerprint field (对撞⑦).
 * All callers MUST import from here; writing a second parser is prohibited.
 * Pure function — no Math.random, no Date.now, no platform Math transcendentals.
 * 禁裸调 .normalize()；使用 normalizeNFKC（禁⑥ whitelist）。
 */

import { normalizeNFKC } from './normalize.js';

// ── 字符映射表 ─────────────────────────────────────────────────────────────────
const DIGIT: Record<string, number> = {
  '零': 0, '〇': 0,
  '一': 1, '壹': 1,
  '二': 2, '贰': 2, '两': 2, '俩': 2,
  '三': 3, '叁': 3,
  '四': 4, '肆': 4,
  '五': 5, '伍': 5,
  '六': 6, '陆': 6,
  '七': 7, '柒': 7,
  '八': 8, '捌': 8,
  '九': 9, '玖': 9,
};

const UNIT: Record<string, number> = {
  '十': 10,  '拾': 10,
  '百': 100, '佰': 100,
  '千': 1000,'仟': 1000,
  '万': 10000,'萬': 10000,
};

// 数字合法字符集（供正则构建）
const VALID_CHARS = '\\d零〇一壹二贰两俩三叁四肆五伍六陆七柒八捌九玖十拾百佰千仟万萬';

// 非规范货币单位字符（段②）：含两（作单位时）/ 不含文（由段①处理）
const UNCONFIRMED_UNIT_CHARS = '块两贯吊元圆枚银铜钱';

/** 规则版本常量——fingerprint 字段 `中文数字解析规则版` 必须与此一致。 */
export const CHINESE_NUMBER_RULE_VERSION = 3 as const;

// ── 版本 3：入口归一 ──────────────────────────────────────────────────────────

// 去零宽：U+200B ZWSP / U+200C ZWNJ / U+200D ZWJ / U+2060 WJ / U+FEFF BOM
// 6.59·仅为复用导出（governedKeySpace.ts 规范化键码位 调用）·零行为/零值变更
// eslint-disable-next-line no-misleading-character-class
export const RE_ZERO_WIDTH = /[\u200B\u200C\u200D\u2060\uFEFF]/g;
// 折叠 ASCII 数字之间的空白（处理 NFKC 后的"5 0 文"→"50 文"）
const RE_DIGIT_SPACE = /(\d)[ \t]+(\d)/g;

/**
 * 叙事文本入口归一（版本 3）：
 *   1. NFKC 归一：全角数字→半角、全角空格→半角空格、全角括号→半角括号
 *   2. 去零宽字符
 *   3. ASCII 数字空格折叠（两遍，处理三段以上间隔）
 *   4. trim
 *
 * 结果是确定性纯函数；同文本同结果；禁裸调 .normalize()。
 */
export function prepareNarrative(raw: string): string {
  let s = normalizeNFKC(raw);
  s = s.replace(RE_ZERO_WIDTH, '');
  // 两遍折叠，处理 "1 2 3" 类三段情况
  s = s.replace(RE_DIGIT_SPACE, '$1$2');
  s = s.replace(RE_DIGIT_SPACE, '$1$2');
  return s.trim();
}

// ── 版本 3：语义方向 / 性质词表 ────────────────────────────────────────────────
//
// 这些正则与 prepareNarrative 配合：先归一文本再测试。
// 任一词表命中 → 对账闸 fail-closed（不落账）→ 要求 LLM 重写并归一描述。

/** 收入/找零方向词：找你/找零/退你/退给 等 → 叙事金额为"收入"，不得记为支出。 */
export const RE_CHANGE_GIVING =
  /找(?:[你我他她们]|了?零)|退(?:[你我他她]|给)/;

/**
 * 债权性质词：赊账/欠款/欠了/欠着/借了/借给 → 非即时现金，不得记为普通现金支出。
 * 注：匹配精准，避免"借此/借道"等非金融"借"。
 */
export const RE_DEBT =
  /赊账|赊[了的]|欠款|欠[了着的]|借[了给]/;

/** 代付性质词：垫付/代付/先垫/帮付 → 属代付/债权，不记普通现金。 */
export const RE_ADVANCE =
  /垫付|代付|先垫|帮付/;

/**
 * 总价/合计词：共/一共/共计/合计/总计/总价 + 紧随数字 → 疑似合计，防与分项重复计数。
 * 用 lookahead 限制：后面必须紧跟数字/汉字数字，排除"共同/共享"等用法。
 */
export const RE_TOTAL =
  /(?:一共|共计|合计|总计|总价|共)\s*(?:[约计为]?\s*)(?=[\d零〇一壹二贰两俩三叁四肆五伍六陆七柒八捌九玖十拾百佰千仟万萬])/;

// ── 版本 2：单位分类 ──────────────────────────────────────────────────────────

/**
 * 默认规范货币单位集合（fallback·作者未配注册表时生效）。
 * 仅「文」与「文钱」在标准古代中文世界中等价且无换算歧义。
 * 自定义世界请通过 货币系统.币种定义[基准币种].别称 声明，由 buildCurrencyRegistry 派生。
 */
export const CANONICAL_UNITS: ReadonlySet<string> = new Set(['文', '文钱']);

/** 默认不可确认货币字符集（内联于 DEFAULT_CURRENCY_REGISTRY·此处保留供直接复用）。 */
export { UNCONFIRMED_UNIT_CHARS };

export function isCanonicalUnit(unit: string): boolean {
  return CANONICAL_UNITS.has(unit);
}

/** 参数化版 isCanonicalUnit — 针对任意 canonicalUnits 集合判断。 */
export function isCanonicalUnitIn(unit: string, canonicalUnits: ReadonlySet<string>): boolean {
  return canonicalUnits.has(unit);
}

// ── 版本 2：MoneyAmount 接口 ────────────────────────────────────────────────

export interface MoneyAmount {
  value: number;
  unit:  string;
}

// ── parseChineseAmount（版本 1 规则不变）────────────────────────────────────

export function parseChineseAmount(token: string): number | null {
  if (!token) return null;

  let total   = 0;
  let segment = 0;
  let hasSeg  = false;
  let pos     = 0;

  while (pos < token.length) {
    const ch = token[pos]!;

    if (ch >= '0' && ch <= '9') {
      let num = '';
      while (pos < token.length && token[pos]! >= '0' && token[pos]! <= '9') {
        num += token[pos++];
      }
      segment = parseInt(num, 10);
      hasSeg  = true;
      continue;
    }

    if (ch === '零' || ch === '〇') {
      pos++;
      hasSeg = false;
      continue;
    }

    const d = DIGIT[ch];
    if (d !== undefined) {
      segment = d;
      hasSeg  = true;
      pos++;
      continue;
    }

    const u = UNIT[ch];
    if (u !== undefined) {
      const multiplier = hasSeg ? segment : 1;
      if (u === 10000) {
        total   = (total + multiplier) * 10000;
      } else {
        total  += multiplier * u;
      }
      segment = 0;
      hasSeg  = false;
      pos++;
      continue;
    }

    return null;
  }

  total += segment;
  return total > 0 ? total : null;
}

// ── extractMoneyAmounts（版本 2 + 版本 3 入口归一）───────────────────────────

/** 转义正则特殊字符（供动态构建单位匹配组）。 */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 参数化版金额抽取 — 接受自定义规范单位集合与不可确认单位字符集。
 *
 * 两段抽取：
 *   段①  number + canonicalUnits 中的任一单位  → isCanonicalUnitIn = true
 *   段②  number + unconfirmedUnitChars 中的字符 → isCanonicalUnitIn = false
 *   段①覆盖的文本位置不参与段②。
 *
 * 版本 3：先调用 prepareNarrative 归一输入（全角、零宽、数字空格折叠）。
 *
 * 调用方用 isCanonicalUnitIn(a.unit, canonicalUnits) 判断是否可与提案单直接比对。
 */
export function extractMoneyAmountsFor(
  text: string,
  canonicalUnits: ReadonlySet<string> = CANONICAL_UNITS,
  unconfirmedUnitChars: string = UNCONFIRMED_UNIT_CHARS,
): MoneyAmount[] {
  const norm = prepareNarrative(text);
  const results: MoneyAmount[] = [];
  const coveredStarts = new Set<number>();

  // 段① 规范单位 — 按长度降序排列确保贪婪匹配（如「文钱」优先于「文」）
  const unitPattern = [...canonicalUnits]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegex)
    .join('|');
  const re1 = new RegExp(`([${VALID_CHARS}]+)\\s*(${unitPattern})`, 'g');
  for (const m of norm.matchAll(re1)) {
    coveredStarts.add(m.index!);
    const value = parseChineseAmount(m[1]!);
    if (value !== null && value > 0) {
      results.push({ value, unit: m[2]! });
    }
  }

  // 段② 不可确认单位（空串时跳过，避免正则 [character class] 为空出错）
  if (unconfirmedUnitChars) {
    const re2 = new RegExp(`([${VALID_CHARS}]+)\\s*([${unconfirmedUnitChars}]+)`, 'g');
    for (const m of norm.matchAll(re2)) {
      if (coveredStarts.has(m.index!)) continue;
      const value = parseChineseAmount(m[1]!);
      if (value !== null && value > 0) {
        results.push({ value, unit: m[2]! });
      }
    }
  }

  // 去重
  const seen = new Map<string, MoneyAmount>();
  for (const a of results) {
    const key = `${a.value}\x00${a.unit}`;
    if (!seen.has(key)) seen.set(key, a);
  }
  return [...seen.values()];
}

/**
 * 从叙事文本中提取所有「有后果金额」，返回 MoneyAmount[]（value + unit，去重）。
 *
 * 使用默认规范单位集合（CANONICAL_UNITS = {'文','文钱'}）与 UNCONFIRMED_UNIT_CHARS。
 * 自定义世界请改用 extractMoneyAmountsFor(text, registry.canonicalUnits)。
 *
 * 调用方用 isCanonicalUnit(a.unit) 判断是否可与提案单直接比对。
 */
export function extractMoneyAmounts(text: string): MoneyAmount[] {
  return extractMoneyAmountsFor(text, CANONICAL_UNITS, UNCONFIRMED_UNIT_CHARS);
}
