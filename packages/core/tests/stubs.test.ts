// P0-1x·接口冻结 stub 验收测试
import { describe, it, expect } from 'vitest';
import { CombatResolver } from '../interfaces/combatResolver.js';
import { 赌局Resolver } from '../interfaces/gamblingResolver.js';
import { 离场补结 } from '../interfaces/offstageSettler.js';
import { findRoute } from '../interfaces/findRoute.js';
import {
  提案单Schema,
  提案单条目Schema,
  方向槽枚举,
} from '../schema/proposal.js';

describe('P0-1x Stub: CombatResolver（6.63·三段·未实装）', () => {
  it('init 签名抛出「未实装」', () => {
    expect(() => CombatResolver.init(['npc_a', 'npc_b'], '书房', 42)).toThrow('未实装');
  });
  it('step 签名抛出「未实装」', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => CombatResolver.step({} as any, ['攻击'], ['事件1'])).toThrow('未实装');
  });
  it('settle 签名抛出「未实装」', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => CombatResolver.settle({} as any)).toThrow('未实装');
  });
});

describe('P0-1x Stub: 赌局Resolver（6.31·与 CombatResolver 同构·未实装）', () => {
  it('resolve 签名抛出「未实装」', () => {
    expect(() => 赌局Resolver.resolve(['npc_a', 'npc_b'], '100两', '骰子')).toThrow('未实装');
  });
});

describe('P0-1x Stub: 离场补结（6.66·三段·未实装）', () => {
  it('初始化 签名抛出「未实装」', () => {
    expect(() => 离场补结.初始化({ org_a: {} }, { contract_1: {} }, 0)).toThrow('未实装');
  });
  it('推进 签名抛出「未实装」', () => {
    expect(() => 离场补结.推进({}, { 起: 0, 止: 43200 }, ['事件A'])).toThrow('未实装');
  });
  it('收束 签名抛出「未实装」', () => {
    expect(() => 离场补结.收束({})).toThrow('未实装');
  });
});

describe('P0-1x Stub: findRoute（寻路备忘·未实装）', () => {
  it('findRoute 签名抛出「未实装」', () => {
    expect(() => findRoute({}, '节点_书房', '节点_城门', '全NPC')).toThrow('未实装');
  });
});

describe('P0-1x Schema: 提案单（6.68·Zod schema·形状冻结）', () => {
  it('提案单: 空数组 parse 通过', () => {
    expect(提案单Schema.safeParse([]).success).toBe(true);
  });
  it('提案单: 最小合法条目', () => {
    expect(提案单Schema.safeParse([
      { 动作类别: '转账', 目标引用: 'npc_001' },
    ]).success).toBe(true);
  });
  it('提案单: 完整条目（含数值槽/方向槽/关联实体）', () => {
    expect(提案单条目Schema.safeParse({
      动作类别: '转账', 目标引用: 'npc_001',
      数值槽: 500, 方向槽: '转账收支方向', 关联实体: ['npc_002'],
    }).success).toBe(true);
  });
  it('方向槽: 五类全合法（Z2·6.68）', () => {
    for (const v of 方向槽枚举) {
      expect(提案单条目Schema.safeParse({ 动作类别: 'x', 方向槽: v }).success).toBe(true);
    }
  });
  it('方向槽: absent = optional', () => {
    expect(提案单条目Schema.parse({}).方向槽).toBeUndefined();
  });
  it('方向槽: 非法值拒收', () => {
    expect(提案单条目Schema.safeParse({ 方向槽: '未知方向' }).success).toBe(false);
  });
  it('数值槽: absent = optional', () => {
    expect(提案单条目Schema.parse({}).数值槽).toBeUndefined();
  });
  it('关联实体: 默认空数组', () => {
    expect(提案单条目Schema.parse({}).关联实体).toEqual([]);
  });
  it('提案单: strip 验证（未知字段被剥离）', () => {
    const res = 提案单条目Schema.parse({ 动作类别: 'x', 未知字段: 'y' });
    expect(res).not.toHaveProperty('未知字段');
  });
});
