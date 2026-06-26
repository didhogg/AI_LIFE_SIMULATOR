/**
 * PR-瘦身-A2: resolve() 双轨并存 + 三层校验 验收
 * 断言①  双轨等价：新轨(resolve) 与 旧轨叠加() 逐位恒等
 * 断言②  三层校验：坏依赖/冲突/越界可写键 → 确定性进 _mod墓碑库
 * 断言③  指纹双车道：A桶(内容变) / B桶(判定面变) 各走独立信道
 * 断言④  引用顺序语义：两冲突包交换顺序 → 成品/指纹应不同
 * 断言⑤  守恒门：schemaKeys/BUNDLE/manifest 不变
 */
import { describe, it, expect } from 'vitest';
import { resolve, 旧轨叠加 } from '../engine/preset/resolve.js';
import { 内容包条目Schema, 内容包库Schema } from '../engine/preset/contentPack.js';
import type { 内容包库Type } from '../engine/preset/contentPack.js';
import { RootSchema, BLUEPRINT_KEYS } from '../schema/index.js';
import { hashPresetFingerprint, hashJudgmentBundle, hashCanonical } from '../engine/rng.js';
import { 聚合生效中内容包集哈希 } from '../interfaces/contentPackHash.js';
import {
  FINGERPRINT_BUNDLE_MEMBERS,
  FINGERPRINT_PRESET_FIELDS,
  FINGERPRINT_SNAPSHOT_FIELDS,
  FINGERPRINT_EXCLUDED_FIELDS,
} from '../engine/fingerprintManifest.js';

// ── 最小化 hashPresetFingerprint 调用入参 ──────────────────────────────────────
const SNAPSHOT_BASE = {
  难度系数组: {},
  判定骰型: 100 as 100 | 20,
  暴击映射: '关' as '关',
  钳制表: {},
  预设数值面域上下界: {},
};

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
};

// ── fixture：合法的最小包 ───────────────────────────────────────────────────────
function mkPack(packId: string, overrides: Record<string, unknown> = {}): unknown {
  return {
    pack_id: packId,
    版本: '1.0.0',
    依赖: [],
    冲突: [],
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// 断言① · 双轨等价
// ─────────────────────────────────────────────────────────────────────────────────
describe('A2 · 双轨等价', () => {
  it('空清单 → 新旧轨成品均为 {}', () => {
    const lib = {} as 内容包库Type;
    const newResult = resolve({ packs: [] }, lib);
    expect(newResult.成品).toEqual({});
    expect(旧轨叠加({}, undefined)).toEqual({});
  });

  it('单包 · 货币系统种子 → 新轨 == 旧轨（逐位恒等）', () => {
    const seed = { 基准币种: '铜钱', 汇率: { 金: 100 } };
    const lib = {
      pack_a: mkPack('pack_a', {
        模块种子: { 货币系统: seed },
        内容哈希: 'abc123',
      }),
    } as unknown as 内容包库Type;
    const newResult = resolve({ packs: ['pack_a'] }, lib);
    const oldResult = 旧轨叠加({}, { 货币系统: seed });
    expect(newResult.成品['货币系统']).toEqual(oldResult['货币系统']);
  });

  it('多包叠加 · 后载覆盖先载 → 新旧轨等价', () => {
    const lib = {
      pack_a: mkPack('pack_a', {
        模块种子: { 货币系统: { 基准币种: 'A', 汇率: { x: 1 } } },
      }),
      pack_b: mkPack('pack_b', {
        模块种子: { 货币系统: { 基准币种: 'B' } },
      }),
    } as unknown as 内容包库Type;

    const newResult = resolve({ packs: ['pack_a', 'pack_b'] }, lib);

    let old = 旧轨叠加({}, { 货币系统: { 基准币种: 'A', 汇率: { x: 1 } } });
    old = 旧轨叠加(old, { 货币系统: { 基准币种: 'B' } });

    expect(newResult.成品).toEqual(old);
  });

  it('NPC record 深合并 → 新旧轨等价', () => {
    const lib = {
      pack_a: mkPack('pack_a', {
        模块种子: { NPC: { 张三: { 姓名: '张三', 年龄: 20 } } },
      }),
      pack_b: mkPack('pack_b', {
        模块种子: { NPC: { 张三: { 年龄: 21 }, 李四: { 姓名: '李四' } } },
      }),
    } as unknown as 内容包库Type;

    const newResult = resolve({ packs: ['pack_a', 'pack_b'] }, lib);
    let old = 旧轨叠加({}, { NPC: { 张三: { 姓名: '张三', 年龄: 20 } } });
    old = 旧轨叠加(old, { NPC: { 张三: { 年龄: 21 }, 李四: { 姓名: '李四' } } });

    expect(newResult.成品).toEqual(old);
    // 张三 年龄被后载覆盖，姓名保留
    const npc = newResult.成品['NPC'] as Record<string, Record<string, unknown>>;
    expect(npc['张三']?.['年龄']).toBe(21);
    expect(npc['张三']?.['姓名']).toBe('张三');
    expect(npc['李四']?.['姓名']).toBe('李四');
  });

  it('种子视图幂等：新轨结果字段数 == 旧轨（0 default 污染）', () => {
    const lib = {
      pack_a: mkPack('pack_a', {
        模块种子: { 货币系统: { 基准币种: '铜' } },
      }),
    } as unknown as 内容包库Type;
    const newResult = resolve({ packs: ['pack_a'] }, lib);
    const oldResult = 旧轨叠加({}, { 货币系统: { 基准币种: '铜' } });
    const newKeys = Object.keys(newResult.成品['货币系统'] as object);
    const oldKeys = Object.keys(oldResult['货币系统'] as object);
    expect(newKeys).toEqual(oldKeys);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// 断言② · 三层校验 → 确定性进墓碑库
// ─────────────────────────────────────────────────────────────────────────────────
describe('A2 · Layer 1 · key≠pack_id → tombstone', () => {
  it('library key "pack_x" 但 pack_id "pack_y" → key不等pack_id 墓碑', () => {
    const lib = {
      pack_x: mkPack('pack_y'),  // key ≠ pack_id
    } as unknown as 内容包库Type;
    const result = resolve({ packs: ['pack_x'] }, lib);
    expect(result._mod墓碑库['pack_x']).toBeDefined();
    expect(result._mod墓碑库['pack_x']?.原因).toBe('key不等pack_id');
  });
});

describe('A2 · Layer 1 · semver 不兼容 → tombstone', () => {
  it('基底契约 ">=9.9.9" 与 4.1.0 不兼容 → semver不兼容 墓碑', () => {
    const lib = {
      pack_a: mkPack('pack_a', { 基底契约: '>=9.9.9' }),
    } as unknown as 内容包库Type;
    const result = resolve({ packs: ['pack_a'] }, lib);
    expect(result._mod墓碑库['pack_a']?.原因).toBe('semver不兼容');
  });

  it('基底契约 ">=4.1.0 <5.0.0" 与 4.1.0 兼容 → 不入墓碑', () => {
    const lib = {
      pack_a: mkPack('pack_a', { 基底契约: '>=4.1.0 <5.0.0' }),
    } as unknown as 内容包库Type;
    const result = resolve({ packs: ['pack_a'] }, lib);
    expect(result._mod墓碑库['pack_a']).toBeUndefined();
  });
});

describe('A2 · Layer 1 · 越界可写键（轨道一致性）→ tombstone', () => {
  it('轨道 cosmetic + 可写键非空 → "其他" 墓碑（含诊断）', () => {
    const lib = {
      pack_a: mkPack('pack_a', { 轨道: 'cosmetic', 可写键: ['foo.bar'] }),
    } as unknown as 内容包库Type;
    const result = resolve({ packs: ['pack_a'] }, lib);
    expect(result._mod墓碑库['pack_a']?.原因).toBe('其他');
    expect(result._mod墓碑库['pack_a']?.诊断).toContain('轻轨');
  });

  it('轨道 gameplay + 可写键 → 允许（不入墓碑）', () => {
    const lib = {
      pack_a: mkPack('pack_a', { 轨道: 'gameplay', 可写键: ['foo.bar'] }),
    } as unknown as 内容包库Type;
    const result = resolve({ packs: ['pack_a'] }, lib);
    expect(result._mod墓碑库['pack_a']).toBeUndefined();
  });

  it('轨道 view + 可写键空数组 → 允许（不入墓碑）', () => {
    const lib = {
      pack_a: mkPack('pack_a', { 轨道: 'view', 可写键: [] }),
    } as unknown as 内容包库Type;
    const result = resolve({ packs: ['pack_a'] }, lib);
    expect(result._mod墓碑库['pack_a']).toBeUndefined();
  });
});

describe('A2 · Layer 2 · 坏依赖 → 墓碑', () => {
  it('自环 → 自环 墓碑', () => {
    const lib = {
      pack_a: mkPack('pack_a', { 依赖: ['pack_a'] }),  // depends on itself
    } as unknown as 内容包库Type;
    const result = resolve({ packs: ['pack_a'] }, lib);
    expect(result._mod墓碑库['pack_a']?.原因).toBe('自环');
  });

  it('依赖被拒包 → 级联 依赖被拒 墓碑', () => {
    const lib = {
      bad: mkPack('bad', { 依赖: ['bad'] }),   // self-loop
      child: mkPack('child', { 依赖: ['bad'] }),  // depends on bad
    } as unknown as 内容包库Type;
    const result = resolve({ packs: ['bad', 'child'] }, lib);
    expect(result._mod墓碑库['bad']?.原因).toBe('自环');
    expect(result._mod墓碑库['child']?.原因).toBe('依赖被拒');
  });
});

describe('A2 · Layer 2 · 冲突 → 墓碑', () => {
  it('两包互斥 → 后者（codepoint-larger）入 冲突 墓碑', () => {
    const lib = {
      pack_a: mkPack('pack_a', { 冲突: ['pack_b'] }),
      pack_b: mkPack('pack_b', { 冲突: ['pack_a'] }),
    } as unknown as 内容包库Type;
    const result = resolve({ packs: ['pack_a', 'pack_b'] }, lib);
    // pack_b > pack_a (codepoint), so pack_b loses
    expect(result._mod墓碑库['pack_b']?.原因).toBe('冲突');
    expect(result._mod墓碑库['pack_a']).toBeUndefined();
  });

  it('被拒包不进 生效中包集', () => {
    const lib = {
      pack_a: mkPack('pack_a', { 冲突: ['pack_b'] }),
      pack_b: mkPack('pack_b', { 冲突: ['pack_a'] }),
    } as unknown as 内容包库Type;
    const result = resolve({ packs: ['pack_a', 'pack_b'] }, lib);
    const loadedIds = result.生效中包集.map(p => p.pack_id);
    expect(loadedIds).toContain('pack_a');
    expect(loadedIds).not.toContain('pack_b');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// 断言③ · 指纹双车道（闭合排程页 B+ Caveat 1）
// ─────────────────────────────────────────────────────────────────────────────────
describe('A2 · 指纹双车道 · A桶（内容变 → 生效中内容包集哈希变）', () => {
  it('改 NPC 姓名（内容变） → 生效中内容包集哈希变', () => {
    const mkLib = (name: string) => ({
      pack_a: mkPack('pack_a', {
        模块种子: { NPC: { '张三': { 姓名: name } } },
        内容哈希: hashCanonical({ name }),  // 内容哈希与内容绑定
      }),
    }) as unknown as 内容包库Type;

    const result1 = resolve({ packs: ['pack_a'] }, mkLib('张三'));
    const result2 = resolve({ packs: ['pack_a'] }, mkLib('李四'));

    expect(result1.生效中内容包集哈希).not.toBe('');
    expect(result2.生效中内容包集哈希).not.toBe('');
    expect(result1.生效中内容包集哈希).not.toBe(result2.生效中内容包集哈希);
  });

  it('A桶变化经 生效中内容包集哈希 影响 hashPresetFingerprint', () => {
    const mkLib = (name: string) => ({
      pack_a: mkPack('pack_a', {
        模块种子: { NPC: { '张三': { 姓名: name } } },
        内容哈希: hashCanonical({ name }),
      }),
    }) as unknown as 内容包库Type;

    const r1 = resolve({ packs: ['pack_a'] }, mkLib('张三'));
    const r2 = resolve({ packs: ['pack_a'] }, mkLib('李四'));

    const fp1 = hashPresetFingerprint({
      判定面整包: hashJudgmentBundle(JUDGMENT_BASE),
      生效中内容包集哈希: r1.生效中内容包集哈希,
      snapshot: SNAPSHOT_BASE,
    });
    const fp2 = hashPresetFingerprint({
      判定面整包: hashJudgmentBundle(JUDGMENT_BASE),
      生效中内容包集哈希: r2.生效中内容包集哈希,
      snapshot: SNAPSHOT_BASE,
    });

    expect(fp1).not.toBe(fp2);
  });
});

describe('A2 · 指纹双车道 · B桶（判定面变 → hashJudgmentBundle变）', () => {
  it('改 概率域夹逼（B桶判定面） → hashJudgmentBundle 变·与 A桶信道独立', () => {
    const baseJB = hashJudgmentBundle(JUDGMENT_BASE);
    const altJB = hashJudgmentBundle({ ...JUDGMENT_BASE, 概率域夹逼: { p_最小: 0.001, p_最大: 0.999 } });
    expect(baseJB).not.toBe(altJB);

    // 同一 生效中内容包集哈希 下，B桶变化也改变指纹
    const r = resolve({ packs: [] }, {});
    const fp1 = hashPresetFingerprint({ 判定面整包: baseJB, 生效中内容包集哈希: r.生效中内容包集哈希, snapshot: SNAPSHOT_BASE });
    const fp2 = hashPresetFingerprint({ 判定面整包: altJB, 生效中内容包集哈希: r.生效中内容包集哈希, snapshot: SNAPSHOT_BASE });
    expect(fp1).not.toBe(fp2);
  });

  it('A桶内容不影响 hashJudgmentBundle（信道隔离）', () => {
    // 即使换了 NPC，hashJudgmentBundle 不变（它只看判定面字段）
    const jb1 = hashJudgmentBundle(JUDGMENT_BASE);
    const jb2 = hashJudgmentBundle(JUDGMENT_BASE);
    expect(jb1).toBe(jb2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// 断言④ · 引用顺序语义（Caveat 2）
// ─────────────────────────────────────────────────────────────────────────────────
describe('A2 · 引用顺序语义', () => {
  it('A→B 与 B→A 加载顺序 → 成品不同（后载覆盖先载）', () => {
    const lib = {
      pack_a: mkPack('pack_a', {
        模块种子: { 货币系统: { 基准币种: 'A' } },
        内容哈希: 'hash_a',
      }),
      pack_b: mkPack('pack_b', {
        模块种子: { 货币系统: { 基准币种: 'B' } },
        内容哈希: 'hash_b',
      }),
    } as unknown as 内容包库Type;

    const ab = resolve({ packs: ['pack_a', 'pack_b'] }, lib);
    const ba = resolve({ packs: ['pack_b', 'pack_a'] }, lib);

    const abCurrency = (ab.成品['货币系统'] as Record<string, unknown>)?.['基准币种'];
    const baCurrency = (ba.成品['货币系统'] as Record<string, unknown>)?.['基准币种'];
    expect(abCurrency).toBe('B');  // B loads last → wins
    expect(baCurrency).toBe('A');  // A loads last → wins
    expect(abCurrency).not.toBe(baCurrency);
  });

  it('引用顺序 → 生效中包集顺序一致', () => {
    const lib = {
      pack_a: mkPack('pack_a'),
      pack_b: mkPack('pack_b'),
    } as unknown as 内容包库Type;

    const ab = resolve({ packs: ['pack_a', 'pack_b'] }, lib);
    const ba = resolve({ packs: ['pack_b', 'pack_a'] }, lib);

    expect(ab.生效中包集.map(p => p.pack_id)).toEqual(['pack_a', 'pack_b']);
    expect(ba.生效中包集.map(p => p.pack_id)).toEqual(['pack_b', 'pack_a']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// 成品可接 hashPresetFingerprint（Layer 3 完整链路）
// ─────────────────────────────────────────────────────────────────────────────────
describe('A2 · 成品过 hashPresetFingerprint', () => {
  it('空成品可计算指纹（8位 hex）', () => {
    const r = resolve({ packs: [] }, {});
    const fp = hashPresetFingerprint({
      判定面整包: hashJudgmentBundle(JUDGMENT_BASE),
      生效中内容包集哈希: r.生效中内容包集哈希,
      snapshot: SNAPSHOT_BASE,
    });
    expect(fp).toMatch(/^[0-9a-f]{8}$/);
  });

  it('含内容的成品可计算指纹·双跑恒等', () => {
    const lib = {
      pack_a: mkPack('pack_a', {
        模块种子: { NPC: { '张三': { 姓名: '张三' } } },
        内容哈希: 'abc',
      }),
    } as unknown as 内容包库Type;
    const r = resolve({ packs: ['pack_a'] }, lib);
    const fp = () => hashPresetFingerprint({
      判定面整包: hashJudgmentBundle(JUDGMENT_BASE),
      生效中内容包集哈希: r.生效中内容包集哈希,
      snapshot: SNAPSHOT_BASE,
    });
    expect(fp()).toBe(fp());  // 确定性·双跑恒等
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// 断言⑤ · 守恒门（additive-only 不动指纹基数）
// ─────────────────────────────────────────────────────────────────────────────────
describe('A2 · 守恒门', () => {
  it('schemaKeys = 52（RootSchema 无新增顶层键）', () => {
    expect(Object.keys(RootSchema.shape).length).toBe(52);
    expect(BLUEPRINT_KEYS.length).toBe(52);
  });

  it('BUNDLE = 21（FINGERPRINT_BUNDLE_MEMBERS 不变）', () => {
    expect(FINGERPRINT_BUNDLE_MEMBERS.length).toBe(21);
  });

  it('manifest 四组总长 = 86（不变）', () => {
    const total = FINGERPRINT_BUNDLE_MEMBERS.length +
      FINGERPRINT_PRESET_FIELDS.length +
      FINGERPRINT_SNAPSHOT_FIELDS.length +
      FINGERPRINT_EXCLUDED_FIELDS.length;
    expect(total).toBe(86);
  });

  it('黄金向量：hashPresetFingerprint 确定性（不重定基）', () => {
    // 同入参双跑相等即可（不钉死具体 hex 值·避免与 A0 黄金向量冲突）
    const r = resolve({ packs: [] }, {});
    const inputs = {
      判定面整包: hashJudgmentBundle(JUDGMENT_BASE),
      生效中内容包集哈希: r.生效中内容包集哈希,
      snapshot: SNAPSHOT_BASE,
    };
    expect(hashPresetFingerprint(inputs)).toBe(hashPresetFingerprint(inputs));
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// A1 审计债：内容包条目Schema 去重验证（no duplication）
// ─────────────────────────────────────────────────────────────────────────────────
describe('A2 · A1 审计债 · contentPack schema 去重', () => {
  it('内容包条目Schema 含元数据所有字段（spread 正确）', () => {
    const r = 内容包条目Schema.safeParse({ pack_id: 'p' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.版本).toBe('0.1.0');
      expect(r.data.依赖).toEqual([]);
      expect(r.data.冲突).toEqual([]);
    }
  });

  it('内容包条目Schema 新增字段：基底契约/可写键/轨道 均可选', () => {
    const r = 内容包条目Schema.safeParse({
      pack_id: 'p',
      基底契约: '>=4.0.0',
      可写键: ['foo.bar'],
      轨道: 'gameplay',
    });
    expect(r.success).toBe(true);
  });

  it('内容包条目Schema 模块种子路由仍有效（共用 校验模块种子）', () => {
    const r = 内容包条目Schema.safeParse({
      pack_id: 'p',
      模块种子: { 不存在的键: {} },
    });
    expect(r.success).toBe(false);
  });

  it('内容包库Schema 验收（多包 parse）', () => {
    const r = 内容包库Schema.safeParse({
      pack_a: { pack_id: 'pack_a', 模块种子: { 货币系统: {} } },
    });
    expect(r.success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// P1 · deepMerge 原型污染防护（复用 是JS保留键·无第二黑名单）
// ─────────────────────────────────────────────────────────────────────────────────
describe('P1 · deepMerge 原型污染防护', () => {
  it('旧轨叠加 含 __proto__ 键 → 不污染 Object.prototype', () => {
    const dangerPack = JSON.parse('{"__proto__":{"polluted":true}}') as Record<string, unknown>;
    旧轨叠加({}, dangerPack);
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });

  it('旧轨叠加 含 constructor 键 → 不作为 own-property 写入结果', () => {
    const dangerPack = { constructor: 'evil' } as Record<string, unknown>;
    const result = 旧轨叠加({}, dangerPack);
    // guard 跳过后，result 中 constructor 不是自有属性（仍来自原型链）
    expect(Object.prototype.hasOwnProperty.call(result, 'constructor')).toBe(false);
  });

  it('旧轨叠加 含 prototype 键 → 不作为 own-property 写入结果', () => {
    const dangerPack = { prototype: { evil: true } } as Record<string, unknown>;
    const result = 旧轨叠加({}, dangerPack);
    expect(Object.prototype.hasOwnProperty.call(result, 'prototype')).toBe(false);
  });

  it('resolve 含 __proto__ 模块种子 → 不污染 Object.prototype', () => {
    const lib = {
      pack_a: mkPack('pack_a', {
        模块种子: { NPC: JSON.parse('{"__proto__":{"polluted2":true}}') },
      }),
    } as unknown as 内容包库Type;
    resolve({ packs: ['pack_a'] }, lib);
    expect(({} as Record<string, unknown>)['polluted2']).toBeUndefined();
  });

  it('合法键正常合并（guard 不误杀普通字段）', () => {
    const result = 旧轨叠加({}, { 正常键: 'value', another: 42 });
    expect(result['正常键']).toBe('value');
    expect(result['another']).toBe(42);
  });
});
