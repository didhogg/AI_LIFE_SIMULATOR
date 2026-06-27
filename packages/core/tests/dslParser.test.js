// D-a · DSL v1.0 string→AST parser · D-b 防双轨 · S-1 fixture gate · K-a 谓词求值侧
//
// 覆盖点:
//   D-a: parseExpr/parsePred 正向+负向 · 全部 EBNF 节点类型
//   D-b: evalExpr/evalPred 通过 parse 路径与 fixed.ts 同源逐位恒等
//   S-1: v1 fixture strings parse 通过 + eval 逐位恒等 (向后兼容 gate)
//   K-a: expandVerbTarget DSL 谓词筛选 + evalPredStr lore 触发谓词
//   'in': 已支持语法·fail-closed 求值
import { describe, it, expect } from 'vitest';
import { parseExpr, parsePred, tryParseExpr, tryParsePred, DslParseError, DSL_GRAMMAR_VERSION, DSL_EVALUATOR_VERSION, } from '../engine/dsl/parser.js';
import { evalExpr, evalPred, evalPredStr } from '../engine/dsl/eval.js';
import { expandVerbTarget } from '../engine/verbExpand.js';
import { fixedPow, fixedSqrt } from '../engine/math/fixed.js';
// ── Shared context (matches dslFuzzer.test golden values) ─────────────────────
const CTX = {
    账户: { 持有: 1000 },
    人口: { 数量: 50000 },
    声望: { 值: 75 },
    军事: { 兵力: 5000 },
    资产: { 价值: 20000 },
};
// ── Helpers ────────────────────────────────────────────────────────────────────
const INT = (v) => ({ kind: 'int', value: v });
const PCT = (v) => ({ kind: 'percent', value: v });
const PATH = (...parts) => ({ kind: 'path', parts });
const BIN = (op, l, r) => ({ kind: 'binary', op, left: l, right: r });
const UNI = (e) => ({ kind: 'unary', op: '-', expr: e });
const CALL = (fn, ...args) => ({ kind: 'call', fn, args });
const CMP = (op, l, r) => ({ kind: 'compare', op, left: l, right: r });
const LOG = (op, l, r) => ({ kind: 'logical', op, left: l, right: r });
// ── D-a: Expression parser ─────────────────────────────────────────────────────
describe('D-a · parseExpr: 叶节点', () => {
    it('INT: "42" → int(42)', () => {
        expect(parseExpr('42')).toEqual(INT(42));
    });
    it('INT 0: "0" → int(0)', () => {
        expect(parseExpr('0')).toEqual(INT(0));
    });
    it('百分比: "30%" → percent(30)', () => {
        expect(parseExpr('30%')).toEqual(PCT(30));
    });
    it('百分比 100%: "100%" → percent(100)', () => {
        expect(parseExpr('100%')).toEqual(PCT(100));
    });
    it('单段路径: "声望" → path(["声望"])', () => {
        expect(parseExpr('声望')).toEqual(PATH('声望'));
    });
    it('双段路径: "账户.持有" → path(["账户","持有"])', () => {
        expect(parseExpr('账户.持有')).toEqual(PATH('账户', '持有'));
    });
    it('三段路径: "全局.货币.数量" → path(["全局","货币","数量"])', () => {
        expect(parseExpr('全局.货币.数量')).toEqual(PATH('全局', '货币', '数量'));
    });
});
describe('D-a · parseExpr: 一元/二元', () => {
    it('一元负: "-5" → unary(-,int(5))', () => {
        expect(parseExpr('-5')).toEqual(UNI(INT(5)));
    });
    it('一元负路径: "-声望.值" → unary(-,path)', () => {
        expect(parseExpr('-声望.值')).toEqual(UNI(PATH('声望', '值')));
    });
    it('加法: "1+2" → binary(+,int(1),int(2))', () => {
        expect(parseExpr('1+2')).toEqual(BIN('+', INT(1), INT(2)));
    });
    it('减法: "账户.持有-声望.值" → binary(-,path,path)', () => {
        expect(parseExpr('账户.持有-声望.值')).toEqual(BIN('-', PATH('账户', '持有'), PATH('声望', '值')));
    });
    it('乘法: "账户.持有*30%" → binary(*,path,percent)', () => {
        expect(parseExpr('账户.持有*30%')).toEqual(BIN('*', PATH('账户', '持有'), PCT(30)));
    });
    it('除法: "军事.兵力/人口.数量" → binary(/,path,path)', () => {
        expect(parseExpr('军事.兵力/人口.数量')).toEqual(BIN('/', PATH('军事', '兵力'), PATH('人口', '数量')));
    });
    it('空格容忍: "1 + 2" → binary(+,int,int)', () => {
        expect(parseExpr('1 + 2')).toEqual(BIN('+', INT(1), INT(2)));
    });
    it('左结合: "1+2+3" → binary(+,binary(+,1,2),3)', () => {
        expect(parseExpr('1+2+3')).toEqual(BIN('+', BIN('+', INT(1), INT(2)), INT(3)));
    });
    it('优先级: "1+2*3" → binary(+,1,binary(*,2,3))', () => {
        expect(parseExpr('1+2*3')).toEqual(BIN('+', INT(1), BIN('*', INT(2), INT(3))));
    });
    it('括号覆盖优先级: "(1+2)*3" → binary(*,binary(+,1,2),3)', () => {
        expect(parseExpr('(1+2)*3')).toEqual(BIN('*', BIN('+', INT(1), INT(2)), INT(3)));
    });
    it('混合: "账户.持有*30% + 声望.值"', () => {
        const expr = parseExpr('账户.持有*30% + 声望.值');
        expect(evalExpr(expr, CTX)).toBe(375); // 1000*0.3 + 75
    });
});
describe('D-a · parseExpr: 函数调用', () => {
    it('min(1,2) → call(min,[int(1),int(2)])', () => {
        expect(parseExpr('min(1,2)')).toEqual(CALL('min', INT(1), INT(2)));
    });
    it('max(账户.持有,声望.值) → call(max,[path,path])', () => {
        expect(parseExpr('max(账户.持有,声望.值)')).toEqual(CALL('max', PATH('账户', '持有'), PATH('声望', '值')));
    });
    it('clamp(声望.值,0,50) → call(clamp,[path,int,int])', () => {
        expect(parseExpr('clamp(声望.值,0,50)')).toEqual(CALL('clamp', PATH('声望', '值'), INT(0), INT(50)));
    });
    it('pow(声望.值,2) → call(pow,[path,int])', () => {
        expect(parseExpr('pow(声望.值,2)')).toEqual(CALL('pow', PATH('声望', '值'), INT(2)));
    });
    it('sqrt(账户.持有) → call(sqrt,[path])', () => {
        expect(parseExpr('sqrt(账户.持有)')).toEqual(CALL('sqrt', PATH('账户', '持有')));
    });
    it('嵌套函数: min(-5,max(1,2)) → call(min,[unary,call])', () => {
        const expr = parseExpr('min(-5,max(1,2))');
        expect(evalExpr(expr, CTX)).toBe(-5); // min(-5, 2) = -5
    });
    it('函数名作路径段: "clamp.值" → path(["clamp","值"])', () => {
        const expr = parseExpr('clamp.值');
        expect(expr).toEqual(PATH('clamp', '值'));
    });
});
describe('D-a · parseExpr: fail-closed', () => {
    it('空串 → throws DslParseError', () => {
        expect(() => parseExpr('')).toThrow(DslParseError);
    });
    it('非法字符 → throws DslParseError', () => {
        expect(() => parseExpr('a || b')).toThrow(DslParseError);
    });
    it('未闭合括号 → throws DslParseError', () => {
        expect(() => parseExpr('(1+2')).toThrow(DslParseError);
    });
    it('尾部残余 → throws DslParseError', () => {
        expect(() => parseExpr('1+2 garbage')).toThrow(DslParseError);
    });
    it('tryParseExpr 无效 → null', () => {
        expect(tryParseExpr('')).toBeNull();
        expect(tryParseExpr('!invalid')).toBeNull();
    });
    it('tryParseExpr 有效 → 非 null', () => {
        expect(tryParseExpr('42')).not.toBeNull();
        expect(tryParseExpr('账户.持有 * 50%')).not.toBeNull();
    });
});
// ── D-a: Predicate parser ──────────────────────────────────────────────────────
describe('D-a · parsePred: 比较运算符', () => {
    it('"账户.持有 == 1000" → compare(==,path,int)', () => {
        expect(parsePred('账户.持有 == 1000')).toEqual(CMP('==', PATH('账户', '持有'), INT(1000)));
    });
    it('"账户.持有 != 0" → compare(!=,path,int)', () => {
        expect(parsePred('账户.持有 != 0')).toEqual(CMP('!=', PATH('账户', '持有'), INT(0)));
    });
    it('"声望.值 < 100" → compare(<,path,int)', () => {
        expect(parsePred('声望.值 < 100')).toEqual(CMP('<', PATH('声望', '值'), INT(100)));
    });
    it('"声望.值 <= 75" → compare(<=,path,int)', () => {
        expect(parsePred('声望.值 <= 75')).toEqual(CMP('<=', PATH('声望', '值'), INT(75)));
    });
    it('"账户.持有 > 500" → compare(>,path,int)', () => {
        expect(parsePred('账户.持有 > 500')).toEqual(CMP('>', PATH('账户', '持有'), INT(500)));
    });
    it('"军事.兵力 >= 1000" → compare(>=,path,int)', () => {
        expect(parsePred('军事.兵力 >= 1000')).toEqual(CMP('>=', PATH('军事', '兵力'), INT(1000)));
    });
    it('"in" 运算符: "账户.持有 in 1000" → compare(in,path,int)', () => {
        expect(parsePred('账户.持有 in 1000')).toEqual(CMP('in', PATH('账户', '持有'), INT(1000)));
    });
});
describe('D-a · parsePred: 逻辑运算符 + 限深1', () => {
    it('"a > 0 and b < 100" → logical(and,compare,compare)', () => {
        const pred = parsePred('账户.持有 > 0 and 声望.值 < 100');
        expect(pred).toEqual(LOG('and', CMP('>', PATH('账户', '持有'), INT(0)), CMP('<', PATH('声望', '值'), INT(100))));
    });
    it('"a > 0 or b < 100" → logical(or,compare,compare)', () => {
        const pred = parsePred('军事.兵力 > 10000 or 声望.值 > 50');
        expect(pred).toEqual(LOG('or', CMP('>', PATH('军事', '兵力'), INT(10000)), CMP('>', PATH('声望', '值'), INT(50))));
    });
    it('深度1: 单个 compare → 直接返回 compare（无 logical 包装）', () => {
        const pred = parsePred('账户.持有 > 500');
        expect(pred.kind).toBe('compare');
    });
    it('限深1违反: "a > 0 and b > 0 and c > 0" → throws', () => {
        expect(() => parsePred('账户.持有 > 0 and 声望.值 > 0 and 军事.兵力 > 0')).toThrow(DslParseError);
    });
    it('tryParsePred 有效谓词 → 非 null', () => {
        expect(tryParsePred('声望.值 > 50')).not.toBeNull();
    });
    it('tryParsePred 无效谓词 → null', () => {
        expect(tryParsePred('')).toBeNull();
        expect(tryParsePred('没有运算符')).toBeNull();
    });
});
// ── D-b: 防双轨——eval 通过 parse 路径与 fixed.ts 同源逐位恒等 ──────────────────
describe('D-b · 防双轨: parse+eval 与 fixed.ts 逐位恒等', () => {
    it('pow(2,10) via parse: = fixedPow(2,10) 逐位恒等', () => {
        expect(evalExpr(parseExpr('pow(2,10)'), CTX)).toBe(fixedPow(2, 10));
    });
    it('pow(声望.值,50%) via parse: = fixedPow(75,0.5) 逐位恒等', () => {
        expect(evalExpr(parseExpr('pow(声望.值,50%)'), CTX)).toBe(fixedPow(75, 0.5));
    });
    it('sqrt(账户.持有) via parse: = fixedSqrt(1000) 逐位恒等', () => {
        expect(evalExpr(parseExpr('sqrt(账户.持有)'), CTX)).toBe(fixedSqrt(1000));
    });
    it('min/max/clamp via parse 均走 v1 函数库（无平台 Math）', () => {
        expect(evalExpr(parseExpr('min(1000,75)'), CTX)).toBe(75);
        expect(evalExpr(parseExpr('max(1000,75)'), CTX)).toBe(1000);
        expect(evalExpr(parseExpr('clamp(声望.值,0,50)'), CTX)).toBe(50);
    });
});
// ── S-1: fixture gate ─────────────────────────────────────────────────────────
describe('S-1 · fixture gate: v1 表达式 parse + eval 逐位恒等', () => {
    // v1 fixture 表达式（string）→ parse → eval → 与手工计算/fuzzer golden 逐位一致
    const EXPR_FIXTURES = [
        { expr: 'min(账户.持有 * 30%, 声望.值)', expected: 75 },
        { expr: 'clamp(军事.兵力 / 人口.数量 * 100, 0, 50)', expected: 10 },
        { expr: 'pow(声望.值 / 100, 2)', expected: 0.5625 },
        { expr: 'sqrt(账户.持有)', expected: 31.622776601683793 },
        { expr: 'pow(2, 10)', expected: 1024.0000000000018 },
        { expr: 'clamp(pow(资产.价值 / 100, 2), 0, 声望.值)', expected: 75 },
        { expr: 'pow(声望.值, 50%)', expected: 8.660254037844386 },
        { expr: '1 / 3', expected: 1 / 3 },
        { expr: '-(账户.持有)', expected: -1000 },
        { expr: 'max(声望.值, 资产.价值)', expected: 20000 },
    ];
    for (const { expr, expected } of EXPR_FIXTURES) {
        it(`parse+eval: "${expr}" = ${expected}`, () => {
            expect(evalExpr(parseExpr(expr), CTX)).toBe(expected);
        });
    }
    // 谓词 fixture
    const PRED_FIXTURES = [
        { pred: '账户.持有 > 500', expected: true },
        { pred: '声望.值 == 75', expected: true },
        { pred: '军事.兵力 < 1000', expected: false },
        { pred: '声望.值 >= 75', expected: true },
        { pred: '账户.持有 != 0', expected: true },
        { pred: '账户.持有 > 500 and 声望.值 < 100', expected: true },
        { pred: '军事.兵力 < 1000 or 声望.值 > 50', expected: true },
        { pred: '账户.持有 == 999', expected: false },
    ];
    for (const { pred, expected } of PRED_FIXTURES) {
        it(`parse+eval pred: "${pred}" = ${String(expected)}`, () => {
            expect(evalPred(parsePred(pred), CTX)).toBe(expected);
        });
    }
    it('S-1 v2 向后兼容: 全部 v1 fixture 在当前文法下 parse 通过（不 throw）', () => {
        for (const { expr } of EXPR_FIXTURES) {
            expect(() => parseExpr(expr)).not.toThrow();
        }
        for (const { pred } of PRED_FIXTURES) {
            expect(() => parsePred(pred)).not.toThrow();
        }
    });
    it('S-1 round-trip: parse 结果求值逐位恒等（双跑确定性）', () => {
        for (const { expr } of EXPR_FIXTURES) {
            const ast = parseExpr(expr);
            expect(evalExpr(ast, CTX)).toBe(evalExpr(ast, CTX));
        }
    });
});
// ── S-1: 除法取整 golden (DSL M·1 静态约束 4) ─────────────────────────────────
describe('S-1 · 除法: IEEE 754 精确有理除·向不利发起者取整', () => {
    it('"1/3" via parse = 0.3333… [IEEE 754 exact]', () => {
        expect(evalExpr(parseExpr('1/3'), CTX)).toBe(1 / 3);
    });
    it('"2/3" via parse = 0.6666… [IEEE 754 exact]', () => {
        expect(evalExpr(parseExpr('2/3'), CTX)).toBe(2 / 3);
    });
    it('除以零 → 0 (静态约束 1 失败策略)', () => {
        expect(evalExpr(parseExpr('1/0'), CTX)).toBe(0);
    });
});
// ── in 运算符 · fail-closed ───────────────────────────────────────────────────
describe('"in" 运算符: 语法支持·fail-closed 求值', () => {
    it('"账户.持有 in 1000" 解析成功 (语法层·EBNF 包含 in)', () => {
        expect(() => parsePred('账户.持有 in 1000')).not.toThrow();
    });
    it('"in" 谓词求值 → false (extensional 集合法·外部数据未接入)', () => {
        const pred = parsePred('账户.持有 in 1000');
        expect(evalPred(pred, CTX)).toBe(false);
    });
});
// ── K-a: V3 选择器展开 + DSL 谓词筛选 ───────────────────────────────────────
describe('K-a · expandVerbTarget DSL 谓词筛选', () => {
    const ENTITIES = ['角色甲', '角色乙', '角色丙'];
    const CTXS = {
        '角色甲': { 属性: { 体质: 80, 魅力: 60 } },
        '角色乙': { 属性: { 体质: 40, 魅力: 90 } },
        '角色丙': { 属性: { 体质: 60, 魅力: 50 } },
    };
    const resolver = (key) => CTXS[key] ?? null;
    it('"属性.体质 > 50" → 筛出 甲(80) 丙(60)·字典序 [角色丙,角色甲]', () => {
        expect(expandVerbTarget('属性.体质 > 50', ENTITIES, resolver)).toEqual(['角色丙', '角色甲']);
    });
    it('"属性.魅力 >= 90" → 仅 乙(90)', () => {
        expect(expandVerbTarget('属性.魅力 >= 90', ENTITIES, resolver)).toEqual(['角色乙']);
    });
    it('"属性.体质 > 100" → 无匹配 → []', () => {
        expect(expandVerbTarget('属性.体质 > 100', ENTITIES, resolver)).toEqual([]);
    });
    it('"属性.体质 > 50 and 属性.魅力 > 55" → 仅 甲(80,60)', () => {
        expect(expandVerbTarget('属性.体质 > 50 and 属性.魅力 > 55', ENTITIES, resolver)).toEqual(['角色甲']);
    });
    it('"属性.体质 < 50 or 属性.魅力 > 85" → 乙(40,90) [两条满足其一]', () => {
        expect(expandVerbTarget('属性.体质 < 50 or 属性.魅力 > 85', ENTITIES, resolver)).toEqual(['角色乙']);
    });
    it('无 resolver 时: DSL 谓词串 → [] (原行为，不尝试解析)', () => {
        expect(expandVerbTarget('属性.体质 > 50', ENTITIES)).toEqual([]);
    });
    it('字面键优先: 字面键匹配时不走谓词路径', () => {
        // '角色乙' 是合法实体键，直接返回 ['角色乙']，不尝试解析为 DSL
        expect(expandVerbTarget('角色乙', ENTITIES, resolver)).toEqual(['角色乙']);
    });
    it('通配符 * 仍走字典序展开（不受 resolver 影响）', () => {
        expect(expandVerbTarget('*', ENTITIES, resolver)).toEqual([...ENTITIES].sort());
    });
    it('空串 → []', () => {
        expect(expandVerbTarget('', ENTITIES, resolver)).toEqual([]);
    });
    it('无效谓词串 (parse 失败) → [] (fail-closed)', () => {
        expect(expandVerbTarget('!invalid_predicate', ENTITIES, resolver)).toEqual([]);
    });
    it('resolver 返回 null 的实体被跳过', () => {
        const partialResolver = (key) => key === '角色甲' ? CTXS['角色甲'] : null;
        // 只有角色甲有 ctx，且体质 80 > 50 → ['角色甲']
        expect(expandVerbTarget('属性.体质 > 50', ENTITIES, partialResolver)).toEqual(['角色甲']);
    });
});
// ── K-a: lore 触发谓词 evalPredStr ────────────────────────────────────────────
describe('K-a · evalPredStr: lore 触发谓词求值', () => {
    const WORLD_CTX = {
        场景: { 人口: 50000 },
        声望: { 值: 80 },
        季节: { 系数: 2 },
    };
    it('"声望.值 > 50" + ctx → true', () => {
        expect(evalPredStr('声望.值 > 50', WORLD_CTX)).toBe(true);
    });
    it('"声望.值 > 100" + ctx → false', () => {
        expect(evalPredStr('声望.值 > 100', WORLD_CTX)).toBe(false);
    });
    it('"场景.人口 >= 50000 and 声望.值 > 70" → true', () => {
        expect(evalPredStr('场景.人口 >= 50000 and 声望.值 > 70', WORLD_CTX)).toBe(true);
    });
    it('空谓词 "" → false (fail-closed)', () => {
        expect(evalPredStr('', WORLD_CTX)).toBe(false);
    });
    it('无效谓词 (parse 失败) → false (fail-closed)', () => {
        // || is not in v1 grammar
        expect(evalPredStr('声望.值 > 50 || 场景.人口 > 0', WORLD_CTX)).toBe(false);
    });
    it('路径不存在 → 0 → 比较按 0 求值', () => {
        // '不存在路径.属性 > 0' → ctx resolves to 0 → 0 > 0 = false
        expect(evalPredStr('不存在路径.属性 > 0', WORLD_CTX)).toBe(false);
        // '不存在路径.属性 >= 0' → 0 >= 0 = true
        expect(evalPredStr('不存在路径.属性 >= 0', WORLD_CTX)).toBe(true);
    });
});
// ── 版本常量 ───────────────────────────────────────────────────────────────────
describe('版本常量: DSL_GRAMMAR_VERSION / DSL_EVALUATOR_VERSION', () => {
    it('DSL_GRAMMAR_VERSION = "v1.0"', () => {
        expect(DSL_GRAMMAR_VERSION).toBe('v1.0');
    });
    it('DSL_EVALUATOR_VERSION = "v1.0"', () => {
        expect(DSL_EVALUATOR_VERSION).toBe('v1.0');
    });
});
