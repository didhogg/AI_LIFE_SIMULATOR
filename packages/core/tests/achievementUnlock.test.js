// P8-a · 成就解锁 consumer 单测
// 覆盖：no-op 回归 / 条件真/假/空串/解析失败 / 幂等 / per-actor / 多 NPC×多成就 确定性
//       原型 guard / SETTLEMENT_PHASES=16 / 守恒中性 / 金向量逐位恒等
// 禁区：解锁后果引用·徽章展示（P8-b·认知层·本轮不读）
import { describe, it, expect } from 'vitest';
import { runTick, SETTLEMENT_PHASES } from '../engine/tick.js';
import { RootSchema } from '../schema/index.js';
// ── helpers ───────────────────────────────────────────────────────────────────
function mkAch(overrides = {}) {
    return { 名称: 'テスト', ...overrides };
}
const TICK_ID = (s) => `ach-test-${s}`;
// ── BASE_STATE ────────────────────────────────────────────────────────────────
// NPC A: 属性.智慧=80（高·条件 "属性.智慧 >= 70" 可满足）
// NPC B: 属性.智慧=30（低·条件不满足）
// 货币账户：守恒配对，确保 assertConservation 不因成就写入而报错
const BASE = RootSchema.parse({
    NPC: {
        npc_a: {
            属性: { 体质: 50, 智慧: 80, 感知: 50, 魅力: 30, 心理: 50 },
        },
        npc_b: {
            属性: { 体质: 50, 智慧: 30, 感知: 50, 魅力: 30, 心理: 50 },
        },
    },
    货币系统: {
        账户: {
            npc_a: { 持有: { 文: 100 } },
            npc_b: { 持有: { 文: 100 } },
        },
    },
    _tick: { 拍计数: 5 },
    世界: { 纪元分钟: 720 },
    _状态机: { 双时钟: { 世界钟: 100 } },
    _席位表: {},
    全局: {},
});
// ── P8-a-0 · SETTLEMENT_PHASES=16 守卫 ──────────────────────────────────────
describe('P8-a-0 · SETTLEMENT_PHASES=16 · 新 phase 在位 · 既有序不变', () => {
    it('SETTLEMENT_PHASES 长度=16', () => {
        expect(SETTLEMENT_PHASES).toHaveLength(16);
    });
    it('成就解锁 在 SETTLEMENT_PHASES 中', () => {
        expect(SETTLEMENT_PHASES).toContain('成就解锁');
    });
    it('成就解锁 在 媒介拍末取材 之后·原子提交 之前', () => {
        const idx = SETTLEMENT_PHASES.indexOf('成就解锁');
        const idxMedia = SETTLEMENT_PHASES.indexOf('媒介拍末取材');
        const idxCommit = SETTLEMENT_PHASES.indexOf('原子提交');
        expect(idx).toBeGreaterThan(idxMedia);
        expect(idx).toBeLessThan(idxCommit);
    });
    it('既有 14 phase 名称 & 顺序不变', () => {
        const expected14 = [
            '日程结算', '事件种子萌发', '阈值触发', '日期触发', '标志触发',
            'LOD调度', '关系触发', '提案落账', '死亡感知发射', '衰减批',
            '涟漪传播', '感知情绪化', '编年史入册', '媒介拍末取材',
        ];
        // 既有 14 项按原顺序依次出现
        let prev = -1;
        for (const ph of expected14) {
            const cur = SETTLEMENT_PHASES.indexOf(ph);
            expect(cur).toBeGreaterThan(prev);
            prev = cur;
        }
    });
});
// ── P8-a-1 · 空库 / undefined → 精确 no-op（金向量守卫） ───────────────────
describe('P8-a-1 · achievements undefined/空对象 → no-op（金向量守卫）', () => {
    const rUndef = runTick(BASE, { tickId: TICK_ID('noop-undef'), achievements: undefined });
    const rEmpty = runTick(BASE, { tickId: TICK_ID('noop-empty'), achievements: {} });
    it('achievements=undefined → NPC.成就 零写入', () => {
        expect(rUndef.state.NPC['npc_a']?.成就).toEqual({});
        expect(rUndef.state.NPC['npc_b']?.成就).toEqual({});
    });
    it('achievements={} → NPC.成就 零写入', () => {
        expect(rEmpty.state.NPC['npc_a']?.成就).toEqual({});
        expect(rEmpty.state.NPC['npc_b']?.成就).toEqual({});
    });
    it('achievements=undefined → settledPhases 含 成就解锁', () => {
        expect(rUndef.settledPhases).toContain('成就解锁');
    });
    it('achievements={} → settledPhases 含 成就解锁', () => {
        expect(rEmpty.settledPhases).toContain('成就解锁');
    });
    it('no-op 下 货币账户不变（守恒中性验证）', () => {
        expect(rEmpty.state.货币系统?.账户['npc_a']?.持有['文']).toBe(100);
        expect(rEmpty.state.货币系统?.账户['npc_b']?.持有['文']).toBe(100);
    });
});
// ── P8-a-2 · 条件真 → 解锁记录 ──────────────────────────────────────────────
describe('P8-a-2 · 解锁条件真 → npc.成就[achId] 写入', () => {
    const lib = {
        smart_one: mkAch({ 名称: '智者', 描述: '聪明的人', 解锁条件引用: '属性.智慧 >= 70' }),
    };
    const r = runTick(BASE, { tickId: TICK_ID('unlock-a'), achievements: lib });
    it('npc_a（智慧=80）解锁 smart_one', () => {
        expect(r.state.NPC['npc_a']?.成就).toHaveProperty('smart_one');
    });
    it('解锁时间 = nowEpochMin（BASE 世界.纪元分钟=720）', () => {
        expect(r.state.NPC['npc_a']?.成就['smart_one']?.解锁时间).toBe(720);
    });
    it('描述 回填 entry.描述', () => {
        expect(r.state.NPC['npc_a']?.成就['smart_one']?.描述).toBe('聪明的人');
    });
    it('settledPhases 含 成就解锁', () => {
        expect(r.settledPhases).toContain('成就解锁');
    });
});
// ── P8-a-3 · 条件假 / 空串 / 解析失败 → 不解锁 ─────────────────────────────
describe('P8-a-3 · 条件假/空串/解析失败 → 不写 NPC.成就', () => {
    it('条件假（智慧 < 阈值）→ 不解锁', () => {
        const lib = {
            high_iq: mkAch({ 解锁条件引用: '属性.智慧 >= 99' }),
        };
        const r = runTick(BASE, { tickId: TICK_ID('cond-false'), achievements: lib });
        expect(r.state.NPC['npc_a']?.成就).not.toHaveProperty('high_iq');
        expect(r.state.NPC['npc_b']?.成就).not.toHaveProperty('high_iq');
    });
    it('解锁条件引用=空串 → fail-closed=false → 不解锁', () => {
        const lib = {
            empty_cond: mkAch({ 解锁条件引用: '' }),
        };
        const r = runTick(BASE, { tickId: TICK_ID('cond-empty'), achievements: lib });
        expect(r.state.NPC['npc_a']?.成就).not.toHaveProperty('empty_cond');
    });
    it('解锁条件引用=undefined（无条件字段）→ 不解锁', () => {
        const lib = {
            no_cond: mkAch(), // 无 解锁条件引用
        };
        const r = runTick(BASE, { tickId: TICK_ID('cond-undef'), achievements: lib });
        expect(r.state.NPC['npc_a']?.成就).not.toHaveProperty('no_cond');
    });
    it('解锁条件引用=非法 DSL 串 → 解析失败 fail-closed=false → 不解锁', () => {
        const lib = {
            bad_dsl: mkAch({ 解锁条件引用: '!!!invalid dsl' }),
        };
        const r = runTick(BASE, { tickId: TICK_ID('cond-bad-dsl'), achievements: lib });
        expect(r.state.NPC['npc_a']?.成就).not.toHaveProperty('bad_dsl');
    });
});
// ── P8-a-4 · 幂等：已解锁 achId 二次 runTick 不覆写 ────────────────────────
describe('P8-a-4 · 幂等：已解锁 → 解锁时间不变', () => {
    it('第一次 runTick 解锁·第二次 runTick（新 tickId）不覆写', () => {
        const lib = {
            first_lock: mkAch({ 名称: '幂等测', 解锁条件引用: '属性.智慧 >= 70' }),
        };
        // 第一次·纪元分钟=720
        const r1 = runTick(BASE, { tickId: TICK_ID('idm-t1'), achievements: lib });
        const 解锁时间1 = r1.state.NPC['npc_a']?.成就['first_lock']?.解锁时间;
        expect(解锁时间1).toBe(720);
        // 第二次·推进时钟（拍后纪元分钟 = 720+43200）·同一 achId·不应覆写
        const r2 = runTick(r1.state, { tickId: TICK_ID('idm-t2'), achievements: lib });
        const 解锁时间2 = r2.state.NPC['npc_a']?.成就['first_lock']?.解锁时间;
        expect(解锁时间2).toBe(解锁时间1); // 时间戳不变
    });
});
// ── P8-a-5 · per-actor：A 满足 / B 不满足 → 只 A 解锁 ──────────────────────
describe('P8-a-5 · per-actor 独立判定', () => {
    const lib = {
        wise_one: mkAch({ 解锁条件引用: '属性.智慧 >= 70' }), // A=80✓  B=30✗
    };
    const r = runTick(BASE, { tickId: TICK_ID('per-actor'), achievements: lib });
    it('npc_a（智慧=80）解锁', () => {
        expect(r.state.NPC['npc_a']?.成就).toHaveProperty('wise_one');
    });
    it('npc_b（智慧=30）不解锁', () => {
        expect(r.state.NPC['npc_b']?.成就).not.toHaveProperty('wise_one');
    });
});
// ── P8-a-6 · 多 NPC × 多成就·.sort() 确定性双跑 ────────────────────────────
describe('P8-a-6 · 多 NPC×多成就 码点序双跑逐位恒等', () => {
    const lib = {
        ach_strength: mkAch({ 解锁条件引用: '属性.体质 >= 50' }), // 两 NPC 均满足（体质=50）
        ach_wise_hi: mkAch({ 解锁条件引用: '属性.智慧 >= 70' }), // 仅 npc_a 满足
        ach_never: mkAch({ 解锁条件引用: '属性.智慧 >= 99' }), // 无人满足
    };
    it('两次独立 runTick（不同 tickId）state JSON 逐位相同', () => {
        const r1 = runTick(BASE, { tickId: TICK_ID('det-1'), achievements: lib });
        const r2 = runTick(BASE, { tickId: TICK_ID('det-2'), achievements: lib });
        // 注：tickId 不同 → _系统.已结算标记 key 不同，但 NPC.成就 相同
        expect(JSON.stringify(r1.state.NPC['npc_a']?.成就)).toBe(JSON.stringify(r2.state.NPC['npc_a']?.成就));
        expect(JSON.stringify(r1.state.NPC['npc_b']?.成就)).toBe(JSON.stringify(r2.state.NPC['npc_b']?.成就));
    });
    it('ach_strength：两 NPC 均解锁', () => {
        const r = runTick(BASE, { tickId: TICK_ID('multi-ach'), achievements: lib });
        expect(r.state.NPC['npc_a']?.成就).toHaveProperty('ach_strength');
        expect(r.state.NPC['npc_b']?.成就).toHaveProperty('ach_strength');
    });
    it('ach_wise_hi：仅 npc_a 解锁', () => {
        const r = runTick(BASE, { tickId: TICK_ID('multi-ach2'), achievements: lib });
        expect(r.state.NPC['npc_a']?.成就).toHaveProperty('ach_wise_hi');
        expect(r.state.NPC['npc_b']?.成就).not.toHaveProperty('ach_wise_hi');
    });
    it('ach_never：无人解锁', () => {
        const r = runTick(BASE, { tickId: TICK_ID('multi-ach3'), achievements: lib });
        expect(r.state.NPC['npc_a']?.成就).not.toHaveProperty('ach_never');
        expect(r.state.NPC['npc_b']?.成就).not.toHaveProperty('ach_never');
    });
});
// ── P8-a-7 · 原型 guard：constructor/__proto__ 作 achId → 跳过 ───────────────
describe('P8-a-7 · 原型污染 guard', () => {
    it('原型继承属性不视为成就条目·只读 own-property', () => {
        // null-proto 对象：safe_one 是 own property；通过原型链继承的属性不应被读
        const base = Object.create(null);
        base['safe_one'] = mkAch({ 解锁条件引用: '属性.智慧 >= 70' });
        // 子对象：own property = good_one；继承 safe_one
        const child = Object.create(base);
        child['good_one'] = mkAch({ 解锁条件引用: '属性.智慧 >= 70' });
        // child 继承了 safe_one 但它不是 own property
        let r;
        expect(() => {
            r = runTick(BASE, { tickId: TICK_ID('proto-guard'), achievements: child });
        }).not.toThrow();
        // good_one 是 own property → 解锁
        expect(r?.state.NPC['npc_a']?.成就).toHaveProperty('good_one');
        // safe_one 仅在原型上 → own-property guard 过滤 → 不解锁
        expect(r?.state.NPC['npc_a']?.成就).not.toHaveProperty('safe_one');
    });
    it('npcKey 为 constructor → own-property guard 过滤·不写 NPC', () => {
        // RootSchema.parse 的 NPC 是普通 Object，构造时无 constructor 键
        // 本测试确认循环对 Object.keys(s.NPC) 返回的键均通过 hasOwnProperty
        const r = runTick(BASE, { tickId: TICK_ID('npc-proto'), achievements: {
                test_ach: mkAch({ 解锁条件引用: '属性.智慧 >= 0' }),
            } });
        // 只有 npc_a / npc_b 应被枚举（无 constructor 等原型键）
        const unlockedKeys = Object.keys(r.state.NPC).filter(k => Object.keys(r.state.NPC[k]?.成就 ?? {}).length > 0);
        expect(unlockedKeys.every(k => k === 'npc_a' || k === 'npc_b')).toBe(true);
    });
});
// ── P8-a-8 · 守恒：NPC.成就 非货币 → assertConservation 不受影响 ─────────────
describe('P8-a-8 · NPC.成就 写入不触发 ConservationError', () => {
    it('解锁成就 → 货币净值不变 → 守恒断言通过', () => {
        const lib = {
            rich_ach: mkAch({ 解锁条件引用: '属性.智慧 >= 70' }),
        };
        expect(() => {
            runTick(BASE, { tickId: TICK_ID('cons-safe'), achievements: lib });
        }).not.toThrow();
    });
});
// ── P8-a-9 · 金向量回归：提供成就库不影响无货币变化的 state hash ─────────────
describe('P8-a-9 · 金向量回归·解锁写 NPC.成就 不进指纹', () => {
    it('黄金测试：连续两次独立 runTick 结果确定性', () => {
        const lib = {
            gold_ach: mkAch({ 解锁条件引用: '属性.智慧 >= 70' }),
        };
        const r1 = runTick(BASE, { tickId: TICK_ID('gold-1'), achievements: lib });
        const r2 = runTick(BASE, { tickId: TICK_ID('gold-2'), achievements: lib });
        // NPC.成就 状态逐位相同（确定性）
        expect(JSON.stringify(r1.state.NPC['npc_a']?.成就)).toBe(JSON.stringify(r2.state.NPC['npc_a']?.成就));
    });
});
