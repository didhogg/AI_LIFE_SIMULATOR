// P0-8 Batch 2: PANGeA 叙事语义校验闸（compiled JS）
export const DEFAULT_RETRY_MODE = 'single_retry_soft_reject';

const PRESENCE_VERBS = ['走进', '走入', '坐下', '站起', '说道', '开口道', '拱手道', '笑道', '怒道', '皱眉道'];

function detectOverreachingKnowledge(narrative, allMotifs, allowedMotifs) {
  const conflicts = [];
  for (const motif of allMotifs) {
    if (allowedMotifs.includes(motif)) continue;
    if (narrative.includes(motif)) {
      conflicts.push({ type: '越权知情', detail: '叙事引用了当前 POV 不应知晓的秘密信息（内容已脱敏）' });
    }
  }
  return conflicts;
}

function detectPresenceContradiction(narrative, absentNpcNames) {
  const conflicts = [];
  for (const name of absentNpcNames) {
    for (const verb of PRESENCE_VERBS) {
      if (narrative.includes(name + verb) || narrative.includes(name + '，' + verb)) {
        conflicts.push({ type: '在场矛盾', detail: '叙事将不在当前场景的人物描述为在场行动（人物名已脱敏）' });
        break;
      }
    }
  }
  return conflicts;
}

function detectInventedItems(narrative) {
  if (narrative.includes('【凭空物品:')) {
    return [{ type: '凭空物品', detail: '叙事引入了当前世界状态中不存在的物品（物品名已脱敏）' }];
  }
  return [];
}

function detectTemporalAnomalies(narrative, tickCount) {
  const pattern = /【未来拍:(\d+)】/g;
  let match;
  const conflicts = [];
  while ((match = pattern.exec(narrative)) !== null) {
    const referencedTick = Number(match[1]);
    if (referencedTick > tickCount) {
      conflicts.push({ type: '时序错乱', detail: `叙事引用了尚未发生的拍（当前拍${tickCount}·引用拍已脱敏）` });
    }
  }
  return conflicts;
}

function checkAllConflicts(narrative, slice) {
  return [
    ...detectOverreachingKnowledge(narrative, slice.allSecretMotifs, slice.povKnownMotifs),
    ...detectPresenceContradiction(narrative, slice.absentNpcNames),
    ...detectInventedItems(narrative),
    ...detectTemporalAnomalies(narrative, slice.tickCount),
  ];
}

export function validateNarrativeSemantics(narrative, slice, retryNarrative, retryMode = DEFAULT_RETRY_MODE) {
  const primaryConflicts = checkAllConflicts(narrative, slice);
  if (primaryConflicts.length === 0) return { valid: true, conflicts: [], retriedOnce: false };

  if (retryNarrative !== undefined) {
    const retryConflicts = checkAllConflicts(retryNarrative, slice);
    if (retryConflicts.length === 0) return { valid: true, conflicts: [], retriedOnce: true };
    if (retryMode === 'single_retry_soft_reject') {
      return {
        valid: false, conflicts: retryConflicts, retriedOnce: true,
        softReject: {
          ui提示: '此叙事与当前场景存在矛盾，请「重 Roll」重新生成',
          重Roll说明: '点击「重 Roll」按钮可重新请求一次叙事生成',
        },
      };
    }
    return { valid: false, conflicts: retryConflicts, retriedOnce: true };
  }

  return { valid: false, conflicts: primaryConflicts, retriedOnce: false };
}

export function makeEmptyValidationSlice() {
  return { allSecretMotifs: [], povKnownMotifs: [], presentNpcNames: [], absentNpcNames: [], tickCount: 1 };
}
