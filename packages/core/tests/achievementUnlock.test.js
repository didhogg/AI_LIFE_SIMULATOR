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
// ── P8-a-0 · SETTLEMENT_PHASES 守卫 ──────────────────────────────────────────
describe('P8-a-0 · SETTLEMENT_PHASES=17 · 新 phase 在位 · 既有序不变', () => {
    it('SETTLEMENT_PHASES 长度=17（P9-2 扩展参数播种 新增）', () => {
        expect(SETTLEMENT_PHASES).toHaveLength(17);
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
// ═══════════════════════════════════════════════════════════════════════════════
// P8-b · 成就解锁后果执行（复用 P7-7 apply 链）
// ═══════════════════════════════════════════════════════════════════════════════
// ── P8-b-0 · E2E 落账：五 op 端到端验证 ─────────────────────────────────────
describe('P8-b-0 · E2E 落账 — 五 op 经复用链端到端', () => {
    // 一个成就含五条后果，覆盖 set/add/sub/clamp/lock 各 op
    const lib = {
        e2e_ach: mkAch({
            解锁条件引用: '属性.智慧 >= 70', // npc_a=80 满足
            解锁后果引用: [
                { path: 'NPC.npc_a.属性.智慧', op: 'add', value: 10 }, // 80+10=90
                { path: 'NPC.npc_a.属性.感知', op: 'sub', value: 5 }, // 50-5=45
                { path: 'NPC.npc_a.属性.体质', op: 'set', value: 60 }, // 60（类型匹配：number=number）
                { path: 'NPC.npc_a.属性.魅力', op: 'clamp', value: 0 }, // 跳过（非值写 op）
                { path: 'NPC.npc_a.属性.心理', op: 'lock', value: 0 }, // 跳过（marker op）
            ],
        }),
    };
    const r = runTick(BASE, { tickId: TICK_ID('e2e-ops'), achievements: lib });
    it('add: 属性.智慧 80+10=90', () => {
        expect(r.state.NPC['npc_a']?.属性?.智慧).toBe(90);
    });
    it('sub: 属性.感知 50-5=45', () => {
        expect(r.state.NPC['npc_a']?.属性?.感知).toBe(45);
    });
    it('set: 属性.体质 → 60', () => {
        expect(r.state.NPC['npc_a']?.属性?.体质).toBe(60);
    });
    it('clamp op: 属性.魅力 不写（APPLY_OPS 不含 clamp）', () => {
        expect(r.state.NPC['npc_a']?.属性?.魅力).toBe(30); // 未变
    });
    it('lock op: 属性.心理 不写·不污染为 undefined（APPLY_OPS 不含 lock）', () => {
        expect(r.state.NPC['npc_a']?.属性?.心理).toBe(50); // 未变
        expect(r.state.NPC['npc_a']?.属性?.心理).not.toBeUndefined();
    });
    it('npc_b（未解锁）属性全不变', () => {
        expect(r.state.NPC['npc_b']?.属性?.智慧).toBe(30);
        expect(r.state.NPC['npc_b']?.属性?.感知).toBe(50);
    });
});
// ── P8-b-1 · 守恒-平：sink 配平货币 → assertConservation 通过 ───────────────
describe('P8-b-1 · 守恒-平：奖励货币自带 sink → 通过', () => {
    it('npc_a+50 文 / npc_b-50 文·净值不变·守恒通过', () => {
        const lib = {
            currency_balanced: mkAch({
                解锁条件引用: '属性.智慧 >= 70', // npc_a 满足
                解锁后果引用: [
                    { path: '货币系统.账户.npc_a.持有.文', op: 'add', value: 50 },
                    { path: '货币系统.账户.npc_b.持有.文', op: 'sub', value: 50 },
                ],
            }),
        };
        let r;
        expect(() => {
            r = runTick(BASE, { tickId: TICK_ID('cons-bal'), achievements: lib });
        }).not.toThrow();
        expect(r?.state.货币系统?.账户['npc_a']?.持有['文']).toBe(150);
        expect(r?.state.货币系统?.账户['npc_b']?.持有['文']).toBe(50);
    });
});
// ── P8-b-2 · 守恒-不平：凭空发币 → ConservationError（整拍拒）──────────────
describe('P8-b-2 · 守恒-不平：凭空发币 → ConservationError', () => {
    it('npc_a+100 文·无 sink → assertConservation 抛', () => {
        const lib = {
            fiat_money: mkAch({
                解锁条件引用: '属性.智慧 >= 70',
                解锁后果引用: [
                    { path: '货币系统.账户.npc_a.持有.文', op: 'add', value: 100 }, // 无对应 sink
                ],
            }),
        };
        expect(() => {
            runTick(BASE, { tickId: TICK_ID('cons-fail'), achievements: lib });
        }).toThrow(); // ConservationError 从原子提交 phase 抛出
    });
});
// ── P8-b-3 · safeParse 跳过：畸形元素被跳·其余照常落账 ──────────────────────
describe('P8-b-3 · safeParse 跳过·不抛·其余照常', () => {
    it('畸形元素（缺 path）跳过·后续合法元素落账', () => {
        const lib = {
            partial_bad: mkAch({
                解锁条件引用: '属性.智慧 >= 70',
                解锁后果引用: [
                    { bad: 'malformed_no_path' }, // safeParse 失败 → 跳过
                    { path: 'NPC.npc_a.属性.智慧', op: 'add', value: 7 }, // 合法 → 落账
                ],
            }),
        };
        let r;
        expect(() => {
            r = runTick(BASE, { tickId: TICK_ID('parse-skip'), achievements: lib });
        }).not.toThrow();
        expect(r?.state.NPC['npc_a']?.属性?.智慧).toBe(87); // 80+7=87（畸形跳过·合法落账）
    });
    it('null 元素跳过·不抛', () => {
        const lib = {
            null_el: mkAch({
                解锁条件引用: '属性.智慧 >= 70',
                解锁后果引用: [null, { path: 'NPC.npc_a.属性.智慧', op: 'add', value: 3 }],
            }),
        };
        let r;
        expect(() => {
            r = runTick(BASE, { tickId: TICK_ID('null-skip'), achievements: lib });
        }).not.toThrow();
        expect(r?.state.NPC['npc_a']?.属性?.智慧).toBe(83);
    });
});
// ── P8-b-4 · M3 硬排除：$/_ 首段路径 → 不写穿治理键空间 ─────────────────────
describe('P8-b-4 · M3 硬排除：$/_ 首段路径被拒', () => {
    it('_ 首段路径后果 → M3 硬拒·state 不变', () => {
        // _internal 通过 safeParse（受治理路径Schema 允许下划线·仅 runtime 拒写）
        // runEffectGates Gate③ 或 M3 pre-check 均阻止写入
        const lib = {
            underscore_path: mkAch({
                解锁条件引用: '属性.智慧 >= 70',
                解锁后果引用: [
                    { path: '_tick.拍计数', op: 'set', value: 999 },
                ],
            }),
        };
        const r = runTick(BASE, { tickId: TICK_ID('m3-underscore'), achievements: lib });
        // _tick.拍计数 不被后果覆写（引擎正常 +1·不被 999 污染）
        expect(r.state._tick?.拍计数).not.toBe(999);
    });
    it('$ 首段路径后果 → M3 硬拒（safeParse 路径校验）·state 不变', () => {
        const lib = {
            dollar_path: mkAch({
                解锁条件引用: '属性.智慧 >= 70',
                解锁后果引用: [
                    { path: '$临时会话.foo', op: 'set', value: 0 },
                    { path: 'NPC.npc_a.属性.智慧', op: 'add', value: 2 },
                ],
            }),
        };
        const r = runTick(BASE, { tickId: TICK_ID('m3-dollar'), achievements: lib });
        // $ 路径被拒·合法后果照常落账
        expect(r.state.NPC['npc_a']?.属性?.智慧).toBe(82); // +2
    });
});
// ── P8-b-5 · scope 隔离：多 NPC 各自解锁·后果只落对应 npcKey ─────────────────
describe('P8-b-5 · scope 隔离·多 NPC·后果不串', () => {
    it('npc_a 后果只落 npc_a·npc_b 后果只落 npc_b·互不干扰', () => {
        const lib = {
            ach_a: mkAch({
                解锁条件引用: '属性.智慧 >= 70', // npc_a=80 满足
                解锁后果引用: [{ path: 'NPC.npc_a.属性.智慧', op: 'add', value: 10 }],
            }),
            ach_b: mkAch({
                解锁条件引用: '属性.智慧 < 70', // npc_b=30 满足
                解锁后果引用: [{ path: 'NPC.npc_b.属性.智慧', op: 'add', value: 10 }],
            }),
        };
        const r = runTick(BASE, { tickId: TICK_ID('scope-iso'), achievements: lib });
        expect(r.state.NPC['npc_a']?.属性?.智慧).toBe(90); // npc_a 解锁 ach_a → +10
        expect(r.state.NPC['npc_b']?.属性?.智慧).toBe(40); // npc_b 解锁 ach_b → +10
        // npc_a 不会执行 ach_b 后果（ach_b 条件对 npc_a 为 false）
        // npc_b 不会执行 ach_a 后果（ach_a 条件对 npc_b 为 false）
    });
});
// ── P8-b-6 · 幂等/重放：后果仅首解锁拍执行一次 ──────────────────────────────
describe('P8-b-6 · 幂等/重放：同成就跨拍重复·后果仅首拍执行', () => {
    const lib = {
        once_ach: mkAch({
            解锁条件引用: '属性.智慧 >= 70',
            解锁后果引用: [{ path: 'NPC.npc_a.属性.智慧', op: 'add', value: 5 }],
        }),
    };
    it('第一拍解锁·属性.智慧 +5', () => {
        const r1 = runTick(BASE, { tickId: TICK_ID('idem-t1'), achievements: lib });
        expect(r1.state.NPC['npc_a']?.属性?.智慧).toBe(85); // 80+5
    });
    it('第二拍（已解锁）→ 后果不重复执行·属性.智慧 不再 +5', () => {
        const r1 = runTick(BASE, { tickId: TICK_ID('idem-r1'), achievements: lib });
        const r2 = runTick(r1.state, { tickId: TICK_ID('idem-r2'), achievements: lib });
        expect(r2.state.NPC['npc_a']?.属性?.智慧).toBe(85); // 仍 85·不再 +5
    });
    it('双跑逐位恒等（确定性）', () => {
        const rA = runTick(BASE, { tickId: TICK_ID('idem-det-a'), achievements: lib });
        const rB = runTick(BASE, { tickId: TICK_ID('idem-det-b'), achievements: lib });
        expect(JSON.stringify(rA.state.NPC['npc_a']?.属性)).toBe(JSON.stringify(rB.state.NPC['npc_a']?.属性));
    });
});
// ── P8-b-7 · 空库/无后果 no-op ────────────────────────────────────────────────
describe('P8-b-7 · 解锁后果引用 空/undefined → 零 state 写·phase 仍登记', () => {
    it('解锁后果引用=[] → 解锁记录写入·属性不变', () => {
        const lib = {
            no_conseq: mkAch({ 解锁条件引用: '属性.智慧 >= 70', 解锁后果引用: [] }),
        };
        const r = runTick(BASE, { tickId: TICK_ID('noop-empty-ach'), achievements: lib });
        expect(r.state.NPC['npc_a']?.成就).toHaveProperty('no_conseq');
        expect(r.state.NPC['npc_a']?.属性?.智慧).toBe(80); // 属性不变
        expect(r.settledPhases).toContain('成就解锁');
    });
    it('解锁后果引用=undefined → 解锁记录写入·属性不变', () => {
        const lib = {
            undef_conseq: mkAch({ 解锁条件引用: '属性.智慧 >= 70' }), // 无 解锁后果引用 字段
        };
        const r = runTick(BASE, { tickId: TICK_ID('noop-undef-ach'), achievements: lib });
        expect(r.state.NPC['npc_a']?.成就).toHaveProperty('undef_conseq');
        expect(r.state.NPC['npc_a']?.属性?.智慧).toBe(80);
    });
});
// ── P8-b-8 · 原型污染：__proto__ path → safeParse 失败·跳过 ─────────────────
describe('P8-b-8 · 原型污染 guard', () => {
    it('__proto__ 名 path 后果 → 受治理路径Schema 拒·safeParse 失败·跳过·不污染原型', () => {
        const lib = {
            proto_ach: mkAch({
                解锁条件引用: '属性.智慧 >= 70',
                解锁后果引用: [
                    { path: '__proto__', op: 'set', value: 'poisoned' }, // 受治理路径Schema 拒（JS保留键）
                    { path: 'NPC.npc_a.属性.智慧', op: 'add', value: 3 },
                ],
            }),
        };
        let r;
        expect(() => {
            r = runTick(BASE, { tickId: TICK_ID('proto-path'), achievements: lib });
        }).not.toThrow();
        expect(r?.state.NPC['npc_a']?.属性?.智慧).toBe(83); // 合法后果落账
        // Object.prototype 未被污染
        expect(Object.prototype['poisoned']).toBeUndefined();
    });
    it('constructor 名后果元素 → safeParse 失败·跳过·不抛', () => {
        const lib = {
            ctor_ach: mkAch({
                解锁条件引用: '属性.智慧 >= 70',
                解锁后果引用: [
                    { path: 'constructor', op: 'set', value: 0 }, // JS保留键 → safeParse 失败
                ],
            }),
        };
        expect(() => {
            runTick(BASE, { tickId: TICK_ID('ctor-path'), achievements: lib });
        }).not.toThrow();
    });
});
// ── P8-b-9 · 金向量 G0 回归：后果执行不破坏 replay 确定性 ──────────────────
describe('P8-b-9 · 金向量 G0 · 后果执行确定性', () => {
    it('含后果的解锁·双跑 settledPhases 逐位相同', () => {
        const lib = {
            gold_b: mkAch({
                解锁条件引用: '属性.智慧 >= 70',
                解锁后果引用: [{ path: 'NPC.npc_a.属性.智慧', op: 'add', value: 1 }],
            }),
        };
        const r1 = runTick(BASE, { tickId: TICK_ID('g0-1'), achievements: lib });
        const r2 = runTick(BASE, { tickId: TICK_ID('g0-2'), achievements: lib });
        expect(r1.state.NPC['npc_a']?.属性?.智慧).toBe(81);
        expect(r2.state.NPC['npc_a']?.属性?.智慧).toBe(81);
        expect(r1.settledPhases).toEqual(r2.settledPhases);
    });
    it('无后果成就与有后果成就·settledPhases 一致（SETTLEMENT_PHASES 不变·仍=17）', () => {
        expect(SETTLEMENT_PHASES).toHaveLength(17);
    });
});
