// P0-8 Batch 2: WhatELSE 因果/动机校验器（compiled JS）
const NEGATIVE_EMOTION_WORDS = ['警惕', '不满', '愤怒', '怀疑', '厌恶', '恐惧', '忧虑', '敌视'];
const TRUST_BEHAVIOR_MARKERS = [
  '欣然同意', '毫无戒心', '完全信任', '慷慨赠予', '毫不犹豫地给',
  '无条件答应', '立刻同意', '全盘托出', '毫不保留',
];
const NEGATIVE_MEMORY_TAGS = ['不满', '愤怒', '怀疑', '厌恶', '恐惧', '忧虑'];
const GENEROUS_CONTRADICTION_MARKERS = [
  '毫不介意', '完全原谅', '欣然垫钱', '立刻同意赊账',
  '慷慨地', '爽快地答应', '大方地', '毫无芥蒂',
];

function detectEmotionContradiction(narrative, anchor) {
  if (!anchor.topEmotions.some(e => NEGATIVE_EMOTION_WORDS.includes(e))) return [];
  if (!narrative.includes(anchor.npcName)) return [];
  for (const marker of TRUST_BEHAVIOR_MARKERS) {
    if (narrative.includes(anchor.npcName) && narrative.includes(marker)) {
      return [{ npcKey: anchor.npcKey, conflictType: '情绪矛盾', detail: `${anchor.npcName}当前情绪状态与叙事中描述的行为存在矛盾（具体情绪已脱敏）` }];
    }
  }
  return [];
}

function detectMemoryViolation(narrative, anchor) {
  if (!anchor.recentMemoryTags.some(t => NEGATIVE_MEMORY_TAGS.includes(t))) return [];
  if (!narrative.includes(anchor.npcName)) return [];
  for (const marker of GENEROUS_CONTRADICTION_MARKERS) {
    if (narrative.includes(anchor.npcName) && narrative.includes(marker)) {
      return [{ npcKey: anchor.npcKey, conflictType: '记忆违背', detail: `${anchor.npcName}的近期记忆与叙事中描述的行为存在矛盾（记忆内容已脱敏）` }];
    }
  }
  return [];
}

function detectMotivationGap(narrative, anchor) {
  if (narrative.includes(`【动机缺失:${anchor.npcKey}】`)) {
    return [{ npcKey: anchor.npcKey, conflictType: '信念动机缺失', detail: `${anchor.npcName}在叙事中执行了缺乏信念/动机支撑的重大行为` }];
  }
  return [];
}

export function validateMotivations(narrative, anchors) {
  const conflicts = [];
  for (const anchor of anchors) {
    conflicts.push(
      ...detectEmotionContradiction(narrative, anchor),
      ...detectMemoryViolation(narrative, anchor),
      ...detectMotivationGap(narrative, anchor),
    );
  }
  return conflicts;
}

export function buildMotivationAnchor(npcKey, npcName, beliefState, emotions, memoryTags) {
  const beliefs = beliefState.信念.filter(b => b.subjectKey === npcKey);
  return { npcKey, npcName, topEmotions: emotions, recentMemoryTags: memoryTags, beliefs };
}
