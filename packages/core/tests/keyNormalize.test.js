// B5 · S3 受治理键码位规范化 · 确定性验收测试
import { describe, it, expect } from 'vitest';
import { normalizeRegistryKeyNames, assertGovernedKeysNormalized, } from '../interfaces/keyNormalize.js';
// 全角 A（U+FF21）在 NFKC 下规范为半角 A（U+0041）
const FULL_WIDE_A = 'Ａ'; // Ａ → A
// 零宽空格（U+200B），normalize 后被去除
const ZWSP = '​';
// ── normalizeRegistryKeyNames · no-op 场景 ────────────────────────────────────
describe('B5 · S3 · normalizeRegistryKeyNames · no-op 场景', () => {
    it('无注册表键 → 返回同一引用', () => {
        const raw = { 属性: { 体质: 10 } };
        expect(normalizeRegistryKeyNames(raw)).toBe(raw);
    });
    it('受治理键空间注册表为空对象 → 返回同一引用', () => {
        const raw = { 受治理键空间注册表: {}, 键空间归并表: {} };
        expect(normalizeRegistryKeyNames(raw)).toBe(raw);
    });
    it('受治理键空间注册表键条目为空数组 → 返回同一引用', () => {
        const raw = {
            受治理键空间注册表: { 键条目: [] },
            键空间归并表: { 归并条目: [] },
        };
        expect(normalizeRegistryKeyNames(raw)).toBe(raw);
    });
    it('已规范化的 规范键 → 返回同一引用（no-op）', () => {
        const raw = {
            受治理键空间注册表: { 键条目: [{ 规范键: '体质', 命名空间: '单位' }] },
        };
        expect(normalizeRegistryKeyNames(raw)).toBe(raw);
    });
    it('已规范化的 别名 → 返回同一引用', () => {
        const raw = {
            受治理键空间注册表: {
                键条目: [{ 规范键: '体质', 别名: ['con', 'CON'], 命名空间: '单位' }],
            },
        };
        expect(normalizeRegistryKeyNames(raw)).toBe(raw);
    });
    it('归并表已规范化 → 返回同一引用', () => {
        const raw = {
            键空间归并表: { 归并条目: [{ 别名: 'str', 规范键: '力量', 命名空间: '单位' }] },
        };
        expect(normalizeRegistryKeyNames(raw)).toBe(raw);
    });
});
// ── normalizeRegistryKeyNames · 规范化 场景 ───────────────────────────────────
describe('B5 · S3 · normalizeRegistryKeyNames · 规范化变换', () => {
    it('受治理键空间注册表.键条目[].规范键 含全角字符 → 规范化', () => {
        const raw = {
            受治理键空间注册表: {
                键条目: [{ 规范键: `${FULL_WIDE_A}体质`, 命名空间: '单位' }],
            },
        };
        const result = normalizeRegistryKeyNames(raw);
        expect(result).not.toBe(raw); // 已改变·新对象
        const reg = result['受治理键空间注册表'];
        const entries = reg['键条目'];
        expect(entries[0]?.['规范键']).toBe('A体质');
    });
    it('受治理键空间注册表.键条目[].别名 含零宽字符 → 去除', () => {
        const raw = {
            受治理键空间注册表: {
                键条目: [{ 规范键: '体质', 别名: [`体${ZWSP}质`], 命名空间: '单位' }],
            },
        };
        const result = normalizeRegistryKeyNames(raw);
        expect(result).not.toBe(raw);
        const reg = result['受治理键空间注册表'];
        const entries = reg['键条目'];
        expect((entries[0]?.['别名'])[0]).toBe('体质');
    });
    it('归并表.归并条目[].别名 含全角 → 规范化', () => {
        const raw = {
            键空间归并表: {
                归并条目: [{ 别名: `${FULL_WIDE_A}力`, 规范键: '力量', 命名空间: '单位' }],
            },
        };
        const result = normalizeRegistryKeyNames(raw);
        expect(result).not.toBe(raw);
        const merge = result['键空间归并表'];
        const entries = merge['归并条目'];
        expect(entries[0]?.['别名']).toBe('A力');
    });
    it('归并表.归并条目[].规范键 含全角 → 规范化', () => {
        const raw = {
            键空间归并表: {
                归并条目: [{ 别名: '力', 规范键: `力${FULL_WIDE_A}量`, 命名空间: '单位' }],
            },
        };
        const result = normalizeRegistryKeyNames(raw);
        const merge = result['键空间归并表'];
        const entries = merge['归并条目'];
        expect(entries[0]?.['规范键']).toBe('力A量');
    });
    it('多条目混合（部分需规范化）→ 仅规范化非规范态条目', () => {
        const raw = {
            受治理键空间注册表: {
                键条目: [
                    { 规范键: '体质', 命名空间: '单位' }, // 已规范·不变
                    { 规范键: `${FULL_WIDE_A}力量`, 命名空间: '单位' }, // 需规范化
                ],
            },
        };
        const result = normalizeRegistryKeyNames(raw);
        const reg = result['受治理键空间注册表'];
        const entries = reg['键条目'];
        expect(entries[0]?.['规范键']).toBe('体质');
        expect(entries[1]?.['规范键']).toBe('A力量');
    });
    it('规范化前缀空白 → trim 后不含空白', () => {
        const raw = {
            受治理键空间注册表: {
                键条目: [{ 规范键: '  体质  ', 命名空间: '单位' }],
            },
        };
        const result = normalizeRegistryKeyNames(raw);
        const reg = result['受治理键空间注册表'];
        const entries = reg['键条目'];
        expect(entries[0]?.['规范键']).toBe('体质');
    });
});
// ── 幂等性 ────────────────────────────────────────────────────────────────────
describe('B5 · S3 · normalizeRegistryKeyNames · 幂等', () => {
    it('规范化后再次规范化 → 结果相同（幂等）', () => {
        const raw = {
            受治理键空间注册表: {
                键条目: [{ 规范键: `${FULL_WIDE_A}体质`, 命名空间: '单位' }],
            },
        };
        const once = normalizeRegistryKeyNames(raw);
        const twice = normalizeRegistryKeyNames(once);
        const reg1 = once['受治理键空间注册表']['键条目'];
        const reg2 = twice['受治理键空间注册表']['键条目'];
        expect(reg1[0]?.['规范键']).toBe(reg2[0]?.['规范键']);
        expect(twice).toBe(once); // 第二次已是规范态·同引用
    });
    it('确定性：相同输入多次调用 → 结果字符串序列化恒等', () => {
        const raw = {
            受治理键空间注册表: {
                键条目: [{ 规范键: `${FULL_WIDE_A}力量`, 别名: [`${ZWSP}力`], 命名空间: '单位' }],
            },
        };
        const r1 = normalizeRegistryKeyNames(raw);
        const r2 = normalizeRegistryKeyNames(raw);
        expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
    });
});
// ── assertGovernedKeysNormalized · 违例检测 ──────────────────────────────────
describe('B5 · S3 · assertGovernedKeysNormalized · 无违例', () => {
    it('空 raw → 空违例列表', () => {
        expect(assertGovernedKeysNormalized({})).toEqual([]);
    });
    it('空注册表 → 空违例列表', () => {
        expect(assertGovernedKeysNormalized({ 受治理键空间注册表: {}, 键空间归并表: {} })).toEqual([]);
    });
    it('已规范化条目 → 空违例列表', () => {
        const raw = {
            受治理键空间注册表: { 键条目: [{ 规范键: '体质', 别名: ['con'], 命名空间: '单位' }] },
            键空间归并表: { 归并条目: [{ 别名: 'str', 规范键: '力量', 命名空间: '单位' }] },
        };
        expect(assertGovernedKeysNormalized(raw)).toEqual([]);
    });
});
describe('B5 · S3 · assertGovernedKeysNormalized · 违例报告', () => {
    it('注册表.规范键 非规范态 → 违例含 field/raw/normalized', () => {
        const raw = {
            受治理键空间注册表: { 键条目: [{ 规范键: `${FULL_WIDE_A}体质`, 命名空间: '单位' }] },
        };
        const violations = assertGovernedKeysNormalized(raw);
        expect(violations.length).toBe(1);
        const v = violations[0];
        expect(v.field).toBe('受治理键空间注册表.键条目[0].规范键');
        expect(v.raw).toBe(`${FULL_WIDE_A}体质`);
        expect(v.normalized).toBe('A体质');
    });
    it('注册表.别名 非规范态 → 违例含正确 field', () => {
        const raw = {
            受治理键空间注册表: { 键条目: [{ 规范键: '体质', 别名: [`${ZWSP}con`], 命名空间: '单位' }] },
        };
        const violations = assertGovernedKeysNormalized(raw);
        expect(violations.length).toBe(1);
        expect(violations[0]?.field).toBe('受治理键空间注册表.键条目[0].别名[0]');
        expect(violations[0]?.normalized).toBe('con');
    });
    it('归并表.别名 非规范态 → 违例含正确 field', () => {
        const raw = {
            键空间归并表: { 归并条目: [{ 别名: `${FULL_WIDE_A}力`, 规范键: '力量', 命名空间: '单位' }] },
        };
        const violations = assertGovernedKeysNormalized(raw);
        expect(violations.length).toBe(1);
        expect(violations[0]?.field).toBe('键空间归并表.归并条目[0].别名');
    });
    it('归并表.规范键 非规范态 → 违例含正确 field', () => {
        const raw = {
            键空间归并表: { 归并条目: [{ 别名: '力', 规范键: `${FULL_WIDE_A}量`, 命名空间: '单位' }] },
        };
        const violations = assertGovernedKeysNormalized(raw);
        expect(violations.length).toBe(1);
        expect(violations[0]?.field).toBe('键空间归并表.归并条目[0].规范键');
    });
    it('多处违例 → 所有违例均上报', () => {
        const raw = {
            受治理键空间注册表: {
                键条目: [{ 规范键: `${FULL_WIDE_A}体质`, 别名: [`${ZWSP}con`], 命名空间: '单位' }],
            },
            键空间归并表: {
                归并条目: [{ 别名: `${FULL_WIDE_A}力`, 规范键: '力量', 命名空间: '单位' }],
            },
        };
        const violations = assertGovernedKeysNormalized(raw);
        expect(violations.length).toBe(3);
    });
    it('断言不改写 raw（纯函数）', () => {
        const raw = {
            受治理键空间注册表: { 键条目: [{ 规范键: `${FULL_WIDE_A}体质`, 命名空间: '单位' }] },
        };
        const rawStr = JSON.stringify(raw);
        assertGovernedKeysNormalized(raw);
        expect(JSON.stringify(raw)).toBe(rawStr); // raw 不被改写
    });
    it('确定性：相同输入 → 同样违例列表', () => {
        const raw = {
            受治理键空间注册表: { 键条目: [{ 规范键: `${FULL_WIDE_A}体质`, 命名空间: '单位' }] },
        };
        const v1 = assertGovernedKeysNormalized(raw);
        const v2 = assertGovernedKeysNormalized(raw);
        expect(JSON.stringify(v1)).toBe(JSON.stringify(v2));
    });
});
