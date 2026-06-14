// P0-8 prompt assembly layer — override injection gate
import type { RootState } from '../schema/index.js';
import type { 叙事调用条目Type } from '../schema/memory.js';

export interface AssembledCall {
  systemPrompt: string;
  assistantPrefill: string | undefined;
}

// Gate is computed live on every call — never cached. Condition is hardcoded:
// both 内容分级==='community' AND 允许玩家覆盖===true must hold simultaneously.
function overrideAllowed(state: RootState, entry: 叙事调用条目Type): boolean {
  return state.$玩家偏好.内容分级 === 'community' && entry.允许玩家覆盖SystemPrompt === true;
}

export function assembleNarrativeCall(
  baseSystemPrompt: string,
  entry: 叙事调用条目Type,
  state: RootState,
): AssembledCall {
  const allowed = overrideAllowed(state, entry);
  return {
    systemPrompt: (allowed && entry.玩家SystemPrompt覆盖) ? entry.玩家SystemPrompt覆盖 : baseSystemPrompt,
    assistantPrefill: (allowed && entry.assistant预填) ? entry.assistant预填 : undefined,
  };
}
