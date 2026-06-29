// 母题配额库 · 剥离③ · additive · dormant · 进 hashJudgmentBundle（投影回填）
// 断言① parse · ②ID正则 · ③value域 · ④等价金测 · ⑤指纹金测·0重定基 · ⑥resolve挂载 · ⑦content_hash · ⑧守恒门
import { describe, it, expect } from 'vitest';
import {
  母题配额库Schema,
  母题配额定义条目Schema,
  母题配额ID正则,
  投影母题配额库,
} from '../schema/motifQuotaLibrary.js';
import type { 母题配额库Type } from '../schema/motifQuotaLibrary.js';
import { 母题配额Schema } from '../schema/preset.js';
import { resolve } from '../engine/preset/resolve.js';
import { 命名空间枚举 } from '../schema/governedKeySpace.js';
import { 冰箱绑定表 } from '../engine/preset/refBinding.js';
import { RootSchema } from '../schema/index.js';
import { hashJudgmentBundle, hashCanonical, hashPresetFingerprint } from '../engine/rng.js';
import { FINGERPRINT_BUNDLE_MEMBERS } from '../engine/fingerprintManifest.js';

// JUDGMENT_BASE：hashJudgmentBundle 的基准参数（除 母题配额 外·0 重定基验收）
const JUDGMENT_BASE = {
  历法皮肤:         {},
  粒度模板覆盖:     {},
  种族模板:         {},
  母题配额:         {},  // 占位·测试中按场景替换
  媒体渠道表:       {},
  检定配方表:       {},
  检定档切分表:     {},
  欠债参数:         {},
  赛事结构模板:     {},
  派生量配方:       {},
  概率域夹逼:       {},
  纠缠闭包弱边阈值: 0.2,
};

const SNAPSHOT_BASE = {
  难度系数组:           {},
  判定骰型:             100 as 100 | 20,
  暴击映射:             '关' as '关',
  钳制表:               {},
  预设数值面域上下界:   {},
};

// 标准母题配额（旧格式）
const QUOTA_RAW = {
  romance: { 基础权重: 2,   每游戏年上限: 3, 互斥组: 'love' },
  war:     { 基础权重: 1.5, 每游戏年上限: 0, 互斥组: '' },
};

describe('母题配额库 · 剥离③', () => {
  // 断言① parse
  it('① 空库默认 {}', () => {
    expect(母题配额库Schema.parse(undefined)).toEqual({});
    expect(母题配额库Schema.parse({})).toEqual({});
  });

  it('① 数据体 defaults 填充', () => {
    const result = 母题配额库Schema.parse({ q: { 名称: '默认配额' } });
    expect(result['q']?.基础权重).toBe(1);
    expect(result['q']?.每游戏年上限).toBe(0);
    expect(result['q']?.互斥组).toBe('');
  });

  it('① 全字段条目', () => {
    const lib = 母题配额库Schema.parse({
      romance: { 名称: '爱情母题', 基础权重: 2, 每游戏年上限: 3, 互斥组: 'love' },
    });
    expect(lib['romance']?.基础权重).toBe(2);
    expect(lib['romance']?.每游戏年上限).toBe(3);
    expect(lib['romance']?.互斥组).toBe('love');
  });

  // 断言② ID 正则
  it('② ID 须为蛇形 /^[a-z][a-z0-9_]*$/', () => {
    expect(() => 母题配额库Schema.parse({ 'BadId': { 名称: 'x' } })).toThrow();
    expect(() => 母题配额库Schema.parse({ 'valid_quota': { 名称: 'x' } })).not.toThrow();
  });

  // 断言③ value 域
  it('③ 基础权重须 >= 0', () => {
    expect(() => 母题配额库Schema.parse({
      q: { 名称: 'x', 基础权重: -0.1 },
    })).toThrow();
    expect(() => 母题配额库Schema.parse({
      q: { 名称: 'x', 基础权重: 0 },
    })).not.toThrow();
  });

  it('③ 每游戏年上限须 >= 0 整数', () => {
    expect(() => 母题配额库Schema.parse({
      q: { 名称: 'x', 每游戏年上限: -1 },
    })).toThrow();
    expect(() => 母题配额库Schema.parse({
      q: { 名称: 'x', 每游戏年上限: 1.5 },
    })).toThrow();
    expect(() => 母题配额库Schema.parse({
      q: { 名称: 'x', 每游戏年上限: 0 },
    })).not.toThrow();
  });

  // 断言④ 等价金测：投影 deepEqual 旧格式
  it('④ 等价金测：投影母题配额库 deepEqual 旧 母题配额Schema.parse()', () => {
    const 旧格式 = 母题配额Schema.parse(QUOTA_RAW);

    const lib: 母题配额库Type = 母题配额库Schema.parse({
      romance: { 名称: '爱情', 基础权重: 2,   每游戏年上限: 3, 互斥组: 'love' },
      war:     { 名称: '战争', 基础权重: 1.5, 每游戏年上限: 0, 互斥组: '' },
    });

    const projected = 投影母题配额库(lib);
    expect(projected).toEqual(旧格式);
  });

  // 断言⑤ 指纹金测·0 重定基
  it('⑤ hashCanonical(投影) === hashCanonical(旧格式)', () => {
    const 旧格式 = 母题配额Schema.parse(QUOTA_RAW);
    const lib: 母题配额库Type = 母题配额库Schema.parse({
      romance: { 名称: '爱情', 基础权重: 2,   每游戏年上限: 3, 互斥组: 'love' },
      war:     { 名称: '战争', 基础权重: 1.5, 每游戏年上限: 0, 互斥组: '' },
    });
    const projected = 投影母题配额库(lib);
    expect(hashCanonical(projected)).toBe(hashCanonical(旧格式));
  });

  it('⑤ hashJudgmentBundle：投影路径 === 旧路径（指纹不变）', () => {
    const 旧格式 = 母题配额Schema.parse(QUOTA_RAW);
    const lib: 母题配额库Type = 母题配额库Schema.parse({
      romance: { 名称: '爱情', 基础权重: 2,   每游戏年上限: 3, 互斥组: 'love' },
      war:     { 名称: '战争', 基础权重: 1.5, 每游戏年上限: 0, 互斥组: '' },
    });
    const projected = 投影母题配额库(lib);

    const hb_旧 = hashJudgmentBundle({ ...JUDGMENT_BASE, 母题配额: 旧格式 });
    const hb_新 = hashJudgmentBundle({ ...JUDGMENT_BASE, 母题配额: projected });
    expect(hb_旧).toBe(hb_新);
    expect(hb_旧).toMatch(/^[0-9a-f]{8}$/);
  });

  it('⑤ hashPresetFingerprint 迁移前后逐位恒等（0 重定基）', () => {
    const 旧格式 = 母题配额Schema.parse(QUOTA_RAW);
    const lib: 母题配额库Type = 母题配额库Schema.parse({
      romance: { 名称: '爱情', 基础权重: 2,   每游戏年上限: 3, 互斥组: 'love' },
      war:     { 名称: '战争', 基础权重: 1.5, 每游戏年上限: 0, 互斥组: '' },
    });

    const base哈希 = resolve({ packs: [] }, {}).生效中内容包集哈希;
    const fp_旧 = hashPresetFingerprint({ 判定面整包: hashJudgmentBundle({ ...JUDGMENT_BASE, 母题配额: 旧格式 }), 生效中内容包集哈希: base哈希, snapshot: SNAPSHOT_BASE });
    const fp_新 = hashPresetFingerprint({ 判定面整包: hashJudgmentBundle({ ...JUDGMENT_BASE, 母题配额: 投影母题配额库(lib) }), 生效中内容包集哈希: base哈希, snapshot: SNAPSHOT_BASE });
    expect(fp_旧).toBe(fp_新);
    expect(fp_旧).toMatch(/^[0-9a-f]{8}$/);
  });

  // 断言⑥ resolve 挂载
  it('⑥ resolve() 挂载 母题配额成品', () => {
    const lib = 母题配额库Schema.parse({
      romance: { 名称: '爱情', 基础权重: 2 },
      war:     { 名称: '战争', 基础权重: 1 },
    });
    const result = resolve(
      { packs: [], 母题配额: ['romance'] },
      {},
      undefined, undefined, undefined, undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined, lib,
    );
    expect(Object.keys(result.母题配额成品)).toEqual(['romance']);
    expect(result.生效中母题配额集).toHaveLength(1);
    expect(result.母题配额成品['romance']?.基础权重).toBe(2);
  });

  it('⑥ 未声明 manifest.母题配额 → 成品为空', () => {
    const lib = 母题配额库Schema.parse({ r: { 名称: 'x' } });
    const result = resolve({ packs: [] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, lib);
    expect(result.母题配额成品).toEqual({});
  });

  it('⑥ 库中不存在的引用 → 跳过', () => {
    const lib = 母题配额库Schema.parse({ romance: { 名称: '爱情' } });
    const result = resolve({ packs: [], 母题配额: ['missing', 'romance'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, lib);
    expect(Object.keys(result.母题配额成品)).toEqual(['romance']);
  });

  // 断言⑦ content_hash
  it('⑦ content_hash optional string', () => {
    const entry = 母题配额定义条目Schema.parse({ 名称: '爱情', 内容哈希: 'chk' });
    expect(entry.内容哈希).toBe('chk');
  });

  // 断言⑧ 守恒门
  it('⑧ 守恒门：schemaKeys=54 / BUNDLE=21 / 命名空间枚举=32项（含母题配额）', () => {
    expect(Object.keys(RootSchema.shape).length).toBe(54);
    expect(FINGERPRINT_BUNDLE_MEMBERS.length).toBe(28);
    expect(FINGERPRINT_BUNDLE_MEMBERS).toContain('母题配额');
    expect(命名空间枚举.length).toBe(32);
    expect(命名空间枚举).toContain('母题配额');
    expect(冰箱绑定表['母题配额']?.解析器键).toBe('母题配额库');
  });
});
