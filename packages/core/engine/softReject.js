// N-4: 软拒/拒答检测 — 确定性规则，不引 LLM
// 禁: 不得引入 LLM 调用、Date.now()、Math.random()（继承六禁约束）
export const SOFT_REJECT_RULE_VERSION = 1;
// 关键短语表（中英文·明确拒绝和 AI 身份声明式拒绝）
export const SOFT_REJECT_KEYWORDS = [
    // 中文：明确拒绝
    '我无法', '我不能', '我不可以', '无法提供', '不能协助', '不能帮助',
    '这超出了我', '这违反了', '作为AI', '作为一个AI',
    '我的设计不允许', '超出我的能力范围',
    // 英文：明确拒绝
    'I cannot', "I can't", 'I am unable', 'I must refuse', 'I am not able to',
    'cannot assist', 'cannot provide', 'against my guidelines',
    // 英文：AI 身份声明式拒绝
    'as an AI', 'as a language model', 'as an artificial intelligence',
];
// 启发式：短响应（≤200字符）+ 拒绝式开头组合触发（两条件同时满足，降低假阳率）
const REFUSAL_OPENER = /^(我(?:无法|不能|不可以|必须|的设计)|I (?:cannot|can't|am unable|must refuse)|As (?:an AI|a language model)|作为(?:AI|语言模型|一个AI))/u;
const REFUSAL_COMBO_MAX_LEN = 200;
// 确定性检测函数——相同输入恒相同输出，无随机性，无副作用
export function detectSoftReject(response) {
    const trimmed = response.trim();
    // 关键短语匹配（优先于启发式）
    for (const kw of SOFT_REJECT_KEYWORDS) {
        if (trimmed.includes(kw)) {
            return { detected: true, matchedKeyword: kw, ruleVersion: SOFT_REJECT_RULE_VERSION };
        }
    }
    // 启发式：拒绝式开头 + 短响应（降低单一条件的假阳率）
    if (trimmed.length <= REFUSAL_COMBO_MAX_LEN && REFUSAL_OPENER.test(trimmed)) {
        return { detected: true, heuristicReason: 'refusal_start_combo', ruleVersion: SOFT_REJECT_RULE_VERSION };
    }
    return { detected: false, ruleVersion: SOFT_REJECT_RULE_VERSION };
}
