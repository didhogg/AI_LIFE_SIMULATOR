import { describe, it, expect } from 'vitest';
import { resolveAttribute, check } from '../engine/check.js';
// ─── shared fixtures ──────────────────────────────────────────────────────────
const DEFAULT_CUTOFF = {
    大胜下限: 40,
    胜下限: 15,
    惨胜下限: 1,
    败下限: -24,
};
/** Base input with no contributing terms except 基线=50, rawU=10 → 公式值=50, M=40 */
const BASE = {
    基线: 50,
    熟练: 0,
    等级: 0,
    属性项: 0,
    情境修正: [],
    DC偏置: 0,
    rawU: 10,
    判定骰型: 100,
    切分表: DEFAULT_CUTOFF,
};
// ─── resolveAttribute ─────────────────────────────────────────────────────────
describe('check.ts — resolveAttribute', () => {
    it('主属性 only (empty 副属性列) → (主 + 0) / 2', () => {
        const res = resolveAttribute({ 主属性: '体质', 副属性列: [] }, { 体质: 60 });
        expect(res).toBe(30); // (60 + 0) / 2
    });
    it('主属性 + 单个副属性列 → (主 + 副×权) / 2', () => {
        // (60 + 40×0.5) / 2 = (60 + 20) / 2 = 40
        const res = resolveAttribute({ 主属性: '体质', 副属性列: [{ 轴名: '智慧', 权重: 0.5 }] }, { 体质: 60, 智慧: 40 });
        expect(res).toBe(40);
    });
    it('多个副属性列 → cumulative sum', () => {
        // (60 + 40×0.5 + 20×0.25) / 2 = (60 + 20 + 5) / 2 = 42.5
        const res = resolveAttribute({
            主属性: '体质',
            副属性列: [
                { 轴名: '智慧', 权重: 0.5 },
                { 轴名: '感知', 权重: 0.25 },
            ],
        }, { 体质: 60, 智慧: 40, 感知: 20 });
        expect(res).toBe(42.5);
    });
    it('missing attribute key → treats as 0', () => {
        const res = resolveAttribute({ 主属性: '体质', 副属性列: [] }, {});
        expect(res).toBe(0);
    });
    it('undefined 副属性列 → same as empty', () => {
        const res = resolveAttribute({ 主属性: '体质' }, { 体质: 80 });
        expect(res).toBe(40); // (80 + 0) / 2
    });
});
// ─── resolveAttribute: 拓扑 dispatch (6.45) ──────────────────────────────────
describe('check.ts — resolveAttribute 拓扑', () => {
    it('即掷 (explicit) — normal path proceeds', () => {
        const res = resolveAttribute({ 主属性: '体质', 拓扑: '即掷' }, { 体质: 60 });
        expect(res).toBe(30); // (60 + 0) / 2
    });
    it('即掷 (default, omitted) — normal path proceeds', () => {
        const res = resolveAttribute({ 主属性: '体质' }, { 体质: 60 });
        expect(res).toBe(30);
    });
    it('骰池 → throws 未实装 (P2 placeholder)', () => {
        expect(() => resolveAttribute({ 主属性: '体质', 拓扑: '骰池' }, { 体质: 60 })).toThrow(/骰池.*未实装|未实装.*骰池/);
    });
});
// ─── resolveAttribute: 宿主类型 dispatch (6.45) ───────────────────────────────
describe('check.ts — resolveAttribute 宿主类型', () => {
    it('角色 (explicit) — normal path proceeds', () => {
        const res = resolveAttribute({ 主属性: '智慧', 宿主类型: '角色' }, { 智慧: 70 });
        expect(res).toBe(35); // (70 + 0) / 2
    });
    it('角色 (default, omitted) — normal path proceeds', () => {
        const res = resolveAttribute({ 主属性: '智慧' }, { 智慧: 70 });
        expect(res).toBe(35);
    });
    it('组织 → throws 未实装 (P0-1 dispatch stub)', () => {
        expect(() => resolveAttribute({ 主属性: '影响力', 宿主类型: '组织' }, {})).toThrow(/组织.*未实装|未实装.*P0-1/);
    });
    it('世界域 → throws 未实装 (P0-1 dispatch stub)', () => {
        expect(() => resolveAttribute({ 主属性: '世界稳定指数', 宿主类型: '世界域' }, {})).toThrow(/世界域.*未实装|未实装.*P0-1/);
    });
});
// ─── resolveAttribute: 停用轴中性缺省 (6.48) ─────────────────────────────────
describe('check.ts — resolveAttribute 停用轴中性缺省', () => {
    it('停用=true → uses 中性缺省, ignores data', () => {
        // axis data has 智慧=99, but recipe says 停用=true, 中性缺省=50
        // result = (60 + 50×0.5) / 2 = (60 + 25) / 2 = 42.5
        const res = resolveAttribute({
            主属性: '体质',
            副属性列: [{ 轴名: '智慧', 权重: 0.5, 停用: true, 中性缺省: 50 }],
        }, { 体质: 60, 智慧: 99 });
        expect(res).toBe(42.5);
    });
    it('停用=true, 中性缺省 omitted → defaults to 0', () => {
        // result = (60 + 0×0.5) / 2 = 30
        const res = resolveAttribute({
            主属性: '体质',
            副属性列: [{ 轴名: '智慧', 权重: 0.5, 停用: true }],
        }, { 体质: 60, 智慧: 80 });
        expect(res).toBe(30);
    });
    it('停用=false → live data used normally', () => {
        // result = (60 + 80×0.5) / 2 = (60 + 40) / 2 = 50
        const res = resolveAttribute({
            主属性: '体质',
            副属性列: [{ 轴名: '智慧', 权重: 0.5, 停用: false, 中性缺省: 0 }],
        }, { 体质: 60, 智慧: 80 });
        expect(res).toBe(50);
    });
    it('停用=true, missing key → uses 中性缺省 (not NaN, not 0/absent)', () => {
        // Without disabled-axis support, missing key → ?? 0 = NaN risk gone.
        // With 停用=true, uses declared 中性缺省=25 regardless.
        const res = resolveAttribute({
            主属性: '体质',
            副属性列: [{ 轴名: '不存在轴', 权重: 1.0, 停用: true, 中性缺省: 25 }],
        }, { 体质: 60 });
        expect(res).toBe(42.5); // (60 + 25×1.0) / 2
    });
    it('mixed: some 停用, some live', () => {
        // 主属性: 体质=60 (live)
        // 副①: 智慧=80, 权重=0.5, 停用=false → 40
        // 副②: 力量=?, 权重=0.25, 停用=true, 中性缺省=20 → 5 (ignores live data)
        // result = (60 + 40 + 5) / 2 = 52.5
        const res = resolveAttribute({
            主属性: '体质',
            副属性列: [
                { 轴名: '智慧', 权重: 0.5, 停用: false },
                { 轴名: '力量', 权重: 0.25, 停用: true, 中性缺省: 20 },
            ],
        }, { 体质: 60, 智慧: 80, 力量: 99 });
        expect(res).toBe(52.5);
    });
});
// ─── check() formula ──────────────────────────────────────────────────────────
describe('check.ts — check() formula', () => {
    it('fixture: 基线50, rawU=10 → 公式值=50, M=40, tier=大胜, rawU echoed', () => {
        const r = check(BASE);
        expect(r.公式值).toBe(50);
        expect(r.余量M).toBe(40);
        expect(r.tier).toBe('大胜');
        expect(r.rawU).toBe(10);
    });
    it('熟练 contributes ×0.4', () => {
        // 50 + 10×0.4 = 54; M = 54 − 10 = 44
        const r = check({ ...BASE, 熟练: 10 });
        expect(r.公式值).toBe(54);
        expect(r.余量M).toBe(44);
    });
    it('等级 contributes ×3', () => {
        // 50 + 5×3 = 65; M = 65 − 10 = 55
        const r = check({ ...BASE, 等级: 5 });
        expect(r.公式值).toBe(65);
        expect(r.余量M).toBe(55);
    });
    it('属性项 adds directly', () => {
        // 50 + 20 = 70; M = 70 − 10 = 60
        const r = check({ ...BASE, 属性项: 20 });
        expect(r.公式值).toBe(70);
    });
    it('DC偏置 subtracts', () => {
        // 50 − 15 = 35; M = 35 − 10 = 25
        const r = check({ ...BASE, DC偏置: 15 });
        expect(r.公式值).toBe(35);
        expect(r.余量M).toBe(25);
    });
    it('combined formula: 基线+熟练+等级+属性项+修正−DC', () => {
        // 50 + 5×0.4 + 2×3 + 10 + (8−3) − 7 = 50+2+6+10+5−7 = 66
        const r = check({
            ...BASE,
            熟练: 5,
            等级: 2,
            属性项: 10,
            情境修正: [{ 来源: '地形', 数值: 8 }, { 来源: '状态', 数值: -3 }],
            DC偏置: 7,
            rawU: 20,
        });
        expect(r.公式值).toBe(66);
        expect(r.余量M).toBe(46);
    });
    it('rawU 原样返回（P0 恒等直通）', () => {
        const r = check({ ...BASE, rawU: 77 });
        expect(r.rawU).toBe(77);
    });
    it('修正明细 is a copy of 情境修正 input', () => {
        const 修正 = [{ 来源: 'A', 数值: 5 }, { 来源: 'B', 数值: -2 }];
        const r = check({ ...BASE, 情境修正: 修正 });
        expect(r.修正明细).toEqual(修正);
        expect(r.修正明细).not.toBe(修正); // copied, not the same reference
    });
    it('同输入重放恒等', () => {
        expect(check(BASE)).toEqual(check(BASE));
    });
});
// ─── clamp boundaries ─────────────────────────────────────────────────────────
describe('check.ts — 公式值 clamp', () => {
    it('公式值 > 100 clamped to 100', () => {
        // 100 + 50 − 0 = 150 → 100
        const r = check({ ...BASE, 基线: 100, 属性项: 50, rawU: 0 });
        expect(r.公式值).toBe(100);
        expect(r.余量M).toBe(100); // 100 − 0
    });
    it('公式值 < 0 clamped to 0', () => {
        // 0 − 200 = −200 → 0; M = 0 − 50 = −50
        const r = check({ ...BASE, 基线: 0, DC偏置: 200, rawU: 50 });
        expect(r.公式值).toBe(0);
        expect(r.余量M).toBe(-50);
    });
    it('公式值 exactly 0 (no clamp)', () => {
        // 基线=0, everything else 0
        const r = check({ ...BASE, 基线: 0, rawU: 0 });
        expect(r.公式值).toBe(0);
    });
    it('公式值 exactly 100 (no clamp)', () => {
        const r = check({ ...BASE, 基线: 100, rawU: 0 });
        expect(r.公式值).toBe(100);
    });
});
// ─── 情境修正 ─────────────────────────────────────────────────────────────────
describe('check.ts — 情境修正', () => {
    it('情境修正 sums correctly (positive + negative)', () => {
        // 50 + 10 − 5 = 55; M = 55 − 10 = 45
        const r = check({
            ...BASE,
            情境修正: [{ 来源: '地形', 数值: 10 }, { 来源: '状态', 数值: -5 }],
        });
        expect(r.公式值).toBe(55);
        expect(r.余量M).toBe(45);
    });
    it('情境修正 顺序无关（swap order → same 公式值）', () => {
        const r1 = check({
            ...BASE,
            情境修正: [{ 来源: 'A', 数值: 10 }, { 来源: 'B', 数值: -5 }],
            rawU: 20,
        });
        const r2 = check({
            ...BASE,
            情境修正: [{ 来源: 'B', 数值: -5 }, { 来源: 'A', 数值: 10 }],
            rawU: 20,
        });
        expect(r1.公式值).toBe(r2.公式值);
        expect(r1.余量M).toBe(r2.余量M);
        expect(r1.tier).toBe(r2.tier);
    });
    it('empty 情境修正 → 修正明细 is []', () => {
        expect(check(BASE).修正明细).toEqual([]);
    });
});
// ─── M boundary tier tests ────────────────────────────────────────────────────
describe('check.ts — M boundary tier classification (default cutoffs)', () => {
    // With 基线=50 and no other modifiers: 公式值=50; M=50−rawU
    // rawU = 50 − M  (all values stay in [0,99])
    function tierAt(M) {
        return check({ ...BASE, rawU: 50 - M }).tier;
    }
    it('M = 40 → 大胜 (at 大胜下限)', () => expect(tierAt(40)).toBe('大胜'));
    it('M = 39 → 胜 (one below 大胜下限)', () => expect(tierAt(39)).toBe('胜'));
    it('M = 15 → 胜 (at 胜下限)', () => expect(tierAt(15)).toBe('胜'));
    it('M = 14 → 惨胜 (one below 胜下限)', () => expect(tierAt(14)).toBe('惨胜'));
    it('M = 1 → 惨胜 (at 惨胜下限)', () => expect(tierAt(1)).toBe('惨胜'));
    it('M = 0 → 败 (one below 惨胜下限)', () => expect(tierAt(0)).toBe('败'));
    it('M = -24 → 败 (at 败下限)', () => expect(tierAt(-24)).toBe('败'));
    it('M = -25 → 溃 (one below 败下限)', () => expect(tierAt(-25)).toBe('溃'));
});
// ─── 切分表 override ──────────────────────────────────────────────────────────
describe('check.ts — 切分表 被预设覆盖后 check 跟随新分界', () => {
    it('大胜下限=50 → M=40 给 胜 (not 大胜)', () => {
        // M = 50 − 10 = 40; with default cutoff that would be 大胜, but custom is 胜
        const r = check({
            ...BASE,
            rawU: 10,
            切分表: { 大胜下限: 50, 胜下限: 15, 惨胜下限: 1, 败下限: -24 },
        });
        expect(r.余量M).toBe(40);
        expect(r.tier).toBe('胜');
    });
    it('败下限=-20 → M=-24 给 溃 (below custom 败下限)', () => {
        // M = 50 − 74 = −24; 败下限=-20 → −24 < −20 → 溃
        const r = check({
            ...BASE,
            rawU: 74,
            切分表: { 大胜下限: 40, 胜下限: 15, 惨胜下限: 1, 败下限: -20 },
        });
        expect(r.余量M).toBe(-24);
        expect(r.tier).toBe('溃');
    });
    it('cutoff fully customised — each boundary maps to correct tier', () => {
        const custom = { 大胜下限: 60, 胜下限: 30, 惨胜下限: 10, 败下限: -10 };
        // M values to test: 60(大胜), 59(胜), 30(胜), 29(惨胜), 10(惨胜), 9(败), -10(败), -11(溃)
        function tierAt(M) {
            return check({ ...BASE, rawU: 50 - M, 切分表: custom }).tier;
        }
        expect(tierAt(60)).toBe('大胜');
        expect(tierAt(59)).toBe('胜');
        expect(tierAt(30)).toBe('胜');
        expect(tierAt(29)).toBe('惨胜');
        expect(tierAt(10)).toBe('惨胜');
        expect(tierAt(9)).toBe('败');
        expect(tierAt(-10)).toBe('败');
        expect(tierAt(-11)).toBe('溃');
    });
});
