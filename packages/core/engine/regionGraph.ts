// 区域图辅助（G1·区域图跳数 + 人口密度调制）— 前置②剥离自 tick.ts，行为 diff=0。
import type { RootState } from '../schema/index.js';
import { guidedTraverse, type Edge } from './traverse.js';

export type LocRecord = NonNullable<RootState['地图']>['地点'];
export type RegionGraph = Map<string, Set<string>>;

/** 给定地点键，沿父节点链（最多 16 层）找最近「区域级」祖先节点键；含自身。 */
export function locRegion(locKey: string, locs: LocRecord): string | undefined {
  let cur = locKey;
  for (let d = 0; d < 16; d++) {
    const loc = locs[cur];
    if (!loc) return undefined;
    if (loc.类别 === '区域级') return cur;
    if (!loc.父节点) return undefined;
    cur = loc.父节点;
  }
  return undefined;
}

/**
 * 从全量 地点.相邻 推导区域级无向邻接图。
 * 若两个地点的相邻边两端解析到不同区域，则添加一条区域间边（双向）。
 */
export function buildRegionGraph(locs: LocRecord): RegionGraph {
  const graph: RegionGraph = new Map();
  for (const [locKey, loc] of Object.entries(locs)) {
    const src = locRegion(locKey, locs);
    if (!src) continue;
    if (!graph.has(src)) graph.set(src, new Set());
    for (const adj of loc.相邻) {
      if (!adj.目标 || adj.目标 === locKey) continue;
      const dst = locRegion(adj.目标, locs);
      if (!dst || dst === src) continue;
      graph.get(src)!.add(dst);
      if (!graph.has(dst)) graph.set(dst, new Set());
      graph.get(dst)!.add(src);
    }
  }
  return graph;
}

/** RegionGraph（Map<string,Set<string>>·无权无向）投影成 guidedTraverse 认的 Map<string,Edge[]>。 */
function toEdgeGraph(graph: RegionGraph): Map<string, Edge[]> {
  const out = new Map<string, Edge[]>();
  for (const [key, neighbors] of graph) {
    out.set(key, [...neighbors].map((to) => ({ to })));
  }
  return out;
}

/** 区域图最短跳数；不可达返回 -1。委托 guidedTraverse route 模式（Dijkstra·纯跳数 edgeScore 恒 1 特例）。 */
export function bfsRegionHops(from: string, to: string, graph: RegionGraph): number {
  const path = guidedTraverse(toEdgeGraph(graph), { seeds: [from], mode: 'route', goal: to }) as string[] | null;
  return path === null ? -1 : path.length - 1;
}
