// Anthropic provider adapter — M0 叙事调用
// 纪律：API key 走 .env；零硬编码；禁进存档/$层/导出
import Anthropic from '@anthropic-ai/sdk';

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
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY 未设置（请配置 .env）');

  const client = new Anthropic({ apiKey });
  const modelId = req.modelId ?? 'claude-haiku-4-5-20251001';

  const msg = await client.messages.create({
    model: modelId,
    max_tokens: req.maxTokens ?? 256,
    system: req.systemPrompt,
    messages: [{ role: 'user', content: req.userPrompt }],
  });

  const block = msg.content[0];
  if (!block || block.type !== 'text') throw new Error('Anthropic 返回格式异常');

  return {
    text: block.text,
    inputTokens: msg.usage.input_tokens,
    outputTokens: msg.usage.output_tokens,
  };
}
