// B1·K1 Step 1 — modGraph.ts · pure graph core (SCC + self-loop detection)
// Zero wiring: no RootSchema, no engine/, no fingerprintManifest, no migrate, no rng.
// No Math.random, no Date, no .normalize, no localeCompare, no Intl.Collator (五禁④).
// Import rule: only zod (not used here) + local types; grep packages/core/engine → 0 hits.
// ─── Codepoint comparator (deterministic — no localeCompare / Intl) ───────────
function cmpCodePoint(a, b) {
    const aArr = [...a];
    const bArr = [...b];
    const len = Math.min(aArr.length, bArr.length);
    for (let i = 0; i < len; i++) {
        const ca = aArr[i].codePointAt(0);
        const cb = bArr[i].codePointAt(0);
        if (ca !== cb)
            return ca - cb;
    }
    return aArr.length - bArr.length;
}
function sortCP(arr) {
    return [...arr].sort(cmpCodePoint);
}
function preScan(registry, knownKeys) {
    const adj = new Map();
    const selfLoops = new Set();
    const danglingDeps = new Set();
    for (const key of knownKeys) {
        adj.set(key, []);
    }
    for (const [key, entry] of Object.entries(registry)) {
        for (const dep of entry.依赖) {
            if (dep === key) {
                selfLoops.add(key);
                // Self-loops: detected separately, not added as graph edge.
                continue;
            }
            if (!knownKeys.has(dep)) {
                danglingDeps.add(dep);
                // Dangling: record target, build no edge.
                continue;
            }
            adj.get(key).push(dep);
        }
    }
    // Sort each adjacency list by codepoint for deterministic DFS order.
    for (const [k, neighbors] of adj) {
        adj.set(k, sortCP(neighbors));
    }
    return { adj, selfLoops, danglingDeps };
}
function tarjanSCC(nodes, adj) {
    const indexMap = new Map();
    const lowlink = new Map();
    const onStack = new Map();
    const sccStack = [];
    const sccs = [];
    let counter = 0;
    for (const start of nodes) {
        if (indexMap.has(start))
            continue;
        const callStack = [];
        indexMap.set(start, counter);
        lowlink.set(start, counter);
        counter++;
        sccStack.push(start);
        onStack.set(start, true);
        callStack.push({ node: start, neighborIdx: 0 });
        while (callStack.length > 0) {
            const frame = callStack[callStack.length - 1];
            const { node } = frame;
            const neighbors = adj.get(node) ?? [];
            if (frame.neighborIdx < neighbors.length) {
                const w = neighbors[frame.neighborIdx];
                frame.neighborIdx++;
                if (!indexMap.has(w)) {
                    // Tree edge — visit w
                    indexMap.set(w, counter);
                    lowlink.set(w, counter);
                    counter++;
                    sccStack.push(w);
                    onStack.set(w, true);
                    callStack.push({ node: w, neighborIdx: 0 });
                }
                else if (onStack.get(w) === true) {
                    // Back edge — update lowlink with w's index (not lowlink)
                    const cur = lowlink.get(node);
                    const wIdx = indexMap.get(w);
                    if (wIdx < cur)
                        lowlink.set(node, wIdx);
                }
                // Cross/forward edge (w visited, not on stack): skip — already in another SCC.
            }
            else {
                // All neighbors processed — pop frame.
                callStack.pop();
                if (callStack.length > 0) {
                    // Propagate lowlink to parent (tree-edge update).
                    const parent = callStack[callStack.length - 1].node;
                    const parentLow = lowlink.get(parent);
                    const nodeLow = lowlink.get(node);
                    if (nodeLow < parentLow)
                        lowlink.set(parent, nodeLow);
                }
                // If node is SCC root, pop the SCC off sccStack.
                if (lowlink.get(node) === indexMap.get(node)) {
                    const scc = [];
                    for (;;) {
                        const w = sccStack.pop();
                        onStack.set(w, false);
                        scc.push(w);
                        if (w === node)
                            break;
                    }
                    sccs.push(scc);
                }
            }
        }
    }
    return sccs;
}
// ─── Main exported function ───────────────────────────────────────────────────
export function buildModGraph(registry) {
    const knownKeys = new Set(Object.keys(registry));
    // Deterministic DFS entry order: codepoint sort.
    const nodes = sortCP([...knownKeys]);
    const { adj, selfLoops, danglingDeps } = preScan(registry, knownKeys);
    const rawSccs = tarjanSCC(nodes, adj);
    // Sort within each SCC by codepoint; sort groups by their min key.
    const sccs = rawSccs
        .map(scc => sortCP(scc))
        .sort((a, b) => cmpCodePoint(a[0], b[0]));
    const cycles = sccs.filter(scc => scc.length > 1);
    return {
        sccs,
        selfLoops: sortCP([...selfLoops]),
        cycles,
        danglingDeps: sortCP([...danglingDeps]),
    };
}
// ─── Internal helpers ─────────────────────────────────────────────────────────
function effectiveId(key, entry) {
    return entry.pack_id ?? key;
}
function isEnabled(entry) {
    return entry.启用 !== false;
}
function entryPriority(entry) {
    return entry.优先级 ?? 0;
}
// ─── computeLoadOrder ─────────────────────────────────────────────────────────
export function computeLoadOrder(registry) {
    // ── 1. Full graph for diagnostics (includes disabled + self-loops) ──────────
    const graph = buildModGraph(registry);
    // ── 2. Classify disabled / enabled ─────────────────────────────────────────
    const disabledSet = new Set();
    const enabledSet = new Set();
    for (const [key, entry] of Object.entries(registry)) {
        if (isEnabled(entry))
            enabledSet.add(key);
        else
            disabledSet.add(key);
    }
    // ── 3. Initial rejected = enabled self-loops (disabled self-loops are moot) ─
    //    Self-loop detection uses the full registry result, so filter to enabled.
    const rejectedSet = new Set(graph.selfLoops.filter(k => enabledSet.has(k)));
    // ── 4. Cascade: enabled nodes whose 依赖 include a rejected key → also rejected
    //    Iterate until stable (BFS-style fixpoint).
    //    Note: disabled deps do NOT cascade (decision D).
    let changed = true;
    while (changed) {
        changed = false;
        for (const key of enabledSet) {
            if (rejectedSet.has(key))
                continue;
            const entry = registry[key];
            if (entry === undefined)
                continue;
            for (const dep of entry.依赖) {
                if (rejectedSet.has(dep)) {
                    rejectedSet.add(key);
                    changed = true;
                    break;
                }
            }
        }
    }
    // ── 5. Active = enabled AND not rejected ────────────────────────────────────
    const activeKeys = new Set([...enabledSet].filter(k => !rejectedSet.has(k)));
    // ── 6. Build active sub-registry (deps filtered to active-only) ─────────────
    //    Re-running buildModGraph on the active subgraph gives correct SCCs even when
    //    removing disabled/rejected nodes breaks original SCC boundaries.
    const activeRegistry = {};
    for (const key of activeKeys) {
        const entry = registry[key];
        activeRegistry[key] = {
            ...entry,
            依赖: entry.依赖.filter(d => activeKeys.has(d)),
        };
    }
    const activeGraph = buildModGraph(activeRegistry);
    // ── 7. Build node → SCC-index map ──────────────────────────────────────────
    const nodeToSCC = new Map();
    for (let i = 0; i < activeGraph.sccs.length; i++) {
        for (const key of activeGraph.sccs[i]) {
            nodeToSCC.set(key, i);
        }
    }
    // ── 8. Build condensation DAG adjacency (SCC-index → Set<SCC-index>) ────────
    //
    // Edge direction for Kahn: dep → depender ("dep must come before depender").
    // In the dep graph edge key→dep means "key depends on dep" (dep loads first).
    // For Kahn we need dep's SCC to point TO key's SCC: dagAdj[toIdx].add(fromIdx).
    const n = activeGraph.sccs.length;
    const dagAdj = Array.from({ length: n }, () => new Set());
    for (const [key, entry] of Object.entries(activeRegistry)) {
        const fromIdx = nodeToSCC.get(key);
        for (const dep of entry.依赖) {
            const toIdx = nodeToSCC.get(dep);
            if (toIdx !== undefined && toIdx !== fromIdx) {
                // dep's SCC must load before key's SCC → Kahn edge: toIdx → fromIdx.
                dagAdj[toIdx].add(fromIdx);
            }
        }
    }
    // ── 9. Kahn on condensation DAG (decision B) ─────────────────────────────────
    //    Tie-break: (max 优先级 of members ASC, min record-key of members ASC)
    //    → lower priority loads first; equal priority → codepoint of min key asc.
    function sccSortKey(idx) {
        const members = activeGraph.sccs[idx];
        let maxPri = 0;
        for (const m of members) {
            const p = entryPriority(registry[m] ?? { 依赖: [] });
            if (p > maxPri)
                maxPri = p;
        }
        // members already sorted by codepoint in buildModGraph → members[0] is the min key.
        return { pri: maxPri, minKey: members[0] };
    }
    function cmpSCCKey(a, b) {
        const ka = sccSortKey(a);
        const kb = sccSortKey(b);
        if (ka.pri !== kb.pri)
            return ka.pri - kb.pri;
        return cmpCodePoint(ka.minKey, kb.minKey);
    }
    const inDegree = new Array(n).fill(0);
    for (let from = 0; from < n; from++) {
        for (const to of dagAdj[from]) {
            inDegree[to]++;
        }
    }
    // Deterministic queue: always kept sorted.
    const queue = [];
    for (let i = 0; i < n; i++) {
        if (inDegree[i] === 0)
            queue.push(i);
    }
    queue.sort(cmpSCCKey);
    const topoOrder = [];
    while (queue.length > 0) {
        const current = queue.shift();
        topoOrder.push(current);
        const newlyZero = [];
        for (const neighbor of dagAdj[current]) {
            inDegree[neighbor]--;
            if (inDegree[neighbor] === 0)
                newlyZero.push(neighbor);
        }
        if (newlyZero.length > 0) {
            newlyZero.sort(cmpSCCKey);
            // Merge into sorted queue (both halves are sorted; insertion-sort small batches is fine).
            for (const idx of newlyZero) {
                let lo = 0, hi = queue.length;
                while (lo < hi) {
                    const mid = (lo + hi) >>> 1;
                    if (cmpSCCKey(queue[mid], idx) <= 0)
                        lo = mid + 1;
                    else
                        hi = mid;
                }
                queue.splice(lo, 0, idx);
            }
        }
    }
    // ── 10. Flatten result ───────────────────────────────────────────────────────
    const orderedGroups = topoOrder.map(i => activeGraph.sccs[i]);
    const flattenedLoadOrder = orderedGroups.flat();
    // ── 11. Conflict detection (decision C: after topo sort) ─────────────────────
    //    Build effectiveId → record_key map for active mods (decision E).
    //    If pack_id is absent, effectiveId == record_key.
    const effectiveIdToKey = new Map();
    for (const key of activeKeys) {
        const entry = registry[key];
        const eid = effectiveId(key, entry);
        effectiveIdToKey.set(eid, key);
    }
    const seenPairs = new Set();
    const conflicts = [];
    for (const key of flattenedLoadOrder) {
        const entry = registry[key];
        for (const cid of (entry.冲突 ?? [])) {
            const otherKey = effectiveIdToKey.get(cid);
            if (otherKey === undefined || otherKey === key)
                continue;
            // Canonical pair: codepoint-smaller key is always `a`.
            const [a, b] = cmpCodePoint(key, otherKey) < 0 ? [key, otherKey] : [otherKey, key];
            const pairId = `${a}\x00${b}`;
            if (!seenPairs.has(pairId)) {
                seenPairs.add(pairId);
                conflicts.push({ a: a, b: b });
            }
        }
    }
    conflicts.sort((x, y) => {
        const d = cmpCodePoint(x.a, y.a);
        return d !== 0 ? d : cmpCodePoint(x.b, y.b);
    });
    return {
        flattenedLoadOrder,
        orderedGroups,
        rejected: sortCP([...rejectedSet]),
        disabled: sortCP([...disabledSet]),
        conflicts,
        graph,
    };
}
// ─── Assert helpers (defined here; Step 3 will call these at wiring time) ─────
export function assertNoSelfLoops(result) {
    if (result.selfLoops.length > 0) {
        throw new Error(`K1: mod 自环检出 [${result.selfLoops.join(', ')}]，导入被拒绝`);
    }
}
export function assertAcyclic(result) {
    if (result.cycles.length > 0) {
        const desc = result.cycles
            .map(c => `[${c.join(' → ')}]`)
            .join(', ');
        throw new Error(`K1: mod 依赖环检出 ${desc}，导入被拒绝`);
    }
}
export function assertNoConflicts(result) {
    if (result.conflicts.length > 0) {
        const desc = result.conflicts.map(p => `(${p.a}, ${p.b})`).join(', ');
        throw new Error(`K1: mod 冲突检出 ${desc}，导入被拒绝`);
    }
}
