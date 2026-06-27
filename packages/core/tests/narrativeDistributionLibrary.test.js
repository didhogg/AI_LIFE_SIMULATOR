// 叙事分发库 · 剥离③ · additive · dormant · 不进 hashJudgmentBundle
// 断言① parse · ②ID正则 · ③value域 · ④resolve挂载 · ⑤不进hashJudgmentBundle · ⑥content_hash · ⑦守恒门
import { describe, it, expect } from 'vitest';
import { 叙事分发库Schema, 叙事分发定义条目Schema, 叙事分发ID正则 } from '../schema/narrativeDistributionLibrary.js';
import { 命名空间枚举 } from '../schema/governedKeySpace.js';
import { 冰箱绑定表 } from '../engine/preset/refBinding.js';
import { resolve } from '../engine/preset/resolve.js';
import { RootSchema } from '../schema/index.js';
import { FINGERPRINT_BUNDLE_MEMBERS, FINGERPRINT_EXCLUDED_FIELDS } from '../engine/fingerprintManifest.js';
describe('叙事分发库 · 剥离③', () => {
    // 断言① parse
    it('① 空库默认 {}', () => {
        expect(叙事分发库Schema.parse(undefined)).toEqual({});
        expect(叙事分发库Schema.parse({})).toEqual({});
    });
    it('① 单条目解析', () => {
        const result = 叙事分发库Schema.parse({
            merchant_gossip: {
                名称: '商人八卦',
                媒介键引用: 'rumor_mill',
                优先级: 5,
            },
        });
        expect(result['merchant_gossip']?.名称).toBe('商人八卦');
        expect(result['merchant_gossip']?.媒介键引用).toBe('rumor_mill');
        expect(result['merchant_gossip']?.优先级).toBe(5);
    });
    it('① 媒介键引用 default 空字符串', () => {
        const result = 叙事分发库Schema.parse({ dist: { 名称: 'x' } });
        expect(result['dist']?.媒介键引用).toBe('');
        expect(result['dist']?.优先级).toBeUndefined();
    });
    // 断言② ID 正则
    it('② ID 须为蛇形 /^[a-z][a-z0-9_]*$/', () => {
        expect(() => 叙事分发库Schema.parse({ 'BadId': { 名称: 'x' } })).toThrow();
        expect(() => 叙事分发库Schema.parse({ 'valid_id': { 名称: 'x' } })).not.toThrow();
    });
    // 断言③ 优先级可选整数
    it('③ 优先级 optional', () => {
        const result = 叙事分发定义条目Schema.parse({ 名称: 'x' });
        expect(result.优先级).toBeUndefined();
    });
    // 断言④ resolve 挂载
    it('④ resolve() 挂载 叙事分发成品', () => {
        const lib = 叙事分发库Schema.parse({ mg: { 名称: '商人八卦' } });
        const result = resolve({ packs: [], 叙事分发: ['mg'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, lib);
        expect(Object.keys(result.叙事分发成品)).toEqual(['mg']);
        expect(result.生效中叙事分发集).toHaveLength(1);
    });
    it('④ 未声明 manifest.叙事分发 → 成品为空', () => {
        const lib = 叙事分发库Schema.parse({ mg: { 名称: 'x' } });
        const result = resolve({ packs: [] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, lib);
        expect(result.叙事分发成品).toEqual({});
    });
    // 断言⑤ 不进 hashJudgmentBundle
    it('⑤ 叙事分发在 FINGERPRINT_EXCLUDED_FIELDS', () => {
        expect(FINGERPRINT_EXCLUDED_FIELDS).toContain('叙事分发表');
    });
    // 断言⑥ content_hash
    it('⑥ content_hash optional string', () => {
        const result = 叙事分发定义条目Schema.parse({ 名称: 'x', 内容哈希: 'hash1' });
        expect(result.内容哈希).toBe('hash1');
    });
    // 断言⑦ 守恒门
    it('⑦ 守恒门：schemaKeys=53 / BUNDLE=21 / 命名空间枚举=32项（含叙事分发）', () => {
        expect(Object.keys(RootSchema.shape).length).toBe(53);
        expect(FINGERPRINT_BUNDLE_MEMBERS.length).toBe(21);
        expect(命名空间枚举.length).toBe(32);
        expect(命名空间枚举).toContain('叙事分发');
        expect(冰箱绑定表['叙事分发']?.解析器键).toBe('叙事分发库');
    });
});
