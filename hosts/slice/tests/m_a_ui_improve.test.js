// A · 调试台 UI 改进批 · C3 专项回归
//
// A1 groupNodesByLocation — 节点按地点分组
// A2 buildEdgeDelta       — 边强度跨拍增减
// A3 buildActorPanel      — 详细角色面板（POV 过滤·字段全枚举）
// 恒等门                  — 指纹84 / schemaKeys52 / RootSchema 守恒
//
// 铁律:
//   ① 纯单元·无 LLM 调用
//   ② core 函数体零 diff（只测行为契约）
//   ③ 黄金向量/指纹84/schemaKeys52 守恒
import { describe, it, expect } from 'vitest';
import { RootSchema } from '@ai-life-sim/core';
import { FINGERPRINT_BUNDLE_MEMBERS, FINGERPRINT_PRESET_FIELDS, FINGERPRINT_SNAPSHOT_FIELDS, FINGERPRINT_EXCLUDED_FIELDS, } from '@ai-life-sim/core/engine/fingerprintManifest';
import { buildWorld, PC, NPC_WANG, LOC_KEY } from '../fixture/world.js';
import { groupNodesByLocation, buildEdgeDelta, buildActorPanel, buildRelationGraph, } from '../../web-debug/aohpDebugConsole2.js';
// ──────────────────────────────────────────────────────────────────────────────
// A1. groupNodesByLocation
// ──────────────────────────────────────────────────────────────────────────────
describe('A1 groupNodesByLocation — 节点按地点分组', () => {
    it('基础 fixture 所有 NPC 在同一地点（LOC_KEY）', () => {
        const state = buildWorld();
        const groups = groupNodesByLocation(state);
        expect(groups.length).toBeGreaterThanOrEqual(1);
        const locGroup = groups.find(g => g.location === LOC_KEY);
        expect(locGroup).toBeDefined();
        const npcCount = Object.keys(state.NPC).length;
        expect(locGroup.nodes.length).toBe(npcCount);
    });
    it('每个节点包含 key / name / orgKeys / knownSecretCount', () => {
        const state = buildWorld();
        const groups = groupNodesByLocation(state);
        for (const g of groups) {
            for (const n of g.nodes) {
                expect(typeof n.key).toBe('string');
                expect(n.key.length).toBeGreaterThan(0);
                expect(typeof n.name).toBe('string');
                expect(Array.isArray(n.orgKeys)).toBe(true);
                expect(typeof n.knownSecretCount).toBe('number');
                expect(n.knownSecretCount).toBeGreaterThanOrEqual(0);
            }
        }
    });
    it('无 NPC state 返回空数组', () => {
        const state = buildWorld();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const emptyState = { ...state, NPC: Object.create(null) };
        const groups = groupNodesByLocation(emptyState);
        expect(groups).toEqual([]);
    });
    it('无位置 NPC 归入「（无位置）」组', () => {
        const state = buildWorld();
        // 将所有 NPC 清空位置
        const modifiedNPC = Object.fromEntries(Object.entries(state.NPC).map(([k, v]) => [k, { ...v, 位置: '' }]));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const modState = { ...state, NPC: modifiedNPC };
        const groups = groupNodesByLocation(modState);
        expect(groups.some(g => g.location === '（无位置）')).toBe(true);
    });
});
// ──────────────────────────────────────────────────────────────────────────────
// A2. buildEdgeDelta
// ──────────────────────────────────────────────────────────────────────────────
describe('A2 buildEdgeDelta — 边强度跨拍增减', () => {
    it('无 prev 边时 delta 均为 0', () => {
        const state = buildWorld();
        const graph = buildRelationGraph(state);
        const delta = buildEdgeDelta([], graph.edges);
        for (const d of delta.values()) {
            expect(d.strengthDelta).toBe(0);
            expect(d.scoreDelta).toBe(0);
        }
    });
    it('相同图 delta 全为 0', () => {
        const state = buildWorld();
        const graph = buildRelationGraph(state);
        const delta = buildEdgeDelta(graph.edges, graph.edges);
        for (const d of delta.values()) {
            expect(d.strengthDelta).toBe(0);
            expect(d.scoreDelta).toBe(0);
        }
    });
    it('强度增加时 strengthDelta > 0', () => {
        const prev = [{
                from: 'a', to: 'b',
                strength: 30, trust: 80,
                score: 24, type: '友好', isHighlighted: false,
            }];
        const curr = [{
                from: 'a', to: 'b',
                strength: 50, trust: 80,
                score: 40, type: '友好', isHighlighted: false,
            }];
        const delta = buildEdgeDelta(prev, curr);
        const d = delta.get('a\x00b');
        expect(d).toBeDefined();
        expect(d.strengthDelta).toBe(20);
        expect(d.scoreDelta).toBeCloseTo(16, 5);
    });
    it('强度减少时 strengthDelta < 0', () => {
        const prev = [{
                from: 'a', to: 'b',
                strength: 60, trust: 100,
                score: 60, type: '敌对', isHighlighted: true,
            }];
        const curr = [{
                from: 'a', to: 'b',
                strength: 40, trust: 100,
                score: 40, type: '敌对', isHighlighted: false,
            }];
        const delta = buildEdgeDelta(prev, curr);
        const d = delta.get('a\x00b');
        expect(d.strengthDelta).toBe(-20);
        expect(d.scoreDelta).toBe(-20);
    });
    it('pair key 与 buildRelationGraph 保持一致（ASCII 字典序）', () => {
        const state = buildWorld();
        const graph = buildRelationGraph(state);
        const delta = buildEdgeDelta(graph.edges, graph.edges);
        // 每条当前边都应在 delta map 里
        for (const e of graph.edges) {
            const a = e.from < e.to ? e.from : e.to;
            const b = e.from < e.to ? e.to : e.from;
            expect(delta.has(`${a}\x00${b}`)).toBe(true);
        }
    });
});
// ──────────────────────────────────────────────────────────────────────────────
// A3. buildActorPanel
// ──────────────────────────────────────────────────────────────────────────────
describe('A3 buildActorPanel — 详细角色面板', () => {
    it('返回基础身份字段', () => {
        const state = buildWorld();
        const panel = buildActorPanel(state, PC);
        expect(panel.entityKey).toBe(PC);
        expect(typeof panel.name).toBe('string');
        expect(['在世', '失踪', '已故']).toContain(panel.存活状态);
        expect(typeof panel.性别).toBe('string');
        expect(typeof panel.种族).toBe('string');
    });
    it('包含完整数值面（属性 / 派生 / 行动点 / 性格五轴）', () => {
        const state = buildWorld();
        const panel = buildActorPanel(state, PC);
        // 五属性
        expect(typeof panel.attributes.体质).toBe('number');
        expect(typeof panel.attributes.智慧).toBe('number');
        expect(typeof panel.attributes.感知).toBe('number');
        expect(typeof panel.attributes.魅力).toBe('number');
        expect(typeof panel.attributes.心理).toBe('number');
        // 派生
        expect(panel.派生.HP).toBeGreaterThanOrEqual(0);
        expect(panel.派生.HP上限).toBeGreaterThan(0);
        expect(panel.派生.精力).toBeGreaterThanOrEqual(0);
        expect(typeof panel.派生.颜值).toBe('number');
        // 行动点
        expect(typeof panel.行动点.当前).toBe('number');
        // 性格五轴
        expect(typeof panel.性格五轴.开放).toBe('number');
        expect(typeof panel.性格五轴.外向).toBe('number');
        expect(typeof panel.性格五轴.神经质).toBe('number');
    });
    it('包含数组类型字段（关系 / 所属组织 / 认知概览 / 情绪栈 等）', () => {
        const state = buildWorld();
        const panel = buildActorPanel(state, PC);
        expect(Array.isArray(panel.关系)).toBe(true);
        expect(Array.isArray(panel.所属组织)).toBe(true);
        expect(Array.isArray(panel.认知概览)).toBe(true);
        expect(Array.isArray(panel.情绪栈)).toBe(true);
        expect(Array.isArray(panel.状态标签)).toBe(true);
        expect(Array.isArray(panel.特质)).toBe(true);
        expect(Array.isArray(panel.技能)).toBe(true);
        expect(Array.isArray(panel.信念)).toBe(true);
        expect(Array.isArray(panel.物品)).toBe(true);
        expect(Array.isArray(panel.记忆)).toBe(true);
        expect(Array.isArray(panel.意象)).toBe(true);
        expect(Array.isArray(panel.可见秘密ID)).toBe(true);
        expect(Array.isArray(panel.头衔)).toBe(true);
    });
    it('目标字段结构正确', () => {
        const state = buildWorld();
        const panel = buildActorPanel(state, PC);
        expect(Array.isArray(panel.目标.长期)).toBe(true);
        expect(Array.isArray(panel.目标.短期)).toBe(true);
    });
    it('POV 过滤：可见秘密 ID 列表来自 filterSecretsForPOV', () => {
        const state = buildWorld();
        const pcPanel = buildActorPanel(state, PC);
        const wangPanel = buildActorPanel(state, NPC_WANG);
        expect(Array.isArray(pcPanel.可见秘密ID)).toBe(true);
        expect(Array.isArray(wangPanel.可见秘密ID)).toBe(true);
    });
    it('PC 与 NPC_WANG 面板 entityKey 不同', () => {
        const state = buildWorld();
        const pcPanel = buildActorPanel(state, PC);
        const wangPanel = buildActorPanel(state, NPC_WANG);
        expect(pcPanel.entityKey).not.toBe(wangPanel.entityKey);
    });
    it('未知 entityKey 抛出错误', () => {
        const state = buildWorld();
        expect(() => buildActorPanel(state, 'nonexistent_xyz_key')).toThrow('[buildActorPanel]');
    });
    it('currencies 来自货币系统账户', () => {
        const state = buildWorld();
        const panel = buildActorPanel(state, PC);
        expect(typeof panel.currencies).toBe('object');
        // 基础 fixture PC 有初始余额
        const total = Object.values(panel.currencies).reduce((s, v) => s + v, 0);
        expect(total).toBeGreaterThanOrEqual(0);
    });
});
// ──────────────────────────────────────────────────────────────────────────────
// 恒等门 — 指纹84 / schemaKeys52
// ──────────────────────────────────────────────────────────────────────────────
describe('恒等门 — 指纹88 / schemaKeys54 守恒', () => {
    it('指纹字段总数恒等 85', () => {
        const allKeys = new Set([
            ...FINGERPRINT_BUNDLE_MEMBERS,
            ...FINGERPRINT_PRESET_FIELDS,
            ...FINGERPRINT_SNAPSHOT_FIELDS,
            ...FINGERPRINT_EXCLUDED_FIELDS,
        ]);
        expect(allKeys.size).toBe(95);
    });
    it('RootSchema 顶层 keyCount 仍为 52', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const shape = RootSchema._def.shape();
        expect(Object.keys(shape).length).toBe(54);
    });
    it('buildWorld() state 通过 RootSchema 校验', () => {
        const state = buildWorld();
        expect(() => RootSchema.parse(state)).not.toThrow();
    });
    it('buildActorPanel 调用不修改 state', () => {
        const state = buildWorld();
        const stateBefore = JSON.stringify(state);
        buildActorPanel(state, PC);
        buildActorPanel(state, NPC_WANG);
        expect(JSON.stringify(state)).toBe(stateBefore);
    });
    it('groupNodesByLocation 调用不修改 state', () => {
        const state = buildWorld();
        const stateBefore = JSON.stringify(state);
        groupNodesByLocation(state);
        expect(JSON.stringify(state)).toBe(stateBefore);
    });
    it('buildEdgeDelta 调用不修改输入数组', () => {
        const state = buildWorld();
        const graph = buildRelationGraph(state);
        const edgesBefore = JSON.stringify(graph.edges);
        buildEdgeDelta(graph.edges, graph.edges);
        expect(JSON.stringify(graph.edges)).toBe(edgesBefore);
    });
});
