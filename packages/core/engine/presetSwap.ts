// PR-1: 预设切换原语 + 状态隔离 + 可拆卸卸载
// 纯函数·确定性·Ring 0·禁 Date.now/Math.random/localeCompare/裸JSON.stringify/NFC
//
// 依赖:
//   segment.ts  — openSegment / shouldOpenNewSegment / verifySegmentChain（F-c·禁第二实现）
//   rng.ts      — hashCanonical（只读调用·函数体零 diff）
//   preset.ts   — 玩法预设Schema（Zod parse + validate）
//
// 红线：gate.ts / rng.ts / conservation.ts / fingerprintManifest.ts 函数体零 diff。
// schemaKeys=52 守恒（不新增顶层 key）。BUNDLE/manifest 不变。

import type { RootState } from '../schema/index.js';
import { 玩法预设Schema } from '../schema/preset.js';
import type { VersionSegmentHead, SegmentVerifyResult } from './segment.js';
import { openSegment, shouldOpenNewSegment, verifySegmentChain } from './segment.js';
import { hashCanonical } from './rng.js';
import type { 受治理键空间注册表Type } from '../schema/governedKeySpace.js';

// ── P1-3 状态所有权宣言（隔离边界·只读常量·文档用途）─────────────────────────────────
// world-owned  : 预设切换后继续存留（实体/记忆/账本/地图/关系网）
// preset-owned (in-state)  : 受治理键空间注册表 来源包===presetId 条目 + 世界域引用 + _tick 难度指纹
// preset-owned (external)  : 引擎配方/规则/媒介登记 ← 外部 preset 对象·非 RootState
export const WORLD_OWNED_STATE_KEYS = [
  'NPC',
  '已故NPC归档',
  '认知档案',
  '货币系统',
  '工作记忆',
  '长期归档',
  '组织实体',
  '组织关系网',
  '全局',
  '地图',
  '世界',
] as const satisfies ReadonlyArray<keyof RootState>;

export type WorldOwnedKey = (typeof WORLD_OWNED_STATE_KEYS)[number];

// ── 接口 ──────────────────────────────────────────────────────────────────────

export interface SwapPresetOptions {
  /** 目标世界域 ID；缺省取第一个域 */
  domainId?: string;
  /** 引擎版本（进段头指纹·对应 segment.ts params.引擎版本） */
  engineVersion?: string;
  /** Schema 版本（进段头指纹·对应 segment.ts params.Schema版本） */
  schemaVersion?: string;
}

export interface SwapPresetResult {
  state: RootState;
  /** 是否开了新段（版本/难度系数组变化→ true） */
  openedNewSegment: boolean;
  /** 段链校验结果（false + warnings = D4 警示，调用方应拒载） */
  chainValid: boolean;
  /** 未注册句柄警告·D4 断链警示（fail-open·纯日志·不阻断） */
  warnings: string[];
}

// ── P1-1: swapPreset —————————————————————————————————————————————————————————

/**
 * swapPreset: 运行时预设切换原语（纯函数·确定性）
 *
 * 执行序：
 *   ① Zod parse + validate（throws ZodError on invalid）
 *   ② 退化守卫：oldPresetId === newPresetId + 版本/难度一致 → state 逐位不变
 *   ③ 卸旧预设命名空间（受治理键空间注册表 中 来源包===oldPresetId 条目）
 *   ④ 计算新预设难度系数组指纹（hashCanonical(难度系数组)·rng.ts 只读调用）
 *   ⑤ shouldOpenNewSegment → openSegment（复用 F-c segment.ts·禁第二实现）
 *   ⑥ verifySegmentChain → 断链 → D4 警示 warnings，不 throw
 *   ⑦ 更新 世界域引用 + _tick 难度指纹 + _存档头 段记录（additive surgical patch）
 *
 * 红线遵守：禁 Date.now / Math.random。hashCanonical 来自 rng.ts，只读调用，函数体零 diff。
 */
export function swapPreset(
  state: RootState,
  newPreset: unknown,
  opts: SwapPresetOptions = {},
  resolvedRules?: Record<string, unknown>,
): SwapPresetResult {
  const warnings: string[] = [];

  // ① Zod parse（throws ZodError if invalid）
  const parsed = 玩法预设Schema.parse(newPreset);
  const newPresetId = parsed.预设ID || '__preset__';

  // ② 目标域
  const domainKeys = Object.keys(state.世界域);
  const domainId = opts.domainId ?? (domainKeys.length > 0 ? domainKeys[0]! : '__default__');
  const oldPresetId = state.世界域[domainId]?.玩法预设引用 ?? '';

  // ④ 新难度系数组指纹（先算·退化守卫需要比对）
  // 难度系数组 已迁入规则库·由调用方经 resolve() 获得并通过 resolvedRules 传入
  const 难度系数组 = (resolvedRules?.['难度系数组'] as object | undefined) ?? {};
  const newDifficultyFingerprint = hashCanonical(难度系数组);

  // ② 退化守卫：预设ID + 版本 + 难度均不变 → 逐位不变
  const prevSegRecords = state._存档头.版本段记录 ?? [];
  const lastSeg = prevSegRecords.length > 0 ? prevSegRecords[prevSegRecords.length - 1]! : null;
  const prevEngineVersion = lastSeg?.引擎版本;
  const prevSchemaVersion = lastSeg?.Schema版本;
  const prevDifficultyFP = state._tick.难度系数组指纹;

  if (
    oldPresetId === newPresetId &&
    opts.engineVersion === prevEngineVersion &&
    opts.schemaVersion === prevSchemaVersion &&
    newDifficultyFingerprint === prevDifficultyFP
  ) {
    return { state, openedNewSegment: false, chainValid: true, warnings };
  }

  // ③ 卸旧预设命名空间
  const registryAfterUnload: 受治理键空间注册表Type = oldPresetId
    ? removePresetFromRegistry(state.受治理键空间注册表, oldPresetId)
    : state.受治理键空间注册表;

  // ⑤ 指纹分段（复用 segment.ts·F-c·禁第二实现）
  // exactOptionalPropertyTypes 安全：undefined 不显式赋值，仅在有值时加入对象
  const segParams: { 引擎版本?: string; Schema版本?: string; 难度系数组指纹?: string } = {
    难度系数组指纹: newDifficultyFingerprint,
  };
  if (opts.engineVersion !== undefined) segParams.引擎版本 = opts.engineVersion;
  if (opts.schemaVersion !== undefined) segParams.Schema版本 = opts.schemaVersion;
  // 构造精确类型的视图（避免 Zod 推断的 T|undefined optional 与 VersionSegmentHead 的类型冲突）
  const prevSegsTyped: VersionSegmentHead[] =
    (prevSegRecords as unknown) as VersionSegmentHead[];
  const segView: { 版本段记录?: VersionSegmentHead[] } =
    prevSegsTyped.length > 0 ? { 版本段记录: prevSegsTyped } : {};
  const needNewSeg = shouldOpenNewSegment(segView, segParams);
  const newSegRecords: VersionSegmentHead[] = needNewSeg
    ? openSegment(segView, segParams)
    : prevSegsTyped;

  // ⑥ 验链（断链=D4警示·不throw）
  const chainResult: SegmentVerifyResult = verifySegmentChain({ 版本段记录: newSegRecords });
  if (!chainResult.valid) {
    warnings.push(
      `[D4] 版本段哈希链断链 brokenAt=${chainResult.brokenAt}: ${chainResult.message}`,
    );
  }

  // ⑦ 构造新 state（additive surgical patch）
  const currentDomain = state.世界域[domainId];
  const newState: RootState = {
    ...state,
    世界域: {
      ...state.世界域,
      [domainId]: {
        ...(currentDomain ?? { 封存状态: false, 累计活跃区间表: [] }),
        玩法预设引用: newPresetId,
      },
    },
    受治理键空间注册表: registryAfterUnload,
    _存档头: {
      ...state._存档头,
      ...(newSegRecords.length > 0 ? { 版本段记录: newSegRecords } : {}),
    },
    _tick: {
      ...state._tick,
      难度系数组指纹: newDifficultyFingerprint,
    },
  };

  return {
    state: newState,
    openedNewSegment: needNewSeg,
    chainValid: chainResult.valid,
    warnings,
  };
}

// ── P1-4: unloadPreset ────────────────────────────────────────────────────────

/**
 * unloadPreset: 清理预设全部命名空间绑定（纯函数·幂等）
 *
 * 铁律：
 *   · 幂等：presetId 未在任何域中挂载 → 直接返回 state（no-op）
 *   · dangling fail-closed：预设注册的句柄被 _lore知识库 引用 → throw（不静默）
 *   · 清理范围：受治理键空间注册表（来源包===presetId）+ 世界域引用（清空为''）
 */
export function unloadPreset(state: RootState, presetId: string): RootState {
  // 幂等：presetId 未在任何域挂载 → no-op
  const isMounted = Object.values(state.世界域).some(
    (d) => d.玩法预设引用 === presetId,
  );
  if (!isMounted) return state;

  // dangling fail-closed：检测卸载后会暴露的孤儿引用
  const danglingRefs = findDanglingRefs(state, presetId);
  if (danglingRefs.length > 0) {
    throw new Error(
      `[PR-1] unloadPreset: preset "${presetId}" 有孤儿引用，拒绝卸载。refs: ${danglingRefs.join(' | ')}`,
    );
  }

  return {
    ...state,
    世界域: Object.fromEntries(
      Object.entries(state.世界域).map(([k, v]) => [
        k,
        v.玩法预设引用 === presetId ? { ...v, 玩法预设引用: '' } : v,
      ]),
    ),
    受治理键空间注册表: removePresetFromRegistry(state.受治理键空间注册表, presetId),
  };
}

// ── 内部ヘルパー（not exported·防外部依赖积累） ────────────────────────────────

/**
 * removePresetFromRegistry: 从 受治理键空间注册表 中移除 来源包===presetId 的全部条目。
 * 纯函数·fast-path on no match（引用返回·不新建对象）。
 */
function removePresetFromRegistry(
  registry: 受治理键空间注册表Type,
  presetId: string,
): 受治理键空间注册表Type {
  const entries = registry.键条目 ?? [];
  const filtered = entries.filter((e) => e.来源包 !== presetId);
  if (filtered.length === entries.length) return registry; // nothing removed
  return { ...registry, 键条目: filtered };
}

/**
 * findDanglingRefs: 查找卸载该 presetId 后会产生的孤儿引用。
 *
 * 扫描 _lore知识库 的 side_effects / cascade_on_change / 解除通道 字段，
 * 检查是否引用了此 presetId 注册的句柄（来源包===presetId 条目的 规范键）。
 * 复用 checkS6UnregisteredHandlerRefs 同款扫描算法（非重复实现·职责不同：
 *   S6 = 加载时查未注册串；本函数 = 卸载前查会变孤儿的串）。
 */
function findDanglingRefs(state: RootState, presetId: string): string[] {
  const presetHandleKeys = new Set(
    (state.受治理键空间注册表.键条目 ?? [])
      .filter((e) => e.来源包 === presetId)
      .map((e) => e.规范键),
  );
  if (presetHandleKeys.size === 0) return [];

  const refs: string[] = [];
  scanHandlerRefs(state._lore知识库, presetHandleKeys, refs, 0);
  return refs;
}

/** 递归扫描 handler ref 字段（side_effects / cascade_on_change / 解除通道） */
function scanHandlerRefs(
  node: unknown,
  keys: Set<string>,
  refs: string[],
  depth: number,
): void {
  if (depth > 10 || node === null || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) scanHandlerRefs(item, keys, refs, depth + 1);
    return;
  }
  const rec = node as Record<string, unknown>;
  if (Array.isArray(rec['side_effects'])) {
    for (const h of rec['side_effects'] as unknown[]) {
      if (typeof h === 'string' && keys.has(h)) refs.push(`side_effects:"${h}"`);
    }
  }
  if (Array.isArray(rec['cascade_on_change'])) {
    for (const h of rec['cascade_on_change'] as unknown[]) {
      if (typeof h === 'string' && keys.has(h)) refs.push(`cascade_on_change:"${h}"`);
    }
  }
  if (typeof rec['解除通道'] === 'string' && keys.has(rec['解除通道'])) {
    refs.push(`解除通道:"${rec['解除通道']}"`);
  }
  for (const k of Object.keys(rec)) {
    if (k === 'side_effects' || k === 'cascade_on_change' || k === '解除通道') continue;
    scanHandlerRefs(rec[k], keys, refs, depth + 1);
  }
}
