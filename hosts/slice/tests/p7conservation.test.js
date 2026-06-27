// P0-7 梯队1 守恒接线验收测试
// 验证：getNetAsset · buildWorld 账户初始化 · core assertConservation Σ接线
//      · __sink__ 只进不出守卫 · _费用 不进 getNetAsset
import { describe, it, expect } from 'vitest';
import { assertConservation } from '@ai-life-sim/core/engine/conservation';
import { SINK_ENTITY_KEY, 账户Schema } from '@ai-life-sim/core';
import { buildWorld, PC, NPC_WANG, NPC_HONG, EXPECTED_NET_ASSET, CURRENCY } from '../fixture/world.js';
import { getNetAsset, BASE_CURRENCY } from '../ledger/netAsset.js';
describe('P0-7 P7-1a · getNetAsset 单币种 MVP', () => {
    it('空账户 → 0', () => {
        const acct = 账户Schema.parse({});
        expect(getNetAsset(acct)).toBe(0);
    });
    it('持有[文]=100 → 100', () => {
        const acct = 账户Schema.parse({ 持有: { '文': 100 } });
        expect(getNetAsset(acct)).toBe(100);
    });
    it('持有[文]=100 + 储蓄[文]=50 → 150', () => {
        const acct = 账户Schema.parse({ 持有: { '文': 100 }, 储蓄: { '文': 50 } });
        expect(getNetAsset(acct)).toBe(150);
    });
    it('存货估值：类别=存货 数量×成本价 累加', () => {
        const acct = 账户Schema.parse({
            资产: [
                { 类别: '存货', 数量: 3, 成本价: 10 },
                { 类别: '存货', 数量: 2, 成本价: 5 },
            ],
        });
        expect(getNetAsset(acct)).toBe(40); // 3×10 + 2×5
    });
    it('非存货资产不计入', () => {
        const acct = 账户Schema.parse({
            持有: { '文': 100 },
            资产: [{ 类别: '债券', 数量: 10, 成本价: 20 }],
        });
        expect(getNetAsset(acct)).toBe(100); // 非存货忽略
    });
    it('_费用 不进 getNetAsset（报表流）', () => {
        const acct = 账户Schema.parse({
            持有: { '文': 100 },
            _费用: { 总额: 50, 明细: { '赊账': 50 } },
        });
        expect(getNetAsset(acct)).toBe(100); // _费用 不影响净值
    });
    it('BASE_CURRENCY = 文', () => {
        expect(BASE_CURRENCY).toBe('文');
    });
});
describe('P0-7 P7-1c · buildWorld 初始账户含 __sink__', () => {
    const state = buildWorld();
    it('SINK_ENTITY_KEY 常量 = __sink__', () => {
        expect(SINK_ENTITY_KEY).toBe('__sink__');
    });
    it('buildWorld.货币系统.基准币种 = 文', () => {
        expect(state.货币系统?.基准币种).toBe(CURRENCY);
    });
    it('buildWorld 含 PC 账户初始余额 30', () => {
        expect(state.货币系统?.账户?.[PC]?.持有?.['文']).toBe(30);
    });
    it('buildWorld 含 NPC_WANG 账户初始余额 200', () => {
        expect(state.货币系统?.账户?.[NPC_WANG]?.持有?.['文']).toBe(200);
    });
    it('buildWorld 含 NPC_HONG 账户初始余额 0', () => {
        expect(state.货币系统?.账户?.[NPC_HONG]?.持有?.['文']).toBe(0);
    });
    it('buildWorld 含 __sink__ 账户初始余额 0', () => {
        expect(state.货币系统?.账户?.[SINK_ENTITY_KEY]?.持有?.['文']).toBe(0);
    });
    it('EXPECTED_NET_ASSET = 230', () => {
        expect(EXPECTED_NET_ASSET).toBe(230);
    });
});
describe('P0-7 P7-1b · core assertConservation Σ接线', () => {
    it('初始世界 Σ净值 = EXPECTED_NET_ASSET（230）', () => {
        const state = buildWorld();
        const 账户 = state.货币系统?.账户;
        expect(() => assertConservation(账户, EXPECTED_NET_ASSET, getNetAsset)).not.toThrow();
    });
    it('转账后 Σ净值不变（30→20 转给 Wang→Wang+10）', () => {
        const accounts = {
            A: 账户Schema.parse({ 持有: { '文': 30 } }),
            B: 账户Schema.parse({ 持有: { '文': 20 } }),
        };
        // 模拟 A→B 转 10
        accounts['A'].持有['文'] = 20;
        accounts['B'].持有['文'] = 30;
        expect(() => assertConservation(accounts, 50, getNetAsset)).not.toThrow();
    });
    it('Σ失衡时 assertConservation 抛 ConservationError', () => {
        const accounts = {
            A: 账户Schema.parse({ 持有: { '文': 30 } }),
            B: 账户Schema.parse({ 持有: { '文': 20 } }),
        };
        // 人为制造失衡
        accounts['A'].持有['文'] = 15;
        expect(() => assertConservation(accounts, 50, getNetAsset)).toThrow();
    });
    it('含 __sink__ 的 Σ覆盖（sink=0 不改总量）', () => {
        const accounts = {
            [PC]: 账户Schema.parse({ 持有: { '文': 30 } }),
            [NPC_WANG]: 账户Schema.parse({ 持有: { '文': 200 } }),
            [NPC_HONG]: 账户Schema.parse({ 持有: { '文': 0 } }),
            [SINK_ENTITY_KEY]: 账户Schema.parse({ 持有: { '文': 0 } }),
        };
        expect(() => assertConservation(accounts, 230, getNetAsset)).not.toThrow();
    });
});
