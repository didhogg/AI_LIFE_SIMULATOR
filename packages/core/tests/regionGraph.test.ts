// 前置②·regionGraph.ts 剥离验收：环边断言 + 行为 diff=0 冒烟
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { locRegion, buildRegionGraph, bfsRegionHops } from '../engine/regionGraph.js';
import { RootSchema } from '../schema/index.js';

const CORE_ROOT = join(fileURLToPath(import.meta.url), '..', '..'); // packages/core/
const readSrc = (rel: string): string => readFileSync(join(CORE_ROOT, rel), 'utf-8');

describe('前置②·regionGraph.ts 剥离：LOD 环边断言', () => {
  it('regionGraph.ts 不 import tick.js', () => {
    expect(readSrc('engine/regionGraph.ts')).not.toMatch(/from ['"]\.\/tick\.js['"]/);
  });

  it('lodScheduler.ts 源文件不再出现 from tick.js 取区域图符号', () => {
    const src = readSrc('engine/lodScheduler.ts');
    expect(src).not.toMatch(/from ['"]\.\/tick\.js['"]/);
    expect(src).toMatch(/from ['"]\.\/regionGraph\.js['"]/);
  });

  it('lodPhase.ts 源文件不再出现 from tick.js 取区域图符号', () => {
    const src = readSrc('engine/lodPhase.ts');
    expect(src).not.toMatch(/from ['"]\.\/tick\.js['"]/);
    expect(src).toMatch(/from ['"]\.\/regionGraph\.js['"]/);
  });

  it('lodScheduler.ts:353 孤岛 re-export 已删（全仓零消费者·recon 核实死代码）', () => {
    const src = readSrc('engine/lodScheduler.ts');
    expect(src).not.toMatch(/export \{ locRegion, buildRegionGraph, bfsRegionHops \}/);
  });
});

describe('前置②·regionGraph.ts 剥离：行为 diff=0 冒烟', () => {
  const state = RootSchema.parse({
    地图: {
      地点: {
        A区: { 类别: '区域级', 相邻: [{ 目标: 'A1' }] },
        A1:  { 类别: '地点级', 父节点: 'A区', 相邻: [] },
        B区: { 类别: '区域级', 相邻: [] },
      },
    },
  });
  const locs = state.地图!.地点;

  it('locRegion：地点级节点归并到区域级祖先', () => {
    expect(locRegion('A1', locs)).toBe('A区');
    expect(locRegion('A区', locs)).toBe('A区');
  });

  it('buildRegionGraph + bfsRegionHops：同区域 0 跳·不同区域不可达返回 -1', () => {
    const graph = buildRegionGraph(locs);
    expect(bfsRegionHops('A区', 'A区', graph)).toBe(0);
    expect(bfsRegionHops('A区', 'B区', graph)).toBe(-1);
  });
});

// ── Commit 2 · bfsRegionHops 委托 guidedTraverse：委托前后 diff=0 对照 ─────────
// referenceBfs = 委托前的纯 BFS 原实现快照（仅测试内比对用·非生产第二实现）。
function referenceBfs(from: string, to: string, graph: Map<string, Set<string>>): number {
  if (from === to) return 0;
  const visited = new Set<string>([from]);
  const queue: [string, number][] = [[from, 0]];
  let qi = 0;
  while (qi < queue.length) {
    const [cur, hops] = queue[qi++]!;
    const neighbors = graph.get(cur);
    if (!neighbors) continue;
    for (const nxt of neighbors) {
      if (nxt === to) return hops + 1;
      if (!visited.has(nxt)) {
        visited.add(nxt);
        queue.push([nxt, hops + 1]);
      }
    }
  }
  return -1;
}

describe('前置②·bfsRegionHops 委托 guidedTraverse：diff=0 对照', () => {
  const graphs: Array<[string, Map<string, Set<string>>]> = [
    ['单节点', new Map([['X', new Set()]])],
    ['直连', new Map([['A', new Set(['B'])], ['B', new Set(['A'])]])],
    ['多跳链', new Map([
      ['A', new Set(['B'])], ['B', new Set(['A', 'C'])],
      ['C', new Set(['B', 'D'])], ['D', new Set(['C'])],
    ])],
    ['不可达（两连通分量）', new Map([
      ['A', new Set(['B'])], ['B', new Set(['A'])],
      ['C', new Set(['D'])], ['D', new Set(['C'])],
    ])],
    ['环', new Map([
      ['A', new Set(['B', 'D'])], ['B', new Set(['A', 'C'])],
      ['C', new Set(['B', 'D'])], ['D', new Set(['C', 'A'])],
    ])],
  ];

  for (const [label, graph] of graphs) {
    it(`${label}：委托实现与参照 BFS 逐位一致（全节点对）`, () => {
      const keys = [...graph.keys()];
      for (const from of keys) {
        for (const to of keys) {
          expect(bfsRegionHops(from, to, graph)).toBe(referenceBfs(from, to, graph));
        }
      }
    });
  }

  it('不存在的节点键：委托实现与参照 BFS 一致（均视作不可达/退化 0）', () => {
    const graph = new Map([['A', new Set(['B'])], ['B', new Set(['A'])]]);
    expect(bfsRegionHops('幽灵', 'A', graph)).toBe(referenceBfs('幽灵', 'A', graph));
    expect(bfsRegionHops('幽灵', '幽灵', graph)).toBe(referenceBfs('幽灵', '幽灵', graph));
  });
});
