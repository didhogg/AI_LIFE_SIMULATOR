// M1 记账 LLM 调用 — 独立于叙事调用，输出结构化提案单
// 纪律：叙事 LLM 不碰提案单结构（§三 第 2/3 段）
import OpenAI from 'openai';

const ACCOUNTING_SYSTEM = `你是记账 AI。根据叙事内容，输出 JSON 格式的提案单。
只输出 JSON，不要其他内容。

格式：
{
  "transfers": [{"from": "实体键", "to": "实体键", "amount": 正整数, "reason": "叙事中对应的文字"}],
  "checks": [{"actor": "实体键", "recipe": "配方键", "intent": "意图描述"}],
  "knowledge": [{"fact": "秘密键", "knownBy": ["实体键"]}]
}

规则：
- transfers.amount 必须是正整数，单位：文钱
- 只记录叙事中明确发生的账变，不要推测
- 如果叙事里没有账变、检定、知情，对应数组留空
- from/to 必须使用实体键，不是名字`;

export interface AccountingRequest {
  narrative:     string;
  entityContext: string; // 实体键提示（防 LLM 用名字而非实体键）
}

export async function callAccounting(req: AccountingRequest): Promise<string> {
  const apiKey  = process.env['DEEPSEEK_API_KEY'];
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY 未设置');

  const baseURL  = process.env['DEEPSEEK_BASE_URL'] ?? 'https://api.deepseek.com';
  const modelId  = process.env['DEEPSEEK_MODEL']    ?? 'deepseek-chat';

  const client = new OpenAI({ apiKey, baseURL });

  const completion = await client.chat.completions.create({
    model:           modelId,
    max_tokens:      512,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: ACCOUNTING_SYSTEM },
      { role: 'user',   content: `实体键参考：${req.entityContext}\n\n叙事内容：\n${req.narrative}` },
    ],
  });

  return completion.choices[0]?.message?.content ?? '{}';
}
