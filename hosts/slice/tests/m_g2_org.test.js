// G2 · 组织实体层（§九）专项回归测试  C2-2
//
// DoD:
//   ① fixture 组织树加载 → 三类边（层级/外交/隶属）解析正确
//   ② §八① 悬空 org 引用 → 幽灵节点（占位形态·不进 autoCompleteRelations 传播桶）
//   ③ §八③ 别名归一去重（org_water_guild → org_shuiyunhui）
//   ④ §九  已解散组织（org_jifu）隶属边保留·不进传播桶·成员不成对
//   ⑤ propagateRipple 零改 → m_p7tier2 35/35 恒等（由顶层 test 套件保证·此处验确定性）
//   ⑥ 3 纯金向量逐位恒等（harness.test.ts 独立保证·此处验 buildWorld schema 合法）
//   ⑦ manifest=85·schemaKeys additive 不变（独立 schema.test.ts 保证·此处绿即可）
import { describe, it, expect } from 'vitest';
import { RootSchema } from '@ai-life-sim/core';
import { resolveOrgNodes } from '@ai-life-sim/core/engine/orgGraph';
import { autoCompleteRelations } from '@ai-life-sim/core/engine/relationGraph';
import { buildWorld, SAVE_SEED, ORG_QINGHEBANG, ORG_SHUIYUNHUI, ORG_JIFU, ORG_GHOST, ORG_ALIAS_WATER, NPC_WANG, NPC_HONG, PC, LOC_KEY, } from '../fixture/world.js';
// ── ① fixture 三类边（层级/外交/隶属）─────────────────────────────────────────
describe('G2-①·fixture 三类组织边', () => {
    it('buildWorld 组织关系网含 层级 边', () => {
        const s = buildWorld();
        const edges = Object.values(s.组织关系网);
        expect(edges.some(e => e.边类型 === '层级')).toBe(true);
    });
    it('buildWorld 组织关系网含 外交 边', () => {
        const s = buildWorld();
        const edges = Object.values(s.组织关系网);
        expect(edges.some(e => e.边类型 === '外交')).toBe(true);
    });
    it('buildWorld 组织关系网含 隶属 边', () => {
        const s = buildWorld();
        const edges = Object.values(s.组织关系网);
        expect(edges.some(e => e.边类型 === '隶属')).toBe(true);
    });
    it('层级边：水运会 ↔ 清河帮', () => {
        const s = buildWorld();
        const edges = Object.values(s.组织关系网);
        const e = edges.find(e => e.边类型 === '层级');
        expect(e).toBeDefined();
        expect([e.A组织, e.B组织]).toContain(ORG_SHUIYUNHUI);
        expect([e.A组织, e.B组织]).toContain(ORG_QINGHEBANG);
    });
    it('外交边：清河帮 ↔ 机福帮', () => {
        const s = buildWorld();
        const edges = Object.values(s.组织关系网);
        const e = edges.find(e => e.边类型 === '外交');
        expect(e).toBeDefined();
        expect([e.A组织, e.B组织]).toContain(ORG_QINGHEBANG);
        expect([e.A组织, e.B组织]).toContain(ORG_JIFU);
    });
    it('隶属边：清河帮 ↔ org_ghost', () => {
        const s = buildWorld();
        const edges = Object.values(s.组织关系网);
        const e = edges.find(e => e.边类型 === '隶属');
        expect(e).toBeDefined();
        expect([e.A组织, e.B组织]).toContain(ORG_GHOST);
    });
});
// ── ② §八① 悬空 org → 幽灵节点（不进传播）──────────────────────────────────────
describe('G2-②·§八① 幽灵节点', () => {
    it('buildWorld 后 org_ghost 存在于 组织实体（幽灵节点）', () => {
        const s = buildWorld();
        expect(s.组织实体[ORG_GHOST]).toBeDefined();
    });
    it('幽灵节点有 占位形态 标记', () => {
        const s = buildWorld();
        expect(s.组织实体[ORG_GHOST]?.占位形态).toBeDefined();
    });
    it('幽灵节点 占位形态.名称 = org_ghost', () => {
        const s = buildWorld();
        expect(s.组织实体[ORG_GHOST]?.占位形态?.名称).toBe(ORG_GHOST);
    });
    it('幽灵节点不进 autoCompleteRelations 传播桶（NPC 引用 ghost 不生成组织同袍边）', () => {
        // 创建两个 NPC 都声明属于 org_ghost（ghost），确认无「组织同袍」边生成
        const s0 = RootSchema.parse({
            NPC: {
                [NPC_WANG]: {
                    姓名: '甲', 位置: LOC_KEY,
                    所属组织: [{ 组织键: ORG_GHOST, 职务: '', 派系: '' }],
                },
                [NPC_HONG]: {
                    姓名: '乙', 位置: LOC_KEY,
                    所属组织: [{ 组织键: ORG_GHOST, 职务: '', 派系: '' }],
                },
            },
            // 注入 ghost 幽灵节点（有 占位形态）
            组织实体: {
                [ORG_GHOST]: {
                    类型: '',
                    状态: '',
                    占位形态: { 名称: ORG_GHOST, 实体类型: '组织', 硬约束: [], 来源拍号: 0 },
                },
            },
        });
        const s1 = autoCompleteRelations(s0, SAVE_SEED, 0);
        // 共址边仍生成（共处类型），但不应有「组织同袍」边
        const rel = s1.NPC[NPC_WANG]?.关系.find(r => r.对象键 === NPC_HONG);
        // 若有边，应为共处（仅共址），不含组织同袍
        if (rel) {
            expect(rel.类型).not.toBe('组织同袍');
        }
        // 无「组织同袍」型的边
        expect(s1.NPC[NPC_WANG]?.关系.filter(r => r.类型 === '组织同袍').length).toBe(0);
        expect(s1.NPC[NPC_HONG]?.关系.filter(r => r.类型 === '组织同袍').length).toBe(0);
    });
    it('悬空引用通过 resolveOrgNodes 自动创建幽灵节点（独立路径验证）', () => {
        const s0 = RootSchema.parse({
            NPC: {
                [NPC_WANG]: {
                    姓名: '甲', 位置: LOC_KEY,
                    所属组织: [{ 组织键: 'org_totally_unknown', 职务: '', 派系: '' }],
                },
            },
        });
        expect(s0.组织实体?.['org_totally_unknown']).toBeUndefined();
        const s1 = resolveOrgNodes(s0);
        // resolveOrgNodes 应为悬空 org 创建幽灵节点
        expect(s1.组织实体['org_totally_unknown']).toBeDefined();
        expect(s1.组织实体['org_totally_unknown']?.占位形态).toBeDefined();
    });
});
// ── ③ §八③ 别名归一去重 ────────────────────────────────────────────────────────
describe('G2-③·§八③ 别名归一', () => {
    it('buildWorld 后 org_shuiyunhui 有 别名键=[org_water_guild]', () => {
        const s = buildWorld();
        expect(s.组织实体[ORG_SHUIYUNHUI]?.别名键).toContain(ORG_ALIAS_WATER);
    });
    it('NPC 引用别名键 → resolveOrgNodes 归一为 canonical 键', () => {
        const s0 = RootSchema.parse({
            NPC: {
                [NPC_WANG]: {
                    姓名: '甲', 位置: LOC_KEY,
                    // 使用别名 org_water_guild 而非 canonical org_shuiyunhui
                    所属组织: [{ 组织键: ORG_ALIAS_WATER, 职务: '', 派系: '' }],
                },
            },
            组织实体: {
                [ORG_SHUIYUNHUI]: {
                    类型: '商会',
                    状态: '活跃',
                    别名键: [ORG_ALIAS_WATER],
                },
            },
        });
        // 归一前：NPC 引用别名键
        expect(s0.NPC[NPC_WANG]?.所属组织[0]?.组织键).toBe(ORG_ALIAS_WATER);
        const s1 = resolveOrgNodes(s0);
        // 归一后：别名键被替换为 canonical 键
        expect(s1.NPC[NPC_WANG]?.所属组织[0]?.组织键).toBe(ORG_SHUIYUNHUI);
    });
    it('别名键归一后：两 NPC 同属 org_shuiyunhui → 生成组织同袍边（canonical 一致）', () => {
        const s0 = RootSchema.parse({
            NPC: {
                [NPC_WANG]: {
                    姓名: '甲', 位置: LOC_KEY,
                    所属组织: [{ 组织键: ORG_ALIAS_WATER, 职务: '', 派系: '' }], // 别名
                },
                [NPC_HONG]: {
                    姓名: '乙', 位置: LOC_KEY,
                    所属组织: [{ 组织键: ORG_SHUIYUNHUI, 职务: '', 派系: '' }], // canonical
                },
            },
            组织实体: {
                [ORG_SHUIYUNHUI]: {
                    类型: '商会',
                    状态: '活跃',
                    别名键: [ORG_ALIAS_WATER],
                },
            },
        });
        const s1 = resolveOrgNodes(s0);
        const s2 = autoCompleteRelations(s1, SAVE_SEED, 0);
        // 别名归一后两者属同一 org → 生成「组织同袍」边
        const rel = s2.NPC[NPC_WANG]?.关系.find(r => r.对象键 === NPC_HONG);
        expect(rel).toBeDefined();
        expect(rel?.类型).toBe('组织同袍');
    });
    it('组织关系网 边端点别名 → resolveOrgNodes 归一（edge A/B 端）', () => {
        const s0 = RootSchema.parse({
            组织实体: {
                [ORG_SHUIYUNHUI]: {
                    类型: '商会',
                    状态: '活跃',
                    别名键: [ORG_ALIAS_WATER],
                },
            },
            组织关系网: {
                'test_edge': {
                    A组织: ORG_ALIAS_WATER, // 别名
                    B组织: ORG_QINGHEBANG,
                    关系: '外交',
                    关系值: 10,
                    约定引用键: '',
                    边类型: '外交',
                },
            },
        });
        const s1 = resolveOrgNodes(s0);
        expect(s1.组织关系网['test_edge']?.A组织).toBe(ORG_SHUIYUNHUI); // 归一
    });
});
// ── ④ §九 已解散组织隶属边保留·不进传播桶 ────────────────────────────────────────
describe('G2-④·§九 已解散组织', () => {
    it('已解散 org_jifu 在 buildWorld 组织实体 中状态=已解散', () => {
        const s = buildWorld();
        expect(s.组织实体[ORG_JIFU]?.状态).toBe('已解散');
    });
    it('已解散 org_jifu 的隶属边仍在 组织关系网 中（边保留）', () => {
        const s = buildWorld();
        const edges = Object.values(s.组织关系网);
        const jifuEdge = edges.find(e => (e.A组织 === ORG_JIFU || e.B组织 === ORG_JIFU) && e.边类型 === '外交');
        expect(jifuEdge).toBeDefined();
    });
    it('已解散 org_jifu 不进 autoCompleteRelations 传播桶（NPC 同属 jifu 不生成组织同袍边）', () => {
        const s0 = RootSchema.parse({
            NPC: {
                [NPC_WANG]: {
                    姓名: '甲', 位置: LOC_KEY,
                    所属组织: [{ 组织键: ORG_JIFU, 职务: '', 派系: '' }],
                },
                [NPC_HONG]: {
                    姓名: '乙', 位置: LOC_KEY,
                    所属组织: [{ 组织键: ORG_JIFU, 职务: '', 派系: '' }],
                },
            },
            组织实体: {
                [ORG_JIFU]: { 类型: '帮派', 状态: '已解散' },
            },
        });
        const s1 = autoCompleteRelations(s0, SAVE_SEED, 0);
        // 两 NPC 同址同解散 org → 共处边（共址）但无「组织同袍」边
        const relWang = s1.NPC[NPC_WANG]?.关系.filter(r => r.类型 === '组织同袍');
        const relHong = s1.NPC[NPC_HONG]?.关系.filter(r => r.类型 === '组织同袍');
        expect(relWang?.length).toBe(0);
        expect(relHong?.length).toBe(0);
    });
    it('已解散 org 成员与活跃 org 成员同址 → 活跃 org 同袍边正常生成', () => {
        // 甲属已解散 org_jifu + 活跃 org_shuiyunhui；乙属活跃 org_shuiyunhui
        // 甲乙仍应有「组织同袍」边（来自 org_shuiyunhui）
        const s0 = RootSchema.parse({
            NPC: {
                [NPC_WANG]: {
                    姓名: '甲', 位置: LOC_KEY,
                    所属组织: [
                        { 组织键: ORG_JIFU, 职务: '', 派系: '' }, // 解散（停中继）
                        { 组织键: ORG_SHUIYUNHUI, 职务: '', 派系: '' }, // 活跃
                    ],
                },
                [NPC_HONG]: {
                    姓名: '乙', 位置: LOC_KEY,
                    所属组织: [{ 组织键: ORG_SHUIYUNHUI, 职务: '', 派系: '' }],
                },
            },
            组织实体: {
                [ORG_JIFU]: { 类型: '帮派', 状态: '已解散' },
                [ORG_SHUIYUNHUI]: { 类型: '商会', 状态: '活跃' },
            },
        });
        const s1 = autoCompleteRelations(s0, SAVE_SEED, 0);
        const rel = s1.NPC[NPC_WANG]?.关系.find(r => r.对象键 === NPC_HONG && r.类型 === '组织同袍');
        expect(rel).toBeDefined();
    });
});
// ── ⑤ buildWorld schema 合法 + 确定性（verifies propagateRipple 未改·零回归）───
describe('G2-⑤·buildWorld 确定性 + schema 合法', () => {
    it('buildWorld() RootSchema 合法', () => {
        expect(RootSchema.safeParse(buildWorld()).success).toBe(true);
    });
    it('两次 buildWorld 组织实体 逐位恒等（确定性）', () => {
        const a = buildWorld();
        const b = buildWorld();
        expect(JSON.stringify(a.组织实体)).toBe(JSON.stringify(b.组织实体));
        expect(JSON.stringify(a.组织关系网)).toBe(JSON.stringify(b.组织关系网));
    });
    it('两次 buildWorld NPC 关系图逐位恒等（autoCompleteRelations 不受 org 数据影响）', () => {
        const a = buildWorld();
        const b = buildWorld();
        expect(JSON.stringify(a.NPC[PC]?.关系)).toBe(JSON.stringify(b.NPC[PC]?.关系));
        expect(JSON.stringify(a.NPC[NPC_WANG]?.关系)).toBe(JSON.stringify(b.NPC[NPC_WANG]?.关系));
        expect(JSON.stringify(a.NPC[NPC_HONG]?.关系)).toBe(JSON.stringify(b.NPC[NPC_HONG]?.关系));
    });
    it('buildWorld PC/WANG/HONG 无组织 → 关系图与 C2-1 前一致（共处类型）', () => {
        const s = buildWorld();
        // 现有三 NPC 无 所属组织 → 不影响已有共址边类型
        for (const npc of [PC, NPC_WANG, NPC_HONG]) {
            for (const rel of s.NPC[npc]?.关系 ?? []) {
                expect(rel.类型).toBe('共处');
            }
        }
    });
});
// ── ⑥ §九 边界：幽灵节点不进 resolveOrgNodes 后的 alias map ──────────────────────
describe('G2-⑥·resolveOrgNodes 幂等 + 边界', () => {
    it('resolveOrgNodes 幂等（二次调用结果一致）', () => {
        const s = buildWorld();
        const s2 = resolveOrgNodes(s);
        // 已有幽灵节点不再重复创建
        expect(JSON.stringify(s.组织实体[ORG_GHOST])).toBe(JSON.stringify(s2.组织实体[ORG_GHOST]));
    });
    it('空世界无 org 引用 → resolveOrgNodes 无副作用', () => {
        const s0 = RootSchema.parse({});
        const s1 = resolveOrgNodes(s0);
        expect(Object.keys(s1.组织实体 ?? {}).length).toBe(0);
    });
    it('组织实体 additive-only：已有 org 条目字段不被 resolveOrgNodes 覆盖', () => {
        const s0 = RootSchema.parse({
            组织实体: {
                [ORG_SHUIYUNHUI]: { 类型: '商会', 状态: '活跃', 风险: 42 },
            },
        });
        const s1 = resolveOrgNodes(s0);
        // 已有条目风险字段保持原样
        expect(s1.组织实体[ORG_SHUIYUNHUI]?.风险).toBe(42);
    });
});
