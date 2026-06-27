// PR-1 · 预设切换原语·状态隔离·可拆卸卸载 验收测试
//
// DoD（六件·全 additive·基于 PR-1 任务规格）：
//   F1  swap 确定性逐位恒等（同 inputs → 同 output）
//   F2  段链完整（openSegment+verifySegmentChain 跨切换·chainValid=true）
//   F3  状态隔离（旧 preset 私有 namespace 条目卸载后不残留·WORLD_OWNED_STATE_KEYS 不变）
//   F4  detach 干净 + 幂等 + dangling fail-closed
//   F5  默认 fixture 无切换 → 退化守卫 → state 逐位不变 → 0 漂移
//   F6  300 拍 soak 守恒不破（swapPreset + runTick 交织·守恒持续成立）
import { describe, it, expect } from 'vitest';
import { RootSchema } from '@ai-life-sim/core';
import { swapPreset, unloadPreset, WORLD_OWNED_STATE_KEYS } from '@ai-life-sim/core/engine/presetSwap';
import { verifySegmentChain } from '@ai-life-sim/core/engine/segment';
import { runTick } from '@ai-life-sim/core/engine/tick';
import { assertConservation } from '@ai-life-sim/core/engine/conservation';
import { getNetAsset } from '@ai-life-sim/core/engine/netAsset';
import { buildWorld, EXPECTED_NET_ASSET, PC, NPC_WANG, NPC_HONG, CURRENCY, } from '../fixture/world.js';
// ── 最小 preset fixture ────────────────────────────────────────────────────────
const PRESET_A = {
    预设ID: 'preset_a',
    名称: 'Test Preset A',
    版本: '1.0.0',
};
const PRESET_B = {
    预设ID: 'preset_b',
    名称: 'Test Preset B',
    版本: '2.0.0',
    难度系数组: {
        基础成功率调整: 10, // differs from A → different fingerprint
        秘密暴露系数: 1,
        NPC_敌意系数: 1,
        经济难度系数: 1,
    },
};
// ── makeState: 最小 RootState，含单域 + 单 NPC ──────────────────────────────────
function makeState(opts = {}) {
    const presetId = opts.presetId ?? 'preset_a';
    return RootSchema.parse({
        $存档种子: opts.seed ?? 42,
        世界: { 纪元分钟: 0 },
        世界域: {
            main_domain: {
                玩法预设引用: presetId,
                封存状态: false,
                累计活跃区间表: [],
            },
        },
        NPC: {
            npc_test: {
                姓名: 'Test NPC',
                位置: 'loc_test',
                存活状态: '在世',
                属性: {},
                关系: [],
                所属组织: [],
                忠诚: {},
            },
        },
        地图: {
            节点: {
                loc_test: { 名称: '测试地', 类别: '', 相邻: [] },
            },
        },
    });
}
// ── F1: swap 确定性逐位恒等 ────────────────────────────────────────────────────
describe('PR1-F1 · swap 确定性逐位恒等', () => {
    it('同 inputs 两次 swapPreset → state 深度相等', () => {
        const s0 = makeState();
        const r1 = swapPreset(s0, PRESET_B, { domainId: 'main_domain', engineVersion: 'v1' });
        const r2 = swapPreset(s0, PRESET_B, { domainId: 'main_domain', engineVersion: 'v1' });
        expect(r1.openedNewSegment).toBe(r2.openedNewSegment);
        expect(r1.chainValid).toBe(r2.chainValid);
        // 难度系数组指纹相同
        expect(r1.state._tick.难度系数组指纹).toBe(r2.state._tick.难度系数组指纹);
        // 世界域引用相同
        expect(r1.state.世界域['main_domain']?.玩法预设引用).toBe('preset_b');
        expect(r2.state.世界域['main_domain']?.玩法预设引用).toBe('preset_b');
        // 段记录完全相同
        const segs1 = (r1.state._存档头.版本段记录 ?? []);
        const segs2 = (r2.state._存档头.版本段记录 ?? []);
        expect(segs1.length).toBe(segs2.length);
        for (let i = 0; i < segs1.length; i++) {
            expect(segs1[i].段头指纹).toBe(segs2[i].段头指纹);
            expect(segs1[i].前段哈希).toBe(segs2[i].前段哈希);
        }
    });
    it('seeded 可复现：不同 state 副本同参数 → 同指纹', () => {
        const s0a = makeState({ seed: 42 });
        const s0b = makeState({ seed: 42 });
        const ra = swapPreset(s0a, PRESET_A, { engineVersion: 'v1.0' });
        const rb = swapPreset(s0b, PRESET_A, { engineVersion: 'v1.0' });
        expect(ra.state._tick.难度系数组指纹).toBe(rb.state._tick.难度系数组指纹);
    });
});
// ── F2: 段链完整（openSegment + verifySegmentChain 跨切换） ──────────────────────
describe('PR1-F2 · 段链完整', () => {
    it('首次 swap → openedNewSegment=true·链长=1', () => {
        const s0 = makeState();
        const r = swapPreset(s0, PRESET_A, { engineVersion: 'v1', schemaVersion: 's1' });
        expect(r.openedNewSegment).toBe(true);
        expect(r.chainValid).toBe(true);
        expect((r.state._存档头.版本段记录 ?? []).length).toBe(1);
    });
    it('A→B 两次 swap → 链长=2·verifySegmentChain valid', () => {
        const s0 = makeState();
        const r1 = swapPreset(s0, PRESET_A, { engineVersion: 'v1', schemaVersion: 's1' });
        const r2 = swapPreset(r1.state, PRESET_B, { engineVersion: 'v2', schemaVersion: 's1' });
        expect(r2.openedNewSegment).toBe(true);
        const segs = (r2.state._存档头.版本段记录 ?? []);
        expect(segs.length).toBe(2);
        const chainResult = verifySegmentChain({ 版本段记录: segs });
        expect(chainResult.valid).toBe(true);
    });
    it('三次 swap → 链长=3·每段 段序号 连续', () => {
        let s = makeState();
        const versions = ['v1', 'v2', 'v3'];
        const presets = [PRESET_A, PRESET_B, PRESET_A];
        for (let i = 0; i < 3; i++) {
            const r = swapPreset(s, presets[i], { engineVersion: versions[i] });
            s = r.state;
        }
        const segs = (s._存档头.版本段记录 ?? []);
        expect(segs.length).toBe(3);
        for (let i = 0; i < segs.length; i++) {
            expect(segs[i].段序号).toBe(i);
        }
        const chainResult = verifySegmentChain({ 版本段记录: segs });
        expect(chainResult.valid).toBe(true);
    });
    it('chainValid=true — 难度指纹变化也触发新段', () => {
        const s0 = makeState();
        const r1 = swapPreset(s0, PRESET_A); // default fingerprint A
        const r2 = swapPreset(r1.state, PRESET_B); // different difficulty group → new fp
        expect(r2.openedNewSegment).toBe(true);
        expect(r2.chainValid).toBe(true);
    });
});
// ── F3: 状态隔离（P1-3 隔离边界） ─────────────────────────────────────────────
describe('PR1-F3 · 状态隔离', () => {
    it('旧预设私有 namespace 条目在切换后不残留', () => {
        // Arrange：state 有 preset_a 的 namespace 条目
        const base = makeState({ presetId: 'preset_a' });
        const s0 = {
            ...base,
            受治理键空间注册表: {
                键条目: [
                    { 规范键: 'preset_a_handler', 命名空间: 'sideEffect句柄', 来源包: 'preset_a' },
                ],
            },
        };
        // Act：swap → preset_b
        const r = swapPreset(s0, PRESET_B, { domainId: 'main_domain' });
        // Assert：旧 namespace 条目已清除
        const remainingEntries = r.state.受治理键空间注册表.键条目 ?? [];
        const presetAEntries = remainingEntries.filter((e) => e.来源包 === 'preset_a');
        expect(presetAEntries).toHaveLength(0);
    });
    it('WORLD_OWNED_STATE_KEYS 在 swap 后不变', () => {
        const s0 = makeState({ presetId: 'preset_a' });
        const r = swapPreset(s0, PRESET_B, { domainId: 'main_domain', engineVersion: 'v2' });
        for (const key of WORLD_OWNED_STATE_KEYS) {
            const before = s0[key];
            const after = r.state[key];
            expect(JSON.stringify(after)).toBe(JSON.stringify(before));
        }
    });
    it('旧预设携带的 namespace 条目 swap 后被新预设域替换', () => {
        const base = makeState({ presetId: 'preset_a' });
        const s0 = {
            ...base,
            受治理键空间注册表: {
                键条目: [
                    { 规范键: 'handler_a', 命名空间: 'sideEffect句柄', 来源包: 'preset_a' },
                    { 规范键: 'shared_handler', 命名空间: 'cascade句柄', 来源包: 'system' },
                ],
            },
        };
        const r = swapPreset(s0, PRESET_B, { domainId: 'main_domain' });
        const entries = r.state.受治理键空间注册表.键条目 ?? [];
        // preset_a 条目已清除
        expect(entries.find((e) => e.规范键 === 'handler_a')).toBeUndefined();
        // 非 preset_a 条目保留（来源包='system'）
        expect(entries.find((e) => e.规范键 === 'shared_handler')).toBeDefined();
    });
});
// ── F4: detach 干净 + 幂等 + dangling fail-closed ──────────────────────────────
describe('PR1-F4 · detach 干净 + 幂等 + dangling fail-closed', () => {
    it('unloadPreset → 世界域引用清空', () => {
        const s0 = makeState({ presetId: 'preset_a' });
        const s1 = unloadPreset(s0, 'preset_a');
        expect(s1.世界域['main_domain']?.玩法预设引用).toBe('');
    });
    it('unloadPreset → 受治理键空间注册表 preset_a 条目已清除', () => {
        const base = makeState({ presetId: 'preset_a' });
        const s0 = {
            ...base,
            受治理键空间注册表: {
                键条目: [
                    { 规范键: 'my_handler', 命名空间: 'sideEffect句柄', 来源包: 'preset_a' },
                    { 规范键: 'other', 命名空间: 'cascade句柄', 来源包: 'other_mod' },
                ],
            },
        };
        const s1 = unloadPreset(s0, 'preset_a');
        const entries = s1.受治理键空间注册表.键条目 ?? [];
        expect(entries.find((e) => e.来源包 === 'preset_a')).toBeUndefined();
        expect(entries.find((e) => e.来源包 === 'other_mod')).toBeDefined();
    });
    it('幂等：重复 unloadPreset → no-op（返回同一引用）', () => {
        const s0 = makeState({ presetId: 'preset_a' });
        const s1 = unloadPreset(s0, 'preset_a');
        const s2 = unloadPreset(s1, 'preset_a'); // 已卸载，preset_a 未在任何域
        expect(s2).toBe(s1); // reference equality (fast path)
    });
    it('dangling fail-closed：lore side_effects 引用待卸预设句柄 → throw', () => {
        const base = makeState({ presetId: 'preset_a' });
        const s0 = {
            ...base,
            受治理键空间注册表: {
                键条目: [
                    { 规范键: 'my_handler', 命名空间: 'sideEffect句柄', 来源包: 'preset_a' },
                ],
            },
            _lore知识库: {
                条目: [{
                        侧写: '',
                        分类: '',
                        side_effects: ['my_handler'],
                    }],
            },
        };
        expect(() => unloadPreset(s0, 'preset_a')).toThrowError(/PR-1.*孤儿引用/);
    });
    it('dangling fail-closed：无 lore 引用时 unloadPreset 成功', () => {
        const base = makeState({ presetId: 'preset_a' });
        const s0 = {
            ...base,
            受治理键空间注册表: {
                键条目: [
                    { 规范键: 'my_handler', 命名空间: 'sideEffect句柄', 来源包: 'preset_a' },
                ],
            },
            // _lore知识库 未设置（undefined）→ 无引用 → 正常卸载
        };
        expect(() => unloadPreset(s0, 'preset_a')).not.toThrow();
        const s1 = unloadPreset(s0, 'preset_a');
        expect(s1.世界域['main_domain']?.玩法预设引用).toBe('');
    });
    it('dangling fail-closed：cascade_on_change 引用 → throw', () => {
        const base = makeState({ presetId: 'preset_a' });
        const s0 = {
            ...base,
            受治理键空间注册表: {
                键条目: [
                    { 规范键: 'cascade_handler', 命名空间: 'cascade句柄', 来源包: 'preset_a' },
                ],
            },
            _lore知识库: {
                条目: [{
                        侧写: '',
                        分类: '',
                        cascade_on_change: ['cascade_handler'],
                    }],
            },
        };
        expect(() => unloadPreset(s0, 'preset_a')).toThrowError(/PR-1.*孤儿引用/);
    });
});
// ── F5: 默认 fixture 无切换 → 退化守卫 → 0 漂移 ──────────────────────────────
describe('PR1-F5 · 默认 fixture 无切换 → 0 漂移', () => {
    it('同 presetId + 同版本 + 同难度 → 退化守卫：openedNewSegment=false·state 逐位不变', () => {
        const s0 = makeState({ presetId: 'preset_a' });
        const r1 = swapPreset(s0, PRESET_A, { engineVersion: 'v1' });
        // 再次以同参数 swap
        const r2 = swapPreset(r1.state, PRESET_A, { engineVersion: 'v1' });
        // 退化守卫触发：引用相等
        expect(r2.openedNewSegment).toBe(false);
        expect(r2.state).toBe(r1.state);
    });
    it('不调用 swapPreset → state 完全不变', () => {
        const s0 = makeState();
        const s1 = makeState(); // 同参数重新构建
        // 无 swap 调用 → 两个独立 parse 结果内容相同
        expect(s0.世界?.纪元分钟).toBe(s1.世界?.纪元分钟);
        expect(s0._tick.难度系数组指纹).toBe(s1._tick.难度系数组指纹);
        expect(Object.keys(s0.世界域)).toEqual(Object.keys(s1.世界域));
    });
});
// ── F6: 300 拍 soak 守恒不破 ──────────────────────────────────────────────────
describe('PR1-F6 · 300拍 soak 守恒不破', () => {
    it('100拍(presetA) → swap(presetB) → 100拍 → swap(presetA) → 100拍·守恒持续成立', () => {
        let s = buildWorld();
        // Phase 1: 100 ticks with preset A
        for (let i = 0; i < 100; i++) {
            const result = runTick(s, { tickId: `soak-a-${i}`, spanMinutes: 1440 });
            expect(result.state).toBeDefined();
            s = result.state;
        }
        // Swap → preset B（engineVersion 変化 → 新段）
        const r1 = swapPreset(s, PRESET_B, { engineVersion: 'v2' });
        expect(r1.chainValid).toBe(true);
        s = r1.state;
        // Phase 2: 100 ticks with preset B
        for (let i = 0; i < 100; i++) {
            const result = runTick(s, { tickId: `soak-b-${i}`, spanMinutes: 1440 });
            expect(result.state).toBeDefined();
            s = result.state;
        }
        // Swap back → preset A
        const r2 = swapPreset(s, PRESET_A, { engineVersion: 'v3' });
        expect(r2.chainValid).toBe(true);
        s = r2.state;
        // Phase 3: 100 ticks
        for (let i = 0; i < 100; i++) {
            const result = runTick(s, { tickId: `soak-c-${i}`, spanMinutes: 1440 });
            expect(result.state).toBeDefined();
            s = result.state;
        }
        // 守恒：swapPreset 不触碰账本·Σ净值与初始值相等
        const accounts = s.货币系统?.账户 ?? {};
        expect(() => assertConservation(accounts, EXPECTED_NET_ASSET, getNetAsset)).not.toThrow();
        // 段链完整（跨 swap 至少 2 段）
        const segs = (s._存档头.版本段记录 ?? []);
        expect(segs.length).toBeGreaterThanOrEqual(2);
        const chainResult = verifySegmentChain({ 版本段记录: segs });
        expect(chainResult.valid).toBe(true);
        // 世界时钟推进正确（300 ticks × 1440 分 = 432000 纪元分钟）
        expect(s.世界?.纪元分钟).toBe(300 * 1440);
    });
});
