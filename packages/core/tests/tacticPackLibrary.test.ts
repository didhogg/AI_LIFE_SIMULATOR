// 战术包库 · 剥离③ · additive · dormant · 不进 hashJudgmentBundle
// 断言① parse · ②ID正则 · ③value域 · ④resolve挂载 · ⑤不进hashJudgmentBundle · ⑥content_hash · ⑦守恒门
import { describe, it, expect } from 'vitest';
import { 战术包库Schema, 战术包定义条目Schema, 战术包ID正则 } from '../schema/tacticPackLibrary.js';
import { 命名空间枚举 } from '../schema/governedKeySpace.js';
import { 冰箱绑定表 } from '../engine/preset/refBinding.js';
import { resolve } from '../engine/preset/resolve.js';
import { RootSchema } from '../schema/index.js';
import { FINGERPRINT_BUNDLE_MEMBERS, FINGERPRINT_EXCLUDED_FIELDS } from '../engine/fingerprintManifest.js';

describe('战术包库 · 剥离③', () => {
  // 断言① parse — 基本解析 + default 填充
  it('① 空库默认 {}', () => {
    expect(战术包库Schema.parse(undefined)).toEqual({});
    expect(战术包库Schema.parse({})).toEqual({});
  });

  it('① 单条目解析', () => {
    const result = 战术包库Schema.parse({
      flanking: {
        名称: '侧翼包抄',
        前置: { 地形: ['平原'], 兵种: ['骑兵'], 情报阈值: 30 },
        修正包: { 命中率: 0.2 },
        风险: '侧翼过长易断',
        母题标签: ['战争', '机动'],
      },
    });
    expect(result['flanking']?.名称).toBe('侧翼包抄');
    expect(result['flanking']?.前置.地形).toEqual(['平原']);
    expect(result['flanking']?.修正包['命中率']).toBe(0.2);
  });

  it('① 数据体 defaults 填充', () => {
    const result = 战术包库Schema.parse({ def: { 名称: '默认战术' } });
    expect(result['def']?.前置.地形).toEqual([]);
    expect(result['def']?.前置.情报阈值).toBe(0);
    expect(result['def']?.修正包).toEqual({});
    expect(result['def']?.风险).toBe('');
    expect(result['def']?.母题标签).toEqual([]);
  });

  // 断言② ID 正则
  it('② ID 须为蛇形 /^[a-z][a-z0-9_]*$/', () => {
    expect(() => 战术包库Schema.parse({ 'BadId': { 名称: 'x' } })).toThrow();
    expect(() => 战术包库Schema.parse({ '123abc': { 名称: 'x' } })).toThrow();
    expect(() => 战术包库Schema.parse({ 'valid_id': { 名称: 'x' } })).not.toThrow();
  });

  // 断言③ value 域
  it('③ 情报阈值 0~100 域', () => {
    expect(() => 战术包库Schema.parse({
      t: { 名称: 'x', 前置: { 情报阈值: -1 } },
    })).toThrow();
    expect(() => 战术包库Schema.parse({
      t: { 名称: 'x', 前置: { 情报阈值: 101 } },
    })).toThrow();
  });

  // 断言④ resolve 挂载
  it('④ resolve() 挂载 战术包成品', () => {
    const lib = 战术包库Schema.parse({
      flanking: { 名称: '侧翼包抄' },
      charge:   { 名称: '冲锋' },
    });
    const result = resolve(
      { packs: [] },
      {},
      undefined, undefined, undefined, undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined, undefined, undefined,
      undefined, lib,
    );
    // 未声明 manifest.战术包 → 成品为空（dormant）
    expect(result.战术包成品).toEqual({});
    expect(result.生效中战术包集).toHaveLength(0);
  });

  it('④ resolve() 挂载 manifest.战术包', () => {
    const lib = 战术包库Schema.parse({
      flanking: { 名称: '侧翼' },
      charge:   { 名称: '冲锋' },
    });
    const result = resolve(
      { packs: [], 战术包: ['flanking'] },
      {},
      undefined, undefined, undefined, undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined, undefined, undefined,
      undefined, lib,
    );
    expect(Object.keys(result.战术包成品)).toEqual(['flanking']);
    expect(result.生效中战术包集).toHaveLength(1);
    expect(result.战术包成品['flanking']?.名称).toBe('侧翼');
  });

  it('④ 库中不存在的引用 → 跳过（不入墓碑）', () => {
    const lib = 战术包库Schema.parse({ flanking: { 名称: '侧翼' } });
    const result = resolve(
      { packs: [], 战术包: ['missing_id', 'flanking'] },
      {},
      undefined, undefined, undefined, undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined, undefined, undefined,
      undefined, lib,
    );
    expect(Object.keys(result.战术包成品)).toEqual(['flanking']);
  });

  // 断言⑤ 不进 hashJudgmentBundle
  it('⑤ 战术包不在 FINGERPRINT_BUNDLE_MEMBERS', () => {
    const allFingerprint = [...FINGERPRINT_BUNDLE_MEMBERS, ...FINGERPRINT_EXCLUDED_FIELDS];
    // 战术包库不对应 hashJudgmentBundle 任何字段
    expect(FINGERPRINT_BUNDLE_MEMBERS).not.toContain('战术包');
  });

  // 断言⑥ content_hash
  it('⑥ content_hash optional string', () => {
    const result = 战术包定义条目Schema.parse({
      名称: '侧翼',
      内容哈希: 'abc123',
    });
    expect(result.内容哈希).toBe('abc123');
  });

  // 断言⑦ 守恒门
  it('⑦ 守恒门：schemaKeys=52 / BUNDLE=21 / manifest=86 / 命名空间枚举=32项（含战术包）', () => {
    expect(Object.keys(RootSchema.shape).length).toBe(52);
    expect(FINGERPRINT_BUNDLE_MEMBERS.length).toBe(21);
    expect(命名空间枚举.length).toBe(32);
    expect(命名空间枚举).toContain('战术包');
    expect(冰箱绑定表['战术包']?.解析器键).toBe('战术包库');
  });
});
