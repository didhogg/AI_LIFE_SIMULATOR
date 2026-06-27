// 母题词汇库 · 剥离③ · additive · dormant · 不进 hashJudgmentBundle
// 断言① parse · ②ID正则 · ③value域 · ④resolve挂载 · ⑤不进hashJudgmentBundle · ⑥content_hash · ⑦守恒门
import { describe, it, expect } from 'vitest';
import { 母题词汇库Schema, 母题词汇定义条目Schema, 母题词汇ID正则 } from '../schema/motifVocabularyLibrary.js';
import { 命名空间枚举 } from '../schema/governedKeySpace.js';
import { 冰箱绑定表 } from '../engine/preset/refBinding.js';
import { resolve } from '../engine/preset/resolve.js';
import { RootSchema } from '../schema/index.js';
import { FINGERPRINT_BUNDLE_MEMBERS, FINGERPRINT_EXCLUDED_FIELDS } from '../engine/fingerprintManifest.js';

describe('母题词汇库 · 剥离③', () => {
  // 断言① parse
  it('① 空库默认 {}', () => {
    expect(母题词汇库Schema.parse(undefined)).toEqual({});
    expect(母题词汇库Schema.parse({})).toEqual({});
  });

  it('① 单条目解析', () => {
    const result = 母题词汇库Schema.parse({
      romance: {
        名称: '爱情母题词汇',
        词条: ['相遇', '误解', '和解', '白头偕老'],
        调味提示词: '充满浪漫情怀',
      },
    });
    expect(result['romance']?.名称).toBe('爱情母题词汇');
    expect(result['romance']?.词条).toHaveLength(4);
    expect(result['romance']?.调味提示词).toBe('充满浪漫情怀');
  });

  it('① defaults 填充', () => {
    const result = 母题词汇库Schema.parse({ m: { 名称: 'x' } });
    expect(result['m']?.词条).toEqual([]);
    expect(result['m']?.调味提示词).toBeUndefined();
  });

  // 断言② ID 正则
  it('② ID 须为蛇形', () => {
    expect(() => 母题词汇库Schema.parse({ 'UPPER': { 名称: 'x' } })).toThrow();
    expect(() => 母题词汇库Schema.parse({ 'valid_vocab': { 名称: 'x' } })).not.toThrow();
  });

  // 断言③ 词条是字符串数组
  it('③ 词条须为 string[]', () => {
    expect(() => 母题词汇库Schema.parse({
      m: { 名称: 'x', 词条: [123] },
    })).toThrow();
  });

  // 断言④ resolve 挂载
  it('④ resolve() 挂载 母题词汇成品', () => {
    const lib = 母题词汇库Schema.parse({
      romance: { 名称: '爱情', 词条: ['相遇'] },
    });
    const result = resolve(
      { packs: [], 母题词汇: ['romance'] },
      {},
      undefined, undefined, undefined, undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, lib,
    );
    expect(Object.keys(result.母题词汇成品)).toEqual(['romance']);
    expect(result.生效中母题词汇集).toHaveLength(1);
    expect(result.母题词汇成品['romance']?.词条).toEqual(['相遇']);
  });

  it('④ 未声明 manifest.母题词汇 → 成品为空', () => {
    const lib = 母题词汇库Schema.parse({ m: { 名称: 'x' } });
    const result = resolve({ packs: [] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, lib);
    expect(result.母题词汇成品).toEqual({});
  });

  // 断言⑤ 不进 hashJudgmentBundle
  it('⑤ 母题词汇表在 FINGERPRINT_EXCLUDED_FIELDS', () => {
    expect(FINGERPRINT_EXCLUDED_FIELDS).toContain('母题词汇表');
  });

  // 断言⑥ content_hash
  it('⑥ content_hash optional string', () => {
    const result = 母题词汇定义条目Schema.parse({ 名称: 'x', 内容哈希: 'h2' });
    expect(result.内容哈希).toBe('h2');
  });

  // 断言⑦ 守恒门
  it('⑦ 守恒门：schemaKeys=53 / BUNDLE=21 / 命名空间枚举=32项（含母题词汇）', () => {
    expect(Object.keys(RootSchema.shape).length).toBe(53);
    expect(FINGERPRINT_BUNDLE_MEMBERS.length).toBe(21);
    expect(命名空间枚举.length).toBe(32);
    expect(命名空间枚举).toContain('母题词汇');
    expect(冰箱绑定表['母题词汇']?.解析器键).toBe('母题词汇库');
  });
});
