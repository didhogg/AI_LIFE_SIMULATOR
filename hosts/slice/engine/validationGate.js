// P0-8 Batch 2: 校验闸统一出入口（compiled JS）
import { filterSecretsForPOV } from '@ai-life-sim/core/engine/knowledgeFilter';
import { deriveBeliefState } from '@ai-life-sim/core/engine/beliefDerive';
import {
  validateNarrativeSemantics,
  DEFAULT_RETRY_MODE,
} from '@ai-life-sim/core/engine/narrativeValidator';
import {
  validateMotivations,
  buildMotivationAnchor,
} from '@ai-life-sim/core/engine/motivationValidator';

function buildTruthSeekingSlice(state, povKey) {
  const fullSecrets = state.全局?.秘密库 ?? {};
  const allSecretMotifs = Object.values(fullSecrets).map(s => s.母题).filter(Boolean);
  const povFiltered = filterSecretsForPOV(fullSecrets, povKey);
  const povKnownMotifs = Object.values(povFiltered).map(s => s.母题).filter(Boolean);
  const pc = state.NPC?.[povKey];
  const povLoc = pc?.位置 ?? '';
  const presentNpcNames = [];
  const absentNpcNames = [];
  for (const [key, npc] of Object.entries(state.NPC ?? {})) {
    if (key === povKey) continue;
    const name = npc.姓名 ?? key;
    if (npc.位置 === povLoc) { presentNpcNames.push(name); } else { absentNpcNames.push(name); }
  }
  return {
    allSecretMotifs, povKnownMotifs, presentNpcNames, absentNpcNames,
    tickCount: state._tick?.拍计数 ?? 1,
  };
}

function buildMotivationAnchors(state, beliefState, povKey) {
  const anchors = [];
  const pc = state.NPC?.[povKey];
  const povLoc = pc?.位置 ?? '';
  for (const [key, npc] of Object.entries(state.NPC ?? {})) {
    if (key === povKey) continue;
    if (npc.位置 !== povLoc) continue;
    const name = npc.姓名 ?? key;
    const emotions = (npc.情绪栈 ?? []).slice(-3).map(e => e.情绪名 ?? '').filter(Boolean);
    const memTags = (npc.记忆 ?? []).filter(m => (m.重要度 ?? 0) >= 2).slice(-5).map(m => m.情绪色彩 ?? '').filter(Boolean);
    anchors.push(buildMotivationAnchor(key, name, beliefState, emotions, memTags));
  }
  return anchors;
}

export function runValidationGate(narrative, state, opts, beliefState) {
  const { povKey, retryMode = DEFAULT_RETRY_MODE, retryNarrative } = opts;
  const truthSlice = buildTruthSeekingSlice(state, povKey);
  const fullSecrets = state.全局?.秘密库 ?? {};
  const povFiltered = filterSecretsForPOV(fullSecrets, povKey);
  const effectiveBeliefState = beliefState ?? deriveBeliefState(
    state.认知档案?.[povKey], povFiltered, povKey, 'narrative',
  );
  const narrativeResult = validateNarrativeSemantics(narrative, truthSlice, retryNarrative, retryMode);
  const anchors = buildMotivationAnchors(state, effectiveBeliefState, povKey);
  const narrativeToCheck = narrativeResult.retriedOnce && retryNarrative !== undefined
    ? retryNarrative : narrative;
  const motConflicts = validateMotivations(narrativeToCheck, anchors);
  const valid = narrativeResult.valid && motConflicts.length === 0;
  return {
    valid, conflicts: narrativeResult.conflicts, motConflicts,
    softReject: narrativeResult.softReject, retriedOnce: narrativeResult.retriedOnce,
    outputFilteredSecrets: povFiltered,
  };
}

export function deriveBeliefFromState(state, povKey) {
  const fullSecrets = state.全局?.秘密库 ?? {};
  const povFiltered = filterSecretsForPOV(fullSecrets, povKey);
  return deriveBeliefState(state.认知档案?.[povKey], povFiltered, povKey, 'narrative');
}
