/**
 * PR-瘦身-A0: 种子视图 9×6 金向量验收
 * 断言①  parse({}) 不抛（全字段 optional）
 * 断言②  parse({}) 不预填任何 default（已知 default 字段缺席）
 * 断言③  record / discriminatedUnion 递归下穿（嵌套字段也 optional）
 * 断言④  顶层 superRefine schema（intervention_pack_v1Schema）不再抛
 * 断言⑤  幂等：提供的字段逐位原样返回，无额外键注入
 * 断言⑥  ZodLazy / 自引用 schema 不爆栈
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { 种子视图 } from '../engine/preset/seedView.js';
import { NpcSchema, 既往记忆种子条目Schema } from '../schema/actor.js';
import { 组织实体条目Schema, 离场演化契约Schema } from '../schema/org.js';
import { 地点条目Schema } from '../schema/map.js';
import { 货币系统Schema } from '../schema/economy.js';
import { intervention_pack_v1Schema } from '../schema/memory.js';
import { factFragment种子条目Schema } from '../schema/secret.js';
import { lore条目Schema } from '../schema/lore.js';

// ── 工具：取字段名 key 不应出现在 parse({}) 结果中 ──────────────────────────────
function assertDefaultAbsent(schema: z.ZodTypeAny, knownDefaultKey: string): void {
  const view = 种子视图(schema);
  const result = view.parse({}) as Record<string, unknown>;
  expect(result).not.toHaveProperty(knownDefaultKey);
}

// ── 工具：fixture 子集逐位恒等 ───────────────────────────────────────────────
function assertSubsetPassthrough(schema: z.ZodTypeAny, subset: Record<string, unknown>): void {
  const view = 种子视图(schema);
  const result = view.parse(subset) as Record<string, unknown>;
  for (const k of Object.keys(subset)) {
    expect(result[k]).toStrictEqual(subset[k]);
  }
  // 无额外键（仅检查 passthrough 传入键 ≤ subset 键数）
  const extraKeys = Object.keys(result).filter(k => !(k in subset));
  expect(extraKeys).toHaveLength(0);
}

// ════════════════════════════════════════════════════════════════════
// 1. NpcSchema（actor:397）
// ════════════════════════════════════════════════════════════════════
describe('种子视图 · NpcSchema', () => {
  const view = 种子视图(NpcSchema);

  it('①  parse({}) 不抛', () => {
    expect(() => view.parse({})).not.toThrow();
  });

  it('②  姓名(default="") 缺席于 parse({})', () => {
    assertDefaultAbsent(NpcSchema, '姓名');
  });

  it('③  技能 record 递归下穿（嵌套字段 optional）', () => {
    // 技能 = z.record(..., 技能条目Schema).default({})
    // 种子视图后：技能 optional → 技能[key] optional → 技能[key].经验 optional
    const withSkill = view.parse({
      技能: { 剑术: { 经验: 100 } },
    }) as Record<string, unknown>;
    const npcSkill = withSkill['技能'] as Record<string, unknown>;
    expect(npcSkill['剑术']).toMatchObject({ 经验: 100 });
    // 嵌套键无 default 注入（技能条目中若有其它 default 字段，不应注入）
    const skillKeys = Object.keys(npcSkill['剑术'] as object);
    expect(skillKeys).toEqual(['经验']);
  });

  it('④  superRefine 不在 NpcSchema 顶层（parse({}) 隐式验证）', () => {
    expect(() => view.parse({})).not.toThrow();
  });

  it('⑤  幂等：{ 姓名: "张三", 位置: "酒馆" } 逐位恒等', () => {
    assertSubsetPassthrough(NpcSchema, { 姓名: '张三', 位置: '酒馆' });
  });

  it('⑥  view 构建过程不爆栈（含多层嵌套 record）', () => {
    expect(() => 种子视图(NpcSchema)).not.toThrow();
  });
});

// ════════════════════════════════════════════════════════════════════
// 2. 组织实体条目Schema（org:125）
// ════════════════════════════════════════════════════════════════════
describe('种子视图 · 组织实体条目Schema', () => {
  const view = 种子视图(组织实体条目Schema);

  it('① parse({}) 不抛', () => {
    expect(() => view.parse({})).not.toThrow();
  });

  it('② 类型(default="") 缺席', () => {
    assertDefaultAbsent(组织实体条目Schema, '类型');
  });

  it('③ 用工.岗位 record 递归下穿', () => {
    const r = view.parse({ 用工: { 岗位: { 厨师: { 人数: 3 } } } }) as Record<string, unknown>;
    const 岗位 = (r['用工'] as Record<string, unknown>)['岗位'] as Record<string, unknown>;
    expect(岗位['厨师']).toMatchObject({ 人数: 3 });
    expect(Object.keys(岗位['厨师'] as object)).toEqual(['人数']);
  });

  it('④ parse({}) 无 superRefine 异常（隐式）', () => {
    expect(() => view.parse({})).not.toThrow();
  });

  it('⑤ 幂等：{ 类型: "帮派", 状态: "活跃" }', () => {
    assertSubsetPassthrough(组织实体条目Schema, { 类型: '帮派', 状态: '活跃' });
  });

  it('⑥ view 构建不爆栈', () => {
    expect(() => 种子视图(组织实体条目Schema)).not.toThrow();
  });
});

// ════════════════════════════════════════════════════════════════════
// 3. 地点条目Schema（map:42）
// ════════════════════════════════════════════════════════════════════
describe('种子视图 · 地点条目Schema', () => {
  const view = 种子视图(地点条目Schema);

  it('① parse({}) 不抛', () => {
    expect(() => view.parse({})).not.toThrow();
  });

  it('② 名称(default="") 缺席', () => {
    assertDefaultAbsent(地点条目Schema, '名称');
  });

  it('③ 产出 object 递归下穿', () => {
    // 产出 = z.object({...}).default({}) — 种子视图后 optional 且无 default 注入
    const r = view.parse({ 产出: { 农业: 80 } }) as Record<string, unknown>;
    expect(r['产出']).toMatchObject({ 农业: 80 });
    expect(Object.keys(r['产出'] as object)).toEqual(['农业']);
  });

  it('④ parse({}) 无异常（superRefine 在相邻条目上·不在顶层）', () => {
    expect(() => view.parse({})).not.toThrow();
  });

  it('⑤ 幂等：{ 名称: "悦来客栈", 类别: "建筑" }', () => {
    assertSubsetPassthrough(地点条目Schema, { 名称: '悦来客栈', 类别: '建筑' });
  });

  it('⑥ view 构建不爆栈', () => {
    expect(() => 种子视图(地点条目Schema)).not.toThrow();
  });
});

// ════════════════════════════════════════════════════════════════════
// 4. 货币系统Schema（economy:103）
// ════════════════════════════════════════════════════════════════════
describe('种子视图 · 货币系统Schema', () => {
  const view = 种子视图(货币系统Schema);

  it('① parse({}) 不抛', () => {
    expect(() => view.parse({})).not.toThrow();
  });

  it('② 基准币种(default="") 缺席', () => {
    assertDefaultAbsent(货币系统Schema, '基准币种');
  });

  it('③ 账户 record → 持有 record 双层递归下穿', () => {
    const r = view.parse({
      账户: { player: { 持有: { 文: 500 } } },
    }) as Record<string, unknown>;
    const acct = (r['账户'] as Record<string, unknown>)['player'] as Record<string, unknown>;
    const 持有 = acct['持有'] as Record<string, unknown>;
    expect(持有['文']).toBe(500);
    // 账户条目中其它 default 字段（如 类型·默认值="存款"）不应注入
    const acctKeys = Object.keys(acct);
    expect(acctKeys).toEqual(['持有']);
  });

  it('④ parse({}) 无异常', () => {
    expect(() => view.parse({})).not.toThrow();
  });

  it('⑤ 幂等：{ 基准币种: "文" }', () => {
    assertSubsetPassthrough(货币系统Schema, { 基准币种: '文' });
  });

  it('⑥ view 构建不爆栈', () => {
    expect(() => 种子视图(货币系统Schema)).not.toThrow();
  });
});

// ════════════════════════════════════════════════════════════════════
// 5. intervention_pack_v1Schema（memory:397 · 顶层 superRefine）
// ════════════════════════════════════════════════════════════════════
describe('种子视图 · intervention_pack_v1Schema', () => {
  const view = 种子视图(intervention_pack_v1Schema);

  it('① parse({}) 不抛', () => {
    expect(() => view.parse({})).not.toThrow();
  });

  it('② pack_id（原 required·无 default）缺席于 parse({})', () => {
    const result = view.parse({}) as Record<string, unknown>;
    expect(result).not.toHaveProperty('pack_id');
  });

  it('③ deltas array → path/op 字段递归下穿', () => {
    const r = view.parse({
      pack_id: 'test_pack',
      deltas: [{ path: 'NPC.npc_a.属性.体质', op: 'add', value: 10 }],
    }) as Record<string, unknown>;
    const deltas = r['deltas'] as Record<string, unknown>[];
    const delta0 = deltas[0] ?? {};
    expect(delta0).toMatchObject({ path: 'NPC.npc_a.属性.体质', op: 'add', value: 10 });
    // max_delta 不应被注入（原无 default）
    expect(delta0).not.toHaveProperty('max_delta');
  });

  it('④ 顶层 superRefine 已剥除·parse({}) 无 TypeError', () => {
    // intervention_pack_v1Schema 有 .strict().superRefine()
    // 直接 parse({}) 会因 pack_id required 失败；种子视图剥除后应成功
    expect(() => view.parse({})).not.toThrow();
  });

  it('⑤ 幂等：{ pack_id: "my_mod" } 逐位恒等', () => {
    assertSubsetPassthrough(intervention_pack_v1Schema, { pack_id: 'my_mod' });
  });

  it('⑥ view 构建不爆栈', () => {
    expect(() => 种子视图(intervention_pack_v1Schema)).not.toThrow();
  });
});

// ════════════════════════════════════════════════════════════════════
// 6. 既往记忆种子条目Schema（actor:339）
// ════════════════════════════════════════════════════════════════════
describe('种子视图 · 既往记忆种子条目Schema', () => {
  const view = 种子视图(既往记忆种子条目Schema);

  it('① parse({}) 不抛', () => {
    expect(() => view.parse({})).not.toThrow();
  });

  it('② 摘要(default="") 缺席', () => {
    assertDefaultAbsent(既往记忆种子条目Schema, '摘要');
  });

  it('③ 各字段全 optional（无嵌套 record，验证 object 层正常下穿）', () => {
    const r = view.parse({ 摘要: '初遇' }) as Record<string, unknown>;
    expect(r['摘要']).toBe('初遇');
    expect(Object.keys(r)).toEqual(['摘要']);
  });

  it('④ parse({}) 无异常', () => {
    expect(() => view.parse({})).not.toThrow();
  });

  it('⑤ 幂等：{ 摘要: "初遇时情形", 重要度: 2 }', () => {
    assertSubsetPassthrough(既往记忆种子条目Schema, { 摘要: '初遇时情形', 重要度: 2 });
  });

  it('⑥ view 构建不爆栈', () => {
    expect(() => 种子视图(既往记忆种子条目Schema)).not.toThrow();
  });
});

// ════════════════════════════════════════════════════════════════════
// 7. factFragment种子条目Schema（secret:203）
// ════════════════════════════════════════════════════════════════════
describe('种子视图 · factFragment种子条目Schema', () => {
  const view = 种子视图(factFragment种子条目Schema);

  it('① parse({}) 不抛', () => {
    expect(() => view.parse({})).not.toThrow();
  });

  it('② 主体(default="") 缺席', () => {
    assertDefaultAbsent(factFragment种子条目Schema, '主体');
  });

  it('③ 全 optional（无 default 注入·仅提供字段返回）', () => {
    const r = view.parse({ 主体: 'npc_wang', 维度: '关系', Δ方向: 1 }) as Record<string, unknown>;
    expect(r['主体']).toBe('npc_wang');
    expect(r['维度']).toBe('关系');
    expect(r['Δ方向']).toBe(1);
    expect(Object.keys(r).sort()).toEqual(['Δ方向', '主体', '维度'].sort());
  });

  it('④ parse({}) 无异常', () => {
    expect(() => view.parse({})).not.toThrow();
  });

  it('⑤ 幂等：{ 主体: "npc_wang", 量级: 80 }', () => {
    assertSubsetPassthrough(factFragment种子条目Schema, { 主体: 'npc_wang', 量级: 80 });
  });

  it('⑥ view 构建不爆栈', () => {
    expect(() => 种子视图(factFragment种子条目Schema)).not.toThrow();
  });
});

// ════════════════════════════════════════════════════════════════════
// 8. 离场演化契约Schema（org:65）
// ════════════════════════════════════════════════════════════════════
describe('种子视图 · 离场演化契约Schema', () => {
  const view = 种子视图(离场演化契约Schema);

  it('① parse({}) 不抛', () => {
    expect(() => view.parse({})).not.toThrow();
  });

  it('② 演化速率(default=0) 缺席', () => {
    assertDefaultAbsent(离场演化契约Schema, '演化速率');
  });

  it('③ 关联声明 array 下穿（optional array → 提供时保留元素）', () => {
    const r = view.parse({ 关联声明: ['信号A', '信号B'] }) as Record<string, unknown>;
    expect(r['关联声明']).toEqual(['信号A', '信号B']);
    expect(Object.keys(r)).toEqual(['关联声明']);
  });

  it('④ parse({}) 无异常', () => {
    expect(() => view.parse({})).not.toThrow();
  });

  it('⑤ 幂等：{ 演化速率: 0.3, 随机事件表: "宫廷事变表" }', () => {
    assertSubsetPassthrough(离场演化契约Schema, { 演化速率: 0.3, 随机事件表: '宫廷事变表' });
  });

  it('⑥ view 构建不爆栈', () => {
    expect(() => 种子视图(离场演化契约Schema)).not.toThrow();
  });
});

// ════════════════════════════════════════════════════════════════════
// 9. lore条目Schema（lore:65）
// ════════════════════════════════════════════════════════════════════
describe('种子视图 · lore条目Schema', () => {
  const view = 种子视图(lore条目Schema);

  it('① parse({}) 不抛', () => {
    expect(() => view.parse({})).not.toThrow();
  });

  it('② 触发谓词(default="") 缺席', () => {
    assertDefaultAbsent(lore条目Schema, '触发谓词');
  });

  it('③ 别名表 array → 别名条目 object 递归下穿', () => {
    const r = view.parse({
      别名表: [{ 别名: '四川菜', 命名空间: '菜系' }],
    }) as Record<string, unknown>;
    const aliases = r['别名表'] as Record<string, unknown>[];
    const alias = aliases[0] ?? {};
    expect(alias['别名']).toBe('四川菜');
    expect(alias['命名空间']).toBe('菜系');
    // 别名条目中的其它 default 字段不应注入
    expect(Object.keys(alias).sort()).toEqual(['别名', '命名空间'].sort());
  });

  it('④ parse({}) 无异常', () => {
    expect(() => view.parse({})).not.toThrow();
  });

  it('⑤ 幂等：{ 触发谓词: "场景.地域 == 四川", 知识载荷: "四川盆地..." }', () => {
    assertSubsetPassthrough(lore条目Schema, {
      触发谓词: '场景.地域 == 四川',
      知识载荷: '四川盆地...',
    });
  });

  it('⑥ view 构建不爆栈', () => {
    expect(() => 种子视图(lore条目Schema)).not.toThrow();
  });
});

// ════════════════════════════════════════════════════════════════════
// ⑥ ZodLazy 自引用专项（独立·合成 schema）
// ════════════════════════════════════════════════════════════════════
describe('种子视图 · ZodLazy 自引用专项', () => {
  // 构造自引用树形 schema（用 z.ZodTypeAny 避免递归类型推断复杂度）
  const TreeSchema: z.ZodTypeAny = z.lazy(() =>
    z.object({
      值: z.string().default(''),
      子节点: z.array(TreeSchema as z.ZodTypeAny).optional(),
    })
  );

  it('⑥-1 自引用 schema view 构建不爆栈', () => {
    expect(() => 种子视图(TreeSchema)).not.toThrow();
  });

  it('⑥-2 parse({}) 不抛（全字段 optional 含 lazy 字段）', () => {
    expect(() => 种子视图(TreeSchema).parse({})).not.toThrow();
  });

  it('⑥-3 值(default="") 缺席·子节点 optional', () => {
    const r = 种子视图(TreeSchema).parse({}) as Record<string, unknown>;
    expect(r).not.toHaveProperty('值');
    expect(r).not.toHaveProperty('子节点');
  });

  it('⑥-4 嵌套树形数据逐位恒等', () => {
    const tree = { 值: '根', 子节点: [{ 值: '叶' }] };
    const r = 种子视图(TreeSchema).parse(tree) as Record<string, unknown>;
    expect(r['值']).toBe('根');
    const 子节点 = r['子节点'] as Record<string, unknown>[];
    expect((子节点[0] ?? {})['值']).toBe('叶');
  });

  it('⑥-5 discriminatedUnion 种子视图保留判别键·其余 optional', () => {
    const DU = z.discriminatedUnion('类型', [
      z.object({ 类型: z.literal('A'), 字段: z.string().default('默认A') }),
      z.object({ 类型: z.literal('B'), 数值: z.number().default(0) }),
    ]);
    const view = 种子视图(DU);
    const rA = view.parse({ 类型: 'A' }) as Record<string, unknown>;
    expect(rA['类型']).toBe('A');
    expect(rA).not.toHaveProperty('字段'); // default 剥除 + optional
    const rB = view.parse({ 类型: 'B', 数值: 42 }) as Record<string, unknown>;
    expect(rB['类型']).toBe('B');
    expect(rB['数值']).toBe(42);
  });
});
