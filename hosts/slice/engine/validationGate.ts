// P0-8 Batch 2: 校验闸统一出入口
// 物理隔离架构：
//   内层（buildTruthSeekingSlice）= 见全局真值（全秘密母题）→ 供 PANGeA/WhatELSE 校验
//   外层（runValidationGate）= 输出过滤（outputFilteredSecrets）→ 输出不携带真值载荷
//
// 拍板④ 保证: 校验见真相 ↔ 输出 POV 过滤，两层物理隔离·校验器输出不含 $谜底
// 与 Batch 1 前置闸协同: 前置闸管输入侧（assemblePrompt）·本闸管产出侧·出口统一过滤

import type { RootState } from '@ai-life-sim/core';
import type { 秘密库条目Type } from '@ai-life-sim/core';
import { filterSecretsForPOV } from '@ai-life-sim/core/engine/knowledgeFilter';
import {
  deriveBeliefState,
  type BeliefState,
} from '@ai-life-sim/core/engine/beliefDerive';
import {
  validateNarrativeSemantics,
  DEFAULT_RETRY_MODE,
  type ValidationSlice,
  type RetryMode,
  type NarrativeConflict,
  type SoftRejectHint,
} from '@ai-life-sim/core/engine/narrativeValidator';
import {
  validateMotivations,
  buildMotivationAnchor,
  type MotivationConflict,
  type MotivationAnchor,
} from '@ai-life-sim/core/engine/motivationValidator';

export type { NarrativeConflict, MotivationConflict, SoftRejectHint, RetryMode };

export interface ValidationGateOptions {
  povKey: string;
  retryMode?: RetryMode;
  /** 纠偏重试叙事（生产侧=LLM 重试结果·测试侧=fixture） */
  retryNarrative?: string;
}

export interface ValidationGateResult {
  valid: boolean;
  conflicts: NarrativeConflict[];
  motConflicts: MotivationConflict[];
  softReject?: SoftRejectHint;
  retriedOnce: boolean;
  /** 出口过滤后的 POV 可见秘密（无真值·已过 filterSecretsForPOV） */
  outputFilteredSecrets: Record<string, { 母题: string; 严重度: number; 暴露度: number }>;
}

// ── 内部函数（不导出·真值层·物理隔离）──────────────────────────────────────────────

/**
 * 构建真值可见的校验切片（内部用·禁透传到输出）。
 * 核心物理隔离: allSecretMotifs 含全局真值·外层不返回此数组。
 */
function buildTruthSeekingSlice(
  state: RootState,
  povKey: string,
): ValidationSlice {
  const fullSecrets = (state.全局?.秘密库 ?? {}) as Record<string, 秘密库条目Type>;
  // 真值层：全秘密母题（含 POV 不知情的）
  const allSecretMotifs = Object.values(fullSecrets).map(s => s.母题).filter(Boolean);

  // POV 知情面：经 filterSecretsForPOV 过滤
  const povFiltered = filterSecretsForPOV(fullSecrets, povKey);
  const povKnownMotifs = Object.values(povFiltered).map(s => s.母题).filter(Boolean);

  // 在场/不在场 NPC 显示名
  const pc = state.NPC?.[povKey];
  const povLoc = pc?.位置 ?? '';
  const presentNpcNames: string[] = [];
  const absentNpcNames: string[] = [];
  for (const [key, npc] of Object.entries(state.NPC ?? {})) {
    if (key === povKey) continue;
    const name = (npc.姓名 as string | undefined) ?? key;
    if (npc.位置 === povLoc) {
      presentNpcNames.push(name);
    } else {
      absentNpcNames.push(name);
    }
  }

  return {
    allSecretMotifs,     // 真值层·仅内部使用·不随输出返回
    povKnownMotifs,
    presentNpcNames,
    absentNpcNames,
    tickCount: (state._tick?.拍计数 as number | undefined) ?? 1,
  };
}

/**
 * 构建 NPC 动机锚列表（内部函数·依赖①信念态）。
 */
function buildMotivationAnchors(
  state: RootState,
  beliefState: BeliefState,
  povKey: string,
): MotivationAnchor[] {
  const anchors: MotivationAnchor[] = [];
  const pc = state.NPC?.[povKey];
  const povLoc = pc?.位置 ?? '';

  for (const [key, npc] of Object.entries(state.NPC ?? {})) {
    if (key === povKey) continue;
    if (npc.位置 !== povLoc) continue; // 只建在场 NPC 的动机锚

    const name = (npc.姓名 as string | undefined) ?? key;

    // 情绪栈顶层情绪名
    type EmotionEntry = { 情绪名?: string };
    const emotions = ((npc.情绪栈 as EmotionEntry[] | undefined) ?? [])
      .slice(-3).map(e => e.情绪名 ?? '').filter(Boolean);

    // 高重要度记忆情绪色彩
    type MemEntry = { 重要度?: number; 情绪色彩?: string };
    const memTags = ((npc.记忆 as MemEntry[] | undefined) ?? [])
      .filter(m => (m.重要度 ?? 0) >= 2)
      .slice(-5)
      .map(m => m.情绪色彩 ?? '')
      .filter(Boolean);

    anchors.push(buildMotivationAnchor(key, name, beliefState, emotions, memTags));
  }
  return anchors;
}

// ── 导出函数 ─────────────────────────────────────────────────────────────────────

/**
 * 校验闸（物理隔离统一出口）。
 *
 * 内部: 见全局真值 → PANGeA 越权知情检测 + WhatELSE 动机校验。
 * 外部: 输出 outputFilteredSecrets（POV 过滤·无真值载荷）。
 * 依赖①信念态：beliefState 须由 deriveBeliefState 预先构建后传入。
 *
 * @param narrative  待校验叙事文本
 * @param state      完整世界状态（含全局真值·内部只读）
 * @param opts       校验选项（povKey / retryMode / retryNarrative）
 * @param beliefState  ①信念态（由调用方预先派生·不可绕过）
 */
export function runValidationGate(
  narrative: string,
  state: RootState,
  opts: ValidationGateOptions,
  beliefState?: BeliefState,
): ValidationGateResult {
  const { povKey, retryMode = DEFAULT_RETRY_MODE, retryNarrative } = opts;

  // ── 内层：真值可见校验 ──────────────────────────────────────────────────────────
  const truthSlice = buildTruthSeekingSlice(state, povKey);

  // 若未传入信念态则内部派生（narrative 路径·不进指纹）
  const fullSecrets = (state.全局?.秘密库 ?? {}) as Record<string, 秘密库条目Type>;
  const povFiltered = filterSecretsForPOV(fullSecrets, povKey);
  const effectiveBeliefState = beliefState ?? deriveBeliefState(
    (state.认知档案 as Record<string, Record<string, unknown>> | undefined)?.[povKey] as
      Record<string, { 印象?: Array<{ 标签?: string; 极性?: string; 强度?: number }> }> | undefined,
    povFiltered,
    povKey,
    'narrative',
  );

  // PANGeA 语义校验
  const narrativeResult = validateNarrativeSemantics(
    narrative, truthSlice, retryNarrative, retryMode,
  );

  // WhatELSE 动机校验
  const anchors = buildMotivationAnchors(state, effectiveBeliefState, povKey);
  const narrativeToCheck = narrativeResult.retriedOnce && retryNarrative !== undefined
    ? retryNarrative
    : narrative;
  const motConflicts = validateMotivations(narrativeToCheck, anchors);

  // ── 外层：输出 POV 过滤（禁带真值载荷）──────────────────────────────────────────
  // outputFilteredSecrets 只含 POV 已知秘密·不含 allSecretMotifs 等真值
  const outputFilteredSecrets = povFiltered;

  const valid = narrativeResult.valid && motConflicts.length === 0;

  return {
    valid,
    conflicts: narrativeResult.conflicts,
    motConflicts,
    softReject: narrativeResult.softReject,
    retriedOnce: narrativeResult.retriedOnce,
    outputFilteredSecrets,
  };
}

/**
 * 便捷函数：从 RootState + POV 构建信念态（供调用方在 runValidationGate 前预构建）。
 * trackPath='narrative'（叙事侧·不进指纹）。
 */
export function deriveBeliefFromState(
  state: RootState,
  povKey: string,
): BeliefState {
  const fullSecrets = (state.全局?.秘密库 ?? {}) as Record<string, 秘密库条目Type>;
  const povFiltered = filterSecretsForPOV(fullSecrets, povKey);
  const cogArchive = (state.认知档案 as Record<string, Record<string, unknown>> | undefined)?.[povKey];
  return deriveBeliefState(
    cogArchive as Record<string, { 印象?: Array<{ 标签?: string; 极性?: string; 强度?: number }> }> | undefined,
    povFiltered,
    povKey,
    'narrative',
  );
}
