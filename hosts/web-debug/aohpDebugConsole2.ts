// G1b3b · AOHP 调试控制台 · 锦上添花批
//
// 功能 1-2, 7（C1: POV切换 + 关系网拓扑图 + PC面板/状态树/地图缩略图）
// 功能 3-6（C2: 全局快照 + 增量视图 + 动作序列回放 + 快照比对）
//
// 铁律:
//   - 全部代码落 web-debug 宿主层，不进指纹，core 宿主无关
//   - core 函数体零改动（runTick / filterSecretsForPOV / 等只调用）
//   - 对 state 只读 + 经合法 API 驱动；不在 UI 层私写 core state
//   - 黄金向量/指纹84/schemaKeys52 全恒等；tsc/lint 新增 0；test 净增
//   - 禁 Date.now / Math.random / localeCompare / 裸 JSON.stringify（判定面）
//   - exactOptionalPropertyTypes=true: optional 字段条件展开

import type { RootState } from '@ai-life-sim/core';
import { runTick } from '@ai-life-sim/core/engine/tick';
import {
  filterSecretsForPOV,
  type VisibleSecret,
} from '@ai-life-sim/core/engine/knowledgeFilter';

import { PHASE6_THRESHOLD, type TickDiffResult } from './aohpDebugConsole.js';

// ── 功能 1: NPC 视角（POV）切换 ──────────────────────────────────────────────────

export type { VisibleSecret };

export interface PovInspectResult {
  povEntityKey: string;
  /** filterSecretsForPOV 可见集（existence-opaque·非知情方条目完全不出现） */
  visibleSecrets: Record<string, VisibleSecret>;
  visibleSecretIds: string[];
  /** 总秘密数 - 可见数 = 不可见（非 knowledge 方·连存在都不可见） */
  hiddenSecretCount: number;
  /** 该 POV 实体在认知档案里能观察到的目标集 */
  cognitiveTargetKeys: string[];
  /** 认知档案 observer 投影：key→ {了解度, 印象数} */
  cognitiveProjection: Record<string, { 了解度: number; impressionCount: number }>;
}

export interface PovCompareResult {
  entityA: string;
  entityB: string;
  /** 只有 A 可见的 secret ID（covert gate 控制） */
  onlyA: string[];
  /** 只有 B 可见的 secret ID */
  onlyB: string[];
  /** A 和 B 都可见的 secret ID */
  both: string[];
  /** A 的认知目标中 B 没有认知条目的 key set */
  cognitiveOnlyA: string[];
  cognitiveOnlyB: string[];
}

/**
 * POV 检视 — 经 filterSecretsForPOV 返回可见秘密集 + 认知档案投影。
 *
 * existence-opaque：非知情方连秘密存在性都不可见（结果中完全不出现）。
 * 并排对比请用 comparePOVs。
 */
export function povInspect(state: RootState, povEntityKey: string): PovInspectResult {
  const secrets = state.全局?.秘密库 ?? {};
  const visible = filterSecretsForPOV(secrets, povEntityKey);
  const allCount = Object.keys(secrets).length;

  const archiveByPov = state.认知档案?.[povEntityKey] ?? {};
  const cognitiveProjection: Record<string, { 了解度: number; impressionCount: number }> = {};
  for (const [tgt, entry] of Object.entries(archiveByPov)) {
    cognitiveProjection[tgt] = {
      了解度: entry.了解度,
      impressionCount: entry.印象.length,
    };
  }

  return {
    povEntityKey,
    visibleSecrets: visible,
    visibleSecretIds: Object.keys(visible),
    hiddenSecretCount: allCount - Object.keys(visible).length,
    cognitiveTargetKeys: Object.keys(archiveByPov),
    cognitiveProjection,
  };
}

/**
 * 并排对比两个 POV 看同一世界的差异（fact / 认知档案交集）。
 *
 * 用途：直观验证 access/covert gate（covert secret 只对持门者可见）。
 */
export function comparePOVs(
  state: RootState,
  entityA: string,
  entityB: string,
): PovCompareResult {
  const secrets = state.全局?.秘密库 ?? {};
  const visA = filterSecretsForPOV(secrets, entityA);
  const visB = filterSecretsForPOV(secrets, entityB);
  const aIds = new Set(Object.keys(visA));
  const bIds = new Set(Object.keys(visB));

  const archiveA = state.认知档案?.[entityA] ?? {};
  const archiveB = state.认知档案?.[entityB] ?? {};
  const aTargets = new Set(Object.keys(archiveA));
  const bTargets = new Set(Object.keys(archiveB));

  return {
    entityA,
    entityB,
    onlyA: [...aIds].filter(id => !bIds.has(id)),
    onlyB: [...bIds].filter(id => !aIds.has(id)),
    both:  [...aIds].filter(id =>  bIds.has(id)),
    cognitiveOnlyA: [...aTargets].filter(k => !bTargets.has(k)),
    cognitiveOnlyB: [...bTargets].filter(k => !aTargets.has(k)),
  };
}

// ── 功能 2: 关系网拓扑图 ───────────────────────────────────────────────────────────

export interface RelationNode {
  key: string;
  name: string;
  /** NPC.位置 */
  location?: string;
  /** NPC.所属组织[].组织键 */
  orgKeys: string[];
  /**
   * 聚簇键：优先取第一个组织键（组织同袍边→组织聚簇）；无组织则取位置键；
   * 均无则退回 NPC 自身键（孤立节点）。
   */
  cluster: string;
}

export interface RelationEdge {
  from: string;
  to: string;
  strength: number;
  trust: number;
  /** |strength| × (trust / 100)，与 PHASE6_THRESHOLD 对比 */
  score: number;
  type: string;
  /** score >= PHASE6_THRESHOLD → 涟漪可触发边，高亮显示 */
  isHighlighted: boolean;
}

export interface RelationGraph {
  nodes: RelationNode[];
  /** 无向边（已去重·正则对键） */
  edges: RelationEdge[];
  highlightedEdgeCount: number;
  weakEdgeCount: number;
}

/**
 * 从 state.NPC[*].关系[] 构建关系网拓扑图。
 *
 * - score ≥ PHASE6_THRESHOLD → isHighlighted=true（涟漪可触发边）
 * - score < PHASE6_THRESHOLD → 弱边（淡显）
 * - 无向图去重：正则对键（字典序小的在前）防止同一边出现两次
 * - 不使用 localeCompare（确定性六禁）
 */
export function buildRelationGraph(state: RootState): RelationGraph {
  const nodes: RelationNode[] = [];
  const edgesMap = new Map<string, RelationEdge>();

  for (const [key, npc] of Object.entries(state.NPC)) {
    const orgKeys = npc.所属组织
      .map(o => o.组织键)
      .filter((k): k is string => !!k);
    nodes.push({
      key,
      name: npc.姓名,
      ...(npc.位置 ? { location: npc.位置 } : {}),
      orgKeys,
      cluster: orgKeys[0] ?? npc.位置 ?? key,
    });

    for (const rel of npc.关系) {
      if (!rel.对象键) continue;
      // 正则对键：ASCII 字符比较（不用 localeCompare）
      const a = key   < rel.对象键 ? key         : rel.对象键;
      const b = key   < rel.对象键 ? rel.对象键  : key;
      const pairKey = `${a}\x00${b}`;
      if (!edgesMap.has(pairKey)) {
        const score = Math.abs(rel.强度) * (rel.信任 / 100);
        edgesMap.set(pairKey, {
          from: key,
          to: rel.对象键,
          strength: rel.强度,
          trust: rel.信任,
          score,
          type: rel.类型,
          isHighlighted: score >= PHASE6_THRESHOLD,
        });
      }
    }
  }

  const edges = [...edgesMap.values()];
  return {
    nodes,
    edges,
    highlightedEdgeCount: edges.filter(e => e.isHighlighted).length,
    weakEdgeCount:         edges.filter(e => !e.isHighlighted).length,
  };
}

// ── 功能 7: 主角状态面板 ──────────────────────────────────────────────────────────

export interface PCPanel {
  pcKey: string;
  name: string;
  location?: string;
  /** NPC.属性 快照 */
  attributes: {
    体质: number;
    智慧: number;
    感知: number;
    魅力: number;
    心理: number;
  };
  hp: number;
  hpMax: number;
  energy: number;
  energyMax: number;
  /** pcKey 的货币账户（货币→数量） */
  currencies: Record<string, number>;
  relationsCount: number;
  /** 认知档案里以 pcKey 为观察者的目标数 */
  cognitiveTargets: number;
  /** 秘密库中 pcKey 在知情名单的 secret ID 列表 */
  knownSecretIds: string[];
}

/**
 * 主角状态面板 — 关键状态字段的高密度摘要。
 *
 * 只读：不修改 state；不调用 Date.now / Math.random。
 */
export function buildPCPanel(state: RootState, pcKey: string): PCPanel {
  const npc = state.NPC[pcKey];
  if (!npc) throw new Error(`[buildPCPanel] '${pcKey}' 不在 state.NPC`);

  const currencies: Record<string, number> = {};
  const acct = state.货币系统?.账户?.[pcKey];
  if (acct) {
    for (const [ccy, amt] of Object.entries(acct.持有)) {
      currencies[ccy] = amt;
    }
  }

  const archiveByPc = state.认知档案?.[pcKey] ?? {};
  const knownSecretIds: string[] = [];
  for (const [id, secret] of Object.entries(state.全局?.秘密库 ?? {})) {
    if (secret.知情名单.some(e => e.对象 === pcKey)) {
      knownSecretIds.push(id);
    }
  }

  return {
    pcKey,
    name: npc.姓名,
    ...(npc.位置 ? { location: npc.位置 } : {}),
    attributes: {
      体质: npc.属性.体质,
      智慧: npc.属性.智慧,
      感知: npc.属性.感知,
      魅力: npc.属性.魅力,
      心理: npc.属性.心理,
    },
    hp:         npc.派生.HP,
    hpMax:      npc.派生.HP上限,
    energy:     npc.派生.精力,
    energyMax:  npc.派生.精力上限,
    currencies,
    relationsCount:   npc.关系.length,
    cognitiveTargets: Object.keys(archiveByPc).length,
    knownSecretIds,
  };
}

// ── 功能 7: 状态树总览 ────────────────────────────────────────────────────────────

export interface StateTreeNode {
  label: string;
  value?: string | number | boolean;
  children?: StateTreeNode[];
  /** true = UI 默认折叠 */
  collapsed?: boolean;
}

/**
 * 可折叠状态树 — 世界状态结构化概览。
 *
 * 不做 deep stringify（确定性六禁之「裸 JSON.stringify」仅限判定面；
 * 此处为显示层·仅用 label 字符串·安全）。
 */
export function buildStateTree(state: RootState): StateTreeNode {
  const npcEntries = Object.entries(state.NPC);
  const archive    = state.认知档案 ?? {};
  const secrets    = state.全局?.秘密库 ?? {};
  const locations  = state.地图?.地点 ?? {};
  const accounts   = state.货币系统?.账户 ?? {};

  return {
    label: '世界状态',
    children: [
      {
        label: `拍号: ${state._tick?.拍计数 ?? 0}`,
        value: state._tick?.拍计数 ?? 0,
      },
      {
        label: `NPC (${npcEntries.length})`,
        collapsed: false,
        children: npcEntries.map(([key, npc]) => ({
          label: `${key} · ${npc.姓名}`,
          collapsed: true,
          children: [
            { label: `位置: ${npc.位置 || '—'}` },
            { label: `关系边: ${npc.关系.length}` },
            { label: `HP: ${npc.派生.HP} / ${npc.派生.HP上限}` },
            { label: `精力: ${npc.派生.精力} / ${npc.派生.精力上限}` },
            {
              label: `所属组织: ${npc.所属组织.map(o => o.组织键).join(', ') || '无'}`,
            },
          ],
        })),
      },
      {
        label: `地图 (${Object.keys(locations).length} 地点)`,
        collapsed: true,
        children: Object.entries(locations).map(([k, loc]) => ({
          label: `${k}: ${loc.名称} [${loc.类别}·${loc.大小}]`,
        })),
      },
      {
        label: `认知档案 (${Object.keys(archive).length} 观察者)`,
        collapsed: true,
        children: Object.entries(archive).map(([obs, targets]) => ({
          label: `${obs} → ${Object.keys(targets).length} 目标`,
          collapsed: true,
          children: Object.entries(targets).map(([tgt, entry]) => ({
            label: `${tgt}: 了解度=${entry.了解度} 印象=${entry.印象.length}条`,
          })),
        })),
      },
      {
        label: `秘密库 (${Object.keys(secrets).length})`,
        collapsed: true,
        children: Object.entries(secrets).map(([id, s]) => ({
          label: `${id}: 母题=${s.母题} 暴露度=${s.暴露度} 知情×${s.知情名单.length}`,
        })),
      },
      {
        label: '货币系统',
        collapsed: false,
        children: Object.entries(accounts).map(([entity, acct]) => ({
          label: `${entity}: ${
            Object.entries(acct.持有)
              .map(([c, a]) => `${a}${c}`)
              .join(', ')
          }`,
        })),
      },
    ],
  };
}

// ── 功能 7: 地图缩略图 ────────────────────────────────────────────────────────────

export interface MapLocationEntry {
  key: string;
  name: string;
  category: string;
  size: string;
  npcCount: number;
  /**
   * LOD 状态字段 LOD调度器 待 G7 实装。
   * 'placeholder' = 灰显占位，不伪造已有 LOD 数据。
   */
  lodStatus: 'placeholder';
}

export interface MapThumbnail {
  locations: MapLocationEntry[];
  totalLocations: number;
  /**
   * LOD 调度器系统状态 — G7 前一律 'NOT_IMPLEMENTED'（灰显占位）。
   * 调用方不得读此值做任何判定；仅供调试面板显示。
   */
  lodSystemStatus: 'NOT_IMPLEMENTED';
}

/**
 * 地图缩略图 — 渲染 map.ts 区域 + LOD 状态灰显占位（LOD 待 G7）。
 *
 * npcCount = 当前 tick 内各地点的 NPC 数（从 NPC.位置 统计）。
 * LOD 字段 lodStatus='placeholder'：明确标注未实现，不假装已有。
 */
export function buildMapThumbnail(state: RootState): MapThumbnail {
  const locations = state.地图?.地点 ?? {};
  const npcsByLoc = new Map<string, number>();
  for (const npc of Object.values(state.NPC)) {
    if (npc.位置) {
      npcsByLoc.set(npc.位置, (npcsByLoc.get(npc.位置) ?? 0) + 1);
    }
  }

  return {
    locations: Object.entries(locations).map(([key, loc]) => ({
      key,
      name:     loc.名称,
      category: loc.类别,
      size:     loc.大小,
      npcCount: npcsByLoc.get(key) ?? 0,
      lodStatus: 'placeholder' as const,
    })),
    totalLocations:  Object.keys(locations).length,
    lodSystemStatus: 'NOT_IMPLEMENTED' as const,
  };
}

// ── 功能 3: 全局状态快照 ──────────────────────────────────────────────────────────

export interface StateSnapshot {
  /** 快照标签（用户传入） */
  label: string;
  tickCount: number;
  /** 供显示的世界时间字符串 */
  worldTime: string;
  npcCount: number;
  locationCount: number;
  secretCount: number;
  totalRelationEdges: number;
  highlightedRelationEdges: number;
  /** $涟漪候选 顶层 key 数（调试读数·$-层 AI 不可见·此处仅统计数量） */
  rippleCandidateTargets: number;
  cognitiveObserverCount: number;
  totalCognitiveImpressions: number;
  /** 货币账户快照 entity → { currency → amount } */
  currencyAccounts: Record<string, Record<string, number>>;
  /** $meta 渲染参数（不进指纹·不进存档·叙事回放用） */
  $metaRenderParams?: { narrativePerson: string; narrativeStyle: string };
}

/**
 * 全局状态快照 — 将当前 state 关键字段序列化为可读快照。
 *
 * 用于: 保存至 SnapshotStore / 两拍之间 diff / 回放后验证。
 */
export function takeStateSnapshot(state: RootState, label: string = 'snapshot'): StateSnapshot {
  const graph     = buildRelationGraph(state);
  const archive   = state.认知档案 ?? {};
  const tickCount = state._tick?.拍计数 ?? 0;
  const worldTime = `纪元第${tickCount * 30}日（第${tickCount + 1}拍）`;

  let totalImpressions = 0;
  for (const targetMap of Object.values(archive)) {
    for (const entry of Object.values(targetMap)) {
      totalImpressions += entry.印象.length;
    }
  }

  const rippleCandidates = (state as unknown as Record<string, unknown>)['$涟漪候选'];
  const rippleCandidateTargets =
    rippleCandidates && typeof rippleCandidates === 'object'
      ? Object.keys(rippleCandidates).length
      : 0;

  const currencyAccounts: Record<string, Record<string, number>> = {};
  for (const [entity, acct] of Object.entries(state.货币系统?.账户 ?? {})) {
    currencyAccounts[entity] = { ...acct.持有 };
  }

  return {
    label,
    tickCount,
    worldTime,
    npcCount:                  Object.keys(state.NPC).length,
    locationCount:             Object.keys(state.地图?.地点 ?? {}).length,
    secretCount:               Object.keys(state.全局?.秘密库 ?? {}).length,
    totalRelationEdges:        graph.edges.length,
    highlightedRelationEdges:  graph.highlightedEdgeCount,
    rippleCandidateTargets,
    cognitiveObserverCount:    Object.keys(archive).length,
    totalCognitiveImpressions: totalImpressions,
    currencyAccounts,
  };
}

// ── 功能 4: 增量视图 ──────────────────────────────────────────────────────────────

export interface TimelineEntry {
  tickId: string;
  cognitiveChangesCount: number;
  /** cognitiveChanges 中 isNew=true 的数量（首次写入的印象条目） */
  newImpressions: number;
  /** cognitiveChanges 中 isNew=false 的数量（强度增加条目） */
  strengthIncreases: number;
  relationHitsCount: number;
  resourceChangesCount: number;
  /** 本拍变化摘要（无变化时显示「本拍无变化」） */
  summary: string;
}

/**
 * 增量视图 — 将 TickDiffResult[] 聚合成「本拍发生了什么」时间线。
 *
 * 复用 G1b3a runTickWithDiff 已有 diff 结构，避免重写。
 */
export function buildIncrementalView(diffs: TickDiffResult[]): TimelineEntry[] {
  return diffs.map(d => {
    const newImpressions   = d.cognitiveChanges.filter(c =>  c.isNew).length;
    const strengthIncrease = d.cognitiveChanges.filter(c => !c.isNew).length;
    const parts: string[] = [];
    if (d.cognitiveChanges.length > 0)
      parts.push(`认知变更×${d.cognitiveChanges.length}`);
    if (d.relationHits.length > 0)
      parts.push(`关系触发×${d.relationHits.length}`);
    if (d.resourceChanges.length > 0)
      parts.push(`资源变化×${d.resourceChanges.length}`);

    return {
      tickId:               d.tickId,
      cognitiveChangesCount: d.cognitiveChanges.length,
      newImpressions,
      strengthIncreases:    strengthIncrease,
      relationHitsCount:    d.relationHits.length,
      resourceChangesCount: d.resourceChanges.length,
      summary:              parts.length > 0 ? parts.join(' · ') : '（本拍无变化）',
    };
  });
}

// ── 功能 5: 动作序列记录与回放 ───────────────────────────────────────────────────────

export interface RecordedAction {
  /** 记录时的拍计数 */
  tickCount: number;
  /** 玩家选择的 option_id */
  optionId: string;
  /** 对应 tick 的 tickId（格式 debug:rec:<seed>:tick:<n>） */
  tickId: string;
}

export interface ReplaySequence {
  seed: number;
  actions: RecordedAction[];
}

/**
 * 动作序列记录器 — 记录 option_id 序列 + 起始 seed；
 * replay() 重放产出逐位恒等 state（同序列 + 同 seed → 同 state）。
 *
 * 确定性保证：tickId = `debug:rec:<seed>:tick:<n>`，n = 记录时的拍计数。
 * 物理隔离：不调用 Date.now / Math.random。
 */
export class ActionRecorder {
  private readonly seed: number;
  private readonly baseState: RootState;
  private currentState: RootState;
  private readonly _actions: RecordedAction[];

  constructor(seed: number, state: RootState) {
    this.seed         = seed;
    this.baseState    = structuredClone(state) as RootState;
    this.currentState = structuredClone(state) as RootState;
    this._actions     = [];
  }

  /**
   * 记录一次 option_id 并推进一拍（使用确定性 tickId）。
   * 返回推进后的 state（深拷贝·不暴露内部引用）。
   */
  record(optionId: string): RootState {
    const tickCount = this.currentState._tick?.拍计数 ?? this._actions.length;
    const tickId    = `debug:rec:${this.seed}:tick:${tickCount}`;
    const result    = runTick(structuredClone(this.currentState) as RootState, { tickId });
    this._actions.push({ tickCount, optionId, tickId });
    this.currentState = result.state;
    return structuredClone(this.currentState) as RootState;
  }

  getActions(): RecordedAction[] { return [...this._actions]; }

  getCurrentState(): RootState { return structuredClone(this.currentState) as RootState; }

  /**
   * 从基态确定性重放序列中所有 tickId → 逐位恒等 state。
   *
   * 逐位恒等断言：同 seed + 同 actions → JSON.stringify(replay()) === JSON.stringify(replay())
   */
  replay(): RootState {
    let st = structuredClone(this.baseState) as RootState;
    for (const action of this._actions) {
      st = runTick(structuredClone(st) as RootState, { tickId: action.tickId }).state;
    }
    return st;
  }

  /** 导出为可序列化对象（供存档/测试）*/
  exportSequence(): ReplaySequence {
    return { seed: this.seed, actions: [...this._actions] };
  }
}

// ── 功能 6: 快照保存与比对 ─────────────────────────────────────────────────────────

export interface SnapshotFieldDiff {
  field: string;
  before: unknown;
  after:  unknown;
}

export interface SnapshotDiff {
  labelA: string;
  labelB: string;
  changedFields: SnapshotFieldDiff[];
  /** 人读摘要（0 变化时为「无变化」） */
  summary: string;
}

/**
 * 快照存储 — 保存多个命名快照，任选两个做结构化 diff。
 *
 * diff 比较：遍历 StateSnapshot 所有字段（JSON 深比较）。
 * label 不参与 diff（仅作名称标识）。
 */
export class SnapshotStore {
  private readonly snapshots: Map<string, StateSnapshot>;

  constructor() {
    this.snapshots = new Map();
  }

  /** 保存 state 快照（覆盖同名快照）；renderParams 为可选 $meta 渲染参数，不进指纹 */
  save(
    label: string,
    state: RootState,
    renderParams?: { narrativePerson: string; narrativeStyle: string },
  ): StateSnapshot {
    const snap = takeStateSnapshot(state, label);
    if (renderParams !== undefined) {
      snap.$metaRenderParams = renderParams;
    }
    this.snapshots.set(label, snap);
    return snap;
  }

  /** 取已保存的快照（不存在则 undefined） */
  get(label: string): StateSnapshot | undefined {
    return this.snapshots.get(label);
  }

  /** 已保存快照名列表 */
  list(): string[] {
    return [...this.snapshots.keys()];
  }

  /**
   * 两快照结构化 diff。
   *
   * 比较 StateSnapshot 各字段（跳过 label）；
   * 货币账户用 JSON 深比较（显示层·非判定面·安全）。
   */
  compare(labelA: string, labelB: string): SnapshotDiff {
    const a = this.snapshots.get(labelA);
    const b = this.snapshots.get(labelB);
    if (!a) throw new Error(`[SnapshotStore] 快照 '${labelA}' 不存在`);
    if (!b) throw new Error(`[SnapshotStore] 快照 '${labelB}' 不存在`);

    const changedFields: SnapshotFieldDiff[] = [];
    const skipFields = new Set<string>(['label', 'worldTime', '$metaRenderParams']);
    for (const field of Object.keys(a) as (keyof StateSnapshot)[]) {
      if (skipFields.has(field)) continue;
      const va = a[field];
      const vb = b[field];
      if (JSON.stringify(va) !== JSON.stringify(vb)) {
        changedFields.push({ field, before: va, after: vb });
      }
    }

    const semanticLabels: Record<string, string> = {
      tickCount:                 '拍号变化',
      totalCognitiveImpressions: '认知档案变化',
      totalRelationEdges:        '关系图变化',
      currencyAccounts:          '资源变化',
      highlightedRelationEdges:  '关系触发边变化',
    };
    const parts: string[] = [];
    for (const f of changedFields) {
      if (semanticLabels[f.field]) parts.push(semanticLabels[f.field]);
    }

    return {
      labelA,
      labelB,
      changedFields,
      summary: parts.length > 0 ? parts.join(' · ') : '（无变化）',
    };
  }
}

// ── A1: 节点按地点分组 ──────────────────────────────────────────────────────────

export interface LocGroupNode {
  key: string;
  name: string;
  orgKeys: string[];
  knownSecretCount: number;
}

export interface LocationGroup {
  location: string;
  nodes: LocGroupNode[];
}

/**
 * 将所有 NPC 按 位置 分组；无位置归入「（无位置）」。
 * 每节点含 orgKeys + 知情秘密数（供 A1 节点明细分组渲染）。
 */
export function groupNodesByLocation(state: RootState): LocationGroup[] {
  const secrets = state.全局?.秘密库 ?? {};
  const groups = new Map<string, LocationGroup>();

  for (const [key, npc] of Object.entries(state.NPC)) {
    const loc = npc.位置 || '（无位置）';
    if (!groups.has(loc)) {
      groups.set(loc, { location: loc, nodes: [] });
    }
    const orgKeys = npc.所属组织
      .map(o => o.组织键)
      .filter((k): k is string => !!k);
    const knownSecretCount = Object.values(secrets).filter(
      s => s.知情名单.some(e => e.对象 === key),
    ).length;
    groups.get(loc)!.nodes.push({ key, name: npc.姓名, orgKeys, knownSecretCount });
  }

  return [...groups.values()];
}

// ── A2: 边强度跨拍 delta ─────────────────────────────────────────────────────────

export interface EdgeDelta {
  strengthDelta: number;
  scoreDelta: number;
}

/**
 * 计算关系边跨拍强度增减 delta。
 * pair key = ASCII 字典序小的端点在前（与 buildRelationGraph 保持一致）。
 * 仅处理当前图中存在的边；prev 中消失的边忽略（显示层不处理消亡边）。
 */
export function buildEdgeDelta(
  prevEdges: RelationEdge[],
  currEdges: RelationEdge[],
): Map<string, EdgeDelta> {
  const prevMap = new Map<string, { strength: number; score: number }>();
  for (const e of prevEdges) {
    const a = e.from < e.to ? e.from : e.to;
    const b = e.from < e.to ? e.to   : e.from;
    prevMap.set(`${a}\x00${b}`, { strength: e.strength, score: e.score });
  }

  const result = new Map<string, EdgeDelta>();
  for (const e of currEdges) {
    const a = e.from < e.to ? e.from : e.to;
    const b = e.from < e.to ? e.to   : e.from;
    const pk = `${a}\x00${b}`;
    const prev = prevMap.get(pk);
    result.set(pk, {
      strengthDelta: prev !== undefined ? e.strength - prev.strength : 0,
      scoreDelta:    prev !== undefined ? e.score    - prev.score    : 0,
    });
  }

  return result;
}

// ── POV 五轴人格投影（Bug 2 · 调试面板专用·不渗入正常游玩路径）────────────────────────

export interface PersonalityAxis {
  /** 引擎存储的真相值（spoiler·仅供调试对照·绝不渗入正常 POV 渲染） */
  true: number;
  /** 认知层感知值 = clamp(真值 + bias, 0, 100) */
  projected: number;
  /** 偏差量（= 0 时投影值 = 真值） */
  bias: number;
}

export interface PersonalityProjectionResult {
  开放:   PersonalityAxis;
  尽责:   PersonalityAxis;
  外向:   PersonalityAxis;
  宜人:   PersonalityAxis;
  神经质: PersonalityAxis;
  /** 本次计算使用的统一偏差量（= 0 → 五轴投影值逐位 = 真值） */
  totalBias: number;
}

/**
 * 计算 POV 实体的五轴人格投影（调试用·纯只读）。
 *
 * 投影值 = clamp(真值 + bias, 0, 100)
 * bias   = round((relDepth×0.3 + disguise×0.5) × selfKnowledge/100)
 *
 * 典型情况（无自我认知条目·无伪装特质·无自身关系边）→ bias=0 → 投影=真值。
 * 不改 state · 不调 runTick · 不进指纹。
 */
export function computePovPersonalityProjection(
  state: RootState,
  entityKey: string,
): PersonalityProjectionResult {
  const npc = state.NPC[entityKey];
  if (!npc) throw new Error(`[computePovPersonalityProjection] '${entityKey}' not in NPC`);

  const trueAxes = npc.性格五轴;

  // 知情程度：认知档案[self][self].了解度（通常 0·NPC 一般不自我观察）
  const archiveBySelf = state.认知档案?.[entityKey] ?? {};
  const selfKnowledge = (archiveBySelf as Record<string, { 了解度: number }>)[entityKey]?.了解度 ?? 0;

  // 伪装度：特质库中 类别=伪装/欺骗 的最大强度
  const disguiseDegree = Object.values(npc.特质).reduce(
    (mx, t) => (t.类别 === '伪装' || t.类别 === '欺骗') ? Math.max(mx, t.强度) : mx,
    0,
  );

  // 关系深度：自身关系列表中对自身的边强度绝对值（通常不存在 → 0）
  const selfRel = npc.关系.find(r => r.对象键 === entityKey);
  const relDepth = selfRel ? Math.abs(selfRel.强度) : 0;

  // bias = round((relDepth×0.3 + disguise×0.5) × selfKnowledge/100)
  // 所有因子为 0 时 bias=0 → 投影=真值（测试覆盖此路径）
  const bias = Math.round((relDepth * 0.3 + disguiseDegree * 0.5) * (selfKnowledge / 100));

  const clamp = (v: number) => Math.max(0, Math.min(100, v));
  const makeAxis = (v: number): PersonalityAxis => ({
    true: v,
    projected: clamp(v + bias),
    bias,
  });

  return {
    开放:   makeAxis(trueAxes.开放),
    尽责:   makeAxis(trueAxes.尽责),
    外向:   makeAxis(trueAxes.外向),
    宜人:   makeAxis(trueAxes.宜人),
    神经质: makeAxis(trueAxes.神经质),
    totalBias: bias,
  };
}

// ── A3: 详细角色面板（POV 过滤） ───────────────────────────────────────────────────

export interface ActorPanel {
  entityKey: string;
  name: string;
  称呼: string;
  性别: string;
  种族: string;
  存活状态: string;
  位置: string;
  背景: string;
  称号: string;
  头衔: string[];
  业力: number;
  attributes: { 体质: number; 智慧: number; 感知: number; 魅力: number; 心理: number };
  派生: { HP: number; HP上限: number; 精力: number; 精力上限: number; 颜值: number };
  行动点: { 当前: number; 上限: number };
  性格五轴: { 开放: number; 尽责: number; 外向: number; 宜人: number; 神经质: number };
  声誉: { 人望: number; 知名度: number; 极性: string; 标签: string };
  情绪栈: Array<{ 情绪名: string; 极性: string; 数值: number; 来源: string }>;
  状态标签: Array<{ key: string; 来源: string }>;
  特质: Array<{ key: string; 类别: string; 强度: number }>;
  技能: Array<{ key: string; 熟练度: number; 等级: number; 类别: string }>;
  关系: Array<{ 对象键: string; 类型: string; 强度: number; 信任: number; 极性: string }>;
  所属组织: Array<{ 组织键: string; 职务: string }>;
  信念: Array<{ key: string; 类型: string; 虔诚或认同: number }>;
  currencies: Record<string, number>;
  物品: Array<{ key: string; 数量: number; 类别: string; 重要级别: string }>;
  目标: { 长期: string[]; 短期: string[] };
  认知概览: Array<{ 目标键: string; 了解度: number; 印象数: number; 姓名知识: string }>;
  可见秘密ID: string[];
  记忆: Array<{ 摘要: string; 重要度: number; 情绪色彩: string }>;
  意象: Array<{ 标签: string; 情绪色彩: string; 强度: number }>;
}

/**
 * 构建详细角色面板 — 枚举 NPC schema 全部可显示字段。
 * 以 entityKey 为 POV 过滤秘密（filterSecretsForPOV）。
 * 只读；不调用 Date.now / Math.random。
 */
export function buildActorPanel(state: RootState, entityKey: string): ActorPanel {
  const npc = state.NPC[entityKey];
  if (!npc) throw new Error(`[buildActorPanel] '${entityKey}' 不在 state.NPC`);

  const secrets = state.全局?.秘密库 ?? {};
  const visibleSecrets = filterSecretsForPOV(secrets, entityKey);

  const currencies: Record<string, number> = {};
  const acct = state.货币系统?.账户?.[entityKey];
  if (acct) {
    for (const [ccy, amt] of Object.entries(acct.持有)) {
      currencies[ccy] = amt;
    }
  }

  const archiveByEntity = state.认知档案?.[entityKey] ?? {};
  const 认知概览 = Object.entries(archiveByEntity).map(([tgt, entry]) => ({
    目标键: tgt,
    了解度: entry.了解度,
    印象数: entry.印象.length,
    姓名知识: entry.姓名知识,
  }));

  return {
    entityKey,
    name:     npc.姓名,
    称呼:     npc.称呼,
    性别:     npc.性别,
    种族:     npc.种族,
    存活状态: npc.存活状态,
    位置:     npc.位置,
    背景:     npc.背景,
    称号:     npc.称号,
    头衔:     [...npc.头衔],
    业力:     npc.业力,
    attributes: {
      体质: npc.属性.体质,
      智慧: npc.属性.智慧,
      感知: npc.属性.感知,
      魅力: npc.属性.魅力,
      心理: npc.属性.心理,
    },
    派生: {
      HP:       npc.派生.HP,
      HP上限:   npc.派生.HP上限,
      精力:     npc.派生.精力,
      精力上限: npc.派生.精力上限,
      颜值:     npc.派生.颜值,
    },
    行动点: { 当前: npc.行动点.当前, 上限: npc.行动点.上限 },
    性格五轴: {
      开放:   npc.性格五轴.开放,
      尽责:   npc.性格五轴.尽责,
      外向:   npc.性格五轴.外向,
      宜人:   npc.性格五轴.宜人,
      神经质: npc.性格五轴.神经质,
    },
    声誉: {
      人望:   npc.声誉.人望,
      知名度: npc.声誉.知名度,
      极性:   npc.声誉.极性,
      标签:   npc.声誉.标签,
    },
    情绪栈: npc.情绪栈.map(e => ({
      情绪名: e.情绪名,
      极性:   e.极性,
      数值:   e.数值,
      来源:   e.来源,
    })),
    状态标签: Object.entries(npc.状态标签).map(([key, v]) => ({ key, 来源: v.来源 })),
    特质: Object.entries(npc.特质).map(([key, v]) => ({ key, 类别: v.类别, 强度: v.强度 })),
    技能: Object.entries(npc.技能).map(([key, v]) => ({
      key,
      熟练度: v.熟练度,
      等级:   v.等级,
      类别:   v.类别,
    })),
    关系: npc.关系.map(r => ({
      对象键: r.对象键,
      类型:   r.类型,
      强度:   r.强度,
      信任:   r.信任,
      极性:   r.极性,
    })),
    所属组织: npc.所属组织.map(o => ({ 组织键: o.组织键, 职务: o.职务 })),
    信念: Object.entries(npc.信念).map(([key, v]) => ({
      key,
      类型:       v.类型,
      虔诚或认同: v.虔诚或认同,
    })),
    currencies,
    物品: Object.entries(npc.物品).map(([key, v]) => ({
      key,
      数量:     v.数量,
      类别:     v.类别,
      重要级别: v.重要级别,
    })),
    目标: { 长期: [...npc.目标.长期], 短期: [...npc.目标.短期] },
    认知概览,
    可见秘密ID: Object.keys(visibleSecrets),
    记忆: npc.记忆.map(m => ({
      摘要:     m.摘要,
      重要度:   m.重要度,
      情绪色彩: m.情绪色彩,
    })),
    意象: npc.意象.map(i => ({
      标签:     i.标签,
      情绪色彩: i.情绪色彩,
      强度:     i.强度,
    })),
  };
}

// ── console 输出工具（供 main 演示） ──────────────────────────────────────────────

function hr2(title: string): void {
  console.log(`\n${'─'.repeat(62)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(62));
}

function printPovInspect(r: PovInspectResult): void {
  console.log(`  POV='${r.povEntityKey}'`);
  console.log(`    可见秘密: ${r.visibleSecretIds.join(', ') || '（无）'}`);
  console.log(`    隐藏秘密数（existence-opaque）: ${r.hiddenSecretCount}`);
  console.log(`    认知目标数: ${r.cognitiveTargetKeys.length}`);
  for (const [tgt, proj] of Object.entries(r.cognitiveProjection)) {
    console.log(`      → ${tgt}: 了解度=${proj.了解度} 印象×${proj.impressionCount}`);
  }
}

function printRelationGraph(g: RelationGraph): void {
  console.log(`  节点数: ${g.nodes.length}  边数: ${g.edges.length}`);
  console.log(`  高亮边(score≥${PHASE6_THRESHOLD}): ${g.highlightedEdgeCount}  弱边: ${g.weakEdgeCount}`);
  for (const e of g.edges) {
    const mark = e.isHighlighted ? '★' : '·';
    console.log(`  ${mark} ${e.from} ─[${e.type} ${e.strength}×${e.trust}/100=${e.score.toFixed(1)}]→ ${e.to}`);
  }
}

// ── 主函数（独立演示·不影响测试） ─────────────────────────────────────────────────

import { buildWorld, PC, NPC_WANG, SAVE_SEED } from '../slice/fixture/world.js';
import {
  buildDebugFixtureMedium,
} from './fixtures/debugFixtures.js';
import { runTickWithDiff } from './aohpDebugConsole.js';

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   G1b3b · AOHP 调试控制台 · 锦上添花批                      ║');
  console.log('║   POV切换·关系网图·PC面板·快照比对·动作回放                  ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  const state = buildWorld();

  // ── 功能 1: POV 切换 ──────────────────────────────────────────────────────
  hr2('NPC 视角（POV）切换（功能 1）');
  console.log('\n  PC POV:');
  printPovInspect(povInspect(state, PC));
  console.log('\n  NPC_WANG POV:');
  printPovInspect(povInspect(state, NPC_WANG));

  const cmp = comparePOVs(state, PC, NPC_WANG);
  console.log(`\n  并排对比 A=${cmp.entityA} / B=${cmp.entityB}:`);
  console.log(`    只有A可见: ${cmp.onlyA.join(', ') || '无'}`);
  console.log(`    只有B可见: ${cmp.onlyB.join(', ') || '无'}`);
  console.log(`    双方均可见: ${cmp.both.join(', ') || '无'}`);
  console.log(`    认知差: A多=${cmp.cognitiveOnlyA.join(',')||'无'} B多=${cmp.cognitiveOnlyB.join(',')||'无'}`);

  // ── 功能 2: 关系网拓扑图 ──────────────────────────────────────────────────
  hr2('关系网拓扑图（功能 2）- 基础 fixture');
  printRelationGraph(buildRelationGraph(state));

  hr2('关系网拓扑图（功能 2）- 大陆 fixture（Phase6 可见边）');
  const medState = buildDebugFixtureMedium();
  printRelationGraph(buildRelationGraph(medState));

  // ── 功能 7: PC 状态面板 ────────────────────────────────────────────────────
  hr2('主角状态面板（功能 7）');
  const panel = buildPCPanel(state, PC);
  console.log(`  ${panel.pcKey} (${panel.name})`);
  console.log(`  位置: ${panel.location ?? '—'}`);
  console.log(`  HP: ${panel.hp}/${panel.hpMax}  精力: ${panel.energy}/${panel.energyMax}`);
  console.log(`  属性: ${Object.entries(panel.attributes).map(([k,v]) => `${k}=${v}`).join(' ')}`);
  console.log(`  货币: ${Object.entries(panel.currencies).map(([c,a]) => `${a}${c}`).join(', ')}`);
  console.log(`  关系边: ${panel.relationsCount}  认知目标: ${panel.cognitiveTargets}`);
  console.log(`  已知秘密: ${panel.knownSecretIds.join(', ') || '无'}`);

  // ── 功能 7: 地图缩略图 ────────────────────────────────────────────────────
  hr2('地图缩略图（功能 7）');
  const map = buildMapThumbnail(medState);
  console.log(`  地点总数: ${map.totalLocations}  LOD状态: ${map.lodSystemStatus}（待 G7）`);
  for (const loc of map.locations) {
    console.log(`  [${loc.key}] ${loc.name} [${loc.category}·${loc.size}]  NPC×${loc.npcCount}  LOD=${loc.lodStatus}`);
  }

  // ── 功能 3: 全局快照 ──────────────────────────────────────────────────────
  hr2('全局状态快照（功能 3）');
  const snap0 = takeStateSnapshot(state, 'tick0');
  console.log(`  tickCount=${snap0.tickCount}  NPC=${snap0.npcCount}  边=${snap0.totalRelationEdges}`);
  console.log(`  认知观察者=${snap0.cognitiveObserverCount}  印象=${snap0.totalCognitiveImpressions}`);

  // ── 功能 4: 增量视图 ──────────────────────────────────────────────────────
  hr2('增量视图（功能 4）');
  const diffs = [
    runTickWithDiff(state,      `debug:${SAVE_SEED}:tick:0`),
    runTickWithDiff(medState,   `debug:200:tick:0`),
  ];
  for (const entry of buildIncrementalView(diffs)) {
    console.log(`  [${entry.tickId}] ${entry.summary}`);
    console.log(`    新印象×${entry.newImpressions} 强度增×${entry.strengthIncreases} 关系触发×${entry.relationHitsCount}`);
  }

  // ── 功能 5: 动作序列记录与回放 ─────────────────────────────────────────────
  hr2('动作序列记录与回放（功能 5）');
  const rec = new ActionRecorder(SAVE_SEED, state);
  rec.record('对话:npc_wang');
  rec.record('对话:npc_hong');
  const replayState = rec.replay();
  const identical = JSON.stringify(rec.getCurrentState()) === JSON.stringify(replayState);
  console.log(`  记录 ${rec.getActions().length} 步动作`);
  console.log(`  重放逐位恒等: ${identical ? '✅' : '❌'}`);

  // ── 功能 6: 快照比对 ──────────────────────────────────────────────────────
  hr2('快照保存与比对（功能 6）');
  const store = new SnapshotStore();
  store.save('before', state);
  const afterState = rec.getCurrentState();
  store.save('after', afterState);
  const diff = store.compare('before', 'after');
  console.log(`  快照 diff [before vs after]:`);
  console.log(`  摘要: ${diff.summary}`);
  console.log(`  变更字段数: ${diff.changedFields.length}`);
  for (const f of diff.changedFields.slice(0, 5)) {
    console.log(`    ${f.field}: ${JSON.stringify(f.before)} → ${JSON.stringify(f.after)}`);
  }

  console.log(`\n${'═'.repeat(62)}`);
  console.log('  G1b3b 调试控制台完成');
  console.log(`  POV切换 ✅  关系网图 ✅  PC面板/状态树/地图缩略图 ✅`);
  console.log(`  全局快照 ✅  增量视图 ✅  动作回放 ✅  快照比对 ✅`);
  console.log('═'.repeat(62));
}

// 仅在 Node.js 直接执行时运行（浏览器导入时 window 存在 → 跳过）
if (typeof window === 'undefined') {
  main().catch(e => {
    console.error('[aohpDebugConsole2] 未捕获异常:', e);
    process.exit(1);
  });
}
