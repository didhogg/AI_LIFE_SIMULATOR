// packages/core/engine/lodScheduler.ts
// PR-4 · LOD 调度器（P15–P21·T5）
//
// P4-1  promoteNode / demoteNode     — 单态不变式 + checkpoint（粗↔实体·原子·幂等）
// P4-2  startWarmWindow / checkWarmWindow / tryDemoteNode — 保温滞回防抖
// P4-3  detectCrossRegion / handleRegionCross             — 跨区自动物化/解聚
// P4-4  detectLodTrigger             — 切换时机四条件检测器（引擎被动·LLM 不触发）
// P4-5  executeTraversal / isCrossDomainAccess            — 穿越契约执行 + 跨域隔离
//
// 纯函数·确定性·Ring 0·六禁：禁 Date.now/new Date/Math.random/localeCompare/裸 JSON.stringify/NFC
// 红线：gate.ts/rng.ts/conservation.ts/computeDelta.ts/fixed.ts/propagateRipple 函数体零 diff

import type { RootState } from '../schema/index.js';
import type { 玩法预设Type } from '../schema/preset.js';
import type { LOD态条目 } from '../schema/lodTable.js';
import { 穿越契约Schema } from '../schema/preset.js';
import type { z } from 'zod';
import { locRegion, buildRegionGraph, bfsRegionHops, type LocRecord } from './tick.js';
import { materializeCoarseNode } from './lodEngine.js';
import { applyDriftCandidate } from './economyEngine.js';

type 穿越契约Type = z.infer<typeof 穿越契约Schema>;

// ── 常量 ─────────────────────────────────────────────────────────────────────

/** 默认保温窗口（拍数）：离开区域后维持「实体」态，防反复跨界抖动。 */
export const LOD_WARM_WINDOW_DEFAULT = 3;

// ── P4-1 · 单态不变式 + checkpoint ────────────────────────────────────────────

/**
 * 促升：location node 粗→实体（in-place·调用方须已 structuredClone）。
 *
 * - nodeKey 不存在 → 幂等 no-op（退化守卫）
 * - LOD表[nodeKey].档位 已='实体' → 幂等 no-op（单态保证）
 * - 物化 nodeKey 下所有 LOD档位='粗' 的 NPC（复用 materializeCoarseNode·PR-2）
 * - 写 checkpoint：LOD表[nodeKey].档位 = '实体'（原子转换·惰性建条目）
 */
export function promoteNode(state: RootState, nodeKey: string, seed: number): void {
  if (state.LOD表[nodeKey]?.档位 === '实体') return; // 幂等

  const loc = state.地图?.地点?.[nodeKey];
  if (!loc) return; // 不存在节点 → no-op

  // 物化该区域下的粗节点 NPC（LOD-B4b: 读 LOD表·写 LOD表）
  for (const npcKey of Object.keys(state.NPC)) {
    const npc = state.NPC[npcKey];
    if (npc && npc.位置 === nodeKey && state.LOD表[npcKey]?.档位 === '粗') {
      materializeCoarseNode(state, npcKey, seed);
      state.LOD表[npcKey]!.档位 = '实体';
    }
  }

  // 写 checkpoint（原子：LOD表 单态转换·惰性建条目）
  if (!state.LOD表[nodeKey]) {
    const entry: LOD态条目 = { 模块键: nodeKey, 档位: '粗' };
    state.LOD表[nodeKey] = entry;
  }
  state.LOD表[nodeKey]!.档位 = '实体';
}

/**
 * 降级：location node 实体→粗（in-place·调用方须已 structuredClone）。
 *
 * - LOD表[nodeKey].档位 非 '实体' → 幂等 no-op（含 undefined·单态保证）
 * - 离开再聚合：对该区域所有品类调用 applyDriftCandidate（P14·复用 PR-3）
 * - 写 LOD表[nodeKey].档位='粗'，清空 保温到期拍号（原子转换）
 */
export function demoteNode(state: RootState, nodeKey: string, preset?: 玩法预设Type): void {
  if (state.LOD表[nodeKey]?.档位 !== '实体') return; // 幂等（含 undefined）

  // 离开再聚合（P14·复用 PR-3 applyDriftCandidate）
  if (preset?.经济生成规则) {
    const locs = state.地图?.地点 ?? {};
    const regionId = locRegion(nodeKey, locs) ?? nodeKey;
    const regionPrices = state.地图?.区域物价?.[regionId];
    if (regionPrices) {
      for (const category of Object.keys(regionPrices)) {
        applyDriftCandidate(state, preset, regionId, category);
      }
    }
  }

  // 写 LOD表（单态转换）+ 清空保温
  const entry = state.LOD表[nodeKey]!;
  entry.档位 = '粗';
  // exactOptionalPropertyTypes: 用 delete 代替赋值 undefined
  if ('保温到期拍号' in entry) {
    delete (entry as { 保温到期拍号?: number }).保温到期拍号;
  }
}

// ── P4-2 · 保温滞回窗口防 thrash ──────────────────────────────────────────────

function getWarmWindow(preset?: 玩法预设Type): number {
  return preset?.LOD保温窗口 ?? LOD_WARM_WINDOW_DEFAULT;
}

/**
 * 起始保温窗口（in-place）。
 * 写 LOD表[nodeKey].保温到期拍号 = currentTick + warmWindow（实体态在到期拍内可复用）。
 * 节点不存在于地图 → no-op（防孤儿条目）。
 */
export function startWarmWindow(
  state: RootState,
  nodeKey: string,
  currentTick: number,
  preset?: 玩法预设Type,
): void {
  if (!state.地图?.地点?.[nodeKey]) return; // guard: loc must exist
  if (!state.LOD表[nodeKey]) {
    const entry: LOD态条目 = { 模块键: nodeKey, 档位: '粗' };
    state.LOD表[nodeKey] = entry;
  }
  state.LOD表[nodeKey]!.保温到期拍号 = currentTick + getWarmWindow(preset);
}

/**
 * 检查是否在保温窗口内（纯·只读）。
 * 返回 true = 在窗口内，不应 demote；false = 已超窗或无窗口。
 */
export function checkWarmWindow(state: RootState, nodeKey: string, currentTick: number): boolean {
  const expiry = state.LOD表[nodeKey]?.保温到期拍号;
  return expiry !== undefined && currentTick <= expiry;
}

/**
 * 尝试 demote（考虑保温窗口·in-place）。
 * 窗口内 → no-op（复用实体态）；超窗 → demoteNode。
 */
export function tryDemoteNode(
  state: RootState,
  nodeKey: string,
  currentTick: number,
  preset?: 玩法预设Type,
): void {
  if (checkWarmWindow(state, nodeKey, currentTick)) return;
  demoteNode(state, nodeKey, preset);
}

// ── P4-3 · 跨区自动物化/解聚 ──────────────────────────────────────────────────

/**
 * 检测位置跨区（纯·只读）。
 * 返回 true = prevLocKey 与 curLocKey 所属不同区域（或有一方无区域·算跨区）。
 * 同一地点 → false（优化短路）。
 */
export function detectCrossRegion(
  state: RootState,
  prevLocKey: string,
  curLocKey: string,
): boolean {
  if (prevLocKey === curLocKey) return false;
  const locs: LocRecord = state.地图?.地点 ?? {};
  const prevRegion = locRegion(prevLocKey, locs);
  const curRegion = locRegion(curLocKey, locs);
  return prevRegion !== curRegion;
}

/**
 * 处理区域过渡（in-place·调用方须已 structuredClone）。
 * - promote 目标区域（懒加载·无 NPC 则无物化成本）
 * - 对离开区域起保温窗口（不立即 demote·防抖）
 * - 只改 LOD 态指针，实体状态全保留，绝不污染预设
 */
export function handleRegionCross(
  state: RootState,
  prevLocKey: string,
  curLocKey: string,
  seed: number,
  currentTick: number,
  preset?: 玩法预设Type,
): void {
  const locs: LocRecord = state.地图?.地点 ?? {};
  const prevRegion = locRegion(prevLocKey, locs) ?? prevLocKey;
  const newRegion = locRegion(curLocKey, locs) ?? curLocKey;

  // Promote 目标区域
  promoteNode(state, newRegion, seed);

  // 对离开区域起保温窗口（不立即 demote）
  if (prevRegion !== newRegion) {
    startWarmWindow(state, prevRegion, currentTick, preset);
  }
}

// ── P4-4 · 切换时机四条件检测器 ────────────────────────────────────────────────

export interface LodTriggerCtx {
  /** NPC/PC 当前地点键 */
  locKey: string;
  /** NPC.所属组织[].组织键 列表 */
  orgKeys: string[];
  /** 世界.纪元分钟 */
  epochMin: number;
  /** 世界.历法.年号表 中当前年号标签（'' = 无历法 / 初始） */
  eraLabel: string;
  /** LOD-B2.5 条件④：consumer 在调用前注入的连续偏离拍数（由 scheduleLodPhase 从 LOD表 读取后传入） */
  consecutiveDriftCount?: number;
}

export interface LodTriggerResult {
  triggered: boolean;
  /** 首个命中的条件（仅 triggered=true 时有值） */
  condition?: '跨区' | '纪元跨时代' | '组织归属变更' | '连续偏离';
}

/**
 * 切换时机四条件检测器（纯·只读·确定性）。
 * LLM 不能主动触发；引擎被动检测，任一条件命中 → triggered=true。
 *
 * ① 位置跨区（locRegion 不同）
 * ② 纪元跨时代（年号标签变更）
 * ③ 组织归属变更（所属组织集合差异）
 * ④ 规范评估器连续 N 拍偏离基线（留参数化入口·consumer 注入偏离拍数·此处 defer）
 */
export function detectLodTrigger(
  state: RootState,
  prev: LodTriggerCtx,
  cur: LodTriggerCtx,
): LodTriggerResult {
  const locs: LocRecord = state.地图?.地点 ?? {};

  // ① 位置跨区
  if (prev.locKey !== cur.locKey) {
    const prevRegion = locRegion(prev.locKey, locs);
    const curRegion = locRegion(cur.locKey, locs);
    if (prevRegion !== curRegion) {
      return { triggered: true, condition: '跨区' };
    }
  }

  // ② 纪元跨时代（年号标签变更·非空才视为有效历法）
  if (prev.eraLabel !== cur.eraLabel && cur.eraLabel !== '') {
    return { triggered: true, condition: '纪元跨时代' };
  }

  // ③ 组织归属变更（集合差异判定·禁 localeCompare·字面量 Set 比较）
  const prevOrgs = new Set(prev.orgKeys);
  const curOrgs = new Set(cur.orgKeys);
  for (const o of prevOrgs) {
    if (!curOrgs.has(o)) return { triggered: true, condition: '组织归属变更' };
  }
  for (const o of curOrgs) {
    if (!prevOrgs.has(o)) return { triggered: true, condition: '组织归属变更' };
  }

  // ④ 连续偏离基线：consumer 在调用前将 LOD表[pcLocKey].连续偏离计数 注入 cur.consecutiveDriftCount
  // N 由 lodPhase.LOD_DRIFT_N 定义（= 3）；此处只做阈值比较，计数管理在 scheduleLodPhase
  if ((cur.consecutiveDriftCount ?? 0) >= 3) {
    return { triggered: true, condition: '连续偏离' };
  }

  return { triggered: false };
}

// ── P4-5 · 穿越 = 切世界域 + 穿越契约执行 ────────────────────────────────────────

/**
 * 执行穿越契约（in-place·调用方须已 structuredClone）。
 *
 * 步骤：
 * ① 切世界域：封存 fromDomainId，激活（解封）toDomainId
 * ② 属性映射：按 contract.属性映射 重命名 PC 属性轴键
 * ③ 技能等价表：按 contract.技能等价表 重命名 PC 技能键
 * ④ 货币处理：'丢失'/'归零' → 清空持有；'保留'/'按汇率' → 留原值（汇率 executor=stub·P2）
 * ⑤ 携带白名单：只保留 contract.携带白名单 中的物品键
 *
 * 明确排除（本轮不接）：记忆卡导入导出、换角 POV、魂穿注入面（PR-5b）。
 */
export function executeTraversal(
  state: RootState,
  fromDomainId: string,
  toDomainId: string,
  pcKey: string,
  contract: 穿越契约Type,
): void {
  // ① 切世界域
  const fromDomain = state.世界域[fromDomainId];
  if (fromDomain) fromDomain.封存状态 = true;
  const toDomain = state.世界域[toDomainId];
  if (toDomain) toDomain.封存状态 = false;

  const pc = state.NPC[pcKey];
  if (!pc) return;

  // ② 属性映射（旧轴名→新轴名·additive rename）
  const attrMap = contract.属性映射;
  if (attrMap) {
    const entries = Object.entries(attrMap);
    if (entries.length > 0) {
      const attrs = pc.属性 as Record<string, number>;
      for (const [oldKey, newKey] of entries) {
        if (oldKey in attrs && oldKey !== newKey) {
          attrs[newKey] = attrs[oldKey] ?? 0;
          delete attrs[oldKey];
        }
      }
    }
  }

  // ③ 技能等价表（旧技能键→新技能键）
  const skillMap = contract.技能等价表;
  if (skillMap) {
    for (const [oldSkill, newSkill] of Object.entries(skillMap)) {
      if (oldSkill in pc.技能 && oldSkill !== newSkill) {
        pc.技能[newSkill] = pc.技能[oldSkill]!;
        delete pc.技能[oldSkill];
      }
    }
  }

  // ④ 货币处理
  const currencyHandling = contract.货币处理;
  if (currencyHandling === '丢失' || currencyHandling === '归零') {
    const acct = state.货币系统?.账户?.[pcKey];
    if (acct) {
      acct.持有 = {};
    }
  }
  // '保留'/'按汇率' → 原值不动（汇率 executor = stub·P2 consumer）

  // ⑤ 携带白名单（非白名单物品清除）
  const whitelist = contract.携带白名单;
  if (whitelist && whitelist.length > 0) {
    const allowed = new Set(whitelist);
    for (const itemKey of Object.keys(pc.物品)) {
      if (!allowed.has(itemKey)) {
        delete pc.物品[itemKey];
      }
    }
  }
}

/**
 * 检测跨域主张（纯·只读）。
 * 来源世界域 ≠ currentDomainId → true（access=0·纯谣言·域内验证失败）。
 * 来源世界域 = undefined → 视为同域（向后兼容·access 正常）。
 */
export function isCrossDomainAccess(
  sourceDomain: string | undefined,
  currentDomainId: string,
): boolean {
  if (sourceDomain === undefined) return false;
  return sourceDomain !== currentDomainId;
}

// ── 辅助：获取区域图（复用 C1 buildRegionGraph·只读）────────────────────────
export { locRegion, buildRegionGraph, bfsRegionHops };
