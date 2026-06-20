// P0-8 Batch 2: WhatELSE 因果/动机校验器
// 用①信念态校验叙事因果链与角色动机自洽（NPC 行为须由信念/情绪/记忆驱动）
// 依赖 beliefDerive.ts: BeliefState（①未就位禁开工铁律）
//
// 物理隔离铁律：输出 MotivationConflict.detail 禁含真值内容（同 narrativeValidator）
// 失败处理：同 PANGeA 软拒/重Roll 通道（由 validationGate.ts 统一调度）

import type { BeliefState, Belief } from './beliefDerive.js';

export type MotivationConflictType = '情绪矛盾' | '记忆违背' | '信念动机缺失';

export interface MotivationConflict {
  npcKey: string;
  conflictType: MotivationConflictType;
  /** 冲突描述——禁含真值内容（物理隔离） */
  detail: string;
}

export interface MotivationAnchor {
  npcKey: string;
  npcName: string;           // 用于叙事中人物名匹配
  topEmotions: string[];     // 情绪栈顶层情绪名（高强度负面情绪触发冲突检测）
  recentMemoryTags: string[]; // 高重要度记忆的情绪色彩/标签（记忆违背检测用）
  beliefs: Pick<Belief, 'content' | 'certainty' | 'subjectKey'>[]; // 来自 BeliefState
}

// ── 检测模式定义 ─────────────────────────────────────────────────────────────────

/** 负面情绪词（触发情绪矛盾检测） */
const NEGATIVE_EMOTION_WORDS = ['警惕', '不满', '愤怒', '怀疑', '厌恶', '恐惧', '忧虑', '敌视'];

/** 强信任/顺从行为词（与负面情绪矛盾） */
const TRUST_BEHAVIOR_MARKERS = [
  '欣然同意', '毫无戒心', '完全信任', '慷慨赠予', '毫不犹豫地给',
  '无条件答应', '立刻同意', '全盘托出', '毫不保留',
];

/** 负面记忆情绪色彩词（触发记忆违背检测） */
const NEGATIVE_MEMORY_TAGS = ['不满', '愤怒', '怀疑', '厌恶', '恐惧', '忧虑'];

/** 违背负面记忆的顺从行为词 */
const GENEROUS_CONTRADICTION_MARKERS = [
  '毫不介意', '完全原谅', '欣然垫钱', '立刻同意赊账',
  '慷慨地', '爽快地答应', '大方地', '毫无芥蒂',
];

// ── 内部检测函数（不导出） ───────────────────────────────────────────────────────

function detectEmotionContradiction(
  narrative: string,
  anchor: MotivationAnchor,
): MotivationConflict[] {
  const hasNegativeEmotion = anchor.topEmotions.some(e => NEGATIVE_EMOTION_WORDS.includes(e));
  if (!hasNegativeEmotion) return [];

  const nameInNarrative = narrative.includes(anchor.npcName);
  if (!nameInNarrative) return [];

  for (const marker of TRUST_BEHAVIOR_MARKERS) {
    if (narrative.includes(anchor.npcName) && narrative.includes(marker)) {
      return [{
        npcKey: anchor.npcKey,
        conflictType: '情绪矛盾',
        detail: `${anchor.npcName}当前情绪状态与叙事中描述的行为存在矛盾（具体情绪已脱敏）`,
      }];
    }
  }
  return [];
}

function detectMemoryViolation(
  narrative: string,
  anchor: MotivationAnchor,
): MotivationConflict[] {
  const hasNegativeMemory = anchor.recentMemoryTags.some(t => NEGATIVE_MEMORY_TAGS.includes(t));
  if (!hasNegativeMemory) return [];

  const nameInNarrative = narrative.includes(anchor.npcName);
  if (!nameInNarrative) return [];

  for (const marker of GENEROUS_CONTRADICTION_MARKERS) {
    if (narrative.includes(anchor.npcName) && narrative.includes(marker)) {
      return [{
        npcKey: anchor.npcKey,
        conflictType: '记忆违背',
        detail: `${anchor.npcName}的近期记忆与叙事中描述的行为存在矛盾（记忆内容已脱敏）`,
      }];
    }
  }
  return [];
}

function detectMotivationGap(
  narrative: string,
  anchor: MotivationAnchor,
): MotivationConflict[] {
  // 检测 NPC 执行高风险行为但信念态不支撑动机的情况
  // MVP: 检测显式标记字符串 【动机缺失:npcKey】
  const marker = `【动机缺失:${anchor.npcKey}】`;
  if (narrative.includes(marker)) {
    return [{
      npcKey: anchor.npcKey,
      conflictType: '信念动机缺失',
      detail: `${anchor.npcName}在叙事中执行了缺乏信念/动机支撑的重大行为`,
    }];
  }
  return [];
}

// ── 导出函数 ─────────────────────────────────────────────────────────────────────

/**
 * WhatELSE 动机校验（纯函数·依赖①信念态）。
 *
 * @param narrative  待校验叙事文本
 * @param anchors    各 NPC 的动机锚（从①信念态 + NPC 状态构建·见 buildMotivationAnchor）
 * @returns  动机冲突列表（空列表 = 全通过）
 */
export function validateMotivations(
  narrative: string,
  anchors: MotivationAnchor[],
): MotivationConflict[] {
  const conflicts: MotivationConflict[] = [];
  for (const anchor of anchors) {
    conflicts.push(
      ...detectEmotionContradiction(narrative, anchor),
      ...detectMemoryViolation(narrative, anchor),
      ...detectMotivationGap(narrative, anchor),
    );
  }
  return conflicts;
}

/**
 * 从①信念态 + NPC 当前情绪/记忆数据构建动机锚。
 *
 * @param npcKey      实体键
 * @param npcName     显示名（叙事匹配用）
 * @param beliefState 来自 deriveBeliefState 的信念态（①依赖·不可绕过）
 * @param emotions    情绪栈情绪名列表（取顶层 N 条）
 * @param memoryTags  高重要度记忆的情绪色彩/标签
 */
export function buildMotivationAnchor(
  npcKey: string,
  npcName: string,
  beliefState: BeliefState,
  emotions: string[],
  memoryTags: string[],
): MotivationAnchor {
  const beliefs = beliefState.信念.filter(b => b.subjectKey === npcKey);
  return {
    npcKey,
    npcName,
    topEmotions: emotions,
    recentMemoryTags: memoryTags,
    beliefs,
  };
}
