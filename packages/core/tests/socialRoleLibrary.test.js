// 社会角色库 · 剥离③ · additive · dormant · 不进存档 · 不进 hashJudgmentBundle
// 合并旧三表（社会角色定义表/权重表/效应量表）为单 by-ID 库
// 断言① parse · ②ID正则 · ③三投影等价 · ④resolve挂载 · ⑤不进hashJudgmentBundle · ⑥content_hash · ⑦守恒门
import { describe, it, expect } from 'vitest';
import { 社会角色库Schema, 社会角色定义条目Schema, 社会角色ID正则, 投影社会角色定义表, 投影社会角色权重表, 投影社会角色效应量表, } from '../schema/socialRoleLibrary.js';
import { 命名空间枚举 } from '../schema/governedKeySpace.js';
import { 冰箱绑定表 } from '../engine/preset/refBinding.js';
import { resolve } from '../engine/preset/resolve.js';
import { RootSchema } from '../schema/index.js';
import { FINGERPRINT_BUNDLE_MEMBERS } from '../engine/fingerprintManifest.js';
const SAMPLE_LIB = 社会角色库Schema.parse({
    merchant: {
        名称: '商人',
        描述: '流通经济中的贸易者',
        场景权重: { city: 0.8, rural: 0.3 },
        效应量: 0.5,
    },
    scholar: {
        名称: '学者',
        场景权重: { academy: 1.0 },
    },
});
describe('社会角色库 · 剥离③', () => {
    // 断言① parse
    it('① 空库默认 {}', () => {
        expect(社会角色库Schema.parse(undefined)).toEqual({});
        expect(社会角色库Schema.parse({})).toEqual({});
    });
    it('① 单条目解析', () => {
        expect(SAMPLE_LIB['merchant']?.名称).toBe('商人');
        expect(SAMPLE_LIB['merchant']?.描述).toBe('流通经济中的贸易者');
        expect(SAMPLE_LIB['merchant']?.场景权重?.['city']).toBe(0.8);
        expect(SAMPLE_LIB['merchant']?.效应量).toBe(0.5);
        expect(SAMPLE_LIB['scholar']?.效应量).toBeUndefined();
    });
    // 断言② ID 正则
    it('② ID 须为蛇形', () => {
        expect(() => 社会角色库Schema.parse({ 'BadId': { 名称: 'x' } })).toThrow();
        expect(() => 社会角色库Schema.parse({ 'ok_role': { 名称: 'x' } })).not.toThrow();
    });
    // 断言③ 三投影等价（旧三表结构还原）
    it('③ 投影社会角色定义表 还原旧 定义表结构', () => {
        const 定义表 = 投影社会角色定义表(SAMPLE_LIB);
        expect(定义表['merchant']).toEqual({ 名称: '商人', 描述: '流通经济中的贸易者' });
        expect(定义表['scholar']).toEqual({ 名称: '学者' });
        expect(Object.keys(定义表)).toHaveLength(2);
    });
    it('③ 投影社会角色权重表 还原旧 权重表结构', () => {
        const 权重表 = 投影社会角色权重表(SAMPLE_LIB);
        expect(权重表['merchant']).toEqual({ city: 0.8, rural: 0.3 });
        expect(权重表['scholar']).toEqual({ academy: 1.0 });
        // 效应量不进权重表
        expect(Object.keys(权重表)).toHaveLength(2);
    });
    it('③ 投影社会角色效应量表 还原旧 效应量表结构', () => {
        const 效应量表 = 投影社会角色效应量表(SAMPLE_LIB);
        expect(效应量表['merchant']).toBe(0.5);
        // scholar 无效应量 → 不进输出
        expect('scholar' in 效应量表).toBe(false);
        expect(Object.keys(效应量表)).toHaveLength(1);
    });
    it('③ 场景权重为空时不进权重表', () => {
        const lib = 社会角色库Schema.parse({ r: { 名称: 'x' } });
        const 权重表 = 投影社会角色权重表(lib);
        expect(Object.keys(权重表)).toHaveLength(0);
    });
    // 断言④ resolve 挂载
    it('④ resolve() 挂载 社会角色成品', () => {
        const result = resolve({ packs: [], 社会角色: ['merchant', 'scholar'] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, SAMPLE_LIB);
        expect(Object.keys(result.社会角色成品).sort()).toEqual(['merchant', 'scholar']);
        expect(result.生效中社会角色集).toHaveLength(2);
    });
    it('④ 未声明 → 成品为空', () => {
        const result = resolve({ packs: [] }, {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, SAMPLE_LIB);
        expect(result.社会角色成品).toEqual({});
    });
    // 断言⑤ 不进 hashJudgmentBundle
    it('⑤ 社会角色不在 FINGERPRINT_BUNDLE_MEMBERS', () => {
        expect(FINGERPRINT_BUNDLE_MEMBERS).not.toContain('社会角色定义表');
        expect(FINGERPRINT_BUNDLE_MEMBERS).not.toContain('社会角色');
    });
    // 断言⑥ content_hash
    it('⑥ content_hash optional string', () => {
        const result = 社会角色定义条目Schema.parse({ 名称: 'x', 内容哈希: 'sha' });
        expect(result.内容哈希).toBe('sha');
    });
    // 断言⑦ 守恒门
    it('⑦ 守恒门：schemaKeys=52 / BUNDLE=21 / 命名空间枚举=32项（含社会角色）', () => {
        expect(Object.keys(RootSchema.shape).length).toBe(52);
        expect(FINGERPRINT_BUNDLE_MEMBERS.length).toBe(21);
        expect(命名空间枚举.length).toBe(32);
        expect(命名空间枚举).toContain('社会角色');
        expect(冰箱绑定表['社会角色']?.解析器键).toBe('社会角色库');
    });
});
