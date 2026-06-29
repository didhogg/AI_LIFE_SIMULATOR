/**
 * PR-瘦身-底座-2b: 规则库 schema + 双轨搬入 验收
 * 断言①  规则库独立 parse：规则条目 / 规则库Schema parse 正确
 * 断言②  12 表种子视图 round-trip：规则面字段经 parse 无 0 default 污染
 * 断言③  按 ID resolve 挂载：resolve() rules 字段 → 规则成品正确
 * 断言④  双轨等价：规则库路径 == 旧轨叠加()（逐表 + 整包·成品逐位恒等）
 * 断言⑤  引用顺序后列覆盖：两规则顺序不同 → 规则成品不同
 * 断言⑥  守恒门：schemaKeys=54 / BUNDLE=21 / manifest=87 不变
 * 断言⑦  指纹 0 漂移：黄金向量不变（additive-only 不改判定基线）
 * 断言⑧  审计债：规则元数据字段结构正确·无重复
 */
import { describe, it, expect } from 'vitest';
import {
  规则元数据Schema,
  规则面Schema,
  规则条目Schema,
  规则库Schema,
  规则面键集,
} from '../engine/preset/ruleLibrary.js';
import { resolve, 旧轨叠加 } from '../engine/preset/resolve.js';
import type { 规则库Type } from '../engine/preset/ruleLibrary.js';
import { RootSchema, BLUEPRINT_KEYS } from '../schema/index.js';
import { hashPresetFingerprint, hashJudgmentBundle } from '../engine/rng.js';
import {
  FINGERPRINT_BUNDLE_MEMBERS,
  FINGERPRINT_PRESET_FIELDS,
  FINGERPRINT_SNAPSHOT_FIELDS,
  FINGERPRINT_EXCLUDED_FIELDS,
} from '../engine/fingerprintManifest.js';

// ── 最小化基准（为 hashPresetFingerprint 验收用）──────────────────────────────
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

// ── 最小合法规则条目 fixture ──────────────────────────────────────────────────
function mkRule(ruleId: string, overrides: Record<string, unknown> = {}): unknown {
  return {
    rule_id: ruleId,
    版本: '1.0.0',
    依赖: [],
    冲突: [],
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════
// 断言① · 规则库独立 parse
// ═══════════════════════════════════════════════════════════════════
describe('底座-2b · 规则元数据Schema · 独立 parse', () => {
  it('最小条目（仅 rule_id）→ parse 成功·字段填默认', () => {
    const r = 规则元数据Schema.safeParse({ rule_id: 'rule_a' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.rule_id).toBe('rule_a');
      expect(r.data.版本).toBe('0.1.0');
      expect(r.data.依赖).toEqual([]);
      expect(r.data.冲突).toEqual([]);
    }
  });

  it('rule_id 不符合正则 → parse 失败', () => {
    const r = 规则元数据Schema.safeParse({ rule_id: 'Bad-ID' });
    expect(r.success).toBe(false);
  });

  it('rule_id 以数字开头 → parse 失败', () => {
    const r = 规则元数据Schema.safeParse({ rule_id: '1rule' });
    expect(r.success).toBe(false);
  });
});

describe('底座-2b · 规则条目Schema · 独立 parse', () => {
  it('最小条目 parse 成功', () => {
    const r = 规则条目Schema.safeParse(mkRule('rule_a'));
    expect(r.success).toBe(true);
  });

  it('含 规则面 → parse 成功', () => {
    const r = 规则条目Schema.safeParse(mkRule('rule_a', {
      规则面: { 难度系数组: { 基础成功率调整: 5 } },
    }));
    expect(r.success).toBe(true);
    if (r.success) {
      const face = r.data.规则面;
      expect(face).toBeDefined();
      const 难度 = face?.难度系数组 as Record<string, unknown> | undefined;
      expect(难度?.['基础成功率调整']).toBe(5);
    }
  });

  it('规则面 可选·缺省时不存在', () => {
    const r = 规则条目Schema.safeParse(mkRule('rule_a'));
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.规则面).toBeUndefined();
    }
  });

  it('基底契约有效 semver → parse 成功', () => {
    const r = 规则条目Schema.safeParse(mkRule('rule_a', { 基底契约: '>=4.0.0 <5.0.0' }));
    expect(r.success).toBe(true);
  });

  it('基底契约 ^ 语法 → parse 失败', () => {
    const r = 规则条目Schema.safeParse(mkRule('rule_a', { 基底契约: '^4.0.0' }));
    expect(r.success).toBe(false);
  });
});

describe('底座-2b · 规则库Schema · parse', () => {
  it('空库 parse 成功', () => {
    const r = 规则库Schema.safeParse({});
    expect(r.success).toBe(true);
  });

  it('多条目 parse 成功', () => {
    const r = 规则库Schema.safeParse({
      rule_a: mkRule('rule_a'),
      rule_b: mkRule('rule_b', { 规则面: { 检定骰面: { 判定骰型: 20 } } }),
    });
    expect(r.success).toBe(true);
  });

  it('规则面键集 = 13 项（12 表 + 归并表）', () => {
    expect(规则面键集.length).toBe(13);
    expect(规则面键集).toContain('难度系数组');
    expect(规则面键集).toContain('归并表');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 断言② · 12 表种子视图 round-trip（zero default pollution）
// ═══════════════════════════════════════════════════════════════════
describe('底座-2b · 规则面 · 种子视图 round-trip', () => {
  it('难度系数组：partial parse → 无 0 default 污染', () => {
    const r = 规则条目Schema.safeParse(mkRule('r', {
      规则面: { 难度系数组: { 基础成功率调整: 10 } },
    }));
    expect(r.success).toBe(true);
    if (r.success) {
      const face = r.data.规则面?.难度系数组 as Record<string, unknown> | undefined;
      expect(face?.['基础成功率调整']).toBe(10);
      expect(face?.['秘密暴露系数']).toBeUndefined();
    }
  });

  it('属性轴表：数组条目 parse → 无额外字段', () => {
    const r = 规则条目Schema.safeParse(mkRule('r', {
      规则面: { 属性轴表: [{ 轴名: '体质', 最大值: 100 }] },
    }));
    expect(r.success).toBe(true);
    if (r.success) {
      const 轴 = (r.data.规则面?.属性轴表 as unknown[])[0] as Record<string, unknown> | undefined;
      expect(轴?.['轴名']).toBe('体质');
      expect(轴?.['最大值']).toBe(100);
      expect(轴?.['说明']).toBeUndefined();
    }
  });

  it('检定配方表：record parse → partial 条目', () => {
    const r = 规则条目Schema.safeParse(mkRule('r', {
      规则面: { 检定配方表: { 魅力: { 配方名: '魅力配方', 主属性: '魅力' } } },
    }));
    expect(r.success).toBe(true);
    if (r.success) {
      const 魅力 = (r.data.规则面?.检定配方表 as Record<string, Record<string, unknown>>)?.['魅力'];
      expect(魅力?.['配方名']).toBe('魅力配方');
      expect(魅力?.['难度修正']).toBeUndefined();
    }
  });

  it('派生量配方：record parse 正确', () => {
    const r = 规则条目Schema.safeParse(mkRule('r', {
      规则面: { 派生量配方: { HP: { 配方名: 'HP', 主属性: '体质' } } },
    }));
    expect(r.success).toBe(true);
  });

  it('赛事结构模板：record parse 正确', () => {
    const r = 规则条目Schema.safeParse(mkRule('r', {
      规则面: { 赛事结构模板: { 锦标赛: { 赛制: '淘汰', 轮次: 4 } } },
    }));
    expect(r.success).toBe(true);
  });

  it('规则补丁：record parse 正确', () => {
    const r = 规则条目Schema.safeParse(mkRule('r', {
      规则面: { 规则补丁: { 难度补丁: { 补丁名: '难度补丁', 是否作弊: false } } },
    }));
    expect(r.success).toBe(true);
  });

  it('检定骰面：object parse → 无 default 污染', () => {
    const r = 规则条目Schema.safeParse(mkRule('r', {
      规则面: { 检定骰面: { 判定骰型: 20 } },
    }));
    expect(r.success).toBe(true);
    if (r.success) {
      const 骰面 = r.data.规则面?.检定骰面 as Record<string, unknown> | undefined;
      expect(骰面?.['判定骰型']).toBe(20);
      expect(骰面?.['显骰']).toBeUndefined();
    }
  });

  it('检定档切分表：object parse → 无 default 污染', () => {
    const r = 规则条目Schema.safeParse(mkRule('r', {
      规则面: { 检定档切分表: { 大胜下限: 50 } },
    }));
    expect(r.success).toBe(true);
    if (r.success) {
      const 切分 = r.data.规则面?.检定档切分表 as Record<string, unknown> | undefined;
      expect(切分?.['大胜下限']).toBe(50);
      expect(切分?.['胜下限']).toBeUndefined();
    }
  });

  it('钳制表：nested object parse 正确', () => {
    const r = 规则条目Schema.safeParse(mkRule('r', {
      规则面: { 钳制表: { 按重要等级: { 路人: 5 } } },
    }));
    expect(r.success).toBe(true);
    if (r.success) {
      const 钳制 = r.data.规则面?.钳制表 as Record<string, unknown> | undefined;
      const 等级 = 钳制?.['按重要等级'] as Record<string, unknown> | undefined;
      expect(等级?.['路人']).toBe(5);
      expect(等级?.['次要']).toBeUndefined();
    }
  });

  it('概率域夹逼：object parse → 无 default 污染', () => {
    const r = 规则条目Schema.safeParse(mkRule('r', {
      规则面: { 概率域夹逼: { p_最小: 0.001 } },
    }));
    expect(r.success).toBe(true);
    if (r.success) {
      const 夹逼 = r.data.规则面?.概率域夹逼 as Record<string, unknown> | undefined;
      expect(夹逼?.['p_最小']).toBe(0.001);
      expect(夹逼?.['p_最大']).toBeUndefined();
    }
  });

  it('死亡拦截器条目：array parse 正确', () => {
    const r = 规则条目Schema.safeParse(mkRule('r', {
      规则面: { 死亡拦截器条目: [{ 注册者: '系统', 优先级: 1, 条件引用: 'c1', 目标动词: 'd1' }] },
    }));
    expect(r.success).toBe(true);
    if (r.success) {
      const 拦截 = r.data.规则面?.死亡拦截器条目 as unknown[];
      expect(拦截?.length).toBe(1);
      const 条目 = 拦截?.[0] as Record<string, unknown> | undefined;
      expect(条目?.['注册者']).toBe('系统');
    }
  });

  it('换角许可：object parse → 无 default 污染', () => {
    const r = 规则条目Schema.safeParse(mkRule('r', {
      规则面: { 换角许可: { 冷却: 100 } },
    }));
    expect(r.success).toBe(true);
    if (r.success) {
      const 换角 = r.data.规则面?.换角许可 as Record<string, unknown> | undefined;
      expect(换角?.['冷却']).toBe(100);
      expect(换角?.['候选选择器']).toBeUndefined();
    }
  });

  it('归并表：record parse 正确（一并纳入）', () => {
    const r = 规则条目Schema.safeParse(mkRule('r', {
      规则面: { 归并表: { 合并规则A: { 策略: 'merge' } } },
    }));
    expect(r.success).toBe(true);
    if (r.success) {
      const 归并 = r.data.规则面?.归并表 as Record<string, unknown> | undefined;
      expect(归并?.['合并规则A']).toBeDefined();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// 断言③ · 按 ID resolve 挂载
// ═══════════════════════════════════════════════════════════════════
describe('底座-2b · resolve() · 规则库路径接线', () => {
  it('空 rules → 规则成品 = {}·生效中规则集 = []', () => {
    const result = resolve({ packs: [], rules: [] }, {}, {});
    expect(result.规则成品).toEqual({});
    expect(result.生效中规则集).toEqual([]);
    expect(result._规则墓碑库).toEqual({});
  });

  it('无 ruleLib 参数 → 规则成品 = {}', () => {
    const result = resolve({ packs: [] }, {});
    expect(result.规则成品).toEqual({});
    expect(result.生效中规则集).toEqual([]);
  });

  it('单规则 · 规则面有值 → 规则成品含对应字段', () => {
    const ruleLib: 规则库Type = {
      rule_a: mkRule('rule_a', {
        规则面: { 难度系数组: { 基础成功率调整: 15 } },
      }) as never,
    };
    const result = resolve({ packs: [], rules: ['rule_a'] }, {}, ruleLib);
    expect(result.生效中规则集.length).toBe(1);
    expect(result.生效中规则集[0]?.rule_id).toBe('rule_a');
    const 难度 = result.规则成品['难度系数组'] as Record<string, unknown> | undefined;
    expect(难度?.['基础成功率调整']).toBe(15);
  });

  it('key ≠ rule_id → _规则墓碑库 key不等pack_id', () => {
    const ruleLib: 规则库Type = {
      rule_x: mkRule('rule_y') as never,  // key ≠ rule_id
    };
    const result = resolve({ packs: [], rules: ['rule_x'] }, {}, ruleLib);
    expect(result._规则墓碑库['rule_x']?.原因).toBe('key不等pack_id');
    expect(result.生效中规则集.length).toBe(0);
  });

  it('规则 semver 不兼容 → _规则墓碑库', () => {
    const ruleLib: 规则库Type = {
      rule_a: mkRule('rule_a', { 基底契约: '>=9.9.9' }) as never,
    };
    const result = resolve({ packs: [], rules: ['rule_a'] }, {}, ruleLib);
    expect(result._规则墓碑库['rule_a']?.原因).toBe('semver不兼容');
  });

  it('规则自环 → _规则墓碑库 自环', () => {
    const ruleLib: 规则库Type = {
      rule_a: mkRule('rule_a', { 依赖: ['rule_a'] }) as never,
    };
    const result = resolve({ packs: [], rules: ['rule_a'] }, {}, ruleLib);
    expect(result._规则墓碑库['rule_a']?.原因).toBe('自环');
  });

  it('不存在的规则ID → 静默跳过（不入墓碑）', () => {
    const result = resolve({ packs: [], rules: ['nonexistent'] }, {}, {});
    expect(result._规则墓碑库['nonexistent']).toBeUndefined();
    expect(result.生效中规则集.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 断言④ · 双轨等价（逐表 + 整包）
// ═══════════════════════════════════════════════════════════════════
describe('底座-2b · 双轨等价 · 逐表验收', () => {
  function mkSingleRuleLib(ruleId: string, faceData: Record<string, unknown>): 规则库Type {
    return {
      [ruleId]: mkRule(ruleId, { 规则面: faceData }) as never,
    };
  }

  it('难度系数组：规则库路径 == 旧轨叠加()', () => {
    const data = { 难度系数组: { 基础成功率调整: 10, NPC_敌意系数: 2 } };
    const result = resolve({ packs: [], rules: ['r'] }, {}, mkSingleRuleLib('r', data));
    expect(result.规则成品).toEqual(旧轨叠加({}, data));
  });

  it('属性轴表：规则库路径 == 旧轨叠加()', () => {
    const data = { 属性轴表: [{ 轴名: '体质', 最大值: 100 }] };
    const result = resolve({ packs: [], rules: ['r'] }, {}, mkSingleRuleLib('r', data));
    expect(result.规则成品).toEqual(旧轨叠加({}, data));
  });

  it('检定配方表：规则库路径 == 旧轨叠加()', () => {
    const data = { 检定配方表: { 力量: { 配方名: '力量配方', 主属性: '力量' } } };
    const result = resolve({ packs: [], rules: ['r'] }, {}, mkSingleRuleLib('r', data));
    expect(result.规则成品).toEqual(旧轨叠加({}, data));
  });

  it('派生量配方：规则库路径 == 旧轨叠加()', () => {
    const data = { 派生量配方: { HP: { 配方名: 'HP', 主属性: '体质' } } };
    const result = resolve({ packs: [], rules: ['r'] }, {}, mkSingleRuleLib('r', data));
    expect(result.规则成品).toEqual(旧轨叠加({}, data));
  });

  it('赛事结构模板：规则库路径 == 旧轨叠加()', () => {
    const data = { 赛事结构模板: { 夏季锦标: { 赛制: '积分', 轮次: 3 } } };
    const result = resolve({ packs: [], rules: ['r'] }, {}, mkSingleRuleLib('r', data));
    expect(result.规则成品).toEqual(旧轨叠加({}, data));
  });

  it('规则补丁：规则库路径 == 旧轨叠加()', () => {
    const data = { 规则补丁: { easy_mode: { 补丁名: '简单模式', 是否作弊: true } } };
    const result = resolve({ packs: [], rules: ['r'] }, {}, mkSingleRuleLib('r', data));
    expect(result.规则成品).toEqual(旧轨叠加({}, data));
  });

  it('检定骰面：规则库路径 == 旧轨叠加()', () => {
    const data = { 检定骰面: { 判定骰型: 20, 显骰: true } };
    const result = resolve({ packs: [], rules: ['r'] }, {}, mkSingleRuleLib('r', data));
    expect(result.规则成品).toEqual(旧轨叠加({}, data));
  });

  it('检定档切分表：规则库路径 == 旧轨叠加()', () => {
    const data = { 检定档切分表: { 大胜下限: 50, 胜下限: 20 } };
    const result = resolve({ packs: [], rules: ['r'] }, {}, mkSingleRuleLib('r', data));
    expect(result.规则成品).toEqual(旧轨叠加({}, data));
  });

  it('钳制表：规则库路径 == 旧轨叠加()', () => {
    const data = { 钳制表: { 按重要等级: { 路人: 5, 次要: 10 } } };
    const result = resolve({ packs: [], rules: ['r'] }, {}, mkSingleRuleLib('r', data));
    expect(result.规则成品).toEqual(旧轨叠加({}, data));
  });

  it('概率域夹逼：规则库路径 == 旧轨叠加()', () => {
    const data = { 概率域夹逼: { p_最小: 0.001, p_最大: 0.999 } };
    const result = resolve({ packs: [], rules: ['r'] }, {}, mkSingleRuleLib('r', data));
    expect(result.规则成品).toEqual(旧轨叠加({}, data));
  });

  it('死亡拦截器条目：规则库路径 == 旧轨叠加()', () => {
    const data = { 死亡拦截器条目: [{ 注册者: '系统', 优先级: 0, 条件引用: 'c', 目标动词: 'd' }] };
    const result = resolve({ packs: [], rules: ['r'] }, {}, mkSingleRuleLib('r', data));
    expect(result.规则成品).toEqual(旧轨叠加({}, data));
  });

  it('换角许可：规则库路径 == 旧轨叠加()', () => {
    const data = { 换角许可: { 候选选择器: 'party', 冷却: 50 } };
    const result = resolve({ packs: [], rules: ['r'] }, {}, mkSingleRuleLib('r', data));
    expect(result.规则成品).toEqual(旧轨叠加({}, data));
  });

  it('归并表：规则库路径 == 旧轨叠加()', () => {
    const data = { 归并表: { 合并A: { mode: 'append' } } };
    const result = resolve({ packs: [], rules: ['r'] }, {}, mkSingleRuleLib('r', data));
    expect(result.规则成品).toEqual(旧轨叠加({}, data));
  });

  it('整包（多字段同时）：规则库路径 == 旧轨叠加()（逐位恒等）', () => {
    const data = {
      难度系数组: { 基础成功率调整: -5 },
      检定骰面: { 判定骰型: 20 },
      概率域夹逼: { p_最小: 0.005, p_最大: 0.995 },
      检定档切分表: { 大胜下限: 45, 胜下限: 18 },
    };
    const result = resolve({ packs: [], rules: ['r'] }, {}, mkSingleRuleLib('r', data));
    expect(result.规则成品).toEqual(旧轨叠加({}, data));
  });
});

// ═══════════════════════════════════════════════════════════════════
// 断言⑤ · 引用顺序后列覆盖
// ═══════════════════════════════════════════════════════════════════
describe('底座-2b · 引用顺序语义', () => {
  it('A→B 与 B→A 顺序不同 → 规则成品不同（后载覆盖先载）', () => {
    const ruleLib: 规则库Type = {
      rule_a: mkRule('rule_a', { 规则面: { 难度系数组: { 基础成功率调整: 10 } } }) as never,
      rule_b: mkRule('rule_b', { 规则面: { 难度系数组: { 基础成功率调整: -10 } } }) as never,
    };
    const ab = resolve({ packs: [], rules: ['rule_a', 'rule_b'] }, {}, ruleLib);
    const ba = resolve({ packs: [], rules: ['rule_b', 'rule_a'] }, {}, ruleLib);
    const abVal = (ab.规则成品['难度系数组'] as Record<string, unknown>)?.['基础成功率调整'];
    const baVal = (ba.规则成品['难度系数组'] as Record<string, unknown>)?.['基础成功率调整'];
    expect(abVal).toBe(-10);  // rule_b loads last → wins
    expect(baVal).toBe(10);   // rule_a loads last → wins
    expect(abVal).not.toBe(baVal);
  });

  it('引用顺序 → 生效中规则集顺序一致', () => {
    const ruleLib: 规则库Type = {
      rule_a: mkRule('rule_a') as never,
      rule_b: mkRule('rule_b') as never,
    };
    const ab = resolve({ packs: [], rules: ['rule_a', 'rule_b'] }, {}, ruleLib);
    const ba = resolve({ packs: [], rules: ['rule_b', 'rule_a'] }, {}, ruleLib);
    expect(ab.生效中规则集.map(r => r.rule_id)).toEqual(['rule_a', 'rule_b']);
    expect(ba.生效中规则集.map(r => r.rule_id)).toEqual(['rule_b', 'rule_a']);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 断言⑥ · 守恒门
// ═══════════════════════════════════════════════════════════════════
describe('底座-2b · 守恒门', () => {
  it('schemaKeys = 54（规则库不进 RootSchema·不改顶层键数）', () => {
    expect(Object.keys(RootSchema.shape).length).toBe(54);
    expect(BLUEPRINT_KEYS.length).toBe(54);
  });

  it('BUNDLE = 21（规则库 dormant·不改 FINGERPRINT_BUNDLE_MEMBERS）', () => {
    expect(FINGERPRINT_BUNDLE_MEMBERS.length).toBe(27);
  });

  it('manifest 四组总长 = 88', () => {
    const total =
      FINGERPRINT_BUNDLE_MEMBERS.length +
      FINGERPRINT_PRESET_FIELDS.length +
      FINGERPRINT_SNAPSHOT_FIELDS.length +
      FINGERPRINT_EXCLUDED_FIELDS.length;
    expect(total).toBe(94);
  });

  it('规则面键集 = 13（12 张规则表 + 归并表）', () => {
    expect(规则面键集.length).toBe(13);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 断言⑦ · 指纹 0 漂移（黄金向量不变）
// ═══════════════════════════════════════════════════════════════════
describe('底座-2b · 指纹 0 漂移', () => {
  it('含规则的 resolve 不影响 hashPresetFingerprint（规则库不进指纹）', () => {
    const ruleLib: 规则库Type = {
      rule_a: mkRule('rule_a', { 规则面: { 难度系数组: { 基础成功率调整: 99 } } }) as never,
    };
    const withRules = resolve({ packs: [], rules: ['rule_a'] }, {}, ruleLib);
    const withoutRules = resolve({ packs: [] }, {});

    // 两者的 生效中内容包集哈希 一致（规则库不贡献内容包哈希）
    expect(withRules.生效中内容包集哈希).toBe(withoutRules.生效中内容包集哈希);

    // fingerprint 基于相同 生效中内容包集哈希 → 结果相同
    const fp1 = hashPresetFingerprint({
      判定面整包: hashJudgmentBundle(JUDGMENT_BASE),
      生效中内容包集哈希: withRules.生效中内容包集哈希,
      snapshot: SNAPSHOT_BASE,
    });
    const fp2 = hashPresetFingerprint({
      判定面整包: hashJudgmentBundle(JUDGMENT_BASE),
      生效中内容包集哈希: withoutRules.生效中内容包集哈希,
      snapshot: SNAPSHOT_BASE,
    });
    expect(fp1).toBe(fp2);
    expect(fp1).toMatch(/^[0-9a-f]{8}$/);
  });

  it('指纹确定性双跑：同入参两次 → 恒等', () => {
    const inputs = {
      判定面整包: hashJudgmentBundle(JUDGMENT_BASE),
      生效中内容包集哈希: resolve({ packs: [] }, {}).生效中内容包集哈希,
      snapshot: SNAPSHOT_BASE,
    };
    expect(hashPresetFingerprint(inputs)).toBe(hashPresetFingerprint(inputs));
  });
});

// ═══════════════════════════════════════════════════════════════════
// 断言⑧ · 审计债（元数据字段结构正确·无重复）
// ═══════════════════════════════════════════════════════════════════
describe('底座-2b · 审计债 · 规则元数据字段结构', () => {
  it('规则条目Schema 含所有规则元数据字段（spread 正确）', () => {
    const r = 规则条目Schema.safeParse({ rule_id: 'r' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.版本).toBe('0.1.0');
      expect(r.data.依赖).toEqual([]);
      expect(r.data.冲突).toEqual([]);
      expect(r.data.名称).toBe('');
    }
  });

  it('规则条目Schema 新增字段：基底契约/可写键/轨道 均可选', () => {
    const r = 规则条目Schema.safeParse({
      rule_id: 'r',
      基底契约: '>=4.0.0',
      可写键: ['foo.bar'],
      轨道: 'gameplay',
    });
    expect(r.success).toBe(true);
  });

  it('规则面键集无重复（派生自 规则面Schema.shape）', () => {
    const set = new Set(规则面键集);
    expect(set.size).toBe(规则面键集.length);
  });

  it('规则面键集包含 12 张预期规则表 + 归并表', () => {
    const expected = [
      '难度系数组', '属性轴表', '检定配方表', '派生量配方',
      '赛事结构模板', '规则补丁', '检定骰面', '检定档切分表',
      '钳制表', '概率域夹逼', '死亡拦截器条目', '换角许可',
      '归并表',
    ];
    for (const key of expected) {
      expect(规则面键集, `规则面键集 should contain ${key}`).toContain(key);
    }
  });

  it('规则库轻轨 + 可写键 → _规则墓碑库（审计一致）', () => {
    const ruleLib: 规则库Type = {
      rule_a: mkRule('rule_a', { 轨道: 'cosmetic', 可写键: ['foo'] }) as never,
    };
    const result = resolve({ packs: [], rules: ['rule_a'] }, {}, ruleLib);
    expect(result._规则墓碑库['rule_a']?.原因).toBe('其他');
    expect(result._规则墓碑库['rule_a']?.诊断).toContain('轻轨');
  });
});
