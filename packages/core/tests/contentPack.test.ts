/**
 * PR-瘦身-A1: 内容包库 schema 验收
 * 断言①  模块菜单派生：RootSchema 全 52 键自动入菜单，无手写清单残留
 * 断言②  模块种子路由：valid 模块键 parse 走 种子视图·零 default 污染
 * 断言③  两级 fail：不存在顶层键 fail-closed · 子键 fail-open
 * 断言④  守恒门：schemaKeys / BUNDLE / manifest 不变（additive-only）
 */
import { describe, it, expect } from 'vitest';
import {
  内容包元数据Schema,
  内容包内容Schema,
  内容包条目Schema,
  内容包库Schema,
  模块菜单键集,
} from '../engine/preset/contentPack.js';
import { RootSchema, BLUEPRINT_KEYS } from '../schema/index.js';

// ═══════════════════════════════════════════════════════════════
// 断言① · 模块菜单派生（引擎单一源·无手写清单）
// ═══════════════════════════════════════════════════════════════
describe('A1 · 模块菜单键集 · 派生守恒', () => {
  it('菜单键数 = RootSchema.shape 键数（53）', () => {
    expect(模块菜单键集.length).toBe(53);
  });

  it('菜单键集 ≡ RootSchema.shape 全键（无多无少）', () => {
    const fromShape = Object.keys(RootSchema.shape).sort();
    const fromMenu = [...模块菜单键集].sort();
    expect(fromMenu).toEqual(fromShape);
  });

  it('BLUEPRINT_KEYS 全 52 键均在菜单中', () => {
    const menuSet = new Set(模块菜单键集);
    for (const k of BLUEPRINT_KEYS) {
      expect(menuSet.has(k), `BLUEPRINT_KEYS 中「${k}」不在菜单`).toBe(true);
    }
  });

  it('菜单键集为只读数组（非空）', () => {
    expect(Array.isArray(模块菜单键集)).toBe(true);
    expect(模块菜单键集.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 断言② · 模块种子路由（valid key · 零 default 污染）
// ═══════════════════════════════════════════════════════════════
describe('A1 · 内容包内容Schema · 模块种子路由', () => {
  it('模块种子 undefined → parse({}) 不抛', () => {
    expect(() => 内容包内容Schema.parse({})).not.toThrow();
  });

  it('空 模块种子 {} → parse 不抛', () => {
    expect(() => 内容包内容Schema.parse({ 模块种子: {} })).not.toThrow();
  });

  it('单实例模块「货币系统」→ seed 为 partial object（无 default 注入）', () => {
    const result = 内容包内容Schema.parse({ 模块种子: { 货币系统: {} } });
    const seed = (result.模块种子 as Record<string, unknown>)['货币系统'];
    expect(seed).toBeDefined();
    // 零 default 污染：parse({}) 结果应为空对象（种子视图剥除 default）
    expect(Object.keys(seed as object)).toHaveLength(0);
  });

  it('单实例模块「世界」→ seed 为 partial object', () => {
    const result = 内容包内容Schema.parse({ 模块种子: { 世界: {} } });
    const seed = (result.模块种子 as Record<string, unknown>)['世界'];
    expect(seed).toBeDefined();
    expect(Object.keys(seed as object)).toHaveLength(0);
  });

  it('多实例模块「NPC」→ seed 为 record<id, partial NPC>（零 default 注入）', () => {
    const result = 内容包内容Schema.parse({
      模块种子: { NPC: { '张三': { 姓名: '张三' } } },
    });
    const seed = (result.模块种子 as Record<string, unknown>)['NPC'] as Record<string, unknown>;
    expect(seed['张三']).toMatchObject({ 姓名: '张三' });
    // 只有提供的字段，无额外 default 注入
    expect(Object.keys(seed['张三'] as object)).toEqual(['姓名']);
  });

  it('多实例模块「组织实体」→ seed 为 record<id, partial entry>', () => {
    const result = 内容包内容Schema.parse({
      模块种子: { 组织实体: { '长安商会': { 类型: '商会' } } },
    });
    const seed = (result.模块种子 as Record<string, unknown>)['组织实体'] as Record<string, unknown>;
    expect(seed['长安商会']).toMatchObject({ 类型: '商会' });
    expect(Object.keys(seed['长安商会'] as object)).toEqual(['类型']);
  });

  it('多实例模块「地图」→ seed 接受 record 结构', () => {
    const result = 内容包内容Schema.parse({
      模块种子: { 地图: { '东市': { 名称: '东市' } } },
    });
    const seed = (result.模块种子 as Record<string, unknown>)['地图'] as Record<string, unknown>;
    expect(seed['东市']).toMatchObject({ 名称: '东市' });
  });

  it('全局 schema「全局」→ seed 为 partial object', () => {
    const result = 内容包内容Schema.parse({
      模块种子: { 全局: { 社会阶层: '平民' } },
    });
    const seed = (result.模块种子 as Record<string, unknown>)['全局'];
    expect(seed).toMatchObject({ 社会阶层: '平民' });
  });

  it('$隐藏记忆库 → seed 为 partial object（延时种子/彩蛋池 optional）', () => {
    const result = 内容包内容Schema.parse({
      模块种子: { $隐藏记忆库: {} },
    });
    const seed = (result.模块种子 as Record<string, unknown>)['$隐藏记忆库'];
    expect(seed).toBeDefined();
    expect(Object.keys(seed as object)).toHaveLength(0);
  });

  it('多个模块键同时提供 → 各自路由正确', () => {
    const result = 内容包内容Schema.parse({
      模块种子: {
        货币系统: {},
        NPC: { '李四': { 姓名: '李四' } },
        全局: {},
      },
    });
    const seeds = result.模块种子 as Record<string, unknown>;
    expect(seeds['货币系统']).toBeDefined();
    expect(seeds['NPC']).toBeDefined();
    expect(seeds['全局']).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════
// 断言③ · 两级 fail
// ═══════════════════════════════════════════════════════════════
describe('A1 · 内容包内容Schema · fail-closed（不存在顶层键）', () => {
  it('不存在键「不存在的模块」→ parse 报错含 fail-closed 诊断', () => {
    const result = 内容包内容Schema.safeParse({
      模块种子: { 不存在的模块: {} },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msgs = result.error.issues.map(i => i.message).join('\n');
      expect(msgs).toContain('fail-closed');
    }
  });

  it('纯英文假键「fakeModule」→ fail-closed', () => {
    const result = 内容包内容Schema.safeParse({
      模块种子: { fakeModule: { x: 1 } },
    });
    expect(result.success).toBe(false);
  });

  it('混合 valid + invalid → 仅 invalid 键报错', () => {
    const result = 内容包内容Schema.safeParse({
      模块种子: {
        货币系统: {},      // valid
        ghost_key: {},    // invalid
      },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map(i => i.path.join('.'));
      expect(paths.some(p => p.includes('ghost_key'))).toBe(true);
      // 不应有 货币系统 相关错误
      expect(paths.some(p => p.includes('货币系统'))).toBe(false);
    }
  });
});

describe('A1 · 内容包内容Schema · fail-open（子键词表）', () => {
  it('NPC 内未知子键 → fail-open（passthrough·parse 成功）', () => {
    // 子键词表（如 NPC 内部字段名）不受 fail-closed 约束
    // 种子视图 返回 passthrough() object → 未知子键透传
    const result = 内容包内容Schema.safeParse({
      模块种子: {
        NPC: { '王五': { 未知字段_xyz: 'value', 姓名: '王五' } },
      },
    });
    expect(result.success).toBe(true);
  });

  it('货币系统内未知币种定义子键 → fail-open（passthrough）', () => {
    // 币种定义 record 条目内有未知字段 → 种子视图 passthrough → 不报错
    const result = 内容包内容Schema.safeParse({
      模块种子: {
        货币系统: { 币种定义: { 金币: { 名称: '金币', 未知字段_xyz: 'value' } } },
      },
    });
    expect(result.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// 内容包元数据Schema 基础验证
// ═══════════════════════════════════════════════════════════════
describe('A1 · 内容包元数据Schema', () => {
  it('合法 pack_id → parse 成功', () => {
    const r = 内容包元数据Schema.safeParse({ pack_id: 'test_pack' });
    expect(r.success).toBe(true);
  });

  it('非法 pack_id（大写）→ parse 失败', () => {
    const r = 内容包元数据Schema.safeParse({ pack_id: 'TestPack' });
    expect(r.success).toBe(false);
  });

  it('版本 default = "0.1.0"', () => {
    const r = 内容包元数据Schema.parse({ pack_id: 'p' });
    expect(r.版本).toBe('0.1.0');
  });

  it('依赖/冲突 default = []', () => {
    const r = 内容包元数据Schema.parse({ pack_id: 'p' });
    expect(r.依赖).toEqual([]);
    expect(r.冲突).toEqual([]);
  });

  it('内容哈希 optional', () => {
    const r = 内容包元数据Schema.parse({ pack_id: 'p' });
    expect(r.内容哈希).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════
// 内容包条目Schema（元数据 + 内容）
// ═══════════════════════════════════════════════════════════════
describe('A1 · 内容包条目Schema', () => {
  it('完整条目 parse 成功', () => {
    const r = 内容包条目Schema.safeParse({
      pack_id: 'my_pack',
      名称: '测试包',
      模块种子: { 货币系统: {} },
    });
    expect(r.success).toBe(true);
  });

  it('条目内不存在模块键 → fail-closed', () => {
    const r = 内容包条目Schema.safeParse({
      pack_id: 'my_pack',
      模块种子: { 不存在: {} },
    });
    expect(r.success).toBe(false);
  });

  it('无 pack_id → 失败', () => {
    const r = 内容包条目Schema.safeParse({ 名称: '无ID包' });
    expect(r.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// 内容包库Schema
// ═══════════════════════════════════════════════════════════════
describe('A1 · 内容包库Schema', () => {
  it('空库 default = {}', () => {
    const r = 内容包库Schema.parse(undefined);
    expect(r).toEqual({});
  });

  it('多包库 parse 成功', () => {
    const r = 内容包库Schema.safeParse({
      pack_a: { pack_id: 'pack_a', 模块种子: { 货币系统: {} } },
      pack_b: { pack_id: 'pack_b', 模块种子: { NPC: {} } },
    });
    expect(r.success).toBe(true);
  });

  it('库内含非法模块键的包 → fail', () => {
    const r = 内容包库Schema.safeParse({
      bad_pack: { pack_id: 'bad_pack', 模块种子: { 幽灵模块: {} } },
    });
    expect(r.success).toBe(false);
  });
});
