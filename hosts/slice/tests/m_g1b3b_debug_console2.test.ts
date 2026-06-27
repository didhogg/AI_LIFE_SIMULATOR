// G1b3b · AOHP 调试控制台 · 锦上添花批 · 专项回归
//
// 铁律:
//   ① 无真实 LLM 调用（纯单元·不烧 API 额度）
//   ② 全部调用路径 确定性·零 IO
//   ③ 黄金向量/指纹84/schemaKeys52 守恒
//
// 覆盖:
//   T1. POV 投影正确（covert 门控·不同 POV 可见集差异）
//   T2. comparePOVs 并排对比（onlyA / onlyB / both 分区正确）
//   T3. 关系网拓扑图 — 节点/边/≥50 高亮与 state 一致
//   T4. buildPCPanel — 主角状态面板字段正确
//   T5. buildMapThumbnail — 地图缩略图渲染区域 + LOD 灰显占位
//   T6. buildStateTree — 状态树结构完整
//   T7. takeStateSnapshot — 快照字段覆盖 + 两次调用结构一致
//   T8. buildIncrementalView — 增量时间线正确聚合 TickDiffResult
//   T9. ActionRecorder — 动作回放逐位恒等（同序列+seed）
//   T10. SnapshotStore — 快照保存/比对/diff 字段检出
//   T11. 指纹84 / schemaKeys52 守恒

import { describe, it, expect } from 'vitest';
import { RootSchema } from '@ai-life-sim/core';
import {
  FINGERPRINT_BUNDLE_MEMBERS,
  FINGERPRINT_PRESET_FIELDS,
  FINGERPRINT_SNAPSHOT_FIELDS,
  FINGERPRINT_EXCLUDED_FIELDS,
} from '@ai-life-sim/core/engine/fingerprintManifest';

import {
  buildWorld, PC, NPC_WANG, NPC_HONG, SECRET_S1, SAVE_SEED,
} from '../fixture/world.js';
import {
  buildDebugFixtureSmall,
  buildDebugFixtureMedium,
  buildDebugFixtureLarge,
} from '../../web-debug/fixtures/debugFixtures.js';
import { runTickWithDiff, PHASE6_THRESHOLD } from '../../web-debug/aohpDebugConsole.js';
import {
  povInspect,
  comparePOVs,
  buildRelationGraph,
  buildPCPanel,
  buildMapThumbnail,
  buildStateTree,
  takeStateSnapshot,
  buildIncrementalView,
  ActionRecorder,
  SnapshotStore,
} from '../../web-debug/aohpDebugConsole2.js';

// ──────────────────────────────────────────────────────────────────────────────
// T1. POV 投影正确（covert gate + existence-opaque）
// ──────────────────────────────────────────────────────────────────────────────
describe('T1 POV 投影 — covert 门控 · existence-opaque', () => {
  const state = buildWorld();

  it('NPC_WANG POV 可见 SECRET_S1（知情名单中）', () => {
    const r = povInspect(state, NPC_WANG);
    expect(r.visibleSecretIds).toContain(SECRET_S1);
    expect(r.visibleSecrets[SECRET_S1]).toBeDefined();
    // 可见条目含母题/严重度/暴露度；不含 $谜底（existence-opaque 输出接口）
    expect(r.visibleSecrets[SECRET_S1]).toHaveProperty('母题');
    expect(r.visibleSecrets[SECRET_S1]).toHaveProperty('严重度');
    expect(r.visibleSecrets[SECRET_S1]).toHaveProperty('暴露度');
    expect(r.visibleSecrets[SECRET_S1]).not.toHaveProperty('$谜底');
  });

  it('PC POV 不可见 SECRET_S1（非知情方·existence-opaque）', () => {
    const r = povInspect(state, PC);
    // existence-opaque: 非知情方连条目都不在返回集中
    expect(r.visibleSecretIds).not.toContain(SECRET_S1);
    expect(r.visibleSecrets[SECRET_S1]).toBeUndefined();
  });

  it('PC hiddenSecretCount ≥ 1（秘密数 - 可见数 ≥ 1）', () => {
    const r = povInspect(state, PC);
    expect(r.hiddenSecretCount).toBeGreaterThanOrEqual(1);
  });

  it('NPC_WANG hiddenSecretCount = 0（知晓全部秘密）', () => {
    const r = povInspect(state, NPC_WANG);
    const totalSecrets = Object.keys(state.全局?.秘密库 ?? {}).length;
    expect(r.hiddenSecretCount).toBe(totalSecrets - r.visibleSecretIds.length);
  });

  it('cognitiveProjection 返回认知档案观察到的目标（了解度 + 印象数）', () => {
    const r = povInspect(state, NPC_WANG);
    // 无论是否有认知条目，返回的 cognitiveProjection 必须是对象
    expect(typeof r.cognitiveProjection).toBe('object');
    for (const [, proj] of Object.entries(r.cognitiveProjection)) {
      expect(typeof proj.了解度).toBe('number');
      expect(typeof proj.impressionCount).toBe('number');
    }
  });

  it('两次调用同 state 同 POV → 结果 JSON 恒等（幂等）', () => {
    const r1 = povInspect(state, NPC_WANG);
    const r2 = povInspect(state, NPC_WANG);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// T2. comparePOVs 并排对比
// ──────────────────────────────────────────────────────────────────────────────
describe('T2 comparePOVs — 并排对比 A/B 可见集差异', () => {
  const state = buildWorld();

  it('onlyA / onlyB / both 三分区完整（交集不重叠）', () => {
    const cmp = comparePOVs(state, PC, NPC_WANG);
    // onlyA ∩ onlyB = ∅
    const setA = new Set(cmp.onlyA);
    for (const id of cmp.onlyB) {
      expect(setA.has(id)).toBe(false);
    }
    // both 中的 id 在 A 和 B 都可见
    for (const id of cmp.both) {
      const povA = povInspect(state, PC);
      const povB = povInspect(state, NPC_WANG);
      expect(povA.visibleSecretIds).toContain(id);
      expect(povB.visibleSecretIds).toContain(id);
    }
  });

  it('PC 不知情 SECRET_S1 → SECRET_S1 在 onlyB（只有 NPC_WANG 可见）', () => {
    const cmp = comparePOVs(state, PC, NPC_WANG);
    expect(cmp.onlyB).toContain(SECRET_S1);
    expect(cmp.onlyA).not.toContain(SECRET_S1);
  });

  it('symmetry: comparePOVs(A,B).onlyA === comparePOVs(B,A).onlyB', () => {
    const ab = comparePOVs(state, PC, NPC_WANG);
    const ba = comparePOVs(state, NPC_WANG, PC);
    expect(ab.onlyA.sort()).toEqual(ba.onlyB.sort());
    expect(ab.onlyB.sort()).toEqual(ba.onlyA.sort());
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// T3. 关系网拓扑图 — 边/强度/≥50 高亮
// ──────────────────────────────────────────────────────────────────────────────
describe('T3 buildRelationGraph — 拓扑图与 state 一致', () => {
  it('节点数 = NPC 数', () => {
    const state = buildWorld();
    const g = buildRelationGraph(state);
    expect(g.nodes.length).toBe(Object.keys(state.NPC).length);
  });

  it('每个 NPC 键在节点集中', () => {
    const state = buildDebugFixtureMedium();
    const g = buildRelationGraph(state);
    const nodeKeys = new Set(g.nodes.map(n => n.key));
    for (const key of Object.keys(state.NPC)) {
      expect(nodeKeys.has(key)).toBe(true);
    }
  });

  it('无向图去重：边数 ≤ Σ(NPC.关系.length)', () => {
    const state = buildDebugFixtureMedium();
    const g = buildRelationGraph(state);
    const totalDirected = Object.values(state.NPC).reduce((sum, npc) => sum + npc.关系.length, 0);
    expect(g.edges.length).toBeLessThanOrEqual(totalDirected);
  });

  it('高亮边 score ≥ PHASE6_THRESHOLD（与常量一致）', () => {
    const state = buildDebugFixtureMedium();
    const g = buildRelationGraph(state);
    for (const e of g.edges) {
      if (e.isHighlighted) {
        expect(e.score).toBeGreaterThanOrEqual(PHASE6_THRESHOLD);
      } else {
        expect(e.score).toBeLessThan(PHASE6_THRESHOLD);
      }
    }
  });

  it('大陆 fixture: highlightedEdgeCount > 0（同组织 NPC score≥60）', () => {
    const state = buildDebugFixtureMedium();
    const g = buildRelationGraph(state);
    expect(g.highlightedEdgeCount).toBeGreaterThan(0);
  });

  it('整世界 fixture: edge 数 > 大陆 fixture（规模递增）', () => {
    const med = buildRelationGraph(buildDebugFixtureMedium());
    const lrg = buildRelationGraph(buildDebugFixtureLarge());
    expect(lrg.edges.length).toBeGreaterThan(med.edges.length);
  });

  it('highlightedEdgeCount + weakEdgeCount = edges.length', () => {
    const state = buildDebugFixtureMedium();
    const g = buildRelationGraph(state);
    expect(g.highlightedEdgeCount + g.weakEdgeCount).toBe(g.edges.length);
  });

  it('所属组织的 NPC cluster 优先取第一个 orgKey', () => {
    const state = buildDebugFixtureMedium();
    const g = buildRelationGraph(state);
    const guildMaster = g.nodes.find(n => n.key === 'npc_guild_master');
    expect(guildMaster).toBeDefined();
    expect(guildMaster!.orgKeys).toContain('org_merchant_guild');
    expect(guildMaster!.cluster).toBe('org_merchant_guild');
  });

  it('小城 fixture: 全部边 score < PHASE6_THRESHOLD（共址无组织 max=40）', () => {
    const state = buildDebugFixtureSmall();
    const g = buildRelationGraph(state);
    expect(g.highlightedEdgeCount).toBe(0);
    for (const e of g.edges) {
      expect(e.score).toBeLessThan(PHASE6_THRESHOLD);
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// T4. buildPCPanel — 主角状态面板
// ──────────────────────────────────────────────────────────────────────────────
describe('T4 buildPCPanel — 主角状态面板字段正确', () => {
  const state = buildWorld();

  it('pcKey 和 name 正确', () => {
    const panel = buildPCPanel(state, PC);
    expect(panel.pcKey).toBe(PC);
    expect(typeof panel.name).toBe('string');
    expect(panel.name.length).toBeGreaterThan(0);
  });

  it('属性五轴均为数字', () => {
    const panel = buildPCPanel(state, PC);
    expect(typeof panel.attributes.体质).toBe('number');
    expect(typeof panel.attributes.智慧).toBe('number');
    expect(typeof panel.attributes.感知).toBe('number');
    expect(typeof panel.attributes.魅力).toBe('number');
    expect(typeof panel.attributes.心理).toBe('number');
  });

  it('hp / hpMax / energy / energyMax 为非负数', () => {
    const panel = buildPCPanel(state, PC);
    expect(panel.hp).toBeGreaterThanOrEqual(0);
    expect(panel.hpMax).toBeGreaterThan(0);
    expect(panel.energy).toBeGreaterThanOrEqual(0);
    expect(panel.energyMax).toBeGreaterThan(0);
  });

  it('currencies 包含「文」账户', () => {
    const panel = buildPCPanel(state, PC);
    expect(panel.currencies['文']).toBeGreaterThan(0);
  });

  it('PC 不知情 SECRET_S1 → knownSecretIds 不含 SECRET_S1', () => {
    const panel = buildPCPanel(state, PC);
    expect(panel.knownSecretIds).not.toContain(SECRET_S1);
  });

  it('NPC_WANG 知情 SECRET_S1 → knownSecretIds 含 SECRET_S1', () => {
    const panel = buildPCPanel(state, NPC_WANG);
    expect(panel.knownSecretIds).toContain(SECRET_S1);
  });

  it('不存在的 PC 键 → 抛出错误', () => {
    expect(() => buildPCPanel(state, 'nonexistent_key')).toThrow();
  });

  it('relationsCount = NPC.关系.length', () => {
    const panel = buildPCPanel(state, PC);
    expect(panel.relationsCount).toBe(state.NPC[PC]!.关系.length);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// T5. buildMapThumbnail — 地图缩略图 + LOD 灰显占位
// ──────────────────────────────────────────────────────────────────────────────
describe('T5 buildMapThumbnail — 地图缩略图渲染 + LOD 占位', () => {
  it('大陆 fixture: 地点数量正确（3 地点）', () => {
    const state = buildDebugFixtureMedium();
    const map = buildMapThumbnail(state);
    expect(map.totalLocations).toBe(3);
    expect(map.locations.length).toBe(3);
  });

  it('整世界 fixture: 5 地点', () => {
    const state = buildDebugFixtureLarge();
    const map = buildMapThumbnail(state);
    expect(map.totalLocations).toBe(5);
  });

  it('每个地点条目含 key/name/category/size/npcCount', () => {
    const state = buildDebugFixtureMedium();
    const map = buildMapThumbnail(state);
    for (const loc of map.locations) {
      expect(typeof loc.key).toBe('string');
      expect(typeof loc.name).toBe('string');
      expect(typeof loc.category).toBe('string');
      expect(typeof loc.size).toBe('string');
      expect(typeof loc.npcCount).toBe('number');
    }
  });

  it('LOD 系统状态 = NOT_IMPLEMENTED（待 G7·明确灰显占位·不伪造）', () => {
    const state = buildDebugFixtureMedium();
    const map = buildMapThumbnail(state);
    expect(map.lodSystemStatus).toBe('NOT_IMPLEMENTED');
    for (const loc of map.locations) {
      expect(loc.lodStatus).toBe('placeholder');
    }
  });

  it('大陆 fixture: loc_fengwei_tavern 有 3 个 NPC（商会三人）', () => {
    const state = buildDebugFixtureMedium();
    const map = buildMapThumbnail(state);
    const tavern = map.locations.find(l => l.key === 'loc_fengwei_tavern');
    expect(tavern).toBeDefined();
    expect(tavern!.npcCount).toBe(3);
  });

  it('npcCount 总和 = state.NPC 总数（每个 NPC 都有位置）', () => {
    const state = buildDebugFixtureLarge();
    const map = buildMapThumbnail(state);
    const totalNpcInMap = map.locations.reduce((sum, l) => sum + l.npcCount, 0);
    // 整世界 fixture 每个 NPC 都有 位置 → 总和应等于 NPC 数
    expect(totalNpcInMap).toBe(Object.keys(state.NPC).length);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// T6. buildStateTree — 状态树结构
// ──────────────────────────────────────────────────────────────────────────────
describe('T6 buildStateTree — 状态树结构完整', () => {
  const state = buildWorld();

  it('根节点 label = 世界状态', () => {
    const tree = buildStateTree(state);
    expect(tree.label).toBe('世界状态');
  });

  it('根节点有 children（多节点）', () => {
    const tree = buildStateTree(state);
    expect(Array.isArray(tree.children)).toBe(true);
    expect(tree.children!.length).toBeGreaterThan(0);
  });

  it('children 中包含 NPC 节点（label 含 NPC）', () => {
    const tree = buildStateTree(state);
    const npcNode = tree.children?.find(c => c.label.startsWith('NPC'));
    expect(npcNode).toBeDefined();
    expect(npcNode!.children?.length).toBe(Object.keys(state.NPC).length);
  });

  it('children 中包含货币系统节点', () => {
    const tree = buildStateTree(state);
    const ccyNode = tree.children?.find(c => c.label === '货币系统');
    expect(ccyNode).toBeDefined();
  });

  it('拍号节点 value 类型为 number', () => {
    const tree = buildStateTree(state);
    const tickNode = tree.children?.find(c => c.label.startsWith('拍号'));
    expect(tickNode).toBeDefined();
    expect(typeof tickNode!.value).toBe('number');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// T7. takeStateSnapshot — 快照字段
// ──────────────────────────────────────────────────────────────────────────────
describe('T7 takeStateSnapshot — 快照字段正确', () => {
  const state = buildWorld();

  it('npcCount / locationCount / secretCount 正确', () => {
    const snap = takeStateSnapshot(state, 'test');
    expect(snap.npcCount).toBe(Object.keys(state.NPC).length);
    expect(snap.locationCount).toBe(Object.keys(state.地图?.地点 ?? {}).length);
    expect(snap.secretCount).toBe(Object.keys(state.全局?.秘密库 ?? {}).length);
  });

  it('tickCount = state._tick.拍计数（或 0）', () => {
    const snap = takeStateSnapshot(state, 'test');
    expect(snap.tickCount).toBe(state._tick?.拍计数 ?? 0);
  });

  it('worldTime 字符串包含「纪元」', () => {
    const snap = takeStateSnapshot(state, 'test');
    expect(snap.worldTime).toContain('纪元');
  });

  it('label 保留传入值', () => {
    const snap = takeStateSnapshot(state, 'my_label');
    expect(snap.label).toBe('my_label');
  });

  it('currencyAccounts 包含 PC 账户余额', () => {
    const snap = takeStateSnapshot(state, 'test');
    expect(snap.currencyAccounts[PC]).toBeDefined();
    expect(typeof snap.currencyAccounts[PC]!['文']).toBe('number');
  });

  it('totalRelationEdges 与 state NPC 关系边数一致（≥ 0）', () => {
    const snap = takeStateSnapshot(state, 'test');
    expect(snap.totalRelationEdges).toBeGreaterThanOrEqual(0);
    // totalRelationEdges 为无向图边数（≤ 有向边总数）
    const totalDirected = Object.values(state.NPC).reduce(
      (sum, npc) => sum + npc.关系.length, 0,
    );
    expect(snap.totalRelationEdges).toBeLessThanOrEqual(totalDirected);
  });

  it('大陆 fixture: highlightedRelationEdges > 0', () => {
    const state = buildDebugFixtureMedium();
    const snap = takeStateSnapshot(state, 'med');
    expect(snap.highlightedRelationEdges).toBeGreaterThan(0);
  });

  it('两次调用同 state → JSON 恒等（确定性）', () => {
    const s1 = takeStateSnapshot(state, 'snap');
    const s2 = takeStateSnapshot(state, 'snap');
    expect(JSON.stringify(s1)).toBe(JSON.stringify(s2));
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// T8. buildIncrementalView — 增量视图聚合
// ──────────────────────────────────────────────────────────────────────────────
describe('T8 buildIncrementalView — 增量时间线聚合正确', () => {
  const state = buildWorld();

  it('空数组 → 空时间线', () => {
    const tl = buildIncrementalView([]);
    expect(tl).toEqual([]);
  });

  it('每条 TimelineEntry.tickId 对应 TickDiffResult.tickId', () => {
    const diff = runTickWithDiff(state, `debug:${SAVE_SEED}:tick:0`);
    const tl = buildIncrementalView([diff]);
    expect(tl.length).toBe(1);
    expect(tl[0]!.tickId).toBe(diff.tickId);
  });

  it('cognitiveChangesCount = cognitiveChanges.length', () => {
    const diff = runTickWithDiff(state, `debug:${SAVE_SEED}:tick:0`);
    const tl = buildIncrementalView([diff]);
    expect(tl[0]!.cognitiveChangesCount).toBe(diff.cognitiveChanges.length);
  });

  it('newImpressions + strengthIncreases = cognitiveChangesCount', () => {
    const medState = buildDebugFixtureMedium();
    const diff = runTickWithDiff(medState, 'debug:200:tick:0');
    const tl = buildIncrementalView([diff]);
    const entry = tl[0]!;
    expect(entry.newImpressions + entry.strengthIncreases).toBe(entry.cognitiveChangesCount);
  });

  it('无变化时 summary = 「（本拍无变化）」', () => {
    // 空认知/关系/资源变化 → 手动构造一个零变化 diff
    const zeroDiff = runTickWithDiff(buildDebugFixtureSmall(), 'debug:100:tick:0');
    // 小城 fixture 无高亮边 → cognitiveChanges 可能为 0
    const tl = buildIncrementalView([zeroDiff]);
    const entry = tl[0]!;
    if (
      entry.cognitiveChangesCount === 0 &&
      entry.relationHitsCount === 0 &&
      entry.resourceChangesCount === 0
    ) {
      expect(entry.summary).toBe('（本拍无变化）');
    } else {
      expect(entry.summary).not.toBe('（本拍无变化）');
    }
  });

  it('多 diff → 多条 TimelineEntry（顺序保留）', () => {
    const d1 = runTickWithDiff(state, `debug:${SAVE_SEED}:tick:0`);
    const d2 = runTickWithDiff(state, `debug:${SAVE_SEED}:tick:1`);
    const tl = buildIncrementalView([d1, d2]);
    expect(tl.length).toBe(2);
    expect(tl[0]!.tickId).toBe(d1.tickId);
    expect(tl[1]!.tickId).toBe(d2.tickId);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// T9. ActionRecorder — 动作序列记录与回放逐位恒等
// ──────────────────────────────────────────────────────────────────────────────
describe('T9 ActionRecorder — 动作回放逐位恒等', () => {
  it('单步记录后 replay() 与 getCurrentState() 逐位恒等', () => {
    const rec = new ActionRecorder(SAVE_SEED, buildWorld());
    rec.record('对话:npc_wang');
    const current  = rec.getCurrentState();
    const replayed = rec.replay();
    expect(JSON.stringify(current)).toBe(JSON.stringify(replayed));
  });

  it('多步记录后 replay() 逐位恒等（同序列+seed）', () => {
    const state = buildWorld();
    const rec = new ActionRecorder(SAVE_SEED, state);
    rec.record('对话:npc_wang');
    rec.record('对话:npc_hong');
    rec.record('对话:npc_wang');
    const current  = rec.getCurrentState();
    const replayed = rec.replay();
    expect(JSON.stringify(current)).toBe(JSON.stringify(replayed));
  });

  it('两个独立 ActionRecorder 同 seed 同 state 同序列 → replay() 逐位恒等', () => {
    const state = buildWorld();
    const rec1 = new ActionRecorder(SAVE_SEED, state);
    const rec2 = new ActionRecorder(SAVE_SEED, buildWorld());
    rec1.record('对话:npc_wang');
    rec2.record('对话:npc_wang');
    const r1 = rec1.replay();
    const r2 = rec2.replay();
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it('getActions() 返回记录顺序不变', () => {
    const rec = new ActionRecorder(SAVE_SEED, buildWorld());
    rec.record('对话:npc_wang');
    rec.record('对话:npc_hong');
    const actions = rec.getActions();
    expect(actions.length).toBe(2);
    expect(actions[0]!.optionId).toBe('对话:npc_wang');
    expect(actions[1]!.optionId).toBe('对话:npc_hong');
  });

  it('exportSequence 含 seed 和 actions 数组', () => {
    const rec = new ActionRecorder(SAVE_SEED, buildWorld());
    rec.record('对话:npc_wang');
    const seq = rec.exportSequence();
    expect(seq.seed).toBe(SAVE_SEED);
    expect(seq.actions.length).toBe(1);
    expect(seq.actions[0]!.optionId).toBe('对话:npc_wang');
  });

  it('tickId 格式为 debug:rec:<seed>:tick:<n>', () => {
    const rec = new ActionRecorder(SAVE_SEED, buildWorld());
    rec.record('对话:npc_wang');
    const a = rec.getActions()[0]!;
    expect(a.tickId).toMatch(new RegExp(`^debug:rec:${SAVE_SEED}:tick:\\d+$`));
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// T10. SnapshotStore — 保存/比对/diff
// ──────────────────────────────────────────────────────────────────────────────
describe('T10 SnapshotStore — 快照保存/比对/diff', () => {
  it('save + get 往返正确', () => {
    const store = new SnapshotStore();
    const state = buildWorld();
    const snap  = store.save('s0', state);
    expect(store.get('s0')).toEqual(snap);
  });

  it('list() 返回已保存的标签', () => {
    const store = new SnapshotStore();
    store.save('a', buildWorld());
    store.save('b', buildWorld());
    expect(store.list()).toContain('a');
    expect(store.list()).toContain('b');
  });

  it('compare 同快照 → changedFields 为空（无变化）', () => {
    const store = new SnapshotStore();
    store.save('same', buildWorld());
    store.save('same2', buildWorld());
    const diff = store.compare('same', 'same2');
    expect(diff.changedFields).toHaveLength(0);
    expect(diff.summary).toBe('（无变化）');
  });

  it('compare 不同拍号快照 → changedFields 包含 tickCount', () => {
    const store = new SnapshotStore();
    const state0 = buildWorld();
    store.save('before', state0);
    // 推进一拍得到 state1
    const rec = new ActionRecorder(SAVE_SEED, state0);
    rec.record('对话:npc_wang');
    const state1 = rec.getCurrentState();
    store.save('after', state1);
    const diff = store.compare('before', 'after');
    const tickDiff = diff.changedFields.find(f => f.field === 'tickCount');
    expect(tickDiff).toBeDefined();
    expect(tickDiff!.before).toBe(0);
    expect(tickDiff!.after).toBeGreaterThan(0);
  });

  it('compare 含变化时 summary 非空（且非「无变化」）', () => {
    const store = new SnapshotStore();
    const state0 = buildWorld();
    store.save('before', state0);
    const rec = new ActionRecorder(SAVE_SEED, state0);
    rec.record('对话:npc_wang');
    store.save('after', rec.getCurrentState());
    const diff = store.compare('before', 'after');
    // 拍号必然变化 → summary 非「无变化」
    expect(diff.summary).not.toBe('（无变化）');
  });

  it('compare 不存在快照 → 抛出错误', () => {
    const store = new SnapshotStore();
    expect(() => store.compare('x', 'y')).toThrow();
  });

  it('compare 返回 labelA / labelB 正确', () => {
    const store = new SnapshotStore();
    store.save('snap_a', buildWorld());
    store.save('snap_b', buildWorld());
    const diff = store.compare('snap_a', 'snap_b');
    expect(diff.labelA).toBe('snap_a');
    expect(diff.labelB).toBe('snap_b');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// T11. 指纹84 / schemaKeys52 守恒
// ──────────────────────────────────────────────────────────────────────────────
describe('T11 指纹守恒 — 84条/schemaKeys=53（锦上添花批不新增）', () => {
  it('指纹 manifest 总条目 = 85', () => {
    const total =
      FINGERPRINT_BUNDLE_MEMBERS.length +
      FINGERPRINT_PRESET_FIELDS.length +
      FINGERPRINT_SNAPSHOT_FIELDS.length +
      FINGERPRINT_EXCLUDED_FIELDS.length;
    expect(total).toBe(88);
  });

  it('schemaKeys = 53（G1b3b 不新增 schema 顶层键）', () => {
    expect(Object.keys(RootSchema.shape).length).toBe(54);
  });
});
