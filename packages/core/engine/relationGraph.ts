// relationGraph.ts — G1b 装配期关系图自动补全（确定性 seeded · 宿主无关）
//
// 策略：共址 + 组织隶属分桶 → 候选成对 → 强度叠加 → seeded 抖动 → 度数裁剪 → 写入 NPC.关系[]
// 确定性：同 (worldSeed, presetVersion) 两跑边集逐位恒等。
// 性能：仅同桶内配对，禁全量 O(n²) 跨桶。
// additive-only：不覆盖已有 NPC.关系[] 条目·不新增 schema 顶层键。
import type { RootState } from '../schema/index.js';
import { rngFor } from './rng.js';
import { resolveFormula, type FormulaResolveConfig } from './formulaRegistry.js';

// ── 装配期边权常量 ────────────────────────────────────────────────────────────
export const COLOC_BASE          = 30;  // 共址基底强度贡献
export const ORG_BONUS           = 30;  // 同组织叠加增量（共址+组织 = 60 ≥ Phase6 阈值 50）
export const JITTER_MAX          = 10;  // seeded 抖动上限（[0, JITTER_MAX]·仅共址 max=40 < 50）
export const REL_TRUST           = 100; // 装配期生成边信任度（共址/共组织→最大信任）
export const MAX_RELATION_DEGREE = 10;  // 每 NPC 最大关系边数（超出按强度降序确定性裁剪）

/** 正典无向端点对键（NPC 键字典序小的在前·null-byte 分隔·防碰撞） */
function pairKey(a: string, b: string): string {
  return a < b ? `${a}\x00${b}` : `${b}\x00${a}`;
}

interface PairEntry {
  a: string;         // 字典序较小端
  b: string;         // 字典序较大端
  colocated: boolean;
  sameOrg:   boolean;
}

/**
 * 装配期关系图自动补全。
 *
 * 输入：world state（NPC 集合 + 组织隶属）。
 * 输出：原地写入 NPC.关系[]（additive-only·不覆盖已有边·返回同一 state 引用）。
 *
 * 退化：NPC < 2 / 无共址 / 无共组织 → 零边，state 不变。
 */
export function autoCompleteRelations(
  state:         RootState,
  worldSeed:     number,
  presetVersion: number = 0,
  formulaConfig?: FormulaResolveConfig,
): RootState {
  const _colocBase  = resolveFormula('rel_coloc_base',    formulaConfig);
  const _orgBonus   = resolveFormula('rel_org_bonus',     formulaConfig);
  const _jitterMax  = resolveFormula('rel_jitter_max',    formulaConfig);
  const _relTrust   = resolveFormula('rel_trust',         formulaConfig);
  const _maxDegree  = resolveFormula('rel_max_degree',    formulaConfig);
  const _depthDef   = resolveFormula('rel_depth_default', formulaConfig);
  const npcEntries = Object.entries(state.NPC);
  if (npcEntries.length < 2) return state;

  // ── 1. 共址桶（按位置键分组）──
  const locBuckets = new Map<string, string[]>();
  for (const [key, npc] of npcEntries) {
    if (npc.存活状态 === '已故') continue; // §八-②: 死者不中继·既有边由调用方保留
    if (!npc.位置) continue;
    const b = locBuckets.get(npc.位置) ?? [];
    locBuckets.set(npc.位置, b);
    b.push(key);
  }

  // ── 2. 组织桶（按组织键分组·同 NPC 可属多个组织）──
  const orgBuckets = new Map<string, string[]>();
  for (const [key, npc] of npcEntries) {
    if (npc.存活状态 === '已故') continue; // §八-②
    for (const m of npc.所属组织) {
      if (!m.组织键) continue;
      // §九: 幽灵节点（占位形态=有）→ 不进传播/不计票；已解散 → 停中继
      const org = state.组织实体?.[m.组织键];
      if (org?.占位形态) continue;         // 潜在节点：§九 悬空防护
      if (org?.状态 === '已解散') continue; // 已解散：§九 停中继（隶属边保留在 组织关系网）
      const b = orgBuckets.get(m.组织键) ?? [];
      orgBuckets.set(m.组织键, b);
      b.push(key);
    }
  }

  // ── 3. 候选对（同桶内配对·正典序去重）──
  const candidates = new Map<string, PairEntry>();

  for (const bucket of locBuckets.values()) {
    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        const [ai, bi] = [bucket[i]!, bucket[j]!];
        const pk = pairKey(ai, bi);
        const entry = candidates.get(pk)
          ?? { a: ai < bi ? ai : bi, b: ai < bi ? bi : ai, colocated: false, sameOrg: false };
        entry.colocated = true;
        candidates.set(pk, entry);
      }
    }
  }

  for (const bucket of orgBuckets.values()) {
    const unique = [...new Set(bucket)];
    for (let i = 0; i < unique.length; i++) {
      for (let j = i + 1; j < unique.length; j++) {
        const [ai, bi] = [unique[i]!, unique[j]!];
        const pk = pairKey(ai, bi);
        const entry = candidates.get(pk)
          ?? { a: ai < bi ? ai : bi, b: ai < bi ? bi : ai, colocated: false, sameOrg: false };
        entry.sameOrg = true;
        candidates.set(pk, entry);
      }
    }
  }

  if (candidates.size === 0) return state;

  // ── 4. 计算强度 + seeded 抖动 ──
  type Edge = { a: string; b: string; strength: number; 类型: string; pk: string };
  const edges: Edge[] = [];

  for (const [pk, { a, b, colocated, sameOrg }] of candidates) {
    let strength = 0;
    if (colocated) strength += _colocBase;
    if (sameOrg)   strength += _orgBonus;
    // seeded 抖动：channel = 装配:关系:<正典对键>，tick=0(装配期哨兵)，salt=presetVersion
    const roll   = rngFor(worldSeed, 0, `装配:关系:${pk}`, presetVersion);
    const jitter = Math.round((roll / 99) * _jitterMax);
    strength     = Math.min(100, strength + jitter);
    if (strength <= 0) continue;
    edges.push({ a, b, strength, 类型: sameOrg ? '组织同袍' : '共处', pk });
  }

  if (edges.length === 0) return state;

  // ── 5. 度数上限裁剪（强度降序·正典对键升序稳定决胜） ──
  edges.sort((x, y) =>
    y.strength !== x.strength ? y.strength - x.strength
    : x.pk < y.pk ? -1 : x.pk > y.pk ? 1 : 0,
  );

  const degree     = new Map<string, number>();
  const finalEdges: Edge[] = [];
  for (const edge of edges) {
    const da = degree.get(edge.a) ?? 0;
    const db = degree.get(edge.b) ?? 0;
    if (da >= _maxDegree || db >= _maxDegree) continue;
    finalEdges.push(edge);
    degree.set(edge.a, da + 1);
    degree.set(edge.b, db + 1);
  }

  // ── 6. Additive 写入 NPC.关系[]（不覆盖已有边） ──
  for (const { a, b, strength, 类型 } of finalEdges) {
    const npcA = state.NPC[a];
    const npcB = state.NPC[b];
    const base = { 类型, 强度: strength, 极性: '中', 信任: _relTrust, 深度: Math.round(_depthDef) };
    if (npcA && !npcA.关系.some(r => r.对象键 === b)) {
      npcA.关系.push({ 对象键: b, ...base });
    }
    if (npcB && !npcB.关系.some(r => r.对象键 === a)) {
      npcB.关系.push({ 对象键: a, ...base });
    }
  }

  return state;
}
