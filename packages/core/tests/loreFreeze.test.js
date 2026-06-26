/**
 * D-a-lore: loreFreeze — lore 触发谓词冻结纪律测试
 * 对标 L-21 importanceFreeze 同构模式：freeze/assert/read 三件套
 * commit-1 (1a): collectLorePredicates — 触发谓词聚合·指纹验证
 */
import { describe, it, expect } from 'vitest';
import { freezeLorePredicate, assertLorePredicateFrozen, readFrozenLorePredicate, collectLorePredicates, freezeLoreTransitionPredicate, assertLoreTransitionPredicateFrozen, freezeLoreConstraintPredicate, assertLoreConstraintPredicateFrozen, } from '../engine/loreFreeze.js';
import { hashJudgmentBundle } from '../engine/rng.js';
// ── JUDGMENT_BASE（最小合法判定面·用于指纹 delta 断言）────────────────────────
const JUDGMENT_BASE = {
    历法皮肤: {},
    粒度模板覆盖: {},
    种族模板: {},
    母题配额: {},
    媒体渠道表: {},
    检定配方表: {},
    检定档切分表: {},
    欠债参数: {},
    赛事结构模板: {},
    派生量配方: {},
    概率域夹逼: {},
    纠缠闭包弱边阈值: 0.2,
};
function mkFrozenEntry(pred) {
    return freezeLorePredicate({}, pred);
}
// ── freezeLorePredicate ──────────────────────────────────────────────────────
describe('D-a-lore: freezeLorePredicate', () => {
    it('空谓词串 → 冻结成功·触发谓词_冻结=true', () => {
        const result = freezeLorePredicate({}, '');
        expect(result.触发谓词).toBe('');
        expect(result.触发谓词_冻结).toBe(true);
    });
    it('简单 DSL 比较谓词 → 冻结成功', () => {
        const result = freezeLorePredicate({}, '场景.地域 == 四川');
        expect(result.触发谓词).toBe('场景.地域 == 四川');
        expect(result.触发谓词_冻结).toBe(true);
    });
    it('DSL and 谓词（深度1） → 冻结成功', () => {
        const result = freezeLorePredicate({}, '角色.出身地 == 苏州 or 场景.地域 == 苏州');
        expect(result.触发谓词_冻结).toBe(true);
        expect(result.触发谓词).toBe('角色.出身地 == 苏州 or 场景.地域 == 苏州');
    });
    it('数值比较谓词 → 冻结成功', () => {
        const result = freezeLorePredicate({}, '角色.年龄 >= 18');
        expect(result.触发谓词_冻结).toBe(true);
    });
    it('未冻结条目 → 从未冻结状态读取·可冻结', () => {
        const entry = { 触发谓词: '场景.地域 == 四川' };
        const result = freezeLorePredicate(entry, '场景.地域 == 四川');
        expect(result.触发谓词_冻结).toBe(true);
    });
    it('已冻结时再调 → 抛出 D-a-lore 违规错误', () => {
        const frozen = freezeLorePredicate({}, '场景.地域 == 四川');
        expect(() => freezeLorePredicate(frozen, '场景.地域 == 北京')).toThrow('D-a-lore 违规');
    });
    it('已冻结时错误消息含当前谓词值', () => {
        const frozen = freezeLorePredicate({}, '场景.地域 == 四川');
        expect(() => freezeLorePredicate(frozen, '场景.地域 == 北京'))
            .toThrow('场景.地域 == 四川');
    });
    it('非法 DSL 谓词（无运算符） → 抛出 D-a-lore 解析失败', () => {
        expect(() => freezeLorePredicate({}, '!!invalid!!')).toThrow('D-a-lore');
    });
    it('非法 DSL 谓词（仅路径无比较） → 解析失败 fail-closed', () => {
        // 谓词须含比较符·单路径不是合法谓词
        expect(() => freezeLorePredicate({}, '场景.地域')).toThrow('D-a-lore');
    });
    it('返回值 触发谓词_冻结 类型为 true（字面量 true）', () => {
        const result = freezeLorePredicate({}, '');
        const check = result.触发谓词_冻结;
        expect(check).toBe(true);
    });
});
// ── assertLorePredicateFrozen ─────────────────────────────────────────────────
describe('D-a-lore: assertLorePredicateFrozen', () => {
    it('已冻结条目 → 不抛', () => {
        const entry = { 触发谓词: '场景.地域 == 四川', 触发谓词_冻结: true };
        expect(() => assertLorePredicateFrozen(entry, 'cuisine:川菜')).not.toThrow();
    });
    it('未冻结条目（触发谓词_冻结=undefined） → 抛 D-a-lore 守卫', () => {
        expect(() => assertLorePredicateFrozen({ 触发谓词: '场景.地域 == 四川' }, 'cuisine:川菜'))
            .toThrow('D-a-lore 守卫');
    });
    it('未冻结条目（触发谓词_冻结=false） → 抛 D-a-lore 守卫', () => {
        expect(() => assertLorePredicateFrozen({ 触发谓词_冻结: false }, 'cuisine:川菜'))
            .toThrow('D-a-lore 守卫');
    });
    it('错误消息含 loreKey', () => {
        expect(() => assertLorePredicateFrozen({}, 'cuisine:川菜'))
            .toThrow('cuisine:川菜');
    });
    it('空条目（无任何字段） → 抛 D-a-lore 守卫', () => {
        expect(() => assertLorePredicateFrozen({}, 'hanfu:交领唐制'))
            .toThrow('D-a-lore 守卫');
    });
});
// ── readFrozenLorePredicate ───────────────────────────────────────────────────
describe('D-a-lore: readFrozenLorePredicate', () => {
    it('已冻结·返回谓词串', () => {
        const entry = { 触发谓词: '场景.地域 == 四川', 触发谓词_冻结: true };
        expect(readFrozenLorePredicate(entry)).toBe('场景.地域 == 四川');
    });
    it('已冻结·空谓词串 → 返回空串', () => {
        const entry = { 触发谓词: '', 触发谓词_冻结: true };
        expect(readFrozenLorePredicate(entry)).toBe('');
    });
    it('未冻结 → 返回默认值 fail-open（不抛）', () => {
        expect(readFrozenLorePredicate({ 触发谓词: '场景.地域 == 四川' })).toBe('');
    });
    it('未冻结·自定义 defaultValue', () => {
        expect(readFrozenLorePredicate({}, '默认')).toBe('默认');
    });
    it('空条目·无谓词_冻结 → 返回默认值', () => {
        expect(readFrozenLorePredicate({})).toBe('');
    });
    it('已冻结·触发谓词字段缺省（undefined） → 返回默认值', () => {
        const entry = { 触发谓词_冻结: true };
        expect(readFrozenLorePredicate(entry)).toBe('');
    });
    it('双跑逐位恒等', () => {
        const entry = { 触发谓词: '角色.年龄 >= 18 and 场景.地域 == 四川', 触发谓词_冻结: true };
        expect(readFrozenLorePredicate(entry)).toBe(readFrozenLorePredicate(entry));
    });
});
// ── 冻结纪律完整流程 ──────────────────────────────────────────────────────────
describe('D-a-lore: 冻结纪律 完整导入流程', () => {
    it('创建→冻结→断言→读取 完整链路', () => {
        const rawEntry = { 触发谓词: '' };
        const frozen = freezeLorePredicate(rawEntry, '场景.地域 == 四川');
        assertLorePredicateFrozen(frozen, 'cuisine:川菜');
        expect(readFrozenLorePredicate(frozen)).toBe('场景.地域 == 四川');
    });
    it('空谓词冻结链路（无 gate 判定谓词的叙事纯知识条目）', () => {
        const frozen = freezeLorePredicate({}, '');
        assertLorePredicateFrozen(frozen, 'hanfu:交领唐制');
        expect(readFrozenLorePredicate(frozen)).toBe('');
    });
});
// ── D-a-lore (1a): collectLorePredicates — 触发谓词聚合 ──────────────────────
describe('D-a-lore: collectLorePredicates (1a 触发谓词)', () => {
    it('空库 → 返回 undefined', () => {
        expect(collectLorePredicates({})).toBeUndefined();
    });
    it('空库 → lore谓词集合=undefined → hashJudgmentBundle 指纹与无此字段时恒等', () => {
        const fp1 = hashJudgmentBundle(JUDGMENT_BASE);
        const fp2 = hashJudgmentBundle({ ...JUDGMENT_BASE, lore谓词集合: collectLorePredicates({}) });
        expect(fp1).toBe(fp2);
    });
    it('非空触发谓词 → 收集入 result', () => {
        const bag = { 'cuisine:川菜': mkFrozenEntry('场景.地域 == 四川') };
        expect(collectLorePredicates(bag)).toEqual({ 'cuisine:川菜': '场景.地域 == 四川' });
    });
    it('空触发谓词 → 不收集（仅非空）· 返回 undefined', () => {
        const bag = { 'hanfu:交领唐制': mkFrozenEntry('') };
        expect(collectLorePredicates(bag)).toBeUndefined();
    });
    it('混合：非空+空 → 仅收集非空', () => {
        const bag = {
            'cuisine:川菜': mkFrozenEntry('场景.地域 == 四川'),
            'hanfu:交领唐制': mkFrozenEntry(''),
            'dialect:苏州话': mkFrozenEntry('角色.出身地 == 苏州'),
        };
        expect(collectLorePredicates(bag)).toEqual({
            'cuisine:川菜': '场景.地域 == 四川',
            'dialect:苏州话': '角色.出身地 == 苏州',
        });
    });
    it('未冻结条目 → assertLorePredicateFrozen 守卫 throw', () => {
        const bag = { 'cuisine:川菜': { 触发谓词: '场景.地域 == 四川' } };
        expect(() => collectLorePredicates(bag)).toThrow('D-a-lore 守卫');
    });
    it('谓词内容变 → lore谓词集合变 → hashJudgmentBundle 指纹变', () => {
        const bag1 = { 'cuisine:川菜': mkFrozenEntry('场景.地域 == 四川') };
        const bag2 = { 'cuisine:川菜': mkFrozenEntry('场景.地域 == 北京') };
        const fp1 = hashJudgmentBundle({ ...JUDGMENT_BASE, lore谓词集合: collectLorePredicates(bag1) });
        const fp2 = hashJudgmentBundle({ ...JUDGMENT_BASE, lore谓词集合: collectLorePredicates(bag2) });
        expect(fp1).not.toBe(fp2);
    });
    it('新增条目 → 集合变 → 指纹变', () => {
        const bag1 = { 'cuisine:川菜': mkFrozenEntry('场景.地域 == 四川') };
        const bag2 = {
            'cuisine:川菜': mkFrozenEntry('场景.地域 == 四川'),
            'dialect:苏州话': mkFrozenEntry('角色.出身地 == 苏州'),
        };
        const fp1 = hashJudgmentBundle({ ...JUDGMENT_BASE, lore谓词集合: collectLorePredicates(bag1) });
        const fp2 = hashJudgmentBundle({ ...JUDGMENT_BASE, lore谓词集合: collectLorePredicates(bag2) });
        expect(fp1).not.toBe(fp2);
    });
    it('确定性：同入参双跑 hashJudgmentBundle 逐位恒等', () => {
        const bag = {
            'cuisine:川菜': mkFrozenEntry('场景.地域 == 四川'),
            'dialect:苏州话': mkFrozenEntry('角色.出身地 == 苏州'),
        };
        const fp1 = hashJudgmentBundle({ ...JUDGMENT_BASE, lore谓词集合: collectLorePredicates(bag) });
        const fp2 = hashJudgmentBundle({ ...JUDGMENT_BASE, lore谓词集合: collectLorePredicates(bag) });
        expect(fp1).toBe(fp2);
        expect(fp1).toMatch(/^[0-9a-f]{8}$/);
    });
    it('多条目全空谓词 → 返回 undefined → 指纹与空库恒等', () => {
        const bag = {
            'hanfu:交领唐制': mkFrozenEntry(''),
            'dialect:吴语': mkFrozenEntry(''),
        };
        const fpEmpty = hashJudgmentBundle(JUDGMENT_BASE);
        const fpBag = hashJudgmentBundle({ ...JUDGMENT_BASE, lore谓词集合: collectLorePredicates(bag) });
        expect(collectLorePredicates(bag)).toBeUndefined();
        expect(fpBag).toBe(fpEmpty);
    });
});
// ── D-a-lore (1b): freezeLoreTransitionPredicate ─────────────────────────────
describe('D-a-lore: freezeLoreTransitionPredicate (1b 状态转移触发条件)', () => {
    it('非空合法谓词 → 冻结成功·触发条件_冻结=true', () => {
        const r = freezeLoreTransitionPredicate({}, '角色.年龄 >= 18');
        expect(r.触发条件).toBe('角色.年龄 >= 18');
        expect(r.触发条件_冻结).toBe(true);
    });
    it('空谓词 → 冻结成功（极性：空=不转移）', () => {
        const r = freezeLoreTransitionPredicate({}, '');
        expect(r.触发条件).toBe('');
        expect(r.触发条件_冻结).toBe(true);
    });
    it('已冻结时再调 → throw D-a-lore 违规', () => {
        const frozen = freezeLoreTransitionPredicate({}, '场景.地域 == 四川');
        expect(() => freezeLoreTransitionPredicate(frozen, '场景.地域 == 北京')).toThrow('D-a-lore 违规');
    });
    it('已冻结错误消息含当前触发条件值', () => {
        const frozen = freezeLoreTransitionPredicate({}, '场景.地域 == 四川');
        expect(() => freezeLoreTransitionPredicate(frozen, '')).toThrow('场景.地域 == 四川');
    });
    it('非法谓词 → fail-closed throw D-a-lore', () => {
        expect(() => freezeLoreTransitionPredicate({}, '!!invalid!!')).toThrow('D-a-lore');
    });
});
describe('D-a-lore: assertLoreTransitionPredicateFrozen (1b)', () => {
    it('已冻结 → 不抛', () => {
        const e = { 触发条件: '场景.地域 == 四川', 触发条件_冻结: true };
        expect(() => assertLoreTransitionPredicateFrozen(e, 'cuisine:川菜:转移[0]')).not.toThrow();
    });
    it('未冻结 → throw D-a-lore 守卫', () => {
        expect(() => assertLoreTransitionPredicateFrozen({}, 'cuisine:川菜:转移[0]')).toThrow('D-a-lore 守卫');
    });
    it('错误消息含复合键', () => {
        expect(() => assertLoreTransitionPredicateFrozen({}, 'cuisine:川菜:转移[0]'))
            .toThrow('cuisine:川菜:转移[0]');
    });
});
// ── D-a-lore (1c): freezeLoreConstraintPredicate ─────────────────────────────
describe('D-a-lore: freezeLoreConstraintPredicate (1c 硬约束禁令谓词)', () => {
    it('非空合法谓词 → 冻结成功·禁令谓词_冻结=true', () => {
        const r = freezeLoreConstraintPredicate({}, '角色.年龄 < 18');
        expect(r.禁令谓词).toBe('角色.年龄 < 18');
        expect(r.禁令谓词_冻结).toBe(true);
    });
    it('空谓词 → 冻结成功（极性：空=不禁）', () => {
        const r = freezeLoreConstraintPredicate({}, '');
        expect(r.禁令谓词).toBe('');
        expect(r.禁令谓词_冻结).toBe(true);
    });
    it('已冻结时再调 → throw D-a-lore 违规', () => {
        const frozen = freezeLoreConstraintPredicate({}, '角色.年龄 < 18');
        expect(() => freezeLoreConstraintPredicate(frozen, '角色.年龄 < 16')).toThrow('D-a-lore 违规');
    });
    it('已冻结错误消息含当前禁令谓词值', () => {
        const frozen = freezeLoreConstraintPredicate({}, '角色.年龄 < 18');
        expect(() => freezeLoreConstraintPredicate(frozen, '')).toThrow('角色.年龄 < 18');
    });
    it('非法谓词 → fail-closed throw D-a-lore', () => {
        expect(() => freezeLoreConstraintPredicate({}, '!!bad!!')).toThrow('D-a-lore');
    });
});
describe('D-a-lore: assertLoreConstraintPredicateFrozen (1c)', () => {
    it('已冻结 → 不抛', () => {
        const e = { 禁令谓词: '角色.年龄 < 18', 禁令谓词_冻结: true };
        expect(() => assertLoreConstraintPredicateFrozen(e, 'hanfu:盘扣:禁令[0]')).not.toThrow();
    });
    it('未冻结 → throw D-a-lore 守卫', () => {
        expect(() => assertLoreConstraintPredicateFrozen({}, 'hanfu:盘扣:禁令[0]')).toThrow('D-a-lore 守卫');
    });
    it('错误消息含复合键', () => {
        expect(() => assertLoreConstraintPredicateFrozen({}, 'hanfu:盘扣:禁令[0]'))
            .toThrow('hanfu:盘扣:禁令[0]');
    });
});
// ── D-a-lore (1a+1b+1c): collectLorePredicates 全三类 ────────────────────────
describe('D-a-lore: collectLorePredicates (1a+1b+1c 三类聚合)', () => {
    function mkFullEntry(mainPred, transitions = [], constraints = []) {
        return {
            ...freezeLorePredicate({}, mainPred),
            状态转移: transitions.map(t => freezeLoreTransitionPredicate({}, t.pred)),
            硬约束: constraints.map(c => freezeLoreConstraintPredicate({}, c.pred)),
        };
    }
    it('复合键稳定序：转移[0]/禁令[0] 键名确定性', () => {
        const bag = {
            'hanfu:盘扣': mkFullEntry('', [{ pred: '场景.地域 == 苏州' }], [{ pred: '角色.年龄 < 18' }]),
        };
        const result = collectLorePredicates(bag);
        expect(result).toEqual({
            'hanfu:盘扣:转移[0]': '场景.地域 == 苏州',
            'hanfu:盘扣:禁令[0]': '角色.年龄 < 18',
        });
    });
    it('极性·转移空=不转移：空触发条件 → 不收集', () => {
        const bag = {
            'hanfu:盘扣': mkFullEntry('', [{ pred: '' }], []),
        };
        expect(collectLorePredicates(bag)).toBeUndefined();
    });
    it('极性·禁令空=不禁：空禁令谓词 → 不收集', () => {
        const bag = {
            'hanfu:盘扣': mkFullEntry('', [], [{ pred: '' }]),
        };
        expect(collectLorePredicates(bag)).toBeUndefined();
    });
    it('多转移条目：复合键索引稳定', () => {
        const bag = {
            'cuisine:川菜': mkFullEntry('场景.地域 == 四川', [{ pred: '角色.年龄 >= 18' }, { pred: '角色.年龄 >= 21' }], []),
        };
        const result = collectLorePredicates(bag);
        expect(result).toEqual({
            'cuisine:川菜': '场景.地域 == 四川',
            'cuisine:川菜:转移[0]': '角色.年龄 >= 18',
            'cuisine:川菜:转移[1]': '角色.年龄 >= 21',
        });
    });
    it('未冻结状态转移 → assertLoreTransitionPredicateFrozen 守卫 throw', () => {
        const bag = {
            'hanfu:盘扣': {
                ...freezeLorePredicate({}, ''),
                状态转移: [{ 触发条件: '场景.地域 == 苏州' }],
            },
        };
        expect(() => collectLorePredicates(bag)).toThrow('D-a-lore 守卫');
    });
    it('未冻结硬约束 → assertLoreConstraintPredicateFrozen 守卫 throw', () => {
        const bag = {
            'hanfu:盘扣': {
                ...freezeLorePredicate({}, ''),
                硬约束: [{ 禁令谓词: '角色.年龄 < 18' }],
            },
        };
        expect(() => collectLorePredicates(bag)).toThrow('D-a-lore 守卫');
    });
    it('修改转移谓词 → 复合键变 → hashJudgmentBundle 指纹变', () => {
        const bag1 = { 'hanfu:盘扣': mkFullEntry('', [{ pred: '场景.地域 == 苏州' }], []) };
        const bag2 = { 'hanfu:盘扣': mkFullEntry('', [{ pred: '场景.地域 == 北京' }], []) };
        const fp1 = hashJudgmentBundle({ ...JUDGMENT_BASE, lore谓词集合: collectLorePredicates(bag1) });
        const fp2 = hashJudgmentBundle({ ...JUDGMENT_BASE, lore谓词集合: collectLorePredicates(bag2) });
        expect(fp1).not.toBe(fp2);
    });
    it('修改禁令谓词 → 复合键变 → hashJudgmentBundle 指纹变', () => {
        const bag1 = { 'hanfu:盘扣': mkFullEntry('', [], [{ pred: '角色.年龄 < 18' }]) };
        const bag2 = { 'hanfu:盘扣': mkFullEntry('', [], [{ pred: '角色.年龄 < 16' }]) };
        const fp1 = hashJudgmentBundle({ ...JUDGMENT_BASE, lore谓词集合: collectLorePredicates(bag1) });
        const fp2 = hashJudgmentBundle({ ...JUDGMENT_BASE, lore谓词集合: collectLorePredicates(bag2) });
        expect(fp1).not.toBe(fp2);
    });
    it('确定性：同入参双跑 1a+1b+1c 全三类·逐位恒等', () => {
        const bag = {
            'cuisine:川菜': mkFullEntry('场景.地域 == 四川', [{ pred: '角色.年龄 >= 18' }], [{ pred: '角色.年龄 < 5' }]),
            'hanfu:盘扣': mkFullEntry('', [], [{ pred: '' }]),
        };
        const fp1 = hashJudgmentBundle({ ...JUDGMENT_BASE, lore谓词集合: collectLorePredicates(bag) });
        const fp2 = hashJudgmentBundle({ ...JUDGMENT_BASE, lore谓词集合: collectLorePredicates(bag) });
        expect(fp1).toBe(fp2);
        expect(fp1).toMatch(/^[0-9a-f]{8}$/);
    });
    it('空库 → undefined（三类均无条目）', () => {
        expect(collectLorePredicates({})).toBeUndefined();
    });
});
