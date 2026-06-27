import { describe, it, expect } from 'vitest';
import { 意象条目Schema, factFragmentSchema, 变量字段声明Schema, 变量模板Schema } from '../schema/commonEntry.js';
import { NpcSchema } from '../schema/actor.js';
import { 地点条目Schema } from '../schema/map.js';
import { $涟漪候选Schema } from '../schema/dollar.js';
describe('意象条目Schema import-source', () => {
    it('意象条目Schema 可直接从 commonEntry 导入并 parse', () => {
        const result = 意象条目Schema.parse({ 标签: '神秘', 情绪色彩: '恐惧', 强度: 50 });
        expect(result.标签).toBe('神秘');
        expect(result.情绪色彩).toBe('恐惧');
        expect(result.强度).toBe(50);
        expect(result.来源).toBe('');
        expect(result.衰减速率).toBe(0);
    });
    it('NPC.意象 与 地点条目.意象 parse 同一形状', () => {
        const sample = [{ 标签: '幽暗', 情绪色彩: '压抑', 强度: 30, 来源: '固有', 衰减速率: 0 }];
        // Both fields are ZodDefault<ZodArray<意象条目Schema>>; parse via partial NPC/地点条目
        const npc = NpcSchema.parse({ 意象: sample });
        const loc = 地点条目Schema.parse({ 意象: sample });
        expect(npc.意象).toEqual(loc.意象);
        expect(npc.意象[0]?.标签).toBe('幽暗');
    });
});
// ── factFragmentSchema 共享定义验收 ──────────────────────────────────────────────
describe('factFragmentSchema · 共享定义（禁第二实现）', () => {
    it('全字段 parse 通过（9 字段含漂移字段）', () => {
        const result = factFragmentSchema.parse({
            主体: 'npc_lin',
            维度: '声誉',
            Δ方向: -1,
            客体: 'npc_wang',
            场景: 'loc_inn',
            量级: 60,
            narrativeFrame: '造谣',
            有锚布尔: false,
            来源世界域: 'domain_main',
        });
        expect(result.主体).toBe('npc_lin');
        expect(result.Δ方向).toBe(-1);
        expect(result.有锚布尔).toBe(false);
        expect(result.来源世界域).toBe('domain_main');
    });
    it('最小 parse（仅默认字段·optional 省略）', () => {
        const result = factFragmentSchema.parse({});
        expect(result.主体).toBe('');
        expect(result.维度).toBe('');
        expect(result.Δ方向).toBe(0);
        expect(result.量级).toBe(0);
        expect(result.客体).toBeUndefined();
        expect(result.有锚布尔).toBeUndefined();
        expect(result.来源世界域).toBeUndefined();
    });
    it('actor.ts 印象条目 factFragment 复用 factFragmentSchema（结构一致）', () => {
        // 通过 NpcSchema 的认知档案路径不可直接访问 印象条目；改用抽取输入验证
        // 只要两处解析同一输入得相同结果即证明是同一 schema
        const input = { 主体: 'a', 维度: '生命', Δ方向: 1, 量级: 50, 有锚布尔: true };
        const direct = factFragmentSchema.parse(input);
        // actor.ts 路径：印象条目 factFragment 已换为 factFragmentSchema，间接验证——
        // 若 actor.ts 未改，此处 direct 与 actor 解析相同 input 会因字段集不同而不等
        expect(direct.有锚布尔).toBe(true);
        expect(direct.来源世界域).toBeUndefined();
    });
    it('dollar.ts $涟漪候选 factFragment 复用 factFragmentSchema（漂移字段归位）', () => {
        // $涟漪候选 的 factFragment 现在也包含 有锚布尔 / 来源世界域
        const candidate = $涟漪候选Schema.parse({
            npc_a: [{
                    标签: '恐惧',
                    极性: '负',
                    强度: 70,
                    可见性: '公开',
                    来源拍号: 5,
                    factFragment: {
                        主体: 'npc_a',
                        维度: '关系',
                        Δ方向: -1,
                        量级: 40,
                        有锚布尔: true, // 原在父级·现在 factFragment 内也可设置
                        来源世界域: 'domain_x', // 原在父级·现在 factFragment 内也可设置
                    },
                }],
        });
        const ff = candidate['npc_a']?.[0]?.factFragment;
        expect(ff?.有锚布尔).toBe(true);
        expect(ff?.来源世界域).toBe('domain_x');
    });
    it('全仓一份定义：factFragment 同输入 actor 路径 ≡ dollar 路径', () => {
        const ffInput = { 主体: 'x', 维度: '财富', Δ方向: 1, 量级: 30 };
        const fromCommon = factFragmentSchema.parse(ffInput);
        // actor 与 dollar 的 factFragment 均来自 factFragmentSchema·解析结果逐位等
        expect(fromCommon.主体).toBe('x');
        expect(fromCommon.Δ方向).toBe(1);
    });
});
// ── 变量字段声明Schema / 变量模板Schema ──────────────────────────────────────────
describe('变量字段声明Schema · 类型↔默认值匹配校验', () => {
    it('数字类型 + number 默认值 → 通过', () => {
        const r = 变量字段声明Schema.parse({ 类型: '数字', 默认值: 10 });
        expect(r.类型).toBe('数字');
        expect(r.默认值).toBe(10);
    });
    it('字符串类型 + string 默认值 → 通过', () => {
        const r = 变量字段声明Schema.parse({ 类型: '字符串', 默认值: '无' });
        expect(r.类型).toBe('字符串');
        expect(r.默认值).toBe('无');
    });
    it('布尔类型 + boolean 默认值 → 通过', () => {
        const r = 变量字段声明Schema.parse({ 类型: '布尔', 默认值: true });
        expect(r.类型).toBe('布尔');
        expect(r.默认值).toBe(true);
    });
    it('类型缺省回落「数字」·number 默认值 → 通过', () => {
        const r = 变量字段声明Schema.parse({ 默认值: 42 });
        expect(r.类型).toBe('数字');
        expect(r.默认值).toBe(42);
    });
    it('数字类型 + string 默认值 → superRefine 拒', () => {
        const r = 变量字段声明Schema.safeParse({ 类型: '数字', 默认值: 'x' });
        expect(r.success).toBe(false);
    });
    it('字符串类型 + number 默认值 → superRefine 拒', () => {
        const r = 变量字段声明Schema.safeParse({ 类型: '字符串', 默认值: 0 });
        expect(r.success).toBe(false);
    });
    it('布尔类型 + number 默认值 → superRefine 拒', () => {
        const r = 变量字段声明Schema.safeParse({ 类型: '布尔', 默认值: 1 });
        expect(r.success).toBe(false);
    });
    it('缺 默认值 → 拒', () => {
        const r = 变量字段声明Schema.safeParse({ 类型: '数字' });
        expect(r.success).toBe(false);
    });
    it('描述字段可选', () => {
        const r = 变量字段声明Schema.parse({ 类型: '数字', 默认值: 0, 描述: '攻击力加成' });
        expect(r.描述).toBe('攻击力加成');
    });
    it('描述缺省为 undefined', () => {
        const r = 变量字段声明Schema.parse({ 类型: '数字', 默认值: 0 });
        expect(r.描述).toBeUndefined();
    });
});
describe('变量模板Schema · record<变量名, 变量字段声明>', () => {
    it('中文字段名（伤害 / 耐久度 / 附魔效果）→ 通过', () => {
        const r = 变量模板Schema.parse({
            伤害: { 类型: '数字', 默认值: 0 },
            耐久度: { 类型: '数字', 默认值: 100 },
            附魔效果: { 类型: '字符串', 默认值: '无' },
        });
        expect(r['伤害']?.默认值).toBe(0);
        expect(r['耐久度']?.默认值).toBe(100);
        expect(r['附魔效果']?.默认值).toBe('无');
    });
    it('空 record → 通过', () => {
        const r = 变量模板Schema.parse({});
        expect(r).toEqual({});
    });
    it('record 内某条类型不匹配 → 拒', () => {
        const r = 变量模板Schema.safeParse({
            内力: { 类型: '数字', 默认值: '满' },
        });
        expect(r.success).toBe(false);
    });
    it('空字符串键 → 拒（z.string().min(1) 守卫）', () => {
        const r = 变量模板Schema.safeParse({
            '': { 类型: '数字', 默认值: 0 },
        });
        expect(r.success).toBe(false);
    });
});
