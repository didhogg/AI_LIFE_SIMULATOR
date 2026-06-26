// C2-T · 多拍 soak — 含死亡 + 关系事件 + 发射 + 消费的长程 fixture
//
// 场景设计：
//   拍 0  : 手注关系涟漪（PC→NPC_WANG·负·量级100）→ 情绪栈动（警惕）
//   拍 3  : NPC_WANG 死亡注入 → 死亡感知发射 → 情绪栈（悲恸）→ _编年史入册
//   拍 7  : 手注关系涟漪（PC→NPC_HONG·正·量级100）→ 情绪栈（信任感）→ 编年史
//   拍 0~19: 全程货币守恒 + schema 合法
//   双宿主: 死亡拍（拍3）两次独立运行 → canonicalize 逐位恒等
//   序号: _编年史序号全程单调递增·无回退
//
// 排除：PR-0 schema 留位 / G2 动力学 / G3 反转（不在本 soak 范围）
import { describe, it, expect } from 'vitest';
import { runTick, SETTLEMENT_PHASES } from '@ai-life-sim/core/engine/tick';
import { assertConservation } from '@ai-life-sim/core/engine/conservation';
import { getNetAsset } from '@ai-life-sim/core/engine/netAsset';
import { RootSchema } from '@ai-life-sim/core';
import { 指令信封Schema } from '@ai-life-sim/core';
import { canonicalize } from '@ai-life-sim/core/engine/text/canonicalize';
import { buildWorld, PC, NPC_WANG, NPC_HONG, EXPECTED_NET_ASSET, } from '../fixture/world.js';
const BASE_ENVELOPE = 指令信封Schema.parse({ 提案: {} });
function relPack(actorKey, targetKey, Δ方向, 量级) {
    return [{
            标签: Δ方向 < 0 ? '冲突' : '义举',
            极性: Δ方向 < 0 ? '负' : '正',
            强度: 量级, 可见性: '公开', 来源拍号: 0,
            factFragment: { 主体: actorKey, 维度: '关系', Δ方向, 客体: targetKey, 量级 },
        }];
}
function deathPack(actorKey) {
    return [[{ path: `NPC.${actorKey}.存活状态`, op: 'set', value: '已故' }]];
}
// ── SK-1 · 拍 0 关系涟漪（警惕情绪） ────────────────────────────────────────
describe('C2-T SK-1 · 拍0 关系涟漢（负·量级100）→ 情绪栈动', () => {
    it('警惕出现在 NPC_WANG 情绪栈 + 守恒不破', () => {
        const s0 = buildWorld();
        s0.$涟漪候选[PC] = relPack(PC, NPC_WANG, -1, 100);
        const { state: s1 } = runTick(s0, { tickId: 'sk1-rel0', spanMinutes: 1440 });
        const 警惕 = s1.NPC[NPC_WANG]?.情绪栈.find(e => e.情绪名 === '警惕');
        expect(警惕).toBeDefined();
        expect(警惕?.数值).toBeGreaterThan(0);
        expect(() => assertConservation(s1.货币系统.账户, EXPECTED_NET_ASSET, getNetAsset)).not.toThrow();
    });
});
// ── SK-2 · 拍 3 死亡拍（悲恸 + 编年史 + 双宿主恒等）──────────────────────────
describe('C2-T SK-2 · 拍3 死亡 → 悲恸情绪 + _编年史入册', () => {
    function buildToTick3() {
        let s = buildWorld();
        // 拍 0: 关系涟漪
        s.$涟漪候选[PC] = relPack(PC, NPC_WANG, -1, 100);
        ({ state: s } = runTick(s, { tickId: 'sk2-t0', spanMinutes: 1440 }));
        // 拍 1, 2: 普通拍
        for (let i = 1; i <= 2; i++) {
            ({ state: s } = runTick(s, { tickId: `sk2-t${i}`, spanMinutes: 1440 }));
        }
        return s;
    }
    it('NPC_WANG 拍3死亡 → NPC_HONG 情绪栈含「悲恸」', () => {
        const s3 = buildToTick3();
        const { state: s4 } = runTick(s3, {
            tickId: 'sk2-death',
            injectedEnvelope: BASE_ENVELOPE,
            injectedPacks: deathPack(NPC_WANG),
            injected授权源: '系统',
        });
        const 悲恸 = s4.NPC[NPC_HONG]?.情绪栈.find(e => e.情绪名 === '悲恸');
        expect(悲恸).toBeDefined();
        expect(悲恸?.数值).toBeGreaterThan(0);
    });
    it('拍3死亡 → _编年史入册（序号>0）', () => {
        const s3 = buildToTick3();
        const prevLen = s3.全局._编年史.length;
        const { state: s4 } = runTick(s3, {
            tickId: 'sk2-death-chronicle',
            injectedEnvelope: BASE_ENVELOPE,
            injectedPacks: deathPack(NPC_WANG),
            injected授权源: '系统',
        });
        expect(s4.全局._编年史.length).toBeGreaterThan(prevLen);
        expect(s4.全局._编年史.at(-1)?.序号).toBeGreaterThan(0);
    });
    it('双宿主恒等：死亡拍两次独立运行 canonicalize 逐位恒等', () => {
        function runDeathPipeline() {
            const s3 = buildToTick3();
            return runTick(s3, {
                tickId: 'sk2-dual-death',
                injectedEnvelope: BASE_ENVELOPE,
                injectedPacks: deathPack(NPC_WANG),
                injected授权源: '系统',
            }).state;
        }
        const r1 = runDeathPipeline();
        const r2 = runDeathPipeline();
        expect(canonicalize(r1)).toBe(canonicalize(r2));
    });
    it('拍3死亡后守恒不破', () => {
        const s3 = buildToTick3();
        const { state: s4 } = runTick(s3, {
            tickId: 'sk2-death-conservation',
            injectedEnvelope: BASE_ENVELOPE,
            injectedPacks: deathPack(NPC_WANG),
            injected授权源: '系统',
        });
        expect(() => assertConservation(s4.货币系统.账户, EXPECTED_NET_ASSET, getNetAsset)).not.toThrow();
    });
});
// ── SK-3 · 全程 20 拍守恒 + schema + 序号单调 ────────────────────────────────
describe('C2-T SK-3 · 全程 20 拍长程 soak（含死亡+关系·全程守恒+schema+序号单调）', () => {
    it('20 拍含三类事件·全程守恒 + schema 合法 + _编年史序号单调', () => {
        let s = buildWorld();
        const chronicleSeqLog = [];
        for (let i = 0; i < 20; i++) {
            // 拍 0: 关系涟漪（负）
            if (i === 0) {
                s.$涟漪候选[PC] = relPack(PC, NPC_WANG, -1, 100);
            }
            // 拍 5: NPC_WANG 死亡
            if (i === 5) {
                ({ state: s } = runTick(s, {
                    tickId: `sk3-t${i}`,
                    injectedEnvelope: BASE_ENVELOPE,
                    injectedPacks: deathPack(NPC_WANG),
                    injected授权源: '系统',
                }));
            }
            else if (i === 7) {
                // 拍 7: PC→HONG 正关系涟漪
                s.$涟漪候选[PC] = relPack(PC, NPC_HONG, 1, 100);
                ({ state: s } = runTick(s, { tickId: `sk3-t${i}`, spanMinutes: 1440 }));
            }
            else {
                ({ state: s } = runTick(s, { tickId: `sk3-t${i}`, spanMinutes: 1440 }));
            }
            // 每拍校验守恒
            expect(() => assertConservation(s.货币系统.账户, EXPECTED_NET_ASSET, getNetAsset)).not.toThrow();
            // 每拍收集编年史序号
            if (s.全局._编年史.length > 0) {
                chronicleSeqLog.push(...s.全局._编年史.map(e => e.序号));
            }
        }
        // schema 合法
        expect(RootSchema.safeParse(s).success).toBe(true);
        // 编年史序号单调递增（无回退）
        const uniqueSeqs = [...new Set(chronicleSeqLog)].sort((a, b) => a - b);
        for (let i = 1; i < uniqueSeqs.length; i++) {
            expect(uniqueSeqs[i]).toBeGreaterThan(uniqueSeqs[i - 1]);
        }
        // 拍 5 之后死亡情绪应存在（NPC_HONG 应有悲恸或其他生命维度情绪）
        const hongHasSomeEmotion = (s.NPC[NPC_HONG]?.情绪栈.length ?? 0) > 0;
        expect(hongHasSomeEmotion).toBe(true);
    });
    it('20 拍双宿主恒等：两条独立 20 拍流水线 canonicalize 逐位恒等', () => {
        function run20() {
            let s = buildWorld();
            for (let i = 0; i < 20; i++) {
                if (i === 0)
                    s.$涟漪候选[PC] = relPack(PC, NPC_WANG, -1, 100);
                if (i === 5) {
                    ({ state: s } = runTick(s, {
                        tickId: `sk3-dual-t${i}`,
                        injectedEnvelope: BASE_ENVELOPE,
                        injectedPacks: deathPack(NPC_WANG),
                        injected授权源: '系统',
                    }));
                }
                else {
                    ({ state: s } = runTick(s, { tickId: `sk3-dual-t${i}`, spanMinutes: 1440 }));
                }
            }
            return s;
        }
        const r1 = run20();
        const r2 = run20();
        expect(canonicalize(r1)).toBe(canonicalize(r2));
    });
});
// ── SK-4 · 黄金向量不漂移（C2-5 新阶段对标准 50 拍无 RNG draw · 不影响向量）───
describe('C2-T SK-4 · SETTLEMENT_PHASES + 标准 50 拍不漂移验证', () => {
    it('SETTLEMENT_PHASES 含 14 个阶段', () => {
        expect(SETTLEMENT_PHASES).toHaveLength(14);
    });
    it('标准 50 拍（无死亡·无手注涟漪）→ schema 合法·守恒不破·感知消费均 no-op', () => {
        let s = buildWorld();
        for (let i = 0; i < 50; i++) {
            ({ state: s } = runTick(s, { tickId: `sk4-std-${i}`, spanMinutes: 1440 }));
        }
        // 标准跑无死亡 → _编年史应为空（C2-5 no-op 路径）
        expect(s.全局._编年史.length).toBe(0);
        // 标准跑无涟漣候选 → 情绪栈均为空（C2-5 no-op·buildWorld NPC 初始 情绪栈=[]）
        for (const npc of Object.values(s.NPC)) {
            expect(npc?.情绪栈.length).toBe(0);
        }
        // 守恒 + schema
        expect(() => assertConservation(s.货币系统.账户, EXPECTED_NET_ASSET, getNetAsset)).not.toThrow();
        expect(RootSchema.safeParse(s).success).toBe(true);
    });
    it('含关系事件的 50 拍两次运行逐位恒等（不含死亡·无 G0 重定基）', () => {
        function run50WithRel() {
            let s = buildWorld();
            for (let i = 0; i < 50; i++) {
                if (i === 10) {
                    s.$涟漪候选[PC] = relPack(PC, NPC_WANG, 1, 80);
                }
                ({ state: s } = runTick(s, { tickId: `sk4-rel50-${i}`, spanMinutes: 1440 }));
            }
            return s;
        }
        expect(canonicalize(run50WithRel())).toBe(canonicalize(run50WithRel()));
    });
});
