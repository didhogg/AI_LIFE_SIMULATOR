// OpenAI-compatible provider adapter — M0 叙事调用
// 支持 DeepSeek / 任意 OpenAI-compatible endpoint
// 纪律：API key / baseURL 只走 .env；零硬编码；禁进存档/$层/导出
import OpenAI from 'openai';

export interface NarrativeRequest {
  systemPrompt: string;
  userPrompt: string;
  modelId?: string;
  maxTokens?: number;
}

export interface NarrativeResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export async function callNarrative(req: NarrativeRequest): Promise<NarrativeResponse> {
  const apiKey  = process.env['DEEPSEEK_API_KEY'];
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY 未设置（请配置 .env）');

  const baseURL  = process.env['DEEPSEEK_BASE_URL'] ?? 'https://api.deepseek.com';
  const modelId  = req.modelId ?? process.env['DEEPSEEK_MODEL'] ?? 'deepseek-chat';

  const client = new OpenAI({ apiKey, baseURL });

  // 把马上要发出去的请求体先存常量，便于在唯一出口处原样打印（一处拦全部叙事调用）。
  const requestBody = {
    model: modelId,
    max_tokens: req.maxTokens ?? 256,
    // 叙事要的是花样、不是复现：温度调高，同一动作每次出不同文字。
    // 不影响确定性护城河——骰子/账本走 seed，重放短路读 tick_log，都不碰 LLM 文字。
    temperature: Number(process.env['DEEPSEEK_TEMPERATURE'] ?? 0.9),
    messages: [
      { role: 'system' as const, content: req.systemPrompt },
      { role: 'user'   as const, content: req.userPrompt   },
    ],
  };

  // ── 调试：打印发给 LLM 的请求体原文（仅 DUMP_PROMPT=1 时启用）──────────────
  // 走 stderr（console.error）不与正常输出抢行；DUMP_PROMPT 不进存档/$层，纯运行期开关。
  if (process.env['DUMP_PROMPT'] === '1') {
    console.error('\n===== 发给 LLM 的原文 =====');
    console.error(JSON.stringify(requestBody, null, 2));
    console.error('===== END =====\n');
  }

  const completion = await client.chat.completions.create(requestBody);

  const choice = completion.choices[0];
  const text = choice?.message?.content;
  if (!text) throw new Error('DeepSeek 返回格式异常（content 为空）');

  return {
    text,
    inputTokens:  completion.usage?.prompt_tokens     ?? 0,
    outputTokens: completion.usage?.completion_tokens ?? 0,
  };
}