// LOD-B2 · LOD 调度相位（tick registry 模型·dormant→active）
// 纯函数·确定性·Ring 0·六禁：禁 Date.now/new Date/Math.random/window/document/localeCompare
//
// P4-6  scheduleLodPhase  — registry 驱动·promote/demote/三条件接通
//
// 架构注：
//   LOD表（顶层·B1 additive）= 注册表（决定哪些节点受 LOD 治理）
//   散落字段（地図.地点[k].LOD态 / NPC[k].LOD档位 / 地点.保温到期拍号）= 实际状态（B4 再迁移）
//   B2 不迁移散落字段·不写 LOD表 条目字段·仅驱动现有 scheduler 函数

import type { RootState } from '../schema/index.js';
import type { 玩法预设Type } from '../schema/preset.js';
import { locRegion, type LocRecord } from './tick.js';
import {
  promoteNode,
  tryDemoteNode,
  handleRegionCross,
  detectLodTrigger,
  type LodTriggerCtx,
} from './lodScheduler.js';
import { dispatchLodGenerate } from './lodMount.js';

// ── §四·6 定稿常量 ───────────────────────────────────────────────────────────

/** promote 每拍硬上限（§四·6 定稿值·静态·动态 computeResourceFactor 留 B2.5） */
export const LOD_PROMOTE_BUDGET = 8;

/** 经济漂移触发 demote 阈值（20%·§四·6·动态资源因子留 B2.5） */
export const LOD_DRIFT_THRESHOLD = 0.20;

// ── 主入口 ────────────────────────────────────────────────────────────────────

/**
 * LOD 调度相位（registry 模型）。
 * 由 tick.ts runPhase('LOD调度') 调用；亦可由单元测试直接调用。
 *
 * @param s            当前（已 structuredClone）RootState（in-place 修改）
 * @param rngSeed      存档级 RNG 种子（s.$存档种子 ?? 0）
 * @param currentTick  当前拍计数（s._tick?.拍计数 ?? 0）
 * @param prevLocCtxs  前一拍实体位置上下文（三条件 detectLodTrigger 用）；
 *                     tick 正路传 undefined → 三条件路径退化为 no-op（无跨拍历史存储·B3+）
 * @param preset       玩法预设（可选·缺省=退化 no-op）
 */
export function scheduleLodPhase(
  s: RootState,
  rngSeed: number,
  currentTick: number,
  prevLocCtxs?: Map<string, LodTriggerCtx>,
  preset?: 玩法预设Type,
): void {
  // ── 双保险 guard：空 LOD表 → 提前 return·零 state 写·零 RNG draw ──────
  if (Object.keys(s.LOD表).length === 0) return;

  const locs: LocRecord = s.地图?.地点 ?? {};
  const nowEpochMin = s.世界?.纪元分钟 ?? 0;

  // ── 当前年号标签 ─────────────────────────────────────────────────────────
  const curEraLabel = resolveEraLabel(s.世界?.历法?.年号表 ?? [], nowEpochMin);

  // ── PC 键集（from _席位表·焦点角色键） ──────────────────────────────────
  const pcKeys = new Set(
    Object.values(s._席位表 ?? {})
      .map(seat => seat.焦点角色键)
      .filter((k): k is string => typeof k === 'string' && k.length > 0),
  );

  // PC → 当前地点键映射
  const pcLocMap = new Map<string, string>();
  for (const pcKey of pcKeys) {
    const locKey = s.NPC[pcKey]?.位置;
    if (locKey) pcLocMap.set(pcKey, locKey);
  }

  // ── B3: build cur contexts for all PCs（用于三条件 detect + 快照写入）──
  const curCtxMap = new Map<string, LodTriggerCtx>();
  for (const [pcKey, curLocKey] of pcLocMap) {
    const pcOrgKeys = (s.NPC[pcKey]?.所属组织 ?? []).map(o => o.组织键);
    curCtxMap.set(pcKey, {
      locKey: curLocKey,
      orgKeys: pcOrgKeys,
      epochMin: nowEpochMin,
      eraLabel: curEraLabel,
    });
  }

  // ── B3: state-based prevLocCtxs（参数优先·兼 B2 测试·无参时读 _系统 快照）──
  const effectivePrevLocCtxs: Map<string, LodTriggerCtx> | undefined =
    prevLocCtxs ??
    (s._系统?.LOD位置快照
      ? new Map(
          Object.entries(s._系统.LOD位置快照).map(([k, v]) => [
            k,
            {
              locKey: v.locKey ?? '',
              orgKeys: v.orgKeys ?? [],
              epochMin: v.epochMin ?? 0,
              eraLabel: v.eraLabel ?? '',
            },
          ]),
        )
      : undefined);

  // ── promote 预算计数器（scheduler-local·每拍重置·不持久） ───────────────
  let promoteCount = 0;

  // ── registry 驱动：遍历 LOD表 成员键 ─────────────────────────────────────
  for (const nodeKey of Object.keys(s.LOD表)) {
    const nodeRegion = locRegion(nodeKey, locs) ?? nodeKey;

    // 判断是否有 PC 在本节点或同区域
    let pcPresent = false;
    for (const [, pcLocKey] of pcLocMap) {
      const pcRegion = locRegion(pcLocKey, locs) ?? pcLocKey;
      if (pcLocKey === nodeKey || pcRegion === nodeRegion) {
        pcPresent = true;
        break;
      }
    }

    if (pcPresent) {
      // PC 在场 → promote（预算守卫·超出直接跳过）
      if (promoteCount < LOD_PROMOTE_BUDGET) {
        promoteNode(s, nodeKey, rngSeed);
        dispatchLodGenerate(s, nodeKey, rngSeed); // B3: lodMount seam（NPC 已促升→索引器返空·no-op）
        promoteCount++;
      }
    } else {
      // PC 不在场 → tryDemoteNode（内部检查保温窗口·到期才 demote）
      tryDemoteNode(s, nodeKey, currentTick, preset);
    }
  }

  // ── 三条件接通：detectLodTrigger → handleRegionCross / promote ──────────
  if (effectivePrevLocCtxs) {
    for (const [pcKey, curCtx] of curCtxMap) {
      const prevCtx = effectivePrevLocCtxs.get(pcKey);
      if (!prevCtx) continue;

      const result = detectLodTrigger(s, prevCtx, curCtx);
      if (!result.triggered) continue;

      if (result.condition === '跨区') {
        // 跨区：promote 新区域 + 对旧区域起保温窗口（via handleRegionCross）
        if (promoteCount < LOD_PROMOTE_BUDGET) {
          handleRegionCross(s, prevCtx.locKey, curCtx.locKey, rngSeed, currentTick, preset);
          promoteCount++;
        }
      } else if (
        result.condition === '纪元跨时代' ||
        result.condition === '组织归属变更'
      ) {
        // 纪元/组织变更：promote 当前区域（同预算）
        if (promoteCount < LOD_PROMOTE_BUDGET) {
          const region = locRegion(curCtx.locKey, locs) ?? curCtx.locKey;
          promoteNode(s, region, rngSeed);
          promoteCount++;
        }
      }
    }
  }

  // ── B3: 写 LOD位置快照 到 _系统（冷启动首拍亦写·供下拍读 prev）──────────
  if (curCtxMap.size > 0) {
    const newSnapshot: Record<string, { locKey: string; orgKeys: string[]; epochMin: number; eraLabel: string }> = {};
    for (const [pcKey, ctx] of curCtxMap) {
      newSnapshot[pcKey] = {
        locKey: ctx.locKey,
        orgKeys: ctx.orgKeys,
        epochMin: ctx.epochMin,
        eraLabel: ctx.eraLabel,
      };
    }
    s._系统.LOD位置快照 = newSnapshot;
  }
}

// ── 内部辅助 ──────────────────────────────────────────────────────────────────

/** 从年号表（按 起始纪元分钟 升序）推导当前年号标签；无匹配返回 ''。 */
function resolveEraLabel(
  年号表: Array<{ 年号: string; 起始纪元分钟: number }>,
  nowEpochMin: number,
): string {
  let label = '';
  for (const entry of 年号表) {
    if (entry.起始纪元分钟 <= nowEpochMin) {
      label = entry.年号;
    }
  }
  return label;
}
