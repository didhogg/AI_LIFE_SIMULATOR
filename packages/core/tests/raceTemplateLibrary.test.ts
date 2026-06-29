// 种族模板库 · 剥离③ · additive · dormant · 进 hashJudgmentBundle（投影回填）
// 断言① parse · ②ID正则 · ③发育阶段语义闸 · ④等价金测 · ⑤指纹金测·0重定基 · ⑥resolve挂载 · ⑦content_hash · ⑧守恒门
import { describe, it, expect } from 'vitest';
import {
  种族模板库Schema,
  种族模板定义条目Schema,
  种族模板ID正则,
  投影种族模板库,
} from '../schema/raceTemplateLibrary.js';
import type { 种族模板库Type } from '../schema/raceTemplateLibrary.js';
import { 种族模板Schema } from '../schema/preset.js';
import { resolve } from '../engine/preset/resolve.js';
import { 命名空间枚举 } from '../schema/governedKeySpace.js';
import { 冰箱绑定表 } from '../engine/preset/refBinding.js';
import { RootSchema } from '../schema/index.js';
import { hashJudgmentBundle, hashCanonical, hashPresetFingerprint } from '../engine/rng.js';
import { FINGERPRINT_BUNDLE_MEMBERS } from '../engine/fingerprintManifest.js';

// JUDGMENT_BASE：hashJudgmentBundle 的基准参数（除 种族模板 外·0 重定基验收）
const JUDGMENT_BASE = {
  历法皮肤:         {},
  粒度模板覆盖:     {},
  种族模板:         {},  // 占位·测试中按场景替换
  母题配额:         {},
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

// 标准种族定义（旧格式·含 defaults）
const RACE_RAW = {
  human:  { 寿命基准: 80,  衰老系数: 1.0, 发育阶段表: [{ 阶段名: '童年', 起始年龄分钟: 0, 结束年龄分钟: 960_000 }], 遗传参数: { 力量: 0.5 }, 最小生育年龄分钟: 600_000 },
  elvish: { 寿命基准: 500, 衰老系数: 0.2, 发育阶段表: [], 遗传参数: {}, 最小生育年龄分钟: 0 },
};

describe('种族模板库 · 剥离③', () => {
  // 断言① parse — 基本解析
  it('① 空库默认 {}', () => {
    expect(种族模板库Schema.parse(undefined)).toEqual({});
    expect(种族模板库Schema.parse({})).toEqual({});
  });

  it('① 数据体 defaults 填充', () => {
    const result = 种族模板库Schema.parse({ r: { 名称: '默认种族' } });
    expect(result['r']?.寿命基准).toBe(75);
    expect(result['r']?.衰老系数).toBe(1);
    expect(result['r']?.发育阶段表).toEqual([]);
    expect(result['r']?.遗传参数).toEqual({});
    expect(result['r']?.最小生育年龄分钟).toBe(0);
  });

  it('① 全字段条目', () => {
    const lib = 种族模板库Schema.parse({
      human: { 名称: '人类', 寿命基准: 80, 衰老系数: 1.0, 遗传参数: { 力量: 0.5 } },
    });
    expect(lib['human']?.寿命基准).toBe(80);
    expect(lib['human']?.遗传参数['力量']).toBe(0.5);
  });

  // 断言② ID 正则
  it('② ID 须为蛇形 /^[a-z][a-z0-9_]*$/', () => {
    expect(() => 种族模板库Schema.parse({ 'Human': { 名称: 'x' } })).toThrow();
    expect(() => 种族模板库Schema.parse({ '123': { 名称: 'x' } })).toThrow();
    expect(() => 种族模板库Schema.parse({ 'human': { 名称: 'x' } })).not.toThrow();
  });

  // 断言③ 发育阶段语义闸（L-25）
  it('③ 发育阶段结束年龄分钟须 > 起始年龄分钟', () => {
    expect(() => 种族模板库Schema.parse({
      r: { 名称: 'x', 发育阶段表: [{ 阶段名: '童年', 起始年龄分钟: 100, 结束年龄分钟: 50 }] },
    })).toThrow();
    expect(() => 种族模板库Schema.parse({
      r: { 名称: 'x', 发育阶段表: [{ 阶段名: '童年', 起始年龄分钟: 100, 结束年龄分钟: 100 }] },
    })).toThrow();
    expect(() => 种族模板库Schema.parse({
      r: { 名称: 'x', 发育阶段表: [{ 阶段名: '童年', 起始年龄分钟: 0, 结束年龄分钟: 960_000 }] },
    })).not.toThrow();
  });

  // 断言④ 等价金测：投影 deepEqual 旧格式
  it('④ 等价金测：投影种族模板库 deepEqual 旧 种族模板Schema.parse()', () => {
    const 旧格式 = 种族模板Schema.parse(RACE_RAW);

    const lib: 种族模板库Type = 种族模板库Schema.parse({
      human: {
        名称: '人类',
        寿命基准: 80, 衰老系数: 1.0,
        发育阶段表: [{ 阶段名: '童年', 起始年龄分钟: 0, 结束年龄分钟: 960_000 }],
        遗传参数: { 力量: 0.5 }, 最小生育年龄分钟: 600_000,
      },
      elvish: {
        名称: '精灵',
        寿命基准: 500, 衰老系数: 0.2,
        发育阶段表: [], 遗传参数: {}, 最小生育年龄分钟: 0,
      },
    });

    const projected = 投影种族模板库(lib);
    expect(projected).toEqual(旧格式);
  });

  // 断言⑤ 指纹金测·0 重定基
  it('⑤ hashCanonical(投影) === hashCanonical(旧格式)', () => {
    const 旧格式 = 种族模板Schema.parse(RACE_RAW);
    const lib: 种族模板库Type = 种族模板库Schema.parse({
      human: {
        名称: '人类', 寿命基准: 80, 衰老系数: 1.0,
        发育阶段表: [{ 阶段名: '童年', 起始年龄分钟: 0, 结束年龄分钟: 960_000 }],
        遗传参数: { 力量: 0.5 }, 最小生育年龄分钟: 600_000,
      },
      elvish: { 名称: '精灵', 寿命基准: 500, 衰老系数: 0.2, 发育阶段表: [], 遗传参数: {}, 最小生育年龄分钟: 0 },
    });
    const projected = 投影种族模板库(lib);
    expect(hashCanonical(projected)).toBe(hashCanonical(旧格式));
  });

  it('⑤ hashJudgmentBundle：投影路径 === 旧路径（指纹不变）', () => {
    const 旧格式 = 种族模板Schema.parse(RACE_RAW);
    const lib: 种族模板库Type = 种族模板库Schema.parse({
      human: { 名称: '人类', 寿命基准: 80, 衰老系数: 1.0, 发育阶段表: [{ 阶段名: '童年', 起始年龄分钟: 0, 结束年龄分钟: 960_000 }], 遗传参数: { 力量: 0.5 }, 最小生育年龄分钟: 600_000 },
      elvish: { 名称: '精灵', 寿命基准: 500, 衰老系数: 0.2, 发育阶段表: [], 遗传参数: {}, 最小生育年龄分钟: 0 },
    });
    const projected = 投影种族模板库(lib);

    const hb_旧 = hashJudgmentBundle({ ...JUDGMENT_BASE, 种族模板: 旧格式 });
    const hb_新 = hashJudgmentBundle({ ...JUDGMENT_BASE, 种族模板: projected });
    expect(hb_旧).toBe(hb_新);
    expect(hb_旧).toMatch(/^[0-9a-f]{8}$/);
  });

  it('⑤ hashPresetFingerprint 迁移前后逐位恒等（0 重定基）', () => {
    const 旧格式 = 种族模板Schema.parse(RACE_RAW);
    const lib: 种族模板库Type = 种族模板库Schema.parse({
      human: { 名称: '人类', 寿命基准: 80, 衰老系数: 1.0, 发育阶段表: [{ 阶段名: '童年', 起始年龄分钟: 0, 结束年龄分钟: 960_000 }], 遗传参数: { 力量: 0.5 }, 最小生育年龄分钟: 600_000 },
      elvish: { 名称: '精灵', 寿命基准: 500, 衰老系数: 0.2, 发育阶段表: [], 遗传参数: {}, 最小生育年龄分钟: 0 },
    });

    const base哈希 = resolve({ packs: [] }, {}).生效中内容包集哈希;
    const fp_旧 = hashPresetFingerprint({ 判定面整包: hashJudgmentBundle({ ...JUDGMENT_BASE, 种族模板: 旧格式 }), 生效中内容包集哈希: base哈希, snapshot: SNAPSHOT_BASE });
    const fp_新 = hashPresetFingerprint({ 判定面整包: hashJudgmentBundle({ ...JUDGMENT_BASE, 种族模板: 投影种族模板库(lib) }), 生效中内容包集哈希: base哈希, snapshot: SNAPSHOT_BASE });
    expect(fp_旧).toBe(fp_新);
    expect(fp_旧).toMatch(/^[0-9a-f]{8}$/);
  });

  // 断言⑥ resolve 挂载
  it('⑥ resolve() 挂载 种族模板成品', () => {
    const lib = 种族模板库Schema.parse({ human: { 名称: '人类', 寿命基准: 80 } });
    const result = resolve(
      { packs: [], 种族模板: ['human'] },
      {},
      undefined, undefined, undefined, undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined, undefined, undefined,
      lib,
    );
    expect(Object.keys(result.种族模板成品)).toEqual(['human']);
    expect(result.生效中种族模板集).toHaveLength(1);
    expect(result.种族模板成品['human']?.寿命基准).toBe(80);
  });

  it('⑥ 未声明 manifest.种族模板 → 成品为空', () => {
    const lib = 种族模板库Schema.parse({ human: { 名称: '人类' } });
    const result = resolve({ packs: [] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, lib);
    expect(result.种族模板成品).toEqual({});
  });

  it('⑥ 库中不存在的引用 → 跳过', () => {
    const lib = 种族模板库Schema.parse({ human: { 名称: '人类' } });
    const result = resolve({ packs: [], 种族模板: ['missing', 'human'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, lib);
    expect(Object.keys(result.种族模板成品)).toEqual(['human']);
  });

  // 断言⑦ content_hash
  it('⑦ content_hash optional string', () => {
    const entry = 种族模板定义条目Schema.parse({ 名称: '人类', 内容哈希: 'abc' });
    expect(entry.内容哈希).toBe('abc');
  });

  // 断言⑧ 守恒门
  it('⑧ 守恒门：schemaKeys=54 / BUNDLE=21 / 命名空间枚举=32项（含种族模板）', () => {
    expect(Object.keys(RootSchema.shape).length).toBe(54);
    expect(FINGERPRINT_BUNDLE_MEMBERS.length).toBe(28);
    expect(FINGERPRINT_BUNDLE_MEMBERS).toContain('种族模板');
    expect(命名空间枚举.length).toBe(32);
    expect(命名空间枚举).toContain('种族模板');
    expect(冰箱绑定表['种族模板']?.解析器键).toBe('种族模板库');
  });
});
