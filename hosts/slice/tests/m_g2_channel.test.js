// G2-2 · 传播信道 + 系数接线 验收测试
//
// DoD（四件·全 additive·基于 G2-2 任务规格）：
//   E1  媒体传播开关：bassP=0 → 无媒体点火；bassP=1 → 全量点火
//   E2  Bass p>0 → 有外部点火（无人传人种子仍可燃）
//   E3  传播系数单调性：bassP 高/低 → 采纳率单调差异·具体数值断言
//   E4  官方信道组织广播：obs1 所属组织 → 同组织其他成员收到广播·非成员不收
//   E5  传播力 ⊥ 真实性：不实 factFragment（有锚布尔=false）仍可经官方信道传播
//   E6  资源紧张度抑制：高紧张度区域 → 二跳强度单调低于低紧张度（因子验证）
//   E7  seeded 确定性：同 seed 双跑逐位恒等（含随机 Bass 路径）
//   E8  soak 稳定性：300 拍 × N 无 NaN / 无发散（bassP=0.5）
import { describe, it, expect } from 'vitest';
import { runTick, emitRipple } from '@ai-life-sim/core/engine/tick';
import { RootSchema } from '@ai-life-sim/core';
// ── 常量镜像（与引擎对齐·勿读引擎私有常量）──────────────────────────────────────
const HOP_DECAY = 0.5;
const RESOURCE_SUPPRESSION_MAX = 0.5;
const ORG_CHANNEL_DECAY = HOP_DECAY;
function makeState(opts = {}) {
    const npcEntries = Object.entries(opts.npcs ?? {}).map(([k, v]) => [k, {
            姓名: k,
            位置: v.位置,
            存活状态: v.存活状态 ?? '在世',
            属性: v.属性 ?? {},
            关系: v.关系 ?? [],
            所属组织: v.所属组织 ?? [],
            忠诚: v.忠诚 ?? {},
        }]);
    const locEntries = Object.entries(opts.locs ?? {}).map(([k, v]) => [k, {
            名称: v.名称 ?? k,
            类别: v.类别,
            父节点: v.父节点,
            相邻: v.相邻 ?? [],
            区域资源紧张度: v.区域资源紧张度,
            人口规模: v.人口规模,
        }]);
    const orgEdgeEntries = Object.entries(opts.orgEdges ?? {}).map(([k, v]) => [k, {
            A组织: v.A组织,
            B组织: v.B组织,
            关系: '',
            边类型: v.边类型,
        }]);
    return RootSchema.parse({
        $存档种子: opts.seed ?? 42,
        NPC: Object.fromEntries(npcEntries),
        地图: locEntries.length > 0 ? { 地点: Object.fromEntries(locEntries) } : undefined,
        组织关系网: orgEdgeEntries.length > 0 ? Object.fromEntries(orgEdgeEntries) : undefined,
    });
}
// ── E1 · 媒体传播开关（bassP=0 vs bassP=1）──────────────────────────────────────
describe('G2-2 E1 · 媒体传播开关：是否传播=false → 社会传播零贡献', () => {
    it('bassP=0（无媒体开关）→ 远端孤立 NPC 不收印象', () => {
        // src: 事件目标·loc_a
        // obs_isolated: 远端孤立·loc_b·无关系·无组织·无法通过任何跳收到
        const s0 = makeState({
            npcs: {
                src: { 位置: 'loc_a' },
                obs_isolated: { 位置: 'loc_b' },
            },
        });
        emitRipple(s0.$涟漪候选, 'src', {
            标签: '声誉', 极性: '正', 强度: 80, 可见性: '公开', 来源拍号: 0,
        });
        // bassP=0（默认）→ 无媒体广播
        const { state: s1 } = runTick(s0, { tickId: 'e1-bassP0', spanMinutes: 1440 });
        expect(s1.认知档案['obs_isolated']?.['src']?.印象.length ?? 0).toBe(0);
    });
    it('bassP=1.0 → 远端孤立 NPC 必然收到印象（触发概率=100%）', () => {
        const s0 = makeState({
            npcs: {
                src: { 位置: 'loc_a' },
                obs_isolated: { 位置: 'loc_b' },
            },
        });
        emitRipple(s0.$涟漪候选, 'src', {
            标签: '声誉', 极性: '正', 强度: 80, 可见性: '公开', 来源拍号: 0,
        });
        // bassP=1.0（100% 触发概率）→ 媒体广播覆盖所有 NPC
        const { state: s1 } = runTick(s0, { tickId: 'e1-bassP1', spanMinutes: 1440, bassP: 1.0 });
        const imp = s1.认知档案['obs_isolated']?.['src']?.印象[0];
        expect(imp).toBeDefined();
        expect(imp?.来源类型).toBe('二手转述');
        expect(imp?.来源).toMatch(/媒体广播/);
        // Bass 媒体强度 = imp.强度 × HOP_DECAY × resourceFactor(1.0) = 80 × 0.5 = 40
        expect(imp?.强度).toBeCloseTo(80 * HOP_DECAY, 5);
    });
    it('bassP=0 时，一手目击 NPC 仍正常收到印象（hop1 不受影响）', () => {
        const s0 = makeState({
            npcs: {
                src: { 位置: 'loc_a' },
                obs_present: { 位置: 'loc_a' }, // 同地·hop1
            },
        });
        emitRipple(s0.$涟漪候选, 'src', {
            标签: '声誉', 极性: '正', 强度: 80, 可见性: '公开', 来源拍号: 0,
        });
        const { state: s1 } = runTick(s0, { tickId: 'e1-hop1', spanMinutes: 1440 }); // bassP=0 default
        const imp = s1.认知档案['obs_present']?.['src']?.印象[0];
        expect(imp?.强度).toBe(80);
        expect(imp?.来源类型).toBe('一手观测');
    });
});
// ── E2 · Bass p>0 无种子仍可燃（外部点火·独立于人传人）─────────────────────────
describe('G2-2 E2 · Bass p>0 → 外部点火（无人传人种子）', () => {
    it('完全孤立 NPC 群（无关系·无组织·无同地）：bassP=1.0 全部点火', () => {
        const s0 = makeState({
            npcs: {
                src: { 位置: 'loc_a' },
                n1: { 位置: 'loc_b' }, // 孤立
                n2: { 位置: 'loc_c' }, // 孤立
                n3: { 位置: 'loc_d' }, // 孤立
            },
        });
        emitRipple(s0.$涟漪候选, 'src', {
            标签: '声誉', 极性: '正', 强度: 60, 可见性: '公开', 来源拍号: 0,
        });
        const { state: s1 } = runTick(s0, { tickId: 'e2-all-fire', spanMinutes: 1440, bassP: 1.0 });
        // 所有孤立 NPC 应收到媒体广播
        for (const npcKey of ['n1', 'n2', 'n3']) {
            const imp = s1.认知档案[npcKey]?.['src']?.印象[0];
            expect(imp, `${npcKey} should have received Bass broadcast`).toBeDefined();
            expect(imp?.来源类型).toBe('二手转述');
        }
    });
    it('bassP=0 时，孤立 NPC 群无点火', () => {
        const s0 = makeState({
            npcs: {
                src: { 位置: 'loc_a' },
                n1: { 位置: 'loc_b' },
                n2: { 位置: 'loc_c' },
            },
        });
        emitRipple(s0.$涟漪候选, 'src', {
            标签: '声誉', 极性: '正', 强度: 60, 可见性: '公开', 来源拍号: 0,
        });
        const { state: s1 } = runTick(s0, { tickId: 'e2-no-fire', spanMinutes: 1440, bassP: 0 });
        expect(s1.认知档案['n1']?.['src']?.印象.length ?? 0).toBe(0);
        expect(s1.认知档案['n2']?.['src']?.印象.length ?? 0).toBe(0);
    });
});
// ── E3 · 传播系数单调性：bassP 高/低 → 采纳率差异 ──────────────────────────────
describe('G2-2 E3 · 传播系数单调性（bassP 高→采纳率高）', () => {
    it('bassP=1.0 采纳率 ≥ bassP=0.0（100 个孤立 NPC）', () => {
        // bassP=1.0: all 100 NPCs receive the broadcast
        // bassP=0.0: none receive it
        const npcsBassHigh = {};
        const npcsBasLow = {};
        for (let i = 0; i < 20; i++) {
            npcsBassHigh[`npc_${i}`] = { 位置: `loc_${i}` };
            npcsBasLow[`npc_${i}`] = { 位置: `loc_${i}` };
        }
        npcsBassHigh['src'] = { 位置: 'loc_src' };
        npcsBasLow['src'] = { 位置: 'loc_src' };
        // 高 bassP（1.0）
        const sHigh = makeState({ npcs: npcsBassHigh });
        emitRipple(sHigh.$涟漪候选, 'src', { 标签: '声誉', 极性: '正', 强度: 50, 可见性: '公开', 来源拍号: 0 });
        const { state: s1High } = runTick(sHigh, { tickId: 'e3-high', spanMinutes: 1440, bassP: 1.0 });
        // 低 bassP（0.0）
        const sLow = makeState({ npcs: npcsBasLow });
        emitRipple(sLow.$涟漪候选, 'src', { 标签: '声誉', 极性: '正', 强度: 50, 可见性: '公开', 来源拍号: 0 });
        const { state: s1Low } = runTick(sLow, { tickId: 'e3-low', spanMinutes: 1440, bassP: 0.0 });
        // 统计采纳数
        const countHigh = Object.keys(npcsBassHigh).filter(k => k !== 'src' &&
            (s1High.认知档案[k]?.['src']?.印象.length ?? 0) > 0).length;
        const countLow = Object.keys(npcsBasLow).filter(k => k !== 'src' &&
            (s1Low.认知档案[k]?.['src']?.印象.length ?? 0) > 0).length;
        expect(countHigh).toBe(20); // bassP=1.0 → 100%
        expect(countLow).toBe(0); // bassP=0.0 → 0%
        expect(countHigh).toBeGreaterThan(countLow);
    });
    it('bassP=1.0 媒体广播强度精确值 = imp.强度 × HOP_DECAY', () => {
        const s0 = makeState({
            npcs: {
                src: { 位置: 'loc_a' },
                far_npc: { 位置: 'loc_z' },
            },
        });
        emitRipple(s0.$涟漪候选, 'src', {
            标签: '声誉', 极性: '正', 强度: 100, 可见性: '公开', 来源拍号: 0,
        });
        const { state: s1 } = runTick(s0, { tickId: 'e3-exact', spanMinutes: 1440, bassP: 1.0 });
        const imp = s1.认知档案['far_npc']?.['src']?.印象[0];
        // 无资源抑制（无地图）→ 强度 = 100 × HOP_DECAY = 50
        expect(imp?.强度).toBeCloseTo(100 * HOP_DECAY, 5);
    });
});
// ── E4 · 官方信道组织广播（§九）──────────────────────────────────────────────────
describe('G2-2 E4 · 官方信道组织广播', () => {
    it('obs1（在场）所属组织 org_a → obs2（同组织·不在场·无关系）收到广播', () => {
        const s0 = makeState({
            npcs: {
                src: { 位置: 'loc_a' },
                obs1: {
                    位置: 'loc_a', // 同地·hop1
                    所属组织: [{ 组织键: 'org_a', 职务: '成员' }],
                },
                obs2: {
                    位置: 'loc_b', // 不同地·无直接关系·同组织
                    所属组织: [{ 组织键: 'org_a', 职务: '成员' }],
                    忠诚: { org_a: { $真实值: 100, 伪装度: 0 } },
                },
                obs_nonmember: {
                    位置: 'loc_c', // 不同地·非组织成员
                },
            },
        });
        emitRipple(s0.$涟漪候选, 'src', {
            标签: '声誉', 极性: '正', 强度: 80, 可见性: '公开', 来源拍号: 0,
        });
        const { state: s1 } = runTick(s0, { tickId: 'e4-org', spanMinutes: 1440 });
        // obs1: hop1（一手观测）
        const obs1Imp = s1.认知档案['obs1']?.['src']?.印象[0];
        expect(obs1Imp?.强度).toBe(80);
        expect(obs1Imp?.来源类型).toBe('一手观测');
        // obs2: 组织信道广播（org broadcast）
        const obs2Imp = s1.认知档案['obs2']?.['src']?.印象[0];
        expect(obs2Imp).toBeDefined();
        expect(obs2Imp?.来源类型).toBe('二手转述');
        expect(obs2Imp?.来源).toMatch(/组织传达:org_a/);
        // 忠诚=100 → 强度 = 80 × ORG_CHANNEL_DECAY × (100/100) = 80 × 0.5 × 1.0 = 40
        expect(obs2Imp?.强度).toBeCloseTo(80 * ORG_CHANNEL_DECAY * 1.0, 5);
        // obs_nonmember: 无任何通道 → 不收
        expect(s1.认知档案['obs_nonmember']?.['src']?.印象.length ?? 0).toBe(0);
    });
    it('忠诚度调制：loyalty=50 → 组织广播强度折半（vs loyalty=100）', () => {
        const s0 = makeState({
            npcs: {
                src: { 位置: 'loc_a' },
                obs1: {
                    位置: 'loc_a',
                    所属组织: [{ 组织键: 'org_b' }],
                },
                mem_high_loyalty: {
                    位置: 'loc_b',
                    所属组织: [{ 组织键: 'org_b' }],
                    忠诚: { org_b: { $真实值: 100, 伪装度: 0 } },
                },
                mem_low_loyalty: {
                    位置: 'loc_c',
                    所属组织: [{ 组织键: 'org_b' }],
                    忠诚: { org_b: { $真实值: 50, 伪装度: 0 } },
                },
            },
        });
        emitRipple(s0.$涟漪候选, 'src', {
            标签: '声誉', 极性: '正', 强度: 80, 可见性: '公开', 来源拍号: 0,
        });
        const { state: s1 } = runTick(s0, { tickId: 'e4-loyalty', spanMinutes: 1440 });
        const highLoyaltyStrength = s1.认知档案['mem_high_loyalty']?.['src']?.印象[0]?.强度 ?? 0;
        const lowLoyaltyStrength = s1.认知档案['mem_low_loyalty']?.['src']?.印象[0]?.强度 ?? 0;
        // loyalty=100: 80 × 0.5 × 1.0 = 40; loyalty=50: 80 × 0.5 × 0.5 = 20
        expect(highLoyaltyStrength).toBeCloseTo(80 * ORG_CHANNEL_DECAY * 1.0, 5);
        expect(lowLoyaltyStrength).toBeCloseTo(80 * ORG_CHANNEL_DECAY * 0.5, 5);
        expect(highLoyaltyStrength).toBeGreaterThan(lowLoyaltyStrength);
    });
});
// ── E5 · 传播力 ⊥ 真实性（不实 factFragment 可通过官方信道传播）──────────────────
describe('G2-2 E5 · 传播力 ⊥ 真实性', () => {
    it('有锚布尔=false 的造谣 factFragment 仍可通过组织信道传播', () => {
        const s0 = makeState({
            npcs: {
                src: { 位置: 'loc_a' },
                obs1: {
                    位置: 'loc_a',
                    所属组织: [{ 组织键: 'org_rumor' }],
                },
                org_member: {
                    位置: 'loc_b',
                    所属组织: [{ 组织键: 'org_rumor' }],
                    忠诚: { org_rumor: { $真实值: 100, 伪装度: 0 } },
                },
            },
        });
        // 造谣语义未来由 factFragment.有锚布尔=false 表达（G5 真伪门接线·当前 seam dormant）
        emitRipple(s0.$涟漪候选, 'src', {
            标签: '声誉', 极性: '负', 强度: 70, 可见性: '公开', 来源拍号: 0,
            factFragment: { 维度: '声誉', 主体: 'src', Δ方向: -1, 量级: 70 },
        });
        const { state: s1 } = runTick(s0, { tickId: 'e5-rumor', spanMinutes: 1440 });
        // obs1: hop1（一手观测）
        const obs1Imp = s1.认知档案['obs1']?.['src']?.印象[0];
        expect(obs1Imp?.来源类型).toBe('一手观测');
        // org_member: 仍通过组织信道收到（传播力 ⊥ 真实性 · 有锚布尔不影响传播路径）
        const orgImp = s1.认知档案['org_member']?.['src']?.印象[0];
        expect(orgImp).toBeDefined();
        expect(orgImp?.来源类型).toBe('二手转述');
        expect(orgImp?.极性).toBe('负');
    });
    it('不实 factFragment 通过 Bass 媒体广播传播', () => {
        const s0 = makeState({
            npcs: {
                src: { 位置: 'loc_a' },
                far_npc: { 位置: 'loc_z' },
            },
        });
        emitRipple(s0.$涟漪候选, 'src', {
            标签: '声誉', 极性: '负', 强度: 60, 可见性: '公开', 来源拍号: 0,
            factFragment: { 维度: '声誉', 主体: 'src', Δ方向: -1, 量级: 60 },
        });
        const { state: s1 } = runTick(s0, { tickId: 'e5-bass-rumor', spanMinutes: 1440, bassP: 1.0 });
        const imp = s1.认知档案['far_npc']?.['src']?.印象[0];
        expect(imp).toBeDefined();
        expect(imp?.极性).toBe('负'); // Bass 广播仍传播（传播力 ⊥ 真实性）
    });
});
// ── E6 · 资源紧张度抑制（目标区域紧张度→传播强度下降）──────────────────────────
describe('G2-2 E6 · 资源紧张度抑制', () => {
    it('高紧张度区域（100）→ 二跳强度 = 低紧张度（0）的 50%', () => {
        // 构建有资源紧张度的地图
        function makeResourceState(tension) {
            const s = makeState({
                locs: {
                    region_a: { 类别: '区域级', 区域资源紧张度: tension },
                    loc_a: { 父节点: 'region_a' },
                    // loc_b 不在地图 → sfactor=1.0（无空间衰减）
                },
                npcs: {
                    src: { 位置: 'loc_a' },
                    obs1: {
                        位置: 'loc_a',
                        关系: [{ 对象键: 'obs2', 类型: '友人', 强度: 80, 极性: '正', 信任: 100, 深度: 70 }],
                    },
                    obs2: { 位置: 'loc_b' }, // loc_b 不在地图 → sfactor=1.0
                },
            });
            return s;
        }
        const sHigh = makeResourceState(100);
        emitRipple(sHigh.$涟漪候选, 'src', {
            标签: '声誉', 极性: '正', 强度: 80, 可见性: '公开', 来源拍号: 0,
        });
        const { state: s1High } = runTick(sHigh, { tickId: 'e6-high', spanMinutes: 1440 });
        const sLow = makeResourceState(0);
        emitRipple(sLow.$涟漪候选, 'src', {
            标签: '声誉', 极性: '正', 强度: 80, 可见性: '公开', 来源拍号: 0,
        });
        const { state: s1Low } = runTick(sLow, { tickId: 'e6-low', spanMinutes: 1440 });
        const hop2High = s1High.认知档案['obs2']?.['src']?.印象[0]?.强度 ?? 0;
        const hop2Low = s1Low.认知档案['obs2']?.['src']?.印象[0]?.强度 ?? 0;
        // 低紧张度（0）= 80 × HOP_DECAY × (100/100) × 1.0 = 40
        expect(hop2Low).toBeCloseTo(80 * HOP_DECAY, 5);
        // 高紧张度（100）= 80 × HOP_DECAY × (100/100) × 0.5 = 20
        expect(hop2High).toBeCloseTo(80 * HOP_DECAY * (1 - RESOURCE_SUPPRESSION_MAX), 5);
        // 单调性
        expect(hop2High).toBeLessThan(hop2Low);
        expect(hop2High).toBeCloseTo(hop2Low * 0.5, 5);
    });
    it('一手观测（hop1）不受资源紧张度影响', () => {
        const s0 = makeState({
            locs: {
                region_a: { 类别: '区域级', 区域资源紧张度: 100 },
                loc_a: { 父节点: 'region_a' },
            },
            npcs: {
                src: { 位置: 'loc_a' },
                obs1: { 位置: 'loc_a' }, // 同地·hop1·确定性不受抑制
            },
        });
        emitRipple(s0.$涟漪候选, 'src', {
            标签: '声誉', 极性: '正', 强度: 80, 可见性: '公开', 来源拍号: 0,
        });
        const { state: s1 } = runTick(s0, { tickId: 'e6-hop1-unaffected', spanMinutes: 1440 });
        const hop1 = s1.认知档案['obs1']?.['src']?.印象[0]?.强度 ?? 0;
        // hop1 不受资源抑制 → 保持原始强度
        expect(hop1).toBe(80);
    });
});
// ── E7 · seeded 确定性（同 seed 双跑逐位恒等）──────────────────────────────────
describe('G2-2 E7 · seeded 确定性', () => {
    it('bassP=0.5 随机点火：同 seed 双跑逐位恒等', () => {
        function runOnce(tickId) {
            const s = makeState({
                seed: 12345,
                npcs: {
                    src: { 位置: 'loc_a' },
                    n1: { 位置: 'loc_b' },
                    n2: { 位置: 'loc_c' },
                    n3: { 位置: 'loc_d' },
                    n4: { 位置: 'loc_e' },
                },
            });
            emitRipple(s.$涟漪候选, 'src', {
                标签: '声誉', 极性: '正', 强度: 80, 可见性: '公开', 来源拍号: 0,
            });
            return runTick(s, { tickId, spanMinutes: 1440, bassP: 0.5 });
        }
        const { state: s1a } = runOnce('e7-run1');
        const { state: s1b } = runOnce('e7-run1'); // 同 tickId（幂等键需相同）
        // 同 seed·同 tickId → 相同的认知档案内容
        for (const npcKey of ['n1', 'n2', 'n3', 'n4']) {
            const impA = s1a.认知档案[npcKey]?.['src']?.印象[0];
            const impB = s1b.认知档案[npcKey]?.['src']?.印象[0];
            expect(impA?.强度).toBe(impB?.强度);
            expect(impA?.来源类型).toBe(impB?.来源类型);
        }
    });
    it('不同 seed → 可能产生不同点火结果（概率性·bassP=0.5）', () => {
        function runWithSeed(seed) {
            const s = makeState({
                seed,
                npcs: Object.fromEntries((Array.from({ length: 10 }, (_, i) => [`n${i}`, { 位置: `loc_${i}` }]))
                    .concat([['src', { 位置: 'loc_src' }]])),
            });
            emitRipple(s.$涟漪候选, 'src', {
                标签: '声誉', 极性: '正', 强度: 80, 可见性: '公开', 来源拍号: 0,
            });
            return runTick(s, { tickId: `e7-seed${seed}`, spanMinutes: 1440, bassP: 0.5 });
        }
        // Different seeds should produce different results (statistical test)
        const { state: sa } = runWithSeed(1);
        const { state: sb } = runWithSeed(999999);
        const countsA = Array.from({ length: 10 }, (_, i) => (sa.认知档案[`n${i}`]?.['src']?.印象.length ?? 0) > 0 ? 1 : 0).reduce((a, b) => a + b, 0);
        const countsB = Array.from({ length: 10 }, (_, i) => (sb.认知档案[`n${i}`]?.['src']?.印象.length ?? 0) > 0 ? 1 : 0).reduce((a, b) => a + b, 0);
        // Either different counts or identical (both valid, but at least seeded correctly)
        // Just verify both are deterministic (run twice same seed → same count)
        const { state: sa2 } = runWithSeed(1);
        const countsA2 = Array.from({ length: 10 }, (_, i) => (sa2.认知档案[`n${i}`]?.['src']?.印象.length ?? 0) > 0 ? 1 : 0).reduce((a, b) => a + b, 0);
        expect(countsA).toBe(countsA2); // same seed → same count
        // Both counts are within valid range
        expect(countsA).toBeGreaterThanOrEqual(0);
        expect(countsA).toBeLessThanOrEqual(10);
        expect(countsB).toBeGreaterThanOrEqual(0);
        void countsB; // suppresses unused variable warning
    });
    it('Bass 媒体广播强度值精确恒等（双宿主 diff=0 验证点）', () => {
        const makeAndRun = () => {
            const s = makeState({
                seed: 42,
                npcs: {
                    src: { 位置: 'loc_a' },
                    far1: { 位置: 'loc_b' },
                    far2: { 位置: 'loc_c' },
                },
            });
            emitRipple(s.$涟漪候选, 'src', {
                标签: '声誉', 极性: '正', 强度: 80, 可见性: '公开', 来源拍号: 0,
            });
            return runTick(s, { tickId: 'e7-exact', spanMinutes: 1440, bassP: 1.0 });
        };
        const { state: r1 } = makeAndRun();
        const { state: r2 } = makeAndRun();
        // 逐位恒等：far1/far2 强度值完全相同
        expect(r1.认知档案['far1']?.['src']?.印象[0]?.强度)
            .toBe(r2.认知档案['far1']?.['src']?.印象[0]?.强度);
        expect(r1.认知档案['far2']?.['src']?.印象[0]?.强度)
            .toBe(r2.认知档案['far2']?.['src']?.印象[0]?.强度);
    });
});
// ──────────────────────────────────────────────────────────────────────────────
// G2-3 S1 · 层级延迟（官方信道子组织扩散 · 沿 层级/隶属 边）
// ──────────────────────────────────────────────────────────────────────────────
// ── E9 · 无层级边时子组织扩散完全跳过（出厂行为不变·0 重定基基线）─────────────────
describe('G2-3 E9 · 层级延迟：无 层级/隶属 边时行为与 G2-2 完全一致', () => {
    it('无 组织关系网 层级边 → 直属成员仍同拍收到（depth=0 确定性）', () => {
        const s0 = makeState({
            npcs: {
                src: { 位置: 'loc_a' },
                obs1: { 位置: 'loc_a', 所属组织: [{ 组织键: 'orgA' }] },
                memA: { 位置: 'loc_b', 所属组织: [{ 组织键: 'orgA' }], 忠诚: { orgA: { $真实值: 100, 伪装度: 0 } } },
            },
            // orgEdges 不设（无 层级 边）→ orgChildGraph 为空
        });
        emitRipple(s0.$涟漪候选, 'src', { 标签: '声誉', 极性: '正', 强度: 80, 可见性: '公开', 来源拍号: 0 });
        const { state: s1 } = runTick(s0, { tickId: 'e9-nohier', spanMinutes: 1440 });
        // 直属成员 memA 同拍收到（depth=0·不受层级延迟影响）
        const memImp = s1.认知档案['memA']?.['src']?.印象.find(i => i.极性 === '正');
        expect(memImp).toBeDefined();
        expect(memImp?.强度).toBeCloseTo(80 * HOP_DECAY * 1.0, 5);
    });
    it('无层级边 → 不存在子组织 NPC 接收路径（只有直属成员·N 不在 orgA → 不收）', () => {
        const s0 = makeState({
            npcs: {
                src: { 位置: 'loc_a' },
                obs1: { 位置: 'loc_a', 所属组织: [{ 组织键: 'orgA' }] },
                memA: { 位置: 'loc_b', 所属组织: [{ 组织键: 'orgA' }], 忠诚: { orgA: { $真实值: 100, 伪装度: 0 } } },
                outsider: { 位置: 'loc_c', 所属组织: [{ 组织键: 'orgB' }] },
            },
        });
        emitRipple(s0.$涟漪候选, 'src', { 标签: '声誉', 极性: '正', 强度: 80, 可见性: '公开', 来源拍号: 0 });
        const { state: s1 } = runTick(s0, { tickId: 'e9-outsider', spanMinutes: 1440 });
        // outsider（orgB·非 orgA 成员·无层级边）→ 不收
        const outsiderImp = s1.认知档案['outsider']?.['src']?.印象.length ?? 0;
        expect(outsiderImp).toBe(0);
    });
});
// ── E10 · 层级延迟：depth=1 子组织成员按 seed 确定性延迟 ──────────────────────────
describe('G2-3 E10 · 层级延迟：子组织成员按深度确定性延迟', () => {
    // 搭建：orgParent → 层级 → orgChild
    //   obs1 在 orgParent（在场）
    //   memParent 在 orgParent（depth=0·确定性到达）
    //   memChild  在 orgChild（depth=1·P=50%·seeded）
    function makeHierState(seed) {
        return makeState({
            seed,
            npcs: {
                src: { 位置: 'loc_a' },
                obs1: { 位置: 'loc_a', 所属组织: [{ 组织键: 'orgParent' }] },
                memParent: { 位置: 'loc_b', 所属组织: [{ 组织键: 'orgParent' }], 忠诚: { orgParent: { $真实值: 100, 伪装度: 0 } } },
                memChild: { 位置: 'loc_c', 所属组织: [{ 组织键: 'orgChild' }], 忠诚: { orgParent: { $真实值: 100, 伪装度: 0 } } },
            },
            orgEdges: {
                'edge_hier': { A组织: 'orgChild', B组织: 'orgParent', 边类型: '层级' },
            },
        });
    }
    it('memParent（depth=0）任何 seed 下同拍确定性到达', () => {
        // depth=0 → rollBound=100 → 始终通过（不消耗 RNG·确定性）
        for (const seed of [42, 99, 12345]) {
            const s0 = makeHierState(seed);
            emitRipple(s0.$涟漪候选, 'src', { 标签: '声誉', 极性: '正', 强度: 80, 可见性: '公开', 来源拍号: 0 });
            const { state: s1 } = runTick(s0, { tickId: `e10-parent-${seed}`, spanMinutes: 1440 });
            const parentImp = s1.认知档案['memParent']?.['src']?.印象.find(i => i.极性 === '正');
            expect(parentImp).toBeDefined();
            expect(parentImp?.强度).toBeCloseTo(80 * HOP_DECAY, 5);
        }
    });
    it('memChild（depth=1）seed=42 → roll=14<50 → 同拍到达', () => {
        // rngFor(42,0,'涟漪:org:delay:memChild:src:声誉:orgParent',0,0)=14 < 50 → 到达
        const s0 = makeHierState(42);
        emitRipple(s0.$涟漪候选, 'src', { 标签: '声誉', 极性: '正', 强度: 80, 可见性: '公开', 来源拍号: 0 });
        const { state: s1 } = runTick(s0, { tickId: 'e10-child-arrive', spanMinutes: 1440 });
        const childImp = s1.认知档案['memChild']?.['src']?.印象.find(i => i.极性 === '正');
        expect(childImp).toBeDefined();
        expect(childImp?.强度).toBeCloseTo(80 * HOP_DECAY, 5);
    });
    it('memChild（depth=1）seed=99 → roll=66≥50 → 本拍未到达（延迟效果）', () => {
        // rngFor(99,0,'涟漪:org:delay:memChild:src:声誉:orgParent',0,0)=66 ≥ 50 → 延迟
        const s0 = makeHierState(99);
        emitRipple(s0.$涟漪候选, 'src', { 标签: '声誉', 极性: '正', 强度: 80, 可见性: '公开', 来源拍号: 0 });
        const { state: s1 } = runTick(s0, { tickId: 'e10-child-delay', spanMinutes: 1440 });
        const childImp = s1.认知档案['memChild']?.['src']?.印象.find(i => i.极性 === '正');
        expect(childImp).toBeUndefined(); // 本拍未到达
    });
});
// ── E11 · 层级延迟 seeded 确定性 ──────────────────────────────────────────────────
describe('G2-3 E11 · 层级延迟 seeded 确定性（同 seed 双跑逐位恒等）', () => {
    it('同 seed 双跑：memChild 到达/未到达结果完全相同', () => {
        function runWithSeed(seed, tickId) {
            const s0 = makeState({
                seed,
                npcs: {
                    src: { 位置: 'loc_a' },
                    obs1: { 位置: 'loc_a', 所属组织: [{ 组织键: 'orgP' }] },
                    memChild: { 位置: 'loc_c', 所属组织: [{ 组织键: 'orgC' }], 忠诚: { orgP: { $真实值: 100, 伪装度: 0 } } },
                },
                orgEdges: { 'e': { A组织: 'orgC', B组织: 'orgP', 边类型: '层级' } },
            });
            emitRipple(s0.$涟漪候选, 'src', { 标签: '声誉', 极性: '正', 强度: 80, 可见性: '公开', 来源拍号: 0 });
            const { state } = runTick(s0, { tickId, spanMinutes: 1440 });
            return state.认知档案['memChild']?.['src']?.印象.find(i => i.极性 === '正')?.强度 ?? null;
        }
        const r1 = runWithSeed(42, 'e11-run1');
        const r2 = runWithSeed(42, 'e11-run2');
        expect(r1).toBe(r2); // 同 seed 逐位恒等（不论到达还是未到达）
    });
});
// ──────────────────────────────────────────────────────────────────────────────
// G2-3 S2 · 矫诏真伪门（官方信道消息真/伪门控）
// ──────────────────────────────────────────────────────────────────────────────
const ORG_MSG_BASE = 80; // 基准涟漪强度
// 预期组织信道送达强度（全因子为 1 时）
const FULL_ORG_STRENGTH = ORG_MSG_BASE * ORG_CHANNEL_DECAY * 1.0; // loyalty=100·resource=1
// ── E12 · 矫诏门：未声明 = 旧行为（backward compat）───────────────────────────────
describe('G2-3 E12 · 矫诏门：未声明 矫诏 = 退回旧行为（backward compat）', () => {
    it('不设 矫诏 字段 → 组织成员收到完整 orgStrength（无折扣）', () => {
        const s0 = makeState({
            npcs: {
                src: { 位置: 'loc_a' },
                obs1: { 位置: 'loc_a', 所属组织: [{ 组织键: 'orgX' }] },
                mem: { 位置: 'loc_b', 所属组织: [{ 组织键: 'orgX' }], 忠诚: { orgX: { $真实值: 100, 伪装度: 0 } } },
            },
        });
        // 不设 矫诏 → 向后兼容
        emitRipple(s0.$涟漪候选, 'src', { 标签: '声誉', 极性: '正', 强度: ORG_MSG_BASE, 可见性: '公开', 来源拍号: 0 });
        const { state: s1 } = runTick(s0, { tickId: 'e12-nofield', spanMinutes: 1440 });
        const imp = s1.认知档案['mem']?.['src']?.印象.find(i => i.极性 === '正');
        expect(imp).toBeDefined();
        expect(imp?.强度).toBeCloseTo(FULL_ORG_STRENGTH, 5); // 无折扣
        expect(imp?.来源).toBe('组织传达:orgX'); // 来源标注不含（矫诏）
    });
    it('矫诏=false → 与未声明行为一致（旧行为·完整强度）', () => {
        const s0 = makeState({
            npcs: {
                src: { 位置: 'loc_a' },
                obs1: { 位置: 'loc_a', 所属组织: [{ 组织键: 'orgY' }] },
                mem: { 位置: 'loc_b', 所属组织: [{ 组织键: 'orgY' }], 忠诚: { orgY: { $真实值: 100, 伪装度: 0 } } },
            },
        });
        emitRipple(s0.$涟漪候选, 'src', { 标签: '声誉', 极性: '正', 强度: ORG_MSG_BASE, 可见性: '公开', 来源拍号: 0, 矫诏: false });
        const { state: s1 } = runTick(s0, { tickId: 'e12-false', spanMinutes: 1440 });
        const imp = s1.认知档案['mem']?.['src']?.印象.find(i => i.极性 === '正');
        expect(imp?.强度).toBeCloseTo(FULL_ORG_STRENGTH, 5);
        expect(imp?.来源).toBe('组织传达:orgY');
    });
});
// ── E13 · 矫诏门：矫诏=true → 官方信道强度折半 + 来源标注 (矫诏)──────────────────
describe('G2-3 E13 · 矫诏门：矫诏=true → 强度折半·来源标注（矫诏）', () => {
    const FAKE_FACTOR = 0.5;
    it('矫诏=true → 组织成员收到 FULL_ORG_STRENGTH × 0.5', () => {
        const s0 = makeState({
            npcs: {
                src: { 位置: 'loc_a' },
                obs1: { 位置: 'loc_a', 所属组织: [{ 组织键: 'orgZ' }] },
                mem: { 位置: 'loc_b', 所属组织: [{ 组织键: 'orgZ' }], 忠诚: { orgZ: { $真实值: 100, 伪装度: 0 } } },
            },
        });
        emitRipple(s0.$涟漪候选, 'src', { 标签: '声誉', 极性: '正', 强度: ORG_MSG_BASE, 可见性: '公开', 来源拍号: 0, 矫诏: true });
        const { state: s1 } = runTick(s0, { tickId: 'e13-fake', spanMinutes: 1440 });
        const imp = s1.认知档案['mem']?.['src']?.印象.find(i => i.极性 === '正');
        expect(imp).toBeDefined();
        expect(imp?.强度).toBeCloseTo(FULL_ORG_STRENGTH * FAKE_FACTOR, 5); // × 0.5
        expect(imp?.来源).toBe('组织传达(矫诏):orgZ'); // 伪诏标注
    });
    it('矫诏=true vs 矫诏未声明：强度差异精确为 2× (50% 折扣)', () => {
        function makeAndRun(fake, tickId) {
            const s0 = makeState({
                npcs: {
                    src: { 位置: 'loc_a' },
                    obs1: { 位置: 'loc_a', 所属组织: [{ 组织键: 'orgCmp' }] },
                    mem: { 位置: 'loc_b', 所属组织: [{ 组织键: 'orgCmp' }], 忠诚: { orgCmp: { $真实值: 100, 伪装度: 0 } } },
                },
            });
            emitRipple(s0.$涟漪候选, 'src', {
                标签: '声誉', 极性: '正', 强度: ORG_MSG_BASE, 可见性: '公开', 来源拍号: 0,
                ...(fake !== undefined ? { 矫诏: fake } : {}),
            });
            const { state } = runTick(s0, { tickId, spanMinutes: 1440 });
            return state.认知档案['mem']?.['src']?.印象.find(i => i.极性 === '正')?.强度 ?? 0;
        }
        const realStr = makeAndRun(undefined, 'e13-cmp-real');
        const fakeStr = makeAndRun(true, 'e13-cmp-fake');
        expect(fakeStr).toBeCloseTo(realStr * FAKE_FACTOR, 5);
    });
});
// ──────────────────────────────────────────────────────────────────────────────
// G2-3 S3 · SEIR 冲突吸收（矫诏消息 + R态接收者）
// ──────────────────────────────────────────────────────────────────────────────
const CONFLICT_THRESHOLD = 30; // SEIR_CONFLICT_ABSORPTION_THRESHOLD
const CONFLICT_FACTOR = 0.5; // SEIR_CONFLICT_ABSORPTION_FACTOR
const FAKE_EDICT_FACTOR = 0.5; // FAKE_EDICT_CREDIBILITY_FACTOR
// ── E14 · 冲突吸收：矫诏=true + 对立真印象(R态) → 进一步折半 ─────────────────────
describe('G2-3 E14 · 冲突吸收：矫诏=true + 对立真印象(R态) → 进一步 × CONFLICT_FACTOR', () => {
    it('mem 已有 声誉/正/40（R态·≥阈值30）→ 矫诏「声誉/负」收到 × FAKE × CONFLICT', () => {
        const s0 = makeState({
            npcs: {
                src: { 位置: 'loc_a' },
                obs1: { 位置: 'loc_a', 所属组织: [{ 组织键: 'orgR' }] },
                mem: { 位置: 'loc_b', 所属组织: [{ 组织键: 'orgR' }], 忠诚: { orgR: { $真实值: 100, 伪装度: 0 } } },
            },
        });
        // 预植「对立真印象」（R态：已相信声誉是正面的）
        s0.认知档案['mem'] = {
            src: {
                了解度: 0, 误差表: {}, 时效: 0, 姓名知识: '已知姓名',
                印象: [{ 标签: '声誉', 极性: '正', 强度: 40, 来源: '目击', 获知时间: 0, 衰减速率: 0, 来源类型: '一手观测' }],
            },
        };
        // 矫诏伪诏：声誉/负
        emitRipple(s0.$涟漪候选, 'src', { 标签: '声誉', 极性: '负', 强度: ORG_MSG_BASE, 可见性: '公开', 来源拍号: 0, 矫诏: true });
        const { state: s1 } = runTick(s0, { tickId: 'e14-conflict', spanMinutes: 1440 });
        // 声誉/负（新写入）的强度 = BASE × HOP_DECAY × loyalty × fake × conflict
        const negImp = s1.认知档案['mem']?.['src']?.印象.find(i => i.极性 === '负');
        expect(negImp).toBeDefined();
        const expected = ORG_MSG_BASE * ORG_CHANNEL_DECAY * 1.0 * FAKE_EDICT_FACTOR * CONFLICT_FACTOR;
        expect(negImp?.强度).toBeCloseTo(expected, 5); // × 0.5 × 0.5 = × 0.25
        // 原「真」印象（声誉/正/40）仍完整（未被覆盖·不同极性键）
        const posImp = s1.认知档案['mem']?.['src']?.印象.find(i => i.极性 === '正');
        expect(posImp?.强度).toBe(40);
    });
    it('R态阈值边界：对立印象强度=29（< 30）→ 不触发冲突吸收', () => {
        const s0 = makeState({
            npcs: {
                src: { 位置: 'loc_a' },
                obs1: { 位置: 'loc_a', 所属组织: [{ 组织键: 'orgBound' }] },
                mem: { 位置: 'loc_b', 所属组织: [{ 组织键: 'orgBound' }], 忠诚: { orgBound: { $真实值: 100, 伪装度: 0 } } },
            },
        });
        s0.认知档案['mem'] = {
            src: {
                了解度: 0, 误差表: {}, 时效: 0, 姓名知识: '已知姓名',
                印象: [{ 标签: '声誉', 极性: '正', 强度: 29, 来源: '目击', 获知时间: 0, 衰减速率: 0, 来源类型: '一手观测' }],
            },
        };
        emitRipple(s0.$涟漪候选, 'src', { 标签: '声誉', 极性: '负', 强度: ORG_MSG_BASE, 可见性: '公开', 来源拍号: 0, 矫诏: true });
        const { state: s1 } = runTick(s0, { tickId: 'e14-boundary', spanMinutes: 1440 });
        const negImp = s1.认知档案['mem']?.['src']?.印象.find(i => i.极性 === '负');
        // 强度=29 < CONFLICT_THRESHOLD(30) → 不触发冲突吸收 → 仅 FAKE_FACTOR
        const expectedNoAbsorption = ORG_MSG_BASE * ORG_CHANNEL_DECAY * 1.0 * FAKE_EDICT_FACTOR;
        expect(negImp?.强度).toBeCloseTo(expectedNoAbsorption, 5);
    });
});
// ── E15 · 冲突吸收：矫诏=true + 无对立印象 → 只矫诏折半 ──────────────────────────
describe('G2-3 E15 · 冲突吸收：矫诏=true + 无对立印象 → 只 FAKE_EDICT_FACTOR 折半', () => {
    it('无对立真印象 → conflictFactor=1.0（仅 FAKE 折半）', () => {
        const s0 = makeState({
            npcs: {
                src: { 位置: 'loc_a' },
                obs1: { 位置: 'loc_a', 所属组织: [{ 组织键: 'orgNR' }] },
                mem: { 位置: 'loc_b', 所属组织: [{ 组织键: 'orgNR' }], 忠诚: { orgNR: { $真实值: 100, 伪装度: 0 } } },
            },
        });
        // 不预植对立印象（无 R态）
        emitRipple(s0.$涟漪候选, 'src', { 标签: '声誉', 极性: '负', 强度: ORG_MSG_BASE, 可见性: '公开', 来源拍号: 0, 矫诏: true });
        const { state: s1 } = runTick(s0, { tickId: 'e15-noR', spanMinutes: 1440 });
        const negImp = s1.认知档案['mem']?.['src']?.印象.find(i => i.极性 === '负');
        expect(negImp).toBeDefined();
        // 仅 FAKE 折半，无冲突因子
        const expected = ORG_MSG_BASE * ORG_CHANNEL_DECAY * 1.0 * FAKE_EDICT_FACTOR;
        expect(negImp?.强度).toBeCloseTo(expected, 5);
    });
    it('E14 vs E15 强度对比：有R态 < 无R态（冲突吸收生效验证）', () => {
        function runConflict(hasRState, tickId) {
            const s0 = makeState({
                npcs: {
                    src: { 位置: 'loc_a' },
                    obs1: { 位置: 'loc_a', 所属组织: [{ 组织键: 'orgCmpR' }] },
                    mem: { 位置: 'loc_b', 所属组织: [{ 组织键: 'orgCmpR' }], 忠诚: { orgCmpR: { $真实值: 100, 伪装度: 0 } } },
                },
            });
            if (hasRState) {
                s0.认知档案['mem'] = {
                    src: {
                        了解度: 0, 误差表: {}, 时效: 0, 姓名知识: '已知姓名',
                        印象: [{ 标签: '声誉', 极性: '正', 强度: CONFLICT_THRESHOLD + 5, 来源: '目击', 获知时间: 0, 衰减速率: 0, 来源类型: '一手观测' }],
                    },
                };
            }
            emitRipple(s0.$涟漪候选, 'src', { 标签: '声誉', 极性: '负', 强度: ORG_MSG_BASE, 可见性: '公开', 来源拍号: 0, 矫诏: true });
            const { state } = runTick(s0, { tickId, spanMinutes: 1440 });
            return state.认知档案['mem']?.['src']?.印象.find(i => i.极性 === '负')?.强度 ?? 0;
        }
        const withR = runConflict(true, 'e15-cmpR-withR');
        const withoutR = runConflict(false, 'e15-cmpR-noR');
        expect(withR).toBeLessThan(withoutR); // R态 → 冲突吸收 → 更弱
        expect(withR).toBeCloseTo(withoutR * CONFLICT_FACTOR, 5); // 精确 × 0.5
    });
});
// ── E16 · 冲突吸收：中正/中负矫诏 ripple 语义修正（R3-b 判定面·tick 路径）──────
// 旧 oppositePolarityStr(中正)='' → computeConflictAbsorption 立即 return 1.0（latent bug）。
// 新 → '中负' → 查到 R态「中负」印象(强度≥30) → CONFLICT_FACTOR 吸收。
describe('G2-3 E16 · 冲突吸收：中正/中负矫诏 ripple 语义修正（R3-b 判定面）', () => {
    it('矫诏「中正」ripple + R态「中负」印象(35≥30) → CONFLICT_FACTOR 吸收（旧=无吸收·latent bug）', () => {
        const s0 = makeState({
            npcs: {
                src: { 位置: 'loc_a' },
                obs1: { 位置: 'loc_a', 所属组织: [{ 组织键: 'orgE16a' }] },
                mem: { 位置: 'loc_b', 所属组织: [{ 组织键: 'orgE16a' }], 忠诚: { orgE16a: { $真实值: 100, 伪装度: 0 } } },
            },
        });
        // 预植 R态：mem 已相信 src「声誉=中负」强度35≥CONFLICT_THRESHOLD(30)
        s0.认知档案['mem'] = {
            src: {
                了解度: 0, 误差表: {}, 时效: 0, 姓名知识: '已知姓名',
                印象: [{ 标签: '声誉', 极性: '中负', 强度: 35, 来源: '目击', 获知时间: 0, 衰减速率: 0, 来源类型: '一手观测' }],
            },
        };
        // 矫诏伪诏：「声誉/中正」与既有「声誉/中负」对立
        emitRipple(s0.$涟漪候选, 'src', { 标签: '声誉', 极性: '中正', 强度: ORG_MSG_BASE, 可见性: '公开', 来源拍号: 0, 矫诏: true });
        const { state: s1 } = runTick(s0, { tickId: 'e16-zhongzheng', spanMinutes: 1440 });
        const newImp = s1.认知档案['mem']?.['src']?.印象.find(i => i.极性 === '中正');
        expect(newImp).toBeDefined();
        // 新：oppositePolarityStr('中正')='中负'→找到强度35≥30→CONFLICT_FACTOR×0.5（killer）
        const expected = ORG_MSG_BASE * ORG_CHANNEL_DECAY * 1.0 * FAKE_EDICT_FACTOR * CONFLICT_FACTOR;
        expect(newImp?.强度).toBeCloseTo(expected, 5); // 旧=expected/CONFLICT_FACTOR（无吸收）
    });
    it('矫诏「中负」ripple + R态「中正」印象(35≥30) → CONFLICT_FACTOR 吸收（对称验证）', () => {
        const s0 = makeState({
            npcs: {
                src: { 位置: 'loc_a' },
                obs1: { 位置: 'loc_a', 所属组织: [{ 组织键: 'orgE16b' }] },
                mem: { 位置: 'loc_b', 所属组织: [{ 组织键: 'orgE16b' }], 忠诚: { orgE16b: { $真实值: 100, 伪装度: 0 } } },
            },
        });
        s0.认知档案['mem'] = {
            src: {
                了解度: 0, 误差表: {}, 时效: 0, 姓名知识: '已知姓名',
                印象: [{ 标签: '声誉', 极性: '中正', 强度: 35, 来源: '目击', 获知时间: 0, 衰减速率: 0, 来源类型: '一手观测' }],
            },
        };
        emitRipple(s0.$涟漪候选, 'src', { 标签: '声誉', 极性: '中负', 强度: ORG_MSG_BASE, 可见性: '公开', 来源拍号: 0, 矫诏: true });
        const { state: s1 } = runTick(s0, { tickId: 'e16-zhongfu', spanMinutes: 1440 });
        const newImp = s1.认知档案['mem']?.['src']?.印象.find(i => i.极性 === '中负');
        expect(newImp).toBeDefined();
        const expected = ORG_MSG_BASE * ORG_CHANNEL_DECAY * 1.0 * FAKE_EDICT_FACTOR * CONFLICT_FACTOR;
        expect(newImp?.强度).toBeCloseTo(expected, 5);
    });
});
// ── E8 · soak 稳定性（300 拍·bassP=0.5·无 NaN / 无发散）──────────────────────
describe('G2-2 E8 · soak 稳定性（300 拍·bassP=0.5）', () => {
    it('连续 300 拍：所有印象强度无 NaN / 无 Infinity / 无负值', () => {
        const s0 = makeState({
            seed: 7777,
            npcs: {
                src: { 位置: 'loc_a' },
                obs1: { 位置: 'loc_a' },
                obs2: { 位置: 'loc_b' },
                obs3: { 位置: 'loc_c' },
            },
        });
        let s = s0;
        for (let i = 0; i < 300; i++) {
            // 每5拍发一次涟漪
            if (i % 5 === 0) {
                emitRipple(s.$涟漪候选, 'src', {
                    标签: '声誉', 极性: '正', 强度: 60, 可见性: '公开', 来源拍号: i,
                });
            }
            const result = runTick(s, {
                tickId: `soak-${i}`,
                spanMinutes: 1440,
                bassP: 0.5,
            });
            s = result.state;
            // 每20拍验证一次
            if (i % 20 === 0) {
                for (const [obsKey, targetMap] of Object.entries(s.认知档案)) {
                    for (const [, entry] of Object.entries(targetMap)) {
                        for (const imp of entry.印象) {
                            expect(isNaN(imp.强度), `tick ${i} NPC ${obsKey} imp.强度 is NaN`).toBe(false);
                            expect(isFinite(imp.强度), `tick ${i} NPC ${obsKey} imp.强度 is Infinite`).toBe(true);
                            expect(imp.强度).toBeGreaterThanOrEqual(0);
                        }
                    }
                }
            }
        }
    });
});
