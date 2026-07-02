// 前置②·traverse.ts 内核验收：route 完备性 + collect 打分收集 + 确定性双跑逐位恒等
import { describe, it, expect } from 'vitest';
import { guidedTraverse, type Edge } from '../engine/traverse.js';

function chainGraph(): Map<string, Edge[]> {
  // S → A → Z ⊥ S → B → Z（A/B 等长竞争·插入序故意反字典序）
  return new Map<string, Edge[]>([
    ['S', [{ to: 'B' }, { to: 'A' }]],
    ['A', [{ to: 'Z' }]],
    ['B', [{ to: 'Z' }]],
    ['Z', []],
  ]);
}

describe('前置②·guidedTraverse route（Dijkstra 完备·禁截断）', () => {
  it('有路必达：多跳可达返回含起终点的完整路径', () => {
    const graph = chainGraph();
    expect(guidedTraverse(graph, { seeds: ['S'], mode: 'route', goal: 'Z' })).toEqual(['S', 'A', 'Z']);
  });

  it('平局按节点键字典序：竞争路径取键小者（A < B）', () => {
    const graph = chainGraph();
    const result = guidedTraverse(graph, { seeds: ['S'], mode: 'route', goal: 'Z' });
    expect(result).toEqual(['S', 'A', 'Z']);
  });

  it('不可达返回 null（非 throw）', () => {
    const graph = new Map<string, Edge[]>([
      ['S', [{ to: 'A' }]],
      ['A', []],
      ['Z', []], // 孤立节点·无入边
    ]);
    expect(guidedTraverse(graph, { seeds: ['S'], mode: 'route', goal: 'Z' })).toBeNull();
  });

  it('起点即终点：退化路径 = 单节点数组', () => {
    const graph = chainGraph();
    expect(guidedTraverse(graph, { seeds: ['S'], mode: 'route', goal: 'S' })).toEqual(['S']);
  });

  it('gate=false 硬中止：被封锁边不通行·绕行或不可达', () => {
    const graph = chainGraph();
    const result = guidedTraverse(graph, {
      seeds: ['S'], mode: 'route', goal: 'Z',
      gate: (edge) => edge.to !== 'A', // 封锁 S→A，只剩 S→B→Z
    });
    expect(result).toEqual(['S', 'B', 'Z']);
  });

  it('多源 seeds：取全局最短（即便某源字典序更大）', () => {
    const graph = new Map<string, Edge[]>([
      ['far',  [{ to: 'mid' }]],
      ['mid',  [{ to: 'Z' }]],
      ['near', [{ to: 'Z' }]],
      ['Z', []],
    ]);
    expect(guidedTraverse(graph, { seeds: ['far', 'near'], mode: 'route', goal: 'Z' })).toEqual(['near', 'Z']);
  });

  it('确定性：同一输入两次调用输出逐位相同', () => {
    const graph = chainGraph();
    const r1 = guidedTraverse(graph, { seeds: ['S'], mode: 'route', goal: 'Z' });
    const r2 = guidedTraverse(graph, { seeds: ['S'], mode: 'route', goal: 'Z' });
    expect(r1).toEqual(r2);
  });
});

describe('前置②·guidedTraverse collect（best-first 打分收集）', () => {
  function scoredGraph(): Map<string, Edge[]> {
    return new Map<string, Edge[]>([
      ['seed', [{ to: 'strong', attrs: { w: 0.9 } }, { to: 'weak', attrs: { w: 0.1 } }]],
      ['strong', [{ to: 'far', attrs: { w: 0.9 } }]],
      ['weak', [{ to: 'far', attrs: { w: 0.9 } }]],
      ['far', []],
    ]);
  }

  it('排序 = 分数降序 → hop 升序 → 键码点序', () => {
    const graph = scoredGraph();
    const result = guidedTraverse(graph, {
      seeds: ['seed'], mode: 'collect',
      edgeScore: (edge) => edge.attrs?.['w'] ?? 1,
    }) as Array<{ key: string; score: number; hop: number }>;
    // seed(1) > strong(0.9) > far(0.81，经 strong 路径 max 取值·非求和) > weak(0.1)
    const keys = result.map(r => r.key);
    expect(keys).toEqual(['seed', 'strong', 'far', 'weak']);
    expect(result.find(r => r.key === 'far')!.score).toBeCloseTo(0.81, 10);
  });

  it('gate=false 硬中止：该边不生成子节点', () => {
    const graph = scoredGraph();
    const result = guidedTraverse(graph, {
      seeds: ['seed'], mode: 'collect',
      gate: (edge) => edge.to !== 'weak',
    }) as Array<{ key: string; score: number; hop: number }>;
    expect(result.some(r => r.key === 'weak')).toBe(false);
  });

  it('minScore 软中止：低于阈值的支不生成', () => {
    const graph = scoredGraph();
    const result = guidedTraverse(graph, {
      seeds: ['seed'], mode: 'collect',
      edgeScore: (edge) => edge.attrs?.['w'] ?? 1,
      minScore: 0.5,
    }) as Array<{ key: string; score: number; hop: number }>;
    // weak(0.1) < 0.5 被剔除；far 经 weak 也不会被生成（但经 strong 仍可达 0.81 ≥ 0.5）
    expect(result.some(r => r.key === 'weak')).toBe(false);
    expect(result.some(r => r.key === 'far')).toBe(true);
  });

  it('budget.maxNodes 截断：discovered 节点数不超过上限', () => {
    const graph = scoredGraph();
    const result = guidedTraverse(graph, {
      seeds: ['seed'], mode: 'collect',
      budget: { maxNodes: 2 },
    }) as Array<{ key: string; score: number; hop: number }>;
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it('budget.beamWidth：单节点多出边只纳入分数最高者·平局按 hop→键码点序（c1<c3 同分）', () => {
    const graph = new Map<string, Edge[]>([
      // 插入序故意打乱：c2(0.5) / c3(0.9) / c1(0.9)——c1/c3 同分竞争，验证平局取键小者
      ['seed', [{ to: 'c2', attrs: { w: 0.5 } }, { to: 'c3', attrs: { w: 0.9 } }, { to: 'c1', attrs: { w: 0.9 } }]],
      ['c1', []], ['c2', []], ['c3', []],
    ]);
    const spec = {
      seeds: ['seed'], mode: 'collect' as const,
      edgeScore: (edge: Edge): number => edge.attrs?.['w'] ?? 1,
      budget: { beamWidth: 1 },
    };
    const result = guidedTraverse(graph, spec) as Array<{ key: string; score: number; hop: number }>;
    expect(result.map(r => r.key)).toEqual(['seed', 'c1']);
    expect(result.find(r => r.key === 'c1')!.score).toBeCloseTo(0.9, 10);

    const r2 = guidedTraverse(graph, spec) as Array<{ key: string; score: number; hop: number }>;
    expect(r2).toEqual(result); // 双跑逐位恒等
  });

  it('hopDecay：纯跳数场景（edgeScore 恒 1）分数 = hopDecay^hop', () => {
    const graph = new Map<string, Edge[]>([
      ['seed', [{ to: 'a' }]],
      ['a', [{ to: 'b' }]],
      ['b', []],
    ]);
    const result = guidedTraverse(graph, {
      seeds: ['seed'], mode: 'collect', hopDecay: 0.5,
    }) as Array<{ key: string; score: number; hop: number }>;
    expect(result.find(r => r.key === 'seed')!.score).toBeCloseTo(1, 10);
    expect(result.find(r => r.key === 'a')!.score).toBeCloseTo(0.5, 10);
    expect(result.find(r => r.key === 'b')!.score).toBeCloseTo(0.25, 10);
  });

  it('确定性：同一输入两次调用输出逐位相同', () => {
    const graph = scoredGraph();
    const spec = { seeds: ['seed'], mode: 'collect' as const, edgeScore: (e: Edge) => e.attrs?.['w'] ?? 1 };
    const r1 = guidedTraverse(graph, spec);
    const r2 = guidedTraverse(graph, spec);
    expect(r1).toEqual(r2);
  });
});
