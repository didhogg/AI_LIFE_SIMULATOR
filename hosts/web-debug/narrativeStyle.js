// P-A 叙事渲染层 · 人称参数 + 轻量文风库
// 纯 host/session 渲染参数 — 不写真相层 · 不进指纹 · 不进对话历史 · 不进存档
// core 宿主无关：禁 Date.now / new Date / Math.random / window / document
export const PERSON_DEFAULT = 'second';
export const STYLE_DEFAULT = 'guofeng';
export const STYLE_LABELS = {
    guofeng: '古风（默认）',
    baihua: '白话直叙',
    jianjie: '简洁电报体',
};
export const PERSON_LABELS = {
    second: '第二人称（你…）',
    first: '第一人称（我…）',
    third: '第三人称（他/她…）',
};
/** 文风 prompt 指令（追加到 systemPrompt · 不进指纹 · 不影响判定） */
export const STYLE_INSTRUCTIONS = {
    guofeng: '文风：古风细腻，遣词雅致，善用意象与留白，如古典武侠笔调。首尾完整不少于100字',
    baihua: '文风：白话直叙，语言通俗流畅，如近现代白话小说笔调。首尾完整不少于100字',
    jianjie: '文风：简洁电报体，每句不超12字，只陈述核心事件，不铺陈。首尾完整不少于100字',
};
/** 人称 prompt 指令（追加到 systemPrompt · 不进指纹） */
export const PERSON_INSTRUCTIONS = {
    second: '人称：第二人称，用「你」称呼主角（例：你踏入茶馆，抬手招呼）。',
    first: '人称：第一人称，用「我」称呼主角（例：我踏入茶馆，抬手招呼）。',
    third: '人称：第三人称，用主角姓名或他/她称呼（例：主角踏入茶馆，抬手招呼）。',
};
/** 未知人称值安全回落默认·不抛错 */
export function sanitizePerson(v) {
    if (v === 'second' || v === 'first' || v === 'third')
        return v;
    return PERSON_DEFAULT;
}
/** 未知文风值安全回落默认·不抛错 */
export function sanitizeStyle(v) {
    if (v === 'guofeng' || v === 'baihua' || v === 'jianjie')
        return v;
    return STYLE_DEFAULT;
}
/**
 * 将人称 + 文风指令追加到 systemPrompt 末尾（纯渲染层·不进指纹）。
 * 对 state 完全只读；始终安全回落：未知值 → 默认值。
 * pcName 可选：提供时注入真实主角姓名，防止 LLM 在多 NPC 场景下主客混淆。
 */
export function applyPersonStyle(systemPrompt, person, style, pcName) {
    const p = sanitizePerson(person);
    const s = sanitizeStyle(style);
    const name = pcName ?? '主角';
    const personInstr = p === 'second' ? `人称：第二人称，用「你」称呼主角「${name}」（例：你踏入茶馆，抬手招呼）。` :
        p === 'first' ? `人称：第一人称，用「我」称呼主角「${name}」（例：我踏入茶馆，抬手招呼）。` :
            `人称：第三人称，用「${name}」或他/她称呼主角（例：${name}踏入茶馆，抬手招呼）。`;
    return (systemPrompt +
        '\n\n## 渲染参数（不进指纹·不进对话历史）\n' +
        personInstr +
        '\n' +
        STYLE_INSTRUCTIONS[s]);
}
/**
 * Demo 模式脚本化叙事（3 文风 × 3 人称 = 9 模板）。
 * 纯文本·确定性·不调用 LLM·不触 state。
 *
 * @param pcName  主角姓名（第三人称时使用）
 * @param optionId verb:target 格式（提取动词 + 目标）
 */
export function buildScriptedNarrative(person, style, pcName, optionId) {
    const p = sanitizePerson(person);
    const s = sanitizeStyle(style);
    const verb = optionId.split(':')[0] ?? '行动';
    const tgt = optionId.split(':')[1] ?? '';
    const self = p === 'second' ? '你' : p === 'first' ? '我' : pcName;
    const tgtFrag = tgt ? `，与 ${tgt}` : '';
    if (s === 'guofeng') {
        return `${self}迈步前行${tgtFrag}，一「${verb}」之间尘起烟散，往事如烟入画中。`;
    }
    if (s === 'baihua') {
        return `${self}走上前，做了一个「${verb}」的动作${tgtFrag}，场面平静而自然。`;
    }
    // jianjie
    return `${self}${verb}。${tgt ? `对象：${tgt}。` : ''}事毕。`;
}
