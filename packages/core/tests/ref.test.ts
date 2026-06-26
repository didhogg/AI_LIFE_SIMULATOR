// PR-瘦身-指针-0 · Ref 引用原语验收测试
//
// 验收门：
//   R1 · 引用Schema parse + 创建引用 + 命中解引用 → 返回冰箱条目
//   R2 · 未命中守 AA3：handle/冰箱/待建命名空间 均返 null（非 strict）
//   R3 · 成环不死循环：ref_a↔ref_b 相互引用·解引用单步查找·无递归·无死循环
//   R4 · 非法命名空间被拒：引用Schema/创建引用 均 throw
//   R5 · strict 模式抛：strict=true 时各种未命中均 throw
//   R6 · 绑定表覆盖全 13 命名空间（枚举与表 key 一一对应）
//   R7 · 确定性：同输入恒等输出
//   R8 · 引用Schema 句柄格式校验（复用 受治理句柄Schema·不重写）
import { describe, it, expect } from 'vitest';
import { 命名空间枚举 } from '../schema/governedKeySpace.js';
import { 引用Schema, 创建引用, 解引用 } from '../engine/preset/ref.js';
import { 冰箱绑定表 } from '../engine/preset/refBinding.js';
import type { Ref } from '../engine/preset/ref.js';

// ── R4 · 非法命名空间被拒 ──────────────────────────────────────────────────────

describe('R4 · 非法命名空间被拒', () => {
  it('引用Schema 传非法命名空间 → throw at schema creation', () => {
    expect(() => 引用Schema('非法命名空间' as unknown as typeof 命名空间枚举[number])).toThrow(/非法命名空间/);
  });

  it('创建引用 传非法命名空间 → throw', () => {
    expect(() => 创建引用('不存在的空间' as unknown as typeof 命名空间枚举[number], 'handle')).toThrow(/非法命名空间/);
  });

  it('创建引用 传含内部点号的 handle → throw（扁平单 token 纪律）', () => {
    expect(() => 创建引用('mod包', 'invalid.handle')).toThrow();
  });

  it('创建引用 传空 handle → throw', () => {
    expect(() => 创建引用('mod包', '')).toThrow();
  });

  it('创建引用 传 JS 保留键 → throw', () => {
    expect(() => 创建引用('mod包', '__proto__')).toThrow();
  });
});

// ── R6 · 绑定表覆盖全 18 命名空间 ─────────────────────────────────────────────

describe('R6 · 冰箱绑定表覆盖全 17 命名空间', () => {
  it('绑定表 key 数 = 命名空间枚举.length（17）', () => {
    expect(Object.keys(冰箱绑定表).length).toBe(命名空间枚举.length);
    expect(Object.keys(冰箱绑定表).length).toBe(18);
  });

  it('每个命名空间枚举值均有对应绑定条目', () => {
    for (const ns of 命名空间枚举) {
      expect(Object.prototype.hasOwnProperty.call(冰箱绑定表, ns)).toBe(true);
    }
  });

  it('mod包 解析器键 = mod注册表', () => {
    expect(冰箱绑定表['mod包'].解析器键).toBe('mod注册表');
  });

  it('UI组件 解析器键 = UI库（UI库已建·渲染面·不进指纹）', () => {
    expect(冰箱绑定表['UI组件'].解析器键).toBe('UI库');
  });

  it('工具 解析器键 = 工具库（工具库已建·路由面·不进指纹）', () => {
    expect(冰箱绑定表['工具'].解析器键).toBe('工具库');
  });

  it('其余 12 个命名空间解析器键为 undefined（待建）', () => {
    const 已建 = new Set(['mod包', 'UI组件', '工具', '成就', '物品', '媒体']);
    const 待建 = Object.entries(冰箱绑定表).filter(([k]) => !已建.has(k));
    expect(待建).toHaveLength(12);
    for (const [, v] of 待建) {
      expect(v.解析器键).toBeUndefined();
    }
  });
});

// ── R8 · 引用Schema 句柄格式校验 ───────────────────────────────────────────────

describe('R8 · 引用Schema 句柄格式校验', () => {
  it('有效 handle（snake_case）→ 解析成功', () => {
    const s = 引用Schema('mod包');
    const ref = s.parse('my_pack');
    expect(ref.__ns).toBe('mod包');
    expect(ref.handle).toBe('my_pack');
  });

  it('有效 handle（中文字符）→ 解析成功', () => {
    const s = 引用Schema('母题');
    const ref = s.parse('权谋');
    expect(ref.handle).toBe('权谋');
  });

  it('handle 含内部点号 → safeParse fail', () => {
    const s = 引用Schema('mod包');
    expect(s.safeParse('a.b').success).toBe(false);
  });

  it('空字符串 handle → safeParse fail', () => {
    const s = 引用Schema('mod包');
    expect(s.safeParse('').success).toBe(false);
  });

  it('JS 保留键 handle → safeParse fail', () => {
    const s = 引用Schema('mod包');
    expect(s.safeParse('constructor').success).toBe(false);
    expect(s.safeParse('prototype').success).toBe(false);
  });

  it('各合法命名空间均可创建 schema（不 throw）', () => {
    for (const ns of 命名空间枚举) {
      expect(() => 引用Schema(ns)).not.toThrow();
    }
  });
});

// ── R1 · 命中：解引用返回冰箱条目 ─────────────────────────────────────────────

describe('R1 · 命中解引用', () => {
  const 成品: Record<string, unknown> = {
    mod注册表: {
      pack_a: { pack_id: 'pack_a', 版本: '1.0.0', 名称: '基础包' },
      pack_b: { pack_id: 'pack_b', 版本: '2.0.0', 名称: '扩展包' },
    },
  };

  it('创建引用 返回合法 Ref 对象（含 __ns + handle）', () => {
    const ref = 创建引用('mod包', 'pack_a');
    expect(ref.__ns).toBe('mod包');
    expect(ref.handle).toBe('pack_a');
  });

  it('解引用 mod包·命中 → 返回条目', () => {
    const ref = 创建引用('mod包', 'pack_a');
    const result = 解引用(ref, 成品);
    expect(result).toEqual({ pack_id: 'pack_a', 版本: '1.0.0', 名称: '基础包' });
  });

  it('解引用 不同 handle → 返回不同条目', () => {
    const refA = 创建引用('mod包', 'pack_a');
    const refB = 创建引用('mod包', 'pack_b');
    expect((解引用(refA, 成品) as any)['名称']).toBe('基础包');
    expect((解引用(refB, 成品) as any)['名称']).toBe('扩展包');
  });

  it('引用Schema parse → 解引用等价', () => {
    const schema = 引用Schema('mod包');
    const ref = schema.parse('pack_a');
    expect(解引用(ref, 成品)).toEqual(解引用(创建引用('mod包', 'pack_a'), 成品));
  });
});

// ── R2 · 未命中守 AA3 ─────────────────────────────────────────────────────────

describe('R2 · 未命中守 AA3（返 null，非 strict）', () => {
  it('handle 不在冰箱 → 返 null', () => {
    const ref = 创建引用('mod包', 'nonexistent');
    expect(解引用(ref, { mod注册表: {} })).toBeNull();
  });

  it('冰箱 key 不在成品中 → 返 null', () => {
    const ref = 创建引用('mod包', 'pack_a');
    expect(解引用(ref, {})).toBeNull();
  });

  it('冰箱值为 null → 返 null', () => {
    const ref = 创建引用('mod包', 'pack_a');
    expect(解引用(ref, { mod注册表: null as unknown as Record<string, unknown> })).toBeNull();
  });

  it('待建冰箱命名空间（币种）→ 返 null', () => {
    const ref = 创建引用('币种', 'yuan');
    expect(解引用(ref, {})).toBeNull();
  });

  it('待建冰箱命名空间（稀有度）→ 返 null', () => {
    const ref = 创建引用('稀有度', 'common');
    expect(解引用(ref, { 稀有度库: { common: '普通' } })).toBeNull();
  });
});

// ── R5 · strict 模式抛 ────────────────────────────────────────────────────────

describe('R5 · strict 模式 throw', () => {
  it('handle 不在冰箱 + strict=true → throw（含诊断）', () => {
    const ref = 创建引用('mod包', 'missing_pack');
    expect(() => 解引用(ref, { mod注册表: {} }, { strict: true })).toThrow(/missing_pack/);
  });

  it('冰箱不在成品 + strict=true → throw', () => {
    const ref = 创建引用('mod包', 'pack_a');
    expect(() => 解引用(ref, {}, { strict: true })).toThrow();
  });

  it('待建冰箱 + strict=true → throw（含 hint）', () => {
    const ref = 创建引用('稀有度', 'rare');
    expect(() => 解引用(ref, {}, { strict: true })).toThrow(/稀有度/);
  });

  it('待建冰箱 + strict=false（默认）→ 返 null，不 throw', () => {
    const ref = 创建引用('母题', 'romance');
    expect(() => 解引用(ref, {})).not.toThrow();
    expect(解引用(ref, {})).toBeNull();
  });
});

// ── R3 · 成环不死循环 ──────────────────────────────────────────────────────────

describe('R3 · 成环不死循环（引用图允许环·解引用单步不递归）', () => {
  it('ref_a ↔ ref_b 相互引用 → 解引用单步查找·不递归·不死循环', () => {
    const ref_a: Ref<'mod包'> = 创建引用('mod包', 'entry_a');
    const ref_b: Ref<'mod包'> = 创建引用('mod包', 'entry_b');

    // 两条目通过 ref 字段相互引用（循环引用图）
    const 成品: Record<string, unknown> = {
      mod注册表: {
        entry_a: { id: 'a', 引用: ref_b },   // a → b
        entry_b: { id: 'b', 引用: ref_a },   // b → a（成环）
      },
    };

    // 解引用只做单步 record 查找，不递归解析条目内部的 ref 字段
    const resultA = 解引用(ref_a, 成品);
    const resultB = 解引用(ref_b, 成品);

    // 正确返回各自条目（不因环而崩溃）
    expect((resultA as any)['id']).toBe('a');
    expect((resultB as any)['id']).toBe('b');

    // 条目内部的 ref 字段保持原始 Ref 对象（惰性·不自动解析）
    expect((resultA as any)['引用']).toEqual(ref_b);
    expect((resultB as any)['引用']).toEqual(ref_a);
  });

  it('深链：a→b→c（三节点链）·解引用每步独立·无 stack overflow', () => {
    const ref_a = 创建引用('mod包', 'node_a');
    const ref_b = 创建引用('mod包', 'node_b');
    const ref_c = 创建引用('mod包', 'node_c');
    const 成品: Record<string, unknown> = {
      mod注册表: {
        node_a: { id: 'a', next: ref_b },
        node_b: { id: 'b', next: ref_c },
        node_c: { id: 'c', next: ref_a },  // 成环
      },
    };
    expect((解引用(ref_a, 成品) as any)['id']).toBe('a');
    expect((解引用(ref_b, 成品) as any)['id']).toBe('b');
    expect((解引用(ref_c, 成品) as any)['id']).toBe('c');
  });
});

// ── R7 · 确定性（纯函数·同输入恒等输出）──────────────────────────────────────

describe('R7 · 确定性', () => {
  it('创建引用 多次调用·同 ns+handle → 输出 deep equal', () => {
    const r1 = 创建引用('mod包', 'pack_x');
    const r2 = 创建引用('mod包', 'pack_x');
    expect(r1).toEqual(r2);
  });

  it('解引用 多次调用·同输入 → 输出相等', () => {
    const ref = 创建引用('mod包', 'pack_a');
    const 成品: Record<string, unknown> = { mod注册表: { pack_a: { ver: '1.0' } } };
    const r1 = 解引用(ref, 成品);
    const r2 = 解引用(ref, 成品);
    expect(r1).toEqual(r2);
  });

  it('引用Schema 两次 parse 同字符串 → 输出 deep equal', () => {
    const s = 引用Schema('mod包');
    expect(s.parse('pack_y')).toEqual(s.parse('pack_y'));
  });
});

// ── R9 · 原型链 fail-open 防护（P0 + P0-6 member-gate）────────────────────────

describe('R9 · 原型链 fail-open 防护', () => {
  const 成品: Record<string, unknown> = {
    mod注册表: {
      pack_a: { pack_id: 'pack_a', 名称: '基础包' },
    },
  };

  it('toString handle → 不返回原型链函数·返 null', () => {
    // toString 通过 受治理句柄Schema（不在 JS保留键黑名单）·可被 创建引用
    const ref = 创建引用('mod包', 'toString');
    const result = 解引用(ref, 成品);
    expect(result).toBeNull();
    expect(typeof result).not.toBe('function');
  });

  it('valueOf handle → 不返回原型链函数·返 null', () => {
    const ref = 创建引用('mod包', 'valueOf');
    expect(解引用(ref, 成品)).toBeNull();
  });

  it('hasOwnProperty handle → 不返回原型链函数·返 null', () => {
    const ref = 创建引用('mod包', 'hasOwnProperty');
    expect(解引用(ref, 成品)).toBeNull();
  });

  it('直构 constructor handle Ref → 解引用返 null（不泄漏构造函数）', () => {
    // constructor 被 受治理句柄Schema 拒绝·只能直接构造 Ref 模拟攻击面
    const dangerRef: Ref<'mod包'> = { __ns: 'mod包', handle: 'constructor' };
    expect(解引用(dangerRef, 成品)).toBeNull();
  });

  it('直构 __proto__ handle Ref → 解引用返 null', () => {
    const dangerRef: Ref<'mod包'> = { __ns: 'mod包', handle: '__proto__' };
    expect(解引用(dangerRef, 成品)).toBeNull();
  });

  it('own-property handle pack_a → 正常返回条目（guard 不误杀）', () => {
    const ref = 创建引用('mod包', 'pack_a');
    expect(解引用(ref, 成品)).toEqual({ pack_id: 'pack_a', 名称: '基础包' });
  });
});
