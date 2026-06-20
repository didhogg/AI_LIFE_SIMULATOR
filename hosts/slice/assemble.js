// P0-8 Batch 1+3: prompt 组装层（compiled JS）+ 切片预算 B1-B6
import { filterSecretsForPOV } from '@ai-life-sim/core/engine/knowledgeFilter';
import { evalPredStr } from '@ai-life-sim/core/engine/dsl/eval';
import { DEFAULT_NEAR_K, CALL_TYPE_REGISTRY } from '@ai-life-sim/core/prompt/callRegistry';
import { applySliceBudget, estimateSliceTokens } from '@ai-life-sim/core/engine/sliceBudget';
export function assemblePrompt(state, opts) {
    const { pcKey, locName, povEntityKey, visibleSecrets, nearK, narrativeHistory, historyTicks, actionHistory, balances, lorePredCtx, callTypeKey, } = opts;
    // ── 主角 ──
    const pc = state.NPC?.[pcKey];
    if (!pc)
        throw new Error(`找不到主角 ${pcKey}`);
    const pcName = pc.姓名 ?? pcKey;
    const pcBio = pc.背景 ?? '';
    const attrs = pc.属性;
    const pcAttrStr = attrs
        ? `体质${attrs['体质'] ?? '?'} 智慧${attrs['智慧'] ?? '?'} 感知${attrs['感知'] ?? '?'} 魅力${attrs['魅力'] ?? '?'} 心理${attrs['心理'] ?? '?'}`
        : '';
    // ── 知情过滤前置闸（M4·gate invariant）──
    const effectivePovKey = povEntityKey ?? pcKey;
    let effectiveSecrets;
    if (povEntityKey !== undefined) {
        const rawSecrets = (state.全局?.秘密库 ?? {});
        effectiveSecrets = filterSecretsForPOV(rawSecrets, povEntityKey);
    }
    else {
        effectiveSecrets = visibleSecrets ?? {};
    }
    // ── lore 底层谓词切片（R7-b·叙事注入·不进指纹）──
    const loreLines = [];
    if (lorePredCtx) {
        const loreKB = state['_lore知识库'] ?? {};
        for (const entry of Object.values(loreKB)) {
            const matches = entry.触发谓词
                ? evalPredStr(entry.触发谓词, lorePredCtx)
                : true;
            if (matches && entry.知识载荷) {
                loreLines.push(entry.知识载荷);
            }
        }
    }
    // ── 货币 ──
    const currency = state.货币系统?.基准币种 ?? '文钱';
    const pcHolding = balances
        ? (balances[pcKey] ?? 0)
        : (state.货币系统?.账户?.[pcKey]?.持有?.[currency] ?? 0);
    // ── 在场 NPC（含记忆/情绪·只读）──
    const npcLines = [];
    for (const [key, npc] of Object.entries(state.NPC ?? {})) {
        if (key === pcKey)
            continue;
        if (npc.位置 !== (pc.位置 ?? ''))
            continue;
        const attrStr = npc.属性
            ? Object.entries(npc.属性)
                .map(([k, v]) => `${k}${v}`)
                .join('/')
            : '';
        npcLines.push(`- ${npc.姓名 ?? key}（${npc.称呼 ?? ''}）：${npc.背景 ?? ''}${attrStr ? `  [${attrStr}]` : ''}`);
        const npcMems = (npc.记忆 ?? []).filter((m) => (m.重要度 ?? 0) >= 2).slice(-3);
        for (const m of npcMems) {
            if (m.摘要)
                npcLines.push(`  记忆: ${m.摘要}${m.情绪色彩 ? `（${m.情绪色彩}）` : ''}`);
        }
        const emotions = (npc.情绪栈 ?? []).slice(-2);
        for (const e of emotions) {
            if (e.情绪名)
                npcLines.push(`  情绪: ${e.情绪名}`);
        }
    }
    // ── 编年史 ──
    const chronicle = (state.全局?._编年史 ?? []).slice(-5);
    const chronicleLines = chronicle.map((e) => `[序${e.序号 ?? '?'}] ${e.标题 ?? ''}：${e.结果摘要行 ?? ''}`);
    // ── POV 认知投影 ──
    const cogArchive = state.认知档案?.[effectivePovKey];
    const cogLines = [];
    if (cogArchive) {
        for (const [targetKey, cog] of Object.entries(cogArchive)) {
            if (targetKey === effectivePovKey)
                continue;
            const imps = (cog.印象 ?? []).slice(-3);
            if (imps.length > 0) {
                const impStr = imps.map((i) => `${i.标签 ?? ''}(${i.极性 ?? '—'}·${i.强度 ?? 0})`).join('、');
                cogLines.push(`他以为 ${targetKey}：${impStr}`);
            }
        }
    }
    // ── 秘密节 ──
    const secretSection = [];
    const visibleEntries = Object.entries(effectiveSecrets);
    if (visibleEntries.length > 0) {
        secretSection.push('', '## 当前已知秘密（已知存在·勿在叙事中直接揭示）');
        for (const [id, s] of visibleEntries) {
            secretSection.push(`- [${id}] ${s.母题}（严重度${s.严重度}·暴露度${s.暴露度}）`);
        }
    }
    // ── 切片预算 B1-B6（组装侧·不进指纹）──
    const k = nearK ?? DEFAULT_NEAR_K;
    const history = narrativeHistory ?? historyTicks ?? [];
    const recentHistory = history.slice(-k);
    const budgetParts = [];
    if (loreLines.length > 0)      budgetParts.push({ key: 'lore',      content: loreLines.join('\n') });
    if (recentHistory.length > 0)  budgetParts.push({ key: 'nearK',     content: recentHistory.join('\n') });
    if (chronicleLines.length > 0) budgetParts.push({ key: 'chronicle', content: chronicleLines.join('\n') });
    let activeLoreLines = loreLines;
    let activeRecentHistory = recentHistory;
    let activeChronicleLines = chronicleLines;
    if (callTypeKey) {
        const spec = CALL_TYPE_REGISTRY[callTypeKey];
        const limit = spec.切片预算.软上限tokens;
        if (estimateSliceTokens(budgetParts) > limit) {
            const { parts: remaining } = applySliceBudget(budgetParts, { softLimitTokens: limit });
            const remainSet = new Set(remaining.map(p => p.key));
            if (!remainSet.has('lore'))      activeLoreLines = [];
            if (!remainSet.has('chronicle')) activeChronicleLines = [];
            const nearKPart = remaining.find(p => p.key === 'nearK');
            if (!nearKPart) {
                activeRecentHistory = [];
            }
            else if (nearKPart.content !== recentHistory.join('\n')) {
                activeRecentHistory = nearKPart.content.split('\n').filter(l => l.length > 0);
            }
        }
    }
    // ── systemPrompt ──
    const systemParts = [
        '你是一款中文武侠模拟游戏的叙事 AI。请用简洁的第三人称为下面这一拍生成一段叙事（50-80 字），',
        '描述当前场景氛围与主角动作，不要捏造不在场景中的人物或秘密。',
        '',
        '## 主角',
        `姓名：${pcName}  称呼：${pc.称呼 ?? ''}`,
        `背景：${pcBio}`,
        `属性：${pcAttrStr}`,
        `身上：${pcHolding}${currency}`,
    ];
    if (activeLoreLines.length > 0) {
        systemParts.push('', '## 世界常识（lore）');
        for (const l of activeLoreLines)
            systemParts.push(l);
    }
    systemParts.push('', '## 地点', locName, '', '## 在场人物');
    systemParts.push(npcLines.join('\n') || '（无）');
    if (activeChronicleLines.length > 0) {
        systemParts.push('', '## 近期编年史');
        for (const c of activeChronicleLines)
            systemParts.push(c);
    }
    if (cogLines.length > 0) {
        systemParts.push('', '## 主角认知投影（他以为）');
        for (const c of cogLines)
            systemParts.push(c);
    }
    systemParts.push(...secretSection);
    const systemPrompt = systemParts.join('\n');
    // ── userPrompt ──
    const recentActions = (actionHistory ?? []).slice(-6).join(' → ');
    const userParts = [`拍#${state._tick?.拍计数 ?? 1}`];
    if (balances) {
        const balEntries = Object.entries(balances)
            .map(([k2, v]) => `${k2}:${v}${currency}`)
            .join(' / ');
        userParts.push(`【账目】${balEntries}`);
    }
    if (activeRecentHistory.length > 0) {
        userParts.push('', '【近期叙事】');
        activeRecentHistory.forEach((h, i) => userParts.push(`${i + 1}. ${h}`));
    }
    if (recentActions) {
        userParts.push(`【最近动作顺序】${recentActions}`);
    }
    const userPrompt = userParts.join('\n');
    return { systemPrompt, userPrompt };
}
