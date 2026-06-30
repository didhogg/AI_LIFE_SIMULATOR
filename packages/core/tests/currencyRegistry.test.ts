/**
 * 币种单位泛化 substrate — currencyRegistry 机测
 *
 * 断言⑦ 守恒门：
 *   - schemaKeys = 54（additive-only·别称字段在 币种定义Schema 内·不进顶层键）
 *   - manifest 不变·BUNDLE 不变
 *   - 黄金向量逐位恒等（默认配置=零重定基）
 *   - 确定性六禁：纯函数·无 Date.now/Math.random/localeCompare
 *
 * 覆盖点：
 *   R1 buildCurrencyRegistry 默认/标准/自定义
 *   R2 extractMoneyAmountsFor 参数化
 *   R3 isCanonicalUnitIn 参数化
 *   R4 aohp buildOptionId/buildMenuOptionIds with registry
 *   R5 getNetAsset with baseCurrency
 *   R6 gateCoverage with currencyRegistry
 *   R7 schema 别称 parse 通过（多币种 seam·fx dormant）
 *   R8 守恒门
 */

import { describe, it, expect } from 'vitest';
import {
  buildCurrencyRegistry,
  DEFAULT_CURRENCY_REGISTRY,
  type CurrencyRegistry,
} from '../engine/currencyRegistry.js';
import {
  CANONICAL_UNITS,
  extractMoneyAmountsFor,
  isCanonicalUnitIn,
  extractMoneyAmounts,
} from '../engine/text/chineseNumber.js';
import {
  buildOptionId,
  buildMenuOptionIds,
} from '../engine/aohp.js';
import { getNetAsset, BASE_CURRENCY } from '../engine/netAsset.js';
import {
  gateStructural,
  gateCoverage,
} from '../../../hosts/slice/ledger/gate.js';
import { RootSchema } from '../schema/index.js';
import { FINGERPRINT_BUNDLE_MEMBERS, FINGERPRINT_EXCLUDED_FIELDS } from '../engine/fingerprintManifest.js';
import { 货币系统Schema } from '../schema/economy.js';

// ── 辅助 fixture ────────────────────────────────────────────────────────────

function make货币系统(
  baseCurrency: string,
  aliases?: string[],
): Parameters<typeof buildCurrencyRegistry>[0] {
  return 货币系统Schema.parse({
    基准币种: baseCurrency,
    币种定义: aliases
      ? { [baseCurrency]: { 单位: baseCurrency, 符号: baseCurrency, 别称: aliases } }
      : {},
  });
}

function makeAccount(currency: string, amount: number) {
  return {
    持有: { [currency]: amount },
    储蓄: {},
    资产: [],
    _应收: {},
    _负债: {},
    _费用: { 总额: 0, 明细: {} },
    被动收入来源: {},
    本期收入: { 总额: 0, 明细: {} },
    本期支出: { 总额: 0, 明细: {} },
  } as const;
}

// ── R1: buildCurrencyRegistry ─────────────────────────────────────────────────

describe('R1: buildCurrencyRegistry', () => {
  it('R1-1 未传参 → DEFAULT_CURRENCY_REGISTRY（零重定基）', () => {
    const r = buildCurrencyRegistry(undefined);
    expect(r.baseCurrency).toBe('文');
    expect(r.canonicalUnits.has('文')).toBe(true);
    expect(r.canonicalUnits.has('文钱')).toBe(true);
    expect(r.canonicalUnits.size).toBe(2);
  });

  it('R1-2 基准币种为空串 → DEFAULT_CURRENCY_REGISTRY', () => {
    const s = make货币系统('');
    const r = buildCurrencyRegistry(s);
    expect(r).toBe(DEFAULT_CURRENCY_REGISTRY);
    expect(r.baseCurrency).toBe('文');
  });

  it('R1-3 基准币种=\"文\"·无别称 → 同默认（包含文钱别称·零重定基）', () => {
    const s = make货币系统('文');
    const r = buildCurrencyRegistry(s);
    expect(r.baseCurrency).toBe('文');
    expect(r.canonicalUnits.has('文')).toBe(true);
    expect(r.canonicalUnits.has('文钱')).toBe(true);
    expect(r.canonicalUnits.size).toBe(2);
  });

  it('R1-4 基准币种=\"文\"·别称声明 → 只用声明的别称（不追加默认文钱）', () => {
    const s = make货币系统('文', ['铜文']);
    const r = buildCurrencyRegistry(s);
    expect(r.baseCurrency).toBe('文');
    expect(r.canonicalUnits.has('文')).toBe(true);
    expect(r.canonicalUnits.has('铜文')).toBe(true);
    expect(r.canonicalUnits.has('文钱')).toBe(false);
    expect(r.canonicalUnits.size).toBe(2);
  });

  it('R1-5 自定义币种=\"灵石\"·无别称 → {灵石}', () => {
    const s = make货币系统('灵石');
    const r = buildCurrencyRegistry(s);
    expect(r.baseCurrency).toBe('灵石');
    expect(r.canonicalUnits.has('灵石')).toBe(true);
    expect(r.canonicalUnits.has('文')).toBe(false);
    expect(r.canonicalUnits.size).toBe(1);
  });

  it('R1-6 自定义币种=\"灵石\"·别称=[\"石\"] → {灵石, 石}', () => {
    const s = make货币系统('灵石', ['石']);
    const r = buildCurrencyRegistry(s);
    expect(r.baseCurrency).toBe('灵石');
    expect(r.canonicalUnits.has('灵石')).toBe(true);
    expect(r.canonicalUnits.has('石')).toBe(true);
    expect(r.canonicalUnits.size).toBe(2);
  });

  it('R1-7 多别称 → 全部收录', () => {
    const s = make货币系统('credit', ['cr', 'credits']);
    const r = buildCurrencyRegistry(s);
    expect(r.canonicalUnits.size).toBe(3);
    expect(r.canonicalUnits.has('credit')).toBe(true);
    expect(r.canonicalUnits.has('cr')).toBe(true);
    expect(r.canonicalUnits.has('credits')).toBe(true);
  });

  it('R1-8 unconfirmedUnitChars 保持默认（未来可扩展）', () => {
    const s = make货币系统('灵石', ['石']);
    const r = buildCurrencyRegistry(s);
    expect(r.unconfirmedUnitChars).toBe(DEFAULT_CURRENCY_REGISTRY.unconfirmedUnitChars);
  });
});

// ── R2: extractMoneyAmountsFor ─────────────────────────────────────────────────

describe('R2: extractMoneyAmountsFor', () => {
  it('R2-1 默认参数 → 与 extractMoneyAmounts 逐位恒等', () => {
    const text = '林九给了两文铜钱';
    const a = extractMoneyAmountsFor(text);
    const b = extractMoneyAmounts(text);
    expect(a).toEqual(b);
  });

  it('R2-2 默认参数·「文钱」归一 → 与原始行为恒等', () => {
    const amounts = extractMoneyAmountsFor('五文钱');
    expect(amounts).toHaveLength(1);
    expect(amounts[0]?.value).toBe(5);
    expect(amounts[0]?.unit).toBe('文钱');
  });

  it('R2-3 自定义单位集 {灵石} → 能解析「五灵石」', () => {
    const reg = buildCurrencyRegistry(make货币系统('灵石'));
    const amounts = extractMoneyAmountsFor('修真者付出五灵石', reg.canonicalUnits);
    expect(amounts.some(a => a.value === 5 && a.unit === '灵石')).toBe(true);
  });

  it('R2-4 自定义单位集下「文」不再 canonical → 视为 unconfirmed', () => {
    const reg = buildCurrencyRegistry(make货币系统('灵石'));
    const amounts = extractMoneyAmountsFor('五文', reg.canonicalUnits, reg.unconfirmedUnitChars);
    // '文' 不在 canonicalUnits → segment2 不匹配（'文' 不在 unconfirmedUnitChars）→ 无结果
    // OR 出现在 unconfirmed 段（取决于 unconfirmedUnitChars 是否含'文'·默认不含）
    const canonical = amounts.filter(a => isCanonicalUnitIn(a.unit, reg.canonicalUnits));
    expect(canonical).toHaveLength(0);
  });

  it('R2-5 别称 {灵石, 石} → 「三石」「五灵石」均 canonical', () => {
    const reg = buildCurrencyRegistry(make货币系统('灵石', ['石']));
    const a1 = extractMoneyAmountsFor('三石', reg.canonicalUnits);
    expect(a1.some(a => a.value === 3 && isCanonicalUnitIn(a.unit, reg.canonicalUnits))).toBe(true);
    const a2 = extractMoneyAmountsFor('五灵石', reg.canonicalUnits);
    expect(a2.some(a => a.value === 5 && isCanonicalUnitIn(a.unit, reg.canonicalUnits))).toBe(true);
  });

  it('R2-6 多金额提取 → 去重逐位恒等（确定性）', () => {
    const reg = buildCurrencyRegistry(make货币系统('灵石', ['石']));
    const a1 = extractMoneyAmountsFor('三石加五灵石', reg.canonicalUnits);
    const a2 = extractMoneyAmountsFor('三石加五灵石', reg.canonicalUnits);
    expect(a1).toEqual(a2);
  });
});

// ── R3: isCanonicalUnitIn ──────────────────────────────────────────────────────

describe('R3: isCanonicalUnitIn', () => {
  it('R3-1 默认集 → 文/文钱 true·块/贯 false', () => {
    expect(isCanonicalUnitIn('文', CANONICAL_UNITS)).toBe(true);
    expect(isCanonicalUnitIn('文钱', CANONICAL_UNITS)).toBe(true);
    expect(isCanonicalUnitIn('块', CANONICAL_UNITS)).toBe(false);
    expect(isCanonicalUnitIn('贯', CANONICAL_UNITS)).toBe(false);
  });

  it('R3-2 自定义集 {灵石} → 灵石 true·文 false', () => {
    const units: ReadonlySet<string> = new Set(['灵石']);
    expect(isCanonicalUnitIn('灵石', units)).toBe(true);
    expect(isCanonicalUnitIn('文', units)).toBe(false);
  });
});

// ── R4: buildOptionId / buildMenuOptionIds with registry ──────────────────────

describe('R4: aohp with registry', () => {
  it('R4-1 无 registry → 行为与之前完全一致（零重定基）', () => {
    expect(buildOptionId('给钱', 'npc_wang', '五文钱')).toBe('给钱:npc_wang:5文');
    expect(buildOptionId('给钱', 'npc_wang', '5文')).toBe('给钱:npc_wang:5文');
  });

  it('R4-2 默认 registry → 与无 registry 结果相同（零重定基）', () => {
    const reg = buildCurrencyRegistry(make货币系统('文'));
    expect(buildOptionId('给钱', 'npc_wang', '五文钱', reg)).toBe('给钱:npc_wang:5文');
    expect(buildOptionId('给钱', 'npc_wang', '5文', reg)).toBe('给钱:npc_wang:5文');
  });

  it('R4-3 自定义 registry（灵石）→ option_id 用灵石单位', () => {
    const reg = buildCurrencyRegistry(make货币系统('灵石'));
    expect(buildOptionId('购买', 'npc_merchant', '5灵石', reg)).toBe('购买:npc_merchant:5灵石');
  });

  it('R4-4 别称 → option_id 归一为 baseCurrency', () => {
    const reg = buildCurrencyRegistry(make货币系统('灵石', ['石']));
    const id1 = buildOptionId('购买', 'npc_merchant', '5灵石', reg);
    const id2 = buildOptionId('购买', 'npc_merchant', '5石', reg);
    // 两者都归一为 '5灵石'（baseCurrency）
    expect(id1).toBe('购买:npc_merchant:5灵石');
    expect(id2).toBe('购买:npc_merchant:5灵石');
  });

  it('R4-5 buildMenuOptionIds 无 registry → 与原有行为一致', () => {
    const opts = [
      { verb: '给钱', targetEntityId: 'npc_wang', salientArgs: '五文钱' },
      { verb: '给钱', targetEntityId: 'npc_wang', salientArgs: '5文' },
    ];
    const result = buildMenuOptionIds(opts);
    // 同义归一：两者 canonical 相同 → 只输出第一个
    expect(result).toHaveLength(1);
    expect(result[0]?.option_id).toBe('给钱:npc_wang:5文');
  });

  it('R4-6 buildMenuOptionIds 自定义 registry → 正确归一', () => {
    const reg = buildCurrencyRegistry(make货币系统('灵石', ['石']));
    const opts = [
      { verb: '购买', targetEntityId: 'npc_merchant', salientArgs: '5灵石' },
      { verb: '购买', targetEntityId: 'npc_merchant', salientArgs: '5石' },
    ];
    const result = buildMenuOptionIds(opts, reg);
    // 同义归一（两者 canonical 均为 '5灵石'）
    expect(result).toHaveLength(1);
    expect(result[0]?.option_id).toBe('购买:npc_merchant:5灵石');
  });

  it('R4-7 确定性：同输入两次 → 逐位恒等', () => {
    const reg = buildCurrencyRegistry(make货币系统('灵石', ['石']));
    const id1 = buildOptionId('购买', 'npc', '3灵石', reg);
    const id2 = buildOptionId('购买', 'npc', '3灵石', reg);
    expect(id1).toBe(id2);
  });
});

// ── R5: getNetAsset with baseCurrency ──────────────────────────────────────────

describe('R5: getNetAsset with baseCurrency', () => {
  it('R5-1 无 baseCurrency 参数 → 使用 BASE_CURRENCY（零重定基）', () => {
    const acct = makeAccount('文', 100);
    expect(getNetAsset(acct as Parameters<typeof getNetAsset>[0])).toBe(100);
  });

  it('R5-2 显式传 \"文\" → 同无参数结果', () => {
    const acct = makeAccount('文', 100);
    expect(getNetAsset(acct as Parameters<typeof getNetAsset>[0], undefined, '文')).toBe(100);
  });

  it('R5-3 自定义 baseCurrency=\"灵石\" → 读取灵石账户', () => {
    const acct = makeAccount('灵石', 50);
    expect(getNetAsset(acct as Parameters<typeof getNetAsset>[0], undefined, '灵石')).toBe(50);
  });

  it('R5-4 账户有多币种·baseCurrency 只读对应键', () => {
    const acct = {
      持有: { '文': 30, '灵石': 50 },
      储蓄: {},
      资产: [],
      _应收: {},
      _负债: {},
      _费用: { 总额: 0, 明细: {} },
      被动收入来源: {},
      本期收入: { 总额: 0, 明细: {} },
      本期支出: { 总额: 0, 明细: {} },
    } as const;
    expect(getNetAsset(acct as Parameters<typeof getNetAsset>[0], undefined, '文')).toBe(30);
    expect(getNetAsset(acct as Parameters<typeof getNetAsset>[0], undefined, '灵石')).toBe(50);
  });

  it('R5-5 BASE_CURRENCY 常量仍为 \"文\"（向后兼容·零重定基）', () => {
    expect(BASE_CURRENCY).toBe('文');
  });

  it('R5-6 getNetAsset 会计恒等式·引擎事实·不受 formulaConfig 影响（无第4参数）', () => {
    // 持有100 + 储蓄0 + 存货0 = 100（会计恒等式·纯账户数据驱动）
    const acct = makeAccount('文', 100);
    expect(getNetAsset(acct as unknown as Parameters<typeof getNetAsset>[0])).toBe(100);
    // getNetAsset 无 formulaConfig 参数 → 会计恒等式是引擎事实，不 override
    expect(getNetAsset.length).toBeLessThanOrEqual(3);
  });
});

// ── R6: gateCoverage with currencyRegistry ────────────────────────────────────

describe('R6: gateCoverage with currencyRegistry', () => {
  function makeProposal(amounts: number[]) {
    return { transfers: amounts.map(a => ({ from: 'p', to: 'q', amount: a, reason: '' })), checks: [], knowledge: [] };
  }

  it('R6-1 无 context → 默认行为（文/文钱 canonical·零重定基）', () => {
    const r = gateCoverage('林九给了五文钱', makeProposal([5]));
    expect(r.covered).toBe(true);
  });

  it('R6-2 默认 registry context → 与无 context 行为一致', () => {
    const reg = buildCurrencyRegistry(make货币系统('文'));
    const r = gateCoverage('林九给了五文钱', makeProposal([5]), { currencyRegistry: reg });
    expect(r.covered).toBe(true);
  });

  it('R6-3 自定义 registry（灵石）→「五灵石」canonical·覆盖通过', () => {
    const reg = buildCurrencyRegistry(make货币系统('灵石'));
    const r = gateCoverage('修真者付出五灵石', makeProposal([5]), { currencyRegistry: reg });
    expect(r.covered).toBe(true);
  });

  it('R6-4 自定义 registry（灵石）→「五文」不 canonical → 单位不可确认', () => {
    const reg = buildCurrencyRegistry(make货币系统('灵石'));
    // '文' 不在 {灵石} 且不在 unconfirmedUnitChars → 无匹配 → 无金额 → covered:true（无有后果金额）
    const r = gateCoverage('修真者付出五文', makeProposal([5]), { currencyRegistry: reg });
    // '文' 不在 UNCONFIRMED_UNIT_CHARS 也不在自定义 canonical → extractMoneyAmountsFor 无结果 → covered:true
    expect(r.covered).toBe(true);
  });

  it('R6-5 自定义 registry（灵石·别称石）→「三石」覆盖通过', () => {
    const reg = buildCurrencyRegistry(make货币系统('灵石', ['石']));
    // 注：'石' 也不在 unconfirmedUnitChars（默认），so seg2 也不会误捕
    const amounts = extractMoneyAmountsFor('三石', reg.canonicalUnits, reg.unconfirmedUnitChars);
    // '石' 在 canonicalUnits → seg1 匹配 → unit='石' → isCanonicalUnitIn=true
    expect(amounts.some(a => a.value === 3 && isCanonicalUnitIn(a.unit, reg.canonicalUnits))).toBe(true);
  });
});

// ── R7: schema 别称 parse 通过（多币种 seam·fx dormant）────────────────────────

describe('R7: schema 别称 parse', () => {
  it('R7-1 货币系统.币种定义.别称 optional → 不含别称时 parse 通过', () => {
    const s = 货币系统Schema.parse({ 基准币种: '文', 币种定义: { '文': { 单位: '文', 符号: '文' } } });
    expect(s.基准币种).toBe('文');
    expect(s.币种定义['文']?.别称).toBeUndefined();
  });

  it('R7-2 含别称声明 → parse 通过', () => {
    const s = 货币系统Schema.parse({
      基准币种: '灵石',
      币种定义: { '灵石': { 单位: '灵石', 符号: '灵', 别称: ['石', '仙石'] } },
    });
    expect(s.币种定义['灵石']?.别称).toEqual(['石', '仙石']);
  });

  it('R7-3 多币种声明（fx seam·dormant）→ parse 通过', () => {
    const s = 货币系统Schema.parse({
      基准币种: '灵石',
      币种定义: {
        '灵石': { 单位: '灵石', 符号: '灵', 别称: ['石'], 对基准汇率: 1 },
        '凡铁': { 单位: '凡铁', 符号: '铁', 对基准汇率: 0.01 },
      },
      汇率: { '凡铁': 0.01 },
    });
    expect(Object.keys(s.币种定义)).toHaveLength(2);
    expect(s.汇率['凡铁']).toBe(0.01);
  });
});

// ── R8: 守恒门 ────────────────────────────────────────────────────────────────

describe('R8: 守恒门', () => {
  it('R8-1 schemaKeys = 54（别称字段在内层·不进 RootSchema 顶层键）', () => {
    expect(Object.keys(RootSchema.shape)).toHaveLength(54);
  });

  it('R8-2 FINGERPRINT_BUNDLE_MEMBERS 不变（无新增指纹字段）', () => {
    expect(FINGERPRINT_BUNDLE_MEMBERS.length).toBe(28);
  });

  it('R8-3 FINGERPRINT_EXCLUDED_FIELDS（C-2 漂移绑定策略→LOD 模块·54）', () => {
    expect(FINGERPRINT_EXCLUDED_FIELDS.length).toBe(54);
  });

  it('R8-4 BASE_CURRENCY 仍为 \"文\"（零重定基·向后兼容）', () => {
    expect(BASE_CURRENCY).toBe('文');
  });

  it('R8-5 CANONICAL_UNITS 仍为 {文,文钱}（默认常量不变）', () => {
    expect(CANONICAL_UNITS.has('文')).toBe(true);
    expect(CANONICAL_UNITS.has('文钱')).toBe(true);
    expect(CANONICAL_UNITS.size).toBe(2);
  });

  it('R8-6 默认配置下 extractMoneyAmounts 行为逐位恒等（零重定基）', () => {
    const cases = [
      '林九给了两文铜钱',
      '五文钱换一碗茶',
      '三十文买两斗米',
    ];
    for (const c of cases) {
      expect(extractMoneyAmountsFor(c)).toEqual(extractMoneyAmounts(c));
    }
  });

  it('R8-7 默认 buildOptionId 行为逐位恒等（零重定基）', () => {
    // 关键路径：五文钱→归一→5文（与之前完全相同）
    expect(buildOptionId('给钱', 'npc_wang', '五文钱')).toBe('给钱:npc_wang:5文');
    expect(buildOptionId('给钱', 'npc_hong', '10文')).toBe('给钱:npc_hong:10文');
    expect(buildOptionId('对话', 'npc_wang')).toBe('对话:npc_wang');
  });
});
