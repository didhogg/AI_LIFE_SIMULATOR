/**
 * D-a-lore: loreFreeze — lore 触发谓词冻结纪律测试
 * 对标 L-21 importanceFreeze 同构模式：freeze/assert/read 三件套
 * commit-1 (1a): collectLorePredicates — 触发谓词聚合·指纹验证
 */
import { describe, it, expect } from 'vitest';
import {
  freezeLorePredicate,
  assertLorePredicateFrozen,
  readFrozenLorePredicate,
  collectLorePredicates,
  type FreezableLoreEntry,
} from '../engine/loreFreeze.js';
import { hashJudgmentBundle } from '../engine/rng.js';

// ── JUDGMENT_BASE（最小合法判定面·用于指纹 delta 断言）────────────────────────
const JUDGMENT_BASE = {
  历法皮肤: {},
  粒度模板覆盖: {},
  种族模板: {},
  母题配额: {},
  媒体渠道表: {},
  检定配方表: {},
  检定档切分表: {},
  欠债参数: {},
  赛事结构模板: {},
  派生量配方: {},
  概率域夹逼: {},
  纠缠闭包弱边阈值: 0.2,
} as const;

function mkFrozenEntry(pred: string) {
  return freezeLorePredicate({}, pred);
}

// ── freezeLorePredicate ──────────────────────────────────────────────────────

describe('D-a-lore: freezeLorePredicate', () => {
  it('空谓词串 → 冻结成功·触发谓词_冻结=true', () => {
    const result = freezeLorePredicate({}, '');
    expect(result.触发谓词).toBe('');
    expect(result.触发谓词_冻结).toBe(true);
  });

  it('简单 DSL 比较谓词 → 冻结成功', () => {
    const result = freezeLorePredicate({}, '场景.地域 == 四川');
    expect(result.触发谓词).toBe('场景.地域 == 四川');
    expect(result.触发谓词_冻结).toBe(true);
  });

  it('DSL and 谓词（深度1） → 冻结成功', () => {
    const result = freezeLorePredicate({}, '角色.出身地 == 苏州 or 场景.地域 == 苏州');
    expect(result.触发谓词_冻结).toBe(true);
    expect(result.触发谓词).toBe('角色.出身地 == 苏州 or 场景.地域 == 苏州');
  });

  it('数值比较谓词 → 冻结成功', () => {
    const result = freezeLorePredicate({}, '角色.年龄 >= 18');
    expect(result.触发谓词_冻结).toBe(true);
  });

  it('未冻结条目 → 从未冻结状态读取·可冻结', () => {
    const entry: { 触发谓词?: string; 触发谓词_冻结?: boolean } = { 触发谓词: '场景.地域 == 四川' };
    const result = freezeLorePredicate(entry, '场景.地域 == 四川');
    expect(result.触发谓词_冻结).toBe(true);
  });

  it('已冻结时再调 → 抛出 D-a-lore 违规错误', () => {
    const frozen = freezeLorePredicate({}, '场景.地域 == 四川');
    expect(() => freezeLorePredicate(frozen, '场景.地域 == 北京')).toThrow('D-a-lore 违规');
  });

  it('已冻结时错误消息含当前谓词值', () => {
    const frozen = freezeLorePredicate({}, '场景.地域 == 四川');
    expect(() => freezeLorePredicate(frozen, '场景.地域 == 北京'))
      .toThrow('场景.地域 == 四川');
  });

  it('非法 DSL 谓词（无运算符） → 抛出 D-a-lore 解析失败', () => {
    expect(() => freezeLorePredicate({}, '!!invalid!!')).toThrow('D-a-lore');
  });

  it('非法 DSL 谓词（仅路径无比较） → 解析失败 fail-closed', () => {
    // 谓词须含比较符·单路径不是合法谓词
    expect(() => freezeLorePredicate({}, '场景.地域')).toThrow('D-a-lore');
  });

  it('返回值 触发谓词_冻结 类型为 true（字面量 true）', () => {
    const result = freezeLorePredicate({}, '');
    const check: true = result.触发谓词_冻结;
    expect(check).toBe(true);
  });
});

// ── assertLorePredicateFrozen ─────────────────────────────────────────────────

describe('D-a-lore: assertLorePredicateFrozen', () => {
  it('已冻结条目 → 不抛', () => {
    const entry = { 触发谓词: '场景.地域 == 四川', 触发谓词_冻结: true as const };
    expect(() => assertLorePredicateFrozen(entry, 'cuisine:川菜')).not.toThrow();
  });

  it('未冻结条目（触发谓词_冻结=undefined） → 抛 D-a-lore 守卫', () => {
    expect(() => assertLorePredicateFrozen({ 触发谓词: '场景.地域 == 四川' }, 'cuisine:川菜'))
      .toThrow('D-a-lore 守卫');
  });

  it('未冻结条目（触发谓词_冻结=false） → 抛 D-a-lore 守卫', () => {
    expect(() => assertLorePredicateFrozen({ 触发谓词_冻结: false }, 'cuisine:川菜'))
      .toThrow('D-a-lore 守卫');
  });

  it('错误消息含 loreKey', () => {
    expect(() => assertLorePredicateFrozen({}, 'cuisine:川菜'))
      .toThrow('cuisine:川菜');
  });

  it('空条目（无任何字段） → 抛 D-a-lore 守卫', () => {
    expect(() => assertLorePredicateFrozen({}, 'hanfu:交领唐制'))
      .toThrow('D-a-lore 守卫');
  });
});

// ── readFrozenLorePredicate ───────────────────────────────────────────────────

describe('D-a-lore: readFrozenLorePredicate', () => {
  it('已冻结·返回谓词串', () => {
    const entry = { 触发谓词: '场景.地域 == 四川', 触发谓词_冻结: true as const };
    expect(readFrozenLorePredicate(entry)).toBe('场景.地域 == 四川');
  });

  it('已冻结·空谓词串 → 返回空串', () => {
    const entry = { 触发谓词: '', 触发谓词_冻结: true as const };
    expect(readFrozenLorePredicate(entry)).toBe('');
  });

  it('未冻结 → 返回默认值 fail-open（不抛）', () => {
    expect(readFrozenLorePredicate({ 触发谓词: '场景.地域 == 四川' })).toBe('');
  });

  it('未冻结·自定义 defaultValue', () => {
    expect(readFrozenLorePredicate({}, '默认')).toBe('默认');
  });

  it('空条目·无谓词_冻结 → 返回默认值', () => {
    expect(readFrozenLorePredicate({})).toBe('');
  });

  it('已冻结·触发谓词字段缺省（undefined） → 返回默认值', () => {
    const entry = { 触发谓词_冻结: true as const };
    expect(readFrozenLorePredicate(entry)).toBe('');
  });

  it('双跑逐位恒等', () => {
    const entry = { 触发谓词: '角色.年龄 >= 18 and 场景.地域 == 四川', 触发谓词_冻结: true as const };
    expect(readFrozenLorePredicate(entry)).toBe(readFrozenLorePredicate(entry));
  });
});

// ── 冻结纪律完整流程 ──────────────────────────────────────────────────────────

describe('D-a-lore: 冻结纪律 完整导入流程', () => {
  it('创建→冻结→断言→读取 完整链路', () => {
    const rawEntry: FreezableLoreEntry = { 触发谓词: '' };
    const frozen = freezeLorePredicate(rawEntry, '场景.地域 == 四川');
    assertLorePredicateFrozen(frozen, 'cuisine:川菜');
    expect(readFrozenLorePredicate(frozen)).toBe('场景.地域 == 四川');
  });

  it('空谓词冻结链路（无 gate 判定谓词的叙事纯知识条目）', () => {
    const frozen = freezeLorePredicate({}, '');
    assertLorePredicateFrozen(frozen, 'hanfu:交领唐制');
    expect(readFrozenLorePredicate(frozen)).toBe('');
  });
});

// ── D-a-lore (1a): collectLorePredicates — 触发谓词聚合 ──────────────────────

describe('D-a-lore: collectLorePredicates (1a 触发谓词)', () => {
  it('空库 → 返回 undefined', () => {
    expect(collectLorePredicates({})).toBeUndefined();
  });

  it('空库 → lore谓词集合=undefined → hashJudgmentBundle 指纹与无此字段时恒等', () => {
    const fp1 = hashJudgmentBundle(JUDGMENT_BASE);
    const fp2 = hashJudgmentBundle({ ...JUDGMENT_BASE, lore谓词集合: collectLorePredicates({}) });
    expect(fp1).toBe(fp2);
  });

  it('非空触发谓词 → 收集入 result', () => {
    const bag = { 'cuisine:川菜': mkFrozenEntry('场景.地域 == 四川') };
    expect(collectLorePredicates(bag)).toEqual({ 'cuisine:川菜': '场景.地域 == 四川' });
  });

  it('空触发谓词 → 不收集（仅非空）· 返回 undefined', () => {
    const bag = { 'hanfu:交领唐制': mkFrozenEntry('') };
    expect(collectLorePredicates(bag)).toBeUndefined();
  });

  it('混合：非空+空 → 仅收集非空', () => {
    const bag = {
      'cuisine:川菜': mkFrozenEntry('场景.地域 == 四川'),
      'hanfu:交领唐制': mkFrozenEntry(''),
      'dialect:苏州话': mkFrozenEntry('角色.出身地 == 苏州'),
    };
    expect(collectLorePredicates(bag)).toEqual({
      'cuisine:川菜': '场景.地域 == 四川',
      'dialect:苏州话': '角色.出身地 == 苏州',
    });
  });

  it('未冻结条目 → assertLorePredicateFrozen 守卫 throw', () => {
    const bag = { 'cuisine:川菜': { 触发谓词: '场景.地域 == 四川' } };
    expect(() => collectLorePredicates(bag)).toThrow('D-a-lore 守卫');
  });

  it('谓词内容变 → lore谓词集合变 → hashJudgmentBundle 指纹变', () => {
    const bag1 = { 'cuisine:川菜': mkFrozenEntry('场景.地域 == 四川') };
    const bag2 = { 'cuisine:川菜': mkFrozenEntry('场景.地域 == 北京') };
    const fp1 = hashJudgmentBundle({ ...JUDGMENT_BASE, lore谓词集合: collectLorePredicates(bag1) });
    const fp2 = hashJudgmentBundle({ ...JUDGMENT_BASE, lore谓词集合: collectLorePredicates(bag2) });
    expect(fp1).not.toBe(fp2);
  });

  it('新增条目 → 集合变 → 指纹变', () => {
    const bag1 = { 'cuisine:川菜': mkFrozenEntry('场景.地域 == 四川') };
    const bag2 = {
      'cuisine:川菜': mkFrozenEntry('场景.地域 == 四川'),
      'dialect:苏州话': mkFrozenEntry('角色.出身地 == 苏州'),
    };
    const fp1 = hashJudgmentBundle({ ...JUDGMENT_BASE, lore谓词集合: collectLorePredicates(bag1) });
    const fp2 = hashJudgmentBundle({ ...JUDGMENT_BASE, lore谓词集合: collectLorePredicates(bag2) });
    expect(fp1).not.toBe(fp2);
  });

  it('确定性：同入参双跑 hashJudgmentBundle 逐位恒等', () => {
    const bag = {
      'cuisine:川菜': mkFrozenEntry('场景.地域 == 四川'),
      'dialect:苏州话': mkFrozenEntry('角色.出身地 == 苏州'),
    };
    const fp1 = hashJudgmentBundle({ ...JUDGMENT_BASE, lore谓词集合: collectLorePredicates(bag) });
    const fp2 = hashJudgmentBundle({ ...JUDGMENT_BASE, lore谓词集合: collectLorePredicates(bag) });
    expect(fp1).toBe(fp2);
    expect(fp1).toMatch(/^[0-9a-f]{8}$/);
  });

  it('多条目全空谓词 → 返回 undefined → 指纹与空库恒等', () => {
    const bag = {
      'hanfu:交领唐制': mkFrozenEntry(''),
      'dialect:吴语': mkFrozenEntry(''),
    };
    const fpEmpty = hashJudgmentBundle(JUDGMENT_BASE);
    const fpBag = hashJudgmentBundle({ ...JUDGMENT_BASE, lore谓词集合: collectLorePredicates(bag) });
    expect(collectLorePredicates(bag)).toBeUndefined();
    expect(fpBag).toBe(fpEmpty);
  });
});
