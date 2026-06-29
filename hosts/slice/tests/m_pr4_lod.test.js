// PR-4 · LOD 调度器（P15–P21·T5）机测
// 测试序：G1~G7（确定性·seeded·禁 Date.now/Math.random）
import { describe, it, expect } from 'vitest';
import { RootSchema, NpcSchema } from '@ai-life-sim/core';
import { promoteNode, demoteNode, startWarmWindow, checkWarmWindow, tryDemoteNode, detectCrossRegion, handleRegionCross, detectLodTrigger, executeTraversal, isCrossDomainAccess, LOD_WARM_WINDOW_DEFAULT, } from '@ai-life-sim/core/engine/lodScheduler';
import { buildWorld, SAVE_SEED, EXPECTED_NET_ASSET, PC } from '../fixture/world.js';
import { assertConservation } from '@ai-life-sim/core/engine/conservation';
import { getNetAsset } from '@ai-life-sim/core/engine/netAsset';
import { runTick } from '@ai-life-sim/core/engine/tick';
import { FINGERPRINT_BUNDLE_MEMBERS } from '@ai-life-sim/core/engine/fingerprintManifest';
// ── 常量 ─────────────────────────────────────────────────────────────────────
const SEED = SAVE_SEED; // 42
const REGION_NORTH = 'region_north';
const REGION_SOUTH = 'region_south';
const LOC_N1 = 'loc_n1';
const LOC_S1 = 'loc_s1';
const PC_TEST = 'pc_test';
const NPC_COARSE_1 = 'npc_coarse_1';
const NPC_COARSE_2 = 'npc_coarse_2';
// ── Fixture 辅助 ──────────────────────────────────────────────────────────────
/** 双区域连通 LOD 测试世界（两个区域·各一子地点·各有粗节点 NPC） */
function buildLodWorld() {
    const s = RootSchema.parse({
        地图: {
            地点: {
                [REGION_NORTH]: {
                    名称: '北区',
                    类别: '区域级',
                    相邻: [{ 目标: REGION_SOUTH }],
                    人口规模: '小城',
                },
                [REGION_SOUTH]: {
                    名称: '南区',
                    类别: '区域级',
                    相邻: [{ 目标: REGION_NORTH }],
                    人口规模: '乡镇',
                },
                [LOC_N1]: {
                    名称: '北市集',
                    类别: '建筑',
                    父节点: REGION_NORTH,
                    相邻: [],
                },
                [LOC_S1]: {
                    名称: '南码头',
                    类别: '建筑',
                    父节点: REGION_SOUTH,
                    相邻: [],
                },
            },
            区域物价: {
                [REGION_NORTH]: {
                    粮食: { 基准价: 100, 供需: 0 },
                },
                [REGION_SOUTH]: {
                    粮食: { 基准价: 120, 供需: 10 },
                },
            },
        },
        NPC: {
            [PC_TEST]: { 姓名: '测试主角', 位置: LOC_N1, 属性: { 体质: 5, 魅力: 6 } },
            [NPC_COARSE_1]: NpcSchema.parse({ 姓名: '路人甲', 位置: REGION_NORTH }),
            [NPC_COARSE_2]: NpcSchema.parse({ 姓名: '路人乙', 位置: REGION_SOUTH }),
        },
        货币系统: {
            基准币种: '文',
            账户: {
                [PC_TEST]: { 持有: { 文: 100 } },
                __sink__: { 持有: { 文: 0 } },
            },
        },
    });
    // LOD-B4b: NPC 粗态记录在 LOD表（不在 NpcSchema·非地点键·调度器跳过）
    s.LOD表 ??= {}; // R6 opt-in
    s.LOD表[NPC_COARSE_1] = { 模块键: NPC_COARSE_1, 档位: '粗' };
    s.LOD表[NPC_COARSE_2] = { 模块键: NPC_COARSE_2, 档位: '粗' };
    return s;
}
/** 双世界域穿越测试世界 */
function buildTravelWorld() {
    return RootSchema.parse({
        世界域: {
            domain_mortal: { 玩法预设引用: 'preset_a', 封存状态: false },
            domain_spirit: { 玩法预设引用: 'preset_b', 封存状态: true },
        },
        NPC: {
            pc_hero: {
                姓名: '穿越者',
                位置: 'loc_mortal',
                属性: { 体质: 20, 魅力: 15, 体力: 0 },
                技能: { 剑术: { 等级: 3 }, 魔法: { 等级: 1 } },
                物品: {
                    item_sword: { 名称: '铁剑', 数量: 1 },
                    item_potion: { 名称: '药水', 数量: 3 },
                },
            },
        },
        货币系统: {
            基准币种: '文',
            账户: {
                pc_hero: { 持有: { 文: 500 } },
                __sink__: { 持有: { 文: 0 } },
            },
        },
    });
}
function clone(s) {
    return JSON.parse(JSON.stringify(s));
}
// ── G1 · 单态不变式（任一节点恒一态·promote/demote 后断言）──────────────────────
describe('G1: 单态不变式', () => {
    it('G1-1 promoteNode 粗→实体', () => {
        const s = buildLodWorld();
        // LOD表 无条目 = 视为粗（惰性）
        promoteNode(s, REGION_NORTH, SEED);
        expect(s.LOD表[REGION_NORTH]?.档位).toBe('实体');
    });
    it('G1-2 promoteNode 已为实体态 幂等 no-op', () => {
        const s = buildLodWorld();
        promoteNode(s, REGION_NORTH, SEED); // 促升·惰性建条目
        const snap1 = JSON.stringify(s.LOD表[REGION_NORTH]);
        // 物化 NPC：npc_coarse_1 位于 REGION_NORTH → 已实体化
        promoteNode(s, REGION_NORTH, SEED); // 幂等 no-op
        const snap2 = JSON.stringify(s.LOD表[REGION_NORTH]);
        expect(snap1).toBe(snap2);
    });
    it('G1-3 demoteNode 实体→粗', () => {
        const s = buildLodWorld();
        s.LOD表[REGION_NORTH] = { 模块键: REGION_NORTH, 档位: '实体' };
        demoteNode(s, REGION_NORTH);
        expect(s.LOD表[REGION_NORTH]?.档位).toBe('粗');
    });
    it('G1-4 demoteNode 已为粗态 幂等 no-op', () => {
        const s = buildLodWorld();
        s.LOD表[REGION_NORTH] = { 模块键: REGION_NORTH, 档位: '粗' };
        demoteNode(s, REGION_NORTH); // guard: 档位 != '实体' → no-op
        const snap1 = JSON.stringify(s.LOD表[REGION_NORTH]);
        demoteNode(s, REGION_NORTH); // no-op 再次
        const snap2 = JSON.stringify(s.LOD表[REGION_NORTH]);
        expect(snap1).toBe(snap2);
    });
    it('G1-5 promoteNode 不存在节点 no-op 不 throw', () => {
        const s = buildLodWorld();
        expect(() => promoteNode(s, 'nonexistent_node', SEED)).not.toThrow();
    });
    it('G1-6 demoteNode 不存在节点 no-op 不 throw', () => {
        const s = buildLodWorld();
        expect(() => demoteNode(s, 'nonexistent_node')).not.toThrow();
    });
    it('G1-7 promoteNode 物化区域内粗节点 NPC', () => {
        const s = buildLodWorld();
        expect(s.LOD表[NPC_COARSE_1]?.档位).toBe('粗');
        // NPC_COARSE_1 位置 = REGION_NORTH → 物化
        promoteNode(s, REGION_NORTH, SEED);
        expect(s.LOD表[NPC_COARSE_1]?.档位).toBe('实体');
        // NPC_COARSE_2 位置 = REGION_SOUTH → 不物化
        expect(s.LOD表[NPC_COARSE_2]?.档位).toBe('粗');
    });
    it('G1-8 两次 promote 后两次 demote：最终为粗（单态序列）', () => {
        const s = buildLodWorld();
        promoteNode(s, REGION_NORTH, SEED);
        promoteNode(s, REGION_NORTH, SEED); // 幂等
        expect(s.LOD表[REGION_NORTH]?.档位).toBe('实体');
        demoteNode(s, REGION_NORTH);
        demoteNode(s, REGION_NORTH); // 幂等
        expect(s.LOD表[REGION_NORTH]?.档位).toBe('粗');
    });
});
// ── G2 · checkpoint 原子·回访不双计（V2 漏洞复现）────────────────────────────────
describe('G2: checkpoint 原子·回访不双计', () => {
    it('G2-1 A→B→A 回访：窗口内 A 仍为实体（不双计·V2 修复）', () => {
        const s = buildLodWorld();
        // tick=1: 从 loc_n1 → loc_s1（跨区）
        handleRegionCross(s, LOC_N1, LOC_S1, SEED, 1);
        expect(s.LOD表[REGION_SOUTH]?.档位).toBe('实体'); // S promote
        expect(checkWarmWindow(s, REGION_NORTH, 1)).toBe(true); // N 在保温窗口
        // tick=2: 从 loc_s1 → loc_n1（回 A·窗口内）
        handleRegionCross(s, LOC_S1, LOC_N1, SEED, 2);
        // N 已在保温窗口 → promoteNode 但 LOD态 未必变（可能已是实体 or 变实体均可）
        // 关键：N 节点不被 demote（checkWarmWindow 仍 true）
        expect(checkWarmWindow(s, REGION_NORTH, 2)).toBe(true);
        // S 现在有保温窗口（从 tick=2 离开）
        expect(checkWarmWindow(s, REGION_SOUTH, 2)).toBe(true);
    });
    it('G2-2 同一节点连续 promote N 次：状态恒一·NPC 只实体化一次', () => {
        const s = buildLodWorld();
        expect(s.LOD表[NPC_COARSE_1]?.档位).toBe('粗');
        promoteNode(s, REGION_NORTH, SEED);
        expect(s.LOD表[NPC_COARSE_1]?.档位).toBe('实体');
        const attrAfter1 = s.NPC[NPC_COARSE_1]?.属性.体质;
        // 再 promote：REGION_NORTH 已实体化 → 早返·NPC 属性不变
        promoteNode(s, REGION_NORTH, SEED);
        expect(s.LOD表[NPC_COARSE_1]?.档位).toBe('实体');
        expect(s.NPC[NPC_COARSE_1]?.属性.体质).toBe(attrAfter1);
    });
    it('G2-3 回访确定性：相同 seed 两次 promote 属性逐位恒等', () => {
        const s1 = buildLodWorld();
        const s2 = buildLodWorld();
        promoteNode(s1, REGION_NORTH, SEED);
        promoteNode(s2, REGION_NORTH, SEED);
        expect(s1.NPC[NPC_COARSE_1]?.属性.体质).toBe(s2.NPC[NPC_COARSE_1]?.属性.体质);
        expect(s1.NPC[NPC_COARSE_1]?.属性.魅力).toBe(s2.NPC[NPC_COARSE_1]?.属性.魅力);
    });
});
// ── G3 · 保温窗口：窗内复用·超窗 demote ───────────────────────────────────────
describe('G3: 保温窗口', () => {
    it('G3-1 startWarmWindow 写 保温到期拍号 = tick + LOD_WARM_WINDOW_DEFAULT', () => {
        const s = buildLodWorld();
        startWarmWindow(s, REGION_NORTH, 5);
        expect(s.LOD表[REGION_NORTH]?.保温到期拍号).toBe(5 + LOD_WARM_WINDOW_DEFAULT);
    });
    it('G3-2 窗口内（tick <= 到期）→ checkWarmWindow=true', () => {
        const s = buildLodWorld();
        startWarmWindow(s, REGION_NORTH, 5);
        const expiry = 5 + LOD_WARM_WINDOW_DEFAULT;
        expect(checkWarmWindow(s, REGION_NORTH, expiry)).toBe(true);
        expect(checkWarmWindow(s, REGION_NORTH, expiry - 1)).toBe(true);
    });
    it('G3-3 超窗（tick > 到期）→ checkWarmWindow=false', () => {
        const s = buildLodWorld();
        startWarmWindow(s, REGION_NORTH, 5);
        const expiry = 5 + LOD_WARM_WINDOW_DEFAULT;
        expect(checkWarmWindow(s, REGION_NORTH, expiry + 1)).toBe(false);
    });
    it('G3-4 无保温窗口 → checkWarmWindow=false', () => {
        const s = buildLodWorld();
        expect(checkWarmWindow(s, REGION_NORTH, 0)).toBe(false);
    });
    it('G3-5 tryDemoteNode：窗口内 → no-op（档位 不变）', () => {
        const s = buildLodWorld();
        s.LOD表[REGION_NORTH] = { 模块键: REGION_NORTH, 档位: '实体' };
        startWarmWindow(s, REGION_NORTH, 1);
        tryDemoteNode(s, REGION_NORTH, 2); // tick=2 ≤ 1+3=4
        expect(s.LOD表[REGION_NORTH]?.档位).toBe('实体'); // 仍实体
    });
    it('G3-6 tryDemoteNode：超窗 → demote', () => {
        const s = buildLodWorld();
        s.LOD表[REGION_NORTH] = { 模块键: REGION_NORTH, 档位: '实体' };
        startWarmWindow(s, REGION_NORTH, 1);
        tryDemoteNode(s, REGION_NORTH, 5); // tick=5 > 1+3=4
        expect(s.LOD表[REGION_NORTH]?.档位).toBe('粗');
    });
    it('G3-7 自定义保温窗口（预设 LOD保温窗口=1）', () => {
        const s = buildLodWorld();
        const preset = { LOD保温窗口: 1 };
        startWarmWindow(s, REGION_NORTH, 10, preset);
        expect(s.LOD表[REGION_NORTH]?.保温到期拍号).toBe(11);
        // tick=11 仍在窗口内
        expect(checkWarmWindow(s, REGION_NORTH, 11)).toBe(true);
        // tick=12 超窗
        expect(checkWarmWindow(s, REGION_NORTH, 12)).toBe(false);
    });
    it('G3-8 demoteNode 清空 保温到期拍号', () => {
        const s = buildLodWorld();
        s.LOD表[REGION_NORTH] = { 模块键: REGION_NORTH, 档位: '实体' };
        startWarmWindow(s, REGION_NORTH, 1);
        expect(s.LOD表[REGION_NORTH]?.保温到期拍号).toBeDefined();
        demoteNode(s, REGION_NORTH);
        expect(s.LOD表[REGION_NORTH]?.保温到期拍号).toBeUndefined();
    });
});
// ── G4 · 跨区触发 promote+离开起窗（区域图驱动）──────────────────────────────────
describe('G4: 跨区触发 promote + 离开起窗', () => {
    it('G4-1 detectCrossRegion：同地点 → false', () => {
        const s = buildLodWorld();
        expect(detectCrossRegion(s, LOC_N1, LOC_N1)).toBe(false);
    });
    it('G4-2 detectCrossRegion：同区域不同地点 → false', () => {
        const s = buildLodWorld();
        // loc_n1 和 region_north 同区域
        expect(detectCrossRegion(s, LOC_N1, REGION_NORTH)).toBe(false);
    });
    it('G4-3 detectCrossRegion：跨区域 → true', () => {
        const s = buildLodWorld();
        expect(detectCrossRegion(s, LOC_N1, LOC_S1)).toBe(true);
    });
    it('G4-4 handleRegionCross：promote 目标区域', () => {
        const s = buildLodWorld();
        handleRegionCross(s, LOC_N1, LOC_S1, SEED, 1);
        // 目标区域 REGION_SOUTH promoted
        expect(s.LOD表[REGION_SOUTH]?.档位).toBe('实体');
    });
    it('G4-5 handleRegionCross：离开区域起保温窗口', () => {
        const s = buildLodWorld();
        handleRegionCross(s, LOC_N1, LOC_S1, SEED, 1);
        // 离开区域 REGION_NORTH 有保温窗口
        expect(checkWarmWindow(s, REGION_NORTH, 1)).toBe(true);
        expect(s.LOD表[REGION_NORTH]?.保温到期拍号).toBe(1 + LOD_WARM_WINDOW_DEFAULT);
    });
    it('G4-6 handleRegionCross：同区内移动 → 不起窗（同区不视为离开）', () => {
        const s = buildLodWorld();
        // LOC_N1 → REGION_NORTH 同区
        handleRegionCross(s, LOC_N1, REGION_NORTH, SEED, 1);
        // prev 区 = REGION_NORTH, new 区 = REGION_NORTH → 相同 → 不起窗
        expect(s.LOD表[REGION_NORTH]?.保温到期拍号).toBeUndefined();
    });
    it('G4-7 跨区 NPC 物化确定性：同 seed 双跑逐位恒等', () => {
        const s1 = buildLodWorld();
        const s2 = buildLodWorld();
        handleRegionCross(s1, LOC_N1, LOC_S1, SEED, 1);
        handleRegionCross(s2, LOC_N1, LOC_S1, SEED, 1);
        expect(s1.NPC[NPC_COARSE_2]?.属性.体质).toBe(s2.NPC[NPC_COARSE_2]?.属性.体质);
        expect(s1.NPC[NPC_COARSE_2]?.属性.智慧).toBe(s2.NPC[NPC_COARSE_2]?.属性.智慧);
    });
});
// ── G5 · 四条件检测各自命中 ──────────────────────────────────────────────────────
describe('G5: 四条件检测器各自命中', () => {
    const basePrev = {
        locKey: LOC_N1,
        orgKeys: ['org_a'],
        epochMin: 1000,
        eraLabel: '开元',
    };
    it('G5-1 ①跨区：位置变更且区域不同 → triggered=跨区', () => {
        const s = buildLodWorld();
        const cur = { ...basePrev, locKey: LOC_S1 };
        const r = detectLodTrigger(s, basePrev, cur);
        expect(r.triggered).toBe(true);
        expect(r.condition).toBe('跨区');
    });
    it('G5-2 ①同区内移动：同区域 → triggered=false', () => {
        const s = buildLodWorld();
        // LOC_N1 → REGION_NORTH 同区
        const cur = { ...basePrev, locKey: REGION_NORTH };
        const r = detectLodTrigger(s, basePrev, cur);
        expect(r.triggered).toBe(false);
    });
    it('G5-3 ②纪元跨时代：年号变更 → triggered=纪元跨时代', () => {
        const s = buildLodWorld();
        const cur = { ...basePrev, eraLabel: '天宝' };
        const r = detectLodTrigger(s, basePrev, cur);
        expect(r.triggered).toBe(true);
        expect(r.condition).toBe('纪元跨时代');
    });
    it('G5-4 ②无历法（eraLabel 为空串）→ 不触发', () => {
        const s = buildLodWorld();
        const prev2 = { ...basePrev, eraLabel: '开元' };
        const cur = { ...basePrev, eraLabel: '' };
        const r = detectLodTrigger(s, prev2, cur);
        // 切到空字符串不触发
        expect(r.triggered).toBe(false);
    });
    it('G5-5 ③组织归属变更（离组织）→ triggered=组织归属变更', () => {
        const s = buildLodWorld();
        const cur = { ...basePrev, orgKeys: [] };
        const r = detectLodTrigger(s, basePrev, cur);
        expect(r.triggered).toBe(true);
        expect(r.condition).toBe('组织归属变更');
    });
    it('G5-6 ③组织归属变更（加入组织）→ triggered=组织归属变更', () => {
        const s = buildLodWorld();
        const cur = { ...basePrev, orgKeys: ['org_a', 'org_b'] };
        const r = detectLodTrigger(s, basePrev, cur);
        expect(r.triggered).toBe(true);
        expect(r.condition).toBe('组织归属变更');
    });
    it('G5-7 无变化 → triggered=false', () => {
        const s = buildLodWorld();
        const r = detectLodTrigger(s, basePrev, { ...basePrev });
        expect(r.triggered).toBe(false);
    });
});
// ── G6 · 穿越切域 + 契约映射 + 跨域 access=0 ─────────────────────────────────────
describe('G6: 穿越 + 契约执行 + 跨域隔离', () => {
    it('G6-1 executeTraversal：封存 fromDomain，激活 toDomain', () => {
        const s = buildTravelWorld();
        expect(s.世界域['domain_mortal']?.封存状态).toBe(false);
        expect(s.世界域['domain_spirit']?.封存状态).toBe(true);
        executeTraversal(s, 'domain_mortal', 'domain_spirit', 'pc_hero', {
            属性映射: {},
            货币处理: '保留',
            技能等价表: {},
            携带白名单: [],
            时间比率: 1,
        });
        expect(s.世界域['domain_mortal']?.封存状态).toBe(true);
        expect(s.世界域['domain_spirit']?.封存状态).toBe(false);
    });
    it('G6-2 属性映射：旧轴名→新轴名', () => {
        const s = buildTravelWorld();
        expect((s.NPC['pc_hero']?.属性)['体质']).toBe(20);
        executeTraversal(s, 'domain_mortal', 'domain_spirit', 'pc_hero', {
            属性映射: { 体质: '体力' }, // 体质 → 体力
            货币处理: '保留',
            技能等价表: {},
            携带白名单: [],
            时间比率: 1,
        });
        const attrs = s.NPC['pc_hero']?.属性;
        expect(attrs['体力']).toBe(20);
        expect(attrs['体质']).toBeUndefined();
    });
    it('G6-3 技能等价表：重命名技能键', () => {
        const s = buildTravelWorld();
        executeTraversal(s, 'domain_mortal', 'domain_spirit', 'pc_hero', {
            属性映射: {},
            货币处理: '保留',
            技能等价表: { 剑术: '灵剑术' },
            携带白名单: [],
            时间比率: 1,
        });
        expect('灵剑术' in (s.NPC['pc_hero']?.技能 ?? {})).toBe(true);
        expect('剑术' in (s.NPC['pc_hero']?.技能 ?? {})).toBe(false);
    });
    it('G6-4 货币处理=丢失：清空持有', () => {
        const s = buildTravelWorld();
        expect(s.货币系统.账户['pc_hero']?.持有['文']).toBe(500);
        executeTraversal(s, 'domain_mortal', 'domain_spirit', 'pc_hero', {
            属性映射: {},
            货币处理: '丢失',
            技能等价表: {},
            携带白名单: [],
            时间比率: 1,
        });
        expect(Object.keys(s.货币系统.账户['pc_hero']?.持有 ?? {})).toHaveLength(0);
    });
    it('G6-5 货币处理=保留：持有不变', () => {
        const s = buildTravelWorld();
        executeTraversal(s, 'domain_mortal', 'domain_spirit', 'pc_hero', {
            属性映射: {},
            货币处理: '保留',
            技能等价表: {},
            携带白名单: [],
            时间比率: 1,
        });
        expect(s.货币系统.账户['pc_hero']?.持有['文']).toBe(500);
    });
    it('G6-6 携带白名单：仅保留白名单物品', () => {
        const s = buildTravelWorld();
        executeTraversal(s, 'domain_mortal', 'domain_spirit', 'pc_hero', {
            属性映射: {},
            货币处理: '保留',
            技能等价表: {},
            携带白名单: ['item_sword'], // 只带剑
            时间比率: 1,
        });
        const items = s.NPC['pc_hero']?.物品 ?? {};
        expect('item_sword' in items).toBe(true);
        expect('item_potion' in items).toBe(false);
    });
    it('G6-7 isCrossDomainAccess：来源域 ≠ 当前域 → true（纯谣言）', () => {
        expect(isCrossDomainAccess('domain_a', 'domain_b')).toBe(true);
    });
    it('G6-8 isCrossDomainAccess：来源域 = 当前域 → false', () => {
        expect(isCrossDomainAccess('domain_a', 'domain_a')).toBe(false);
    });
    it('G6-9 isCrossDomainAccess：来源域 undefined（无声明）→ false（同域视为）', () => {
        expect(isCrossDomainAccess(undefined, 'domain_b')).toBe(false);
    });
    it('G6-10 不存在的 pcKey → no-op 不 throw', () => {
        const s = buildTravelWorld();
        expect(() => executeTraversal(s, 'domain_mortal', 'domain_spirit', 'nonexistent_pc', {
            属性映射: {},
            货币处理: '保留',
            技能等价表: {},
            携带白名单: [],
            时间比率: 1,
        })).not.toThrow();
        // 域状态仍切换
        expect(s.世界域['domain_mortal']?.封存状态).toBe(true);
        expect(s.世界域['domain_spirit']?.封存状态).toBe(false);
    });
});
// ── G7 · 300拍 soak 守恒 + 双跑逐位恒等 + 默认 fixture 黄金向量不变 ────────────────
describe('G7: soak 守恒 + 确定性 + 黄金向量', () => {
    it('G7-1 默认 fixture 无 LOD 活动：BUNDLE_MEMBERS 守恒（不新增）', () => {
        expect(FINGERPRINT_BUNDLE_MEMBERS).toHaveLength(28);
    });
    it('G7-2 buildWorld()（原始 fixture·无 LOD 区域）：runTick 10拍 守恒', () => {
        const world = buildWorld();
        let s = world;
        for (let i = 0; i < 10; i++) {
            const result = runTick(s, { tickId: `soak_pr4_g7:${i}`, seed: SAVE_SEED });
            s = result.state;
        }
        // 守恒：净资产不变
        assertConservation(s.货币系统.账户, EXPECTED_NET_ASSET, (a) => getNetAsset(a));
    });
    it('G7-3 LOD world 300拍 promote/demote soak：货币守恒', () => {
        const s = buildLodWorld();
        let cur = s;
        for (let i = 0; i < 300; i++) {
            cur = JSON.parse(JSON.stringify(cur));
            // 奇数拍：北→南跨区
            if (i % 10 === 0) {
                cur.NPC[PC_TEST].位置 = LOC_N1;
                handleRegionCross(cur, LOC_S1, LOC_N1, SEED, i);
            }
            else if (i % 10 === 5) {
                cur.NPC[PC_TEST].位置 = LOC_S1;
                handleRegionCross(cur, LOC_N1, LOC_S1, SEED, i);
            }
            // 超窗 demote
            tryDemoteNode(cur, REGION_NORTH, i);
            tryDemoteNode(cur, REGION_SOUTH, i);
        }
        // 货币系统保持不动（lodScheduler 不改货币）
        expect(cur.货币系统.账户[PC_TEST]?.持有['文']).toBe(100);
        expect(cur.货币系统.账户['__sink__']?.持有['文']).toBe(0);
    });
    it('G7-4 双跑逐位恒等（LOD 调度确定性·同 seed 同 tick）', () => {
        const s1 = buildLodWorld();
        const s2 = buildLodWorld();
        for (let i = 0; i < 20; i++) {
            if (i % 5 === 0) {
                handleRegionCross(s1, LOC_N1, LOC_S1, SEED, i);
                handleRegionCross(s2, LOC_N1, LOC_S1, SEED, i);
            }
            else if (i % 5 === 3) {
                handleRegionCross(s1, LOC_S1, LOC_N1, SEED, i);
                handleRegionCross(s2, LOC_S1, LOC_N1, SEED, i);
            }
            tryDemoteNode(s1, REGION_NORTH, i);
            tryDemoteNode(s2, REGION_NORTH, i);
            tryDemoteNode(s1, REGION_SOUTH, i);
            tryDemoteNode(s2, REGION_SOUTH, i);
        }
        // LOD 态逐位恒等
        expect(s1.LOD表[REGION_NORTH]?.档位).toBe(s2.LOD表[REGION_NORTH]?.档位);
        expect(s1.LOD表[REGION_SOUTH]?.档位).toBe(s2.LOD表[REGION_SOUTH]?.档位);
        // NPC 属性逐位恒等
        expect(s1.NPC[NPC_COARSE_1]?.属性.体质).toBe(s2.NPC[NPC_COARSE_1]?.属性.体质);
        expect(s1.NPC[NPC_COARSE_2]?.属性.体质).toBe(s2.NPC[NPC_COARSE_2]?.属性.体质);
    });
    it('G7-5 双宿主 diff=0：buildWorld() 经 lodScheduler 纯函数后全局不变（默认 fixture 无区域）', () => {
        const w1 = buildWorld();
        const w2 = buildWorld();
        // buildWorld 无 区域级 地点 → lodScheduler 调用 no-op
        promoteNode(w1, 'nonexistent', SEED);
        demoteNode(w1, 'nonexistent');
        expect(JSON.stringify(w1)).toBe(JSON.stringify(w2));
    });
});
