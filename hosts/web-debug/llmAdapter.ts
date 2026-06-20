// E1 LLM adapter 隔离层 — P0-11 探雷轮
// 纪律:
//   LLM 输出不进指纹·不参与恒等 (R7-b)
//   失败降级: 记录现象·不崩溃·isFallback=true
//   API key 只走 .env·不硬编码
// 支持: openai-compatible (DeepSeek / 任意 OpenAI endpoint)
import {
  callNarrative as callOpenAICompatible,
} from '../slice/adapter/openai-compatible.js';
import type { NarrativeRequest } from '../slice/adapter/openai-compatible.js';

export type { NarrativeRequest };

export interface LLMCallResult {
  ok: boolean;
  text: string;         // 实际叙事文本 or 降级占位（isFallback=true 时）
  inputTokens: number;
  outputTokens: number;
  isFallback: boolean;  // true = LLM 不可用，文本为降级占位
  error?: string;       // 失败时原始错误信息
}

// 降级占位（探雷期·LLM 不可用时·不进指纹·不参与恒等）
const FALLBACK_PREFIX = '（LLM 降级占位·非真实叙事）';

export async function callNarrativeSafe(req: NarrativeRequest): Promise<LLMCallResult> {
  try {
    const resp = await callOpenAICompatible(req);
    return {
      ok: true,
      text: resp.text,
      inputTokens: resp.inputTokens,
      outputTokens: resp.outputTokens,
      isFallback: false,
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      text: `${FALLBACK_PREFIX}（原因: ${error.slice(0, 80)}）`,
      inputTokens: 0,
      outputTokens: 0,
      isFallback: true,
      error,
    };
  }
}
