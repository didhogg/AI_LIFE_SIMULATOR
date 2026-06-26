// 离场演化契约库 · 剥离③ · additive · dormant · 不进 hashJudgmentBundle
// 断言① parse · ②ID正则 · ③契约载荷 opaque · ④resolve挂载 · ⑤不进hashJudgmentBundle · ⑥content_hash · ⑦守恒门
import { describe, it, expect } from 'vitest';
import { 离场演化契约库Schema, 离场演化契约定义条目Schema, 离场演化契约ID正则 } from '../schema/offstageContractLibrary.js';
import { 命名空间枚举 } from '../schema/governedKeySpace.js';
import { 冰箱绑定表 } from '../engine/preset/refBinding.js';
import { resolve } from '../engine/preset/resolve.js';
import { RootSchema } from '../schema/index.js';
import { FINGERPRINT_BUNDLE_MEMBERS } from '../engine/fingerprintManifest.js';
describe('离场演化契约库 · 剥离③', () => {
    // 断言① parse
    it('① 空库默认 {}', () => {
        expect(离场演化契约库Schema.parse(undefined)).toEqual({});
        expect(离场演化契约库Schema.parse({})).toEqual({});
    });
    it('① 单条目解析（含契约载荷 opaque）', () => {
        const result = 离场演化契约库Schema.parse({
            standard_offstage: {
                名称: '标准离场契约',
                版本: '1.0.0',
                描述: 'NPC 离场后的演化规则',
                契约载荷: { 年龄增速: 1.5, 经济衰退率: 0.1 },
            },
        });
        expect(result['standard_offstage']?.名称).toBe('标准离场契约');
        expect(result['standard_offstage']?.契约载荷?.['年龄增速']).toBe(1.5);
    });
    it('① 契约载荷 optional（可缺省）', () => {
        const result = 离场演化契约库Schema.parse({
            empty_contract: { 名称: '空契约' },
        });
        expect(result['empty_contract']?.契约载荷).toBeUndefined();
    });
    // 断言② ID 正则
    it('② ID 须为蛇形', () => {
        expect(() => 离场演化契约库Schema.parse({ 'BadId': { 名称: 'x' } })).toThrow();
        expect(() => 离场演化契约库Schema.parse({ 'ok_id': { 名称: 'x' } })).not.toThrow();
    });
    // 断言③ 契约载荷 opaque（接受任意键值）
    it('③ 契约载荷接受任意 record<string, unknown>', () => {
        const result = 离场演化契约定义条目Schema.parse({
            名称: 'x',
            契约载荷: {
                nested: { deep: [1, 2, 3] },
                flag: true,
                count: 42,
            },
        });
        expect(result.契约载荷?.['flag']).toBe(true);
        expect(result.契约载荷?.['nested']?.['deep']).toEqual([1, 2, 3]);
    });
    // 断言④ resolve 挂载
    it('④ resolve() 挂载 离场演化契约成品', () => {
        const lib = 离场演化契约库Schema.parse({
            sc: { 名称: '标准', 契约载荷: { rate: 1.0 } },
        });
        const result = resolve({ packs: [], 离场演化契约: ['sc'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, lib);
        expect(Object.keys(result.离场演化契约成品)).toEqual(['sc']);
        expect(result.生效中离场演化契约集).toHaveLength(1);
    });
    it('④ 未声明 → 成品为空', () => {
        const lib = 离场演化契约库Schema.parse({ sc: { 名称: 'x' } });
        const result = resolve({ packs: [] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, lib);
        expect(result.离场演化契约成品).toEqual({});
    });
    // 断言⑤ 不进 hashJudgmentBundle
    it('⑤ 离场演化契约不在 FINGERPRINT_BUNDLE_MEMBERS', () => {
        expect(FINGERPRINT_BUNDLE_MEMBERS).not.toContain('离场演化契约出厂模板');
        expect(FINGERPRINT_BUNDLE_MEMBERS).not.toContain('离场演化契约');
    });
    // 断言⑥ content_hash
    it('⑥ content_hash optional string', () => {
        const result = 离场演化契约定义条目Schema.parse({ 名称: 'x', 内容哈希: 'chk' });
        expect(result.内容哈希).toBe('chk');
    });
    // 断言⑦ 守恒门
    it('⑦ 守恒门：schemaKeys=52 / BUNDLE=21 / 命名空间枚举=32项（含离场演化契约）', () => {
        expect(Object.keys(RootSchema.shape).length).toBe(52);
        expect(FINGERPRINT_BUNDLE_MEMBERS.length).toBe(21);
        expect(命名空间枚举.length).toBe(32);
        expect(命名空间枚举).toContain('离场演化契约');
        expect(冰箱绑定表['离场演化契约']?.解析器键).toBe('离场演化契约库');
    });
});
