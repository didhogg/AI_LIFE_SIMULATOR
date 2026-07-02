// P0-1x·findRoute 寻路备忘 接口冻结实装（前置②·route 模式薄 wrapper over guidedTraverse）
// findRoute(图, 起, 终, NPC过滤器) → 节点序列 | null(不可达)
// 平局按节点键字典序（规则冻结·接线时不得更改）
import type { Edge } from '../engine/traverse.js';
import { guidedTraverse } from '../engine/traverse.js';
import { evalPredStr } from '../engine/dsl/eval.js';

/** 图形状归一：Map<string,Set<string>> 或 Map<string,Edge[]> → Map<string,Edge[]>；其余形状 fail-closed 返回 null。 */
function normalizeGraph(图: unknown): Map<string, Edge[]> | null {
  if (!(图 instanceof Map)) return null;
  const out = new Map<string, Edge[]>();
  for (const [key, value] of 图) {
    if (typeof key !== 'string') return null;
    if (value instanceof Set) {
      out.set(key, [...value].map((to) => ({ to: to as string })));
    } else if (Array.isArray(value)) {
      const edges: Edge[] = [];
      for (const e of value) {
        if (typeof e !== 'object' || e === null || typeof (e as Edge).to !== 'string') return null;
        edges.push(e as Edge);
      }
      out.set(key, edges);
    } else {
      return null;
    }
  }
  return out;
}

/**
 * 在地图图结构中寻找从起点到终点的路径。
 * @param 图 - 地图图结构（节点键→邻接表；接受 Map<string,Set<string>> 或 Map<string,Edge[]>）
 * @param 起 - 起点节点键
 * @param 终 - 终点节点键
 * @param NPC过滤器 - NPC 通行过滤器表达式（DSL 谓词串·开放串·空串=不过滤）
 * @returns 节点键序列（含起点和终点）；不可达时返回 null
 * @note 平局按节点键字典序排序（6.x 冻结规则）
 */
export function findRoute(
  图: unknown,
  起: string,
  终: string,
  NPC过滤器: string,
): string[] | null {
  const graph = normalizeGraph(图);
  if (graph === null) return null;

  const filterSrc = NPC过滤器.trim();
  const spec = filterSrc === ''
    ? { seeds: [起], mode: 'route' as const, goal: 终 }
    : {
        seeds: [起], mode: 'route' as const, goal: 终,
        gate: (edge: Edge): boolean => evalPredStr(filterSrc, edge.attrs ?? {}),
      };

  return guidedTraverse(graph, spec) as string[] | null;
}
