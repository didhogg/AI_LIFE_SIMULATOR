// 制导遍历底座（前置②·P0-7 findRoute / P-3 组装器检索共用内核）
//
// 纯函数·零 RNG·零 schema·零指纹·零 import：只认 Map<string, Edge[]>。
// 两模式：route（Dijkstra 完备寻路·禁 beam 截断）⊥ collect（best-first 打分收集）。
// 六禁：禁 Date.now/D段await/平台超越函数/localeCompare/裸JSON.stringify/NFC —
//   hopDecay^hop 用整数次幂循环乘法实现，不引入 Math.pow。
// 确定性：一切平局（优先选取 / 排序）按节点键码点序（< / >），禁 localeCompare。
// collect 模式假定 edgeScore/hopDecay ≤ 1（分数沿路径单调不增）；传 >1 的打分函数时排序仍确定，
// 但不保证每节点记录到最优分（best-first 提前 finalize 可能锁定一个非全局最大的分数）。

export type Edge = { to: string; attrs?: Record<string, number> };

export type TraverseSpec = {
  seeds: string[];
  mode: 'route' | 'collect';
  goal?: string;                                       // route 必填
  edgeScore?: (edge: Edge, hop: number) => number;      // 缺省恒 1
  gate?: (edge: Edge, hop: number) => boolean;          // 缺省恒 true；false = 该边不通行
  hopDecay?: number;                                    // 缺省 1（不衰减）；仅 collect 用
  minScore?: number;                                    // 仅 collect：低于即软中止该支
  maxHops?: number;
  budget?: { beamWidth?: number; maxNodes?: number };   // 仅 collect
};

export type CollectResult = { key: string; score: number; hop: number };

const DEFAULT_EDGE_SCORE = (): number => 1;
const DEFAULT_GATE = (): boolean => true;

/** 整数次幂（禁 Math.pow·纯循环乘法·跨平台逐位确定性）。 */
function intPow(base: number, exp: number): number {
  let result = 1;
  for (let i = 0; i < exp; i++) result *= base;
  return result;
}

function edgesOf(graph: Map<string, Edge[]>, key: string): Edge[] {
  return graph.get(key) ?? [];
}

// ── route：多源 Dijkstra（edgeScore = 非负累加代价·完备·禁截断） ──────────────

function guidedRoute(graph: Map<string, Edge[]>, spec: TraverseSpec): string[] | null {
  const goal = spec.goal;
  if (goal === undefined) return null;
  const edgeScore = spec.edgeScore ?? DEFAULT_EDGE_SCORE;
  const gate = spec.gate ?? DEFAULT_GATE;
  const maxHops = spec.maxHops;

  const dist = new Map<string, number>();
  const hopOf = new Map<string, number>();
  const pred = new Map<string, string | null>();
  const visited = new Set<string>();

  for (const seed of spec.seeds) {
    if (!dist.has(seed) || dist.get(seed)! > 0) {
      dist.set(seed, 0);
      hopOf.set(seed, 0);
      pred.set(seed, null);
    }
  }
  if (dist.size === 0) return null;

  for (;;) {
    // 码点序线性扫描取未访问最小代价节点；平局取键小者。
    let cur: string | undefined;
    let curDist = Infinity;
    for (const [key, d] of dist) {
      if (visited.has(key)) continue;
      if (d < curDist || (d === curDist && cur !== undefined && key < cur)) {
        curDist = d;
        cur = key;
      }
    }
    if (cur === undefined) break;
    if (cur === goal) {
      const path: string[] = [];
      let walk: string | null = cur;
      while (walk !== null) {
        path.push(walk);
        walk = pred.get(walk) ?? null;
      }
      path.reverse();
      return path;
    }
    visited.add(cur);
    const hop = hopOf.get(cur)!;
    if (maxHops !== undefined && hop >= maxHops) continue;

    for (const edge of edgesOf(graph, cur)) {
      if (!gate(edge, hop)) continue;
      const w = edgeScore(edge, hop);
      const newDist = curDist + w;
      const existing = dist.get(edge.to);
      if (existing === undefined || newDist < existing) {
        dist.set(edge.to, newDist);
        hopOf.set(edge.to, hop + 1);
        pred.set(edge.to, cur);
      }
    }
  }
  return null;
}

// ── collect：best-first 打分收集（gate 硬中止·minScore 软中止·budget 截断） ───

interface Frontier {
  key: string;
  hop: number;
  edgeProduct: number; // ∏ edgeScore（不含 hopDecay）
  score: number;       // edgeProduct × hopDecay^hop
}

function guidedCollect(graph: Map<string, Edge[]>, spec: TraverseSpec): CollectResult[] {
  const edgeScore = spec.edgeScore ?? DEFAULT_EDGE_SCORE;
  const gate = spec.gate ?? DEFAULT_GATE;
  const hopDecay = spec.hopDecay ?? 1;
  const minScore = spec.minScore ?? -Infinity;
  const maxHops = spec.maxHops;
  const beamWidth = spec.budget?.beamWidth;
  const maxNodes = spec.budget?.maxNodes;

  const best = new Map<string, Frontier>(); // key → 最优（最大 score）已发现条目
  const finalized = new Set<string>();

  const admit = (entry: Frontier): void => {
    if (entry.score < minScore) return;
    const cur = best.get(entry.key);
    if (cur) {
      if (entry.score > cur.score) best.set(entry.key, entry);
      return;
    }
    if (maxNodes !== undefined && best.size >= maxNodes) return; // 预算截断：不再纳入新节点
    best.set(entry.key, entry);
  };

  for (const seed of spec.seeds) {
    admit({ key: seed, hop: 0, edgeProduct: 1, score: intPow(hopDecay, 0) });
  }

  for (;;) {
    // best-first：未 finalize 条目中取 score 最大者；平局 hop 升序→键码点序。
    let pick: Frontier | undefined;
    for (const entry of best.values()) {
      if (finalized.has(entry.key)) continue;
      if (
        !pick ||
        entry.score > pick.score ||
        (entry.score === pick.score && entry.hop < pick.hop) ||
        (entry.score === pick.score && entry.hop === pick.hop && entry.key < pick.key)
      ) {
        pick = entry;
      }
    }
    if (!pick) break;
    finalized.add(pick.key);

    if (maxHops !== undefined && pick.hop >= maxHops) continue;

    const children: Frontier[] = [];
    for (const edge of edgesOf(graph, pick.key)) {
      if (finalized.has(edge.to)) continue;
      if (!gate(edge, pick.hop)) continue;
      const childHop = pick.hop + 1;
      const childProduct = pick.edgeProduct * edgeScore(edge, pick.hop);
      const childScore = childProduct * intPow(hopDecay, childHop);
      if (childScore < minScore) continue; // 软中止：不生成该支
      children.push({ key: edge.to, hop: childHop, edgeProduct: childProduct, score: childScore });
    }

    let toAdmit = children;
    if (beamWidth !== undefined && children.length > beamWidth) {
      toAdmit = [...children]
        .sort((a, b) => (b.score - a.score) || (a.hop - b.hop) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
        .slice(0, beamWidth);
    }
    for (const child of toAdmit) admit(child);
  }

  return [...best.values()]
    .sort((a, b) => (b.score - a.score) || (a.hop - b.hop) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map(({ key, score, hop }) => ({ key, score, hop }));
}

export function guidedTraverse(
  graph: Map<string, Edge[]>,
  spec: TraverseSpec,
): string[] | null | CollectResult[] {
  if (spec.mode === 'route') return guidedRoute(graph, spec);
  return guidedCollect(graph, spec);
}
