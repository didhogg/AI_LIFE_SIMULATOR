import { filterSecretsForPOV, } from '@ai-life-sim/core/engine/knowledgeFilter';
import { evalPredStr } from '@ai-life-sim/core/engine/dsl/eval';
import { resolveEffectivePredicate, readGlobalDslSwitch } from '@ai-life-sim/core/engine/dsl/aiPredControl';
import { DEFAULT_NEAR_K, CALL_TYPE_REGISTRY } from '@ai-life-sim/core/prompt/callRegistry';
import { applySliceBudget, estimateSliceTokens, } from '@ai-life-sim/core/engine/sliceBudget';
export function assemblePrompt(state, opts) {
    const { pcKey, locName, povEntityKey, visibleSecrets, nearK, narrativeHistory, historyTicks, actionHistory, balances, lorePredCtx, callTypeKey, proposalConstraints, 作者AI控制表, } = opts;
    // ── 主角 ──────────────────────────────────────────────────────────────────────
    const pc = state.NPC?.[pcKey];
    if (!pc)
        throw new Error(`找不到主角 ${pcKey}`);
    const pcName = pc.姓名 ?? pcKey;
    const pcBio = pc.背景 ?? '';
    const attrs = pc.属性;
    const pcAttrStr = attrs
        ? `体质${attrs['体质'] ?? '?'} 智慧${attrs['智慧'] ?? '?'} 感知${attrs['感知'] ?? '?'} 魅力${attrs['魅力'] ?? '?'} 心理${attrs['心理'] ?? '?'}`
        : '';
    // ── 知情过滤前置闸（M4·gate invariant）────────────────────────────────────────
    // povEntityKey 路径：函数内部过滤（不可旁路）
    // visibleSecrets 路径：调用方已过滤（测试/兼容路径）
    const effectivePovKey = povEntityKey ?? pcKey;
    let effectiveSecrets;
    if (povEntityKey !== undefined) {
        const rawSecrets = (state.全局?.秘密库 ?? {});
        effectiveSecrets = filterSecretsForPOV(rawSecrets, povEntityKey);
    }
    else {
        effectiveSecrets = visibleSecrets ?? {};
    }
    // ── lore 底层谓词切片（R7-b 叙事注入路径·不进指纹）─────────────────────────────
    // 谓词命中 = 当前场景适用此 lore 条目；知识载荷注入叙事上下文（不影响判定）
    const loreLines = [];
    if (lorePredCtx) {
        const loreKB = state['_lore知识库'] ?? {};
        // DSL-AI: 读取三层控制参数（assemble 侧无 tick 上下文·从 state 现场读）
        const _dslGlobal = readGlobalDslSwitch(state._系统.功能开关表 ?? {});
        const _dslState = state['$AI创作状态'];
        for (const [loreKey, entry] of Object.entries(loreKB)) {
            // DSL-AI: 三层控制解析有效谓词（完整键 = lore:{loreKey}）
            const 完整键 = `lore:${loreKey}`;
            const effectivePred = resolveEffectivePredicate(完整键, entry.触发谓词, _dslGlobal, 作者AI控制表, _dslState?.条目AI控制表, _dslState?.谓词override表);
            const matches = effectivePred
                ? evalPredStr(effectivePred, lorePredCtx)
                : true; // 无谓词 = 恒真（通用常识载荷）
            if (matches && entry.知识载荷) {
                loreLines.push(entry.知识载荷);
            }
        }
    }
    // ── 货币（live 账本·来自 balances 参数 fallback 读 state）──────────────────────
    const currency = state.货币系统?.基准币种 ?? '文钱';
    const pcHolding = balances
        ? (balances[pcKey] ?? 0)
        : (state.货币系统?.账户?.[pcKey]?.持有?.[currency] ?? 0);
    // ── 在场 NPC（同地点·排除主角·含记忆/情绪·组装侧只读·回写属模块6）──────────────
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
        const ocean = npc.性格五轴 ?? {};
        const oceanStr = `O${ocean.开放 ?? 50}/C${ocean.尽责 ?? 50}/E${ocean.外向 ?? 50}/A${ocean.宜人 ?? 50}/N${ocean.神经质 ?? 50}`;
        const npcLine = `- ${npc.姓名 ?? key}（${npc.称呼 ?? ''}）：${npc.背景 ?? ''}${attrStr ? `  [${attrStr}]` : ''}  OCEAN[${oceanStr}]`;
        npcLines.push(npcLine);
        const npcMems = (npc.记忆 ?? [])
            .filter((m) => (m.重要度 ?? 0) >= 2)
            .slice(-3);
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
    const chronicle = (state.全局?._编年史 ?? [])
        .slice(-5);
    const chronicleLines = chronicle.map((e) => `[序${e.序号 ?? '?'}] ${e.标题 ?? ''}：${e.结果摘要行 ?? ''}`);
    const cogArchive = state.认知档案?.[effectivePovKey];
    const cogLines = [];
    if (cogArchive) {
        for (const [targetKey, cog] of Object.entries(cogArchive)) {
            if (targetKey === effectivePovKey)
                continue; // 跳过自我认知
            const imps = (cog.印象 ?? []).slice(-3);
            if (imps.length > 0) {
                const impStr = imps
                    .map((i) => `${i.标签 ?? ''}(${i.极性 ?? '—'}·${i.强度 ?? 0})`)
                    .join('、');
                cogLines.push(`他以为 ${targetKey}：${impStr}`);
            }
        }
    }
    // ── 已知秘密节（知情过滤后·$谜底 永不输出）────────────────────────────────────────
    const secretSection = [];
    const visibleEntries = Object.entries(effectiveSecrets);
    if (visibleEntries.length > 0) {
        secretSection.push('', '## 当前已知秘密（已知存在·勿在叙事中直接揭示）');
        for (const [id, s] of visibleEntries) {
            secretSection.push(`- [${id}] ${s.母题}（严重度${s.严重度}·暴露度${s.暴露度}）`);
        }
    }
    // ── 切片预算 B1-B6（组装侧·不进指纹）────────────────────────────────────────────
    // 构建可降级 SlicePart 列表（超限按 lore→nearK→chronicle 顺序降级）
    const k = nearK ?? DEFAULT_NEAR_K;
    const history = narrativeHistory ?? historyTicks ?? [];
    const recentHistory = history.slice(-k);
    const budgetParts = [];
    if (loreLines.length > 0)
        budgetParts.push({ key: 'lore', content: loreLines.join('\n') });
    if (recentHistory.length > 0)
        budgetParts.push({ key: 'nearK', content: recentHistory.join('\n') });
    if (chronicleLines.length > 0)
        budgetParts.push({ key: 'chronicle', content: chronicleLines.join('\n') });
    // npc/cog/secrets 为不可降级件（不进预算裁剪）
    let activeLoreLines = loreLines;
    let activeRecentHistory = recentHistory;
    let activeChronicleLines = chronicleLines;
    if (callTypeKey) {
        const spec = CALL_TYPE_REGISTRY[callTypeKey];
        const limit = spec.切片预算.软上限tokens;
        if (estimateSliceTokens(budgetParts) > limit) {
            const { parts: remaining } = applySliceBudget(budgetParts, { softLimitTokens: limit });
            const remainSet = new Set(remaining.map(p => p.key));
            if (!remainSet.has('lore'))
                activeLoreLines = [];
            if (!remainSet.has('chronicle'))
                activeChronicleLines = [];
            const nearKPart = remaining.find(p => p.key === 'nearK');
            if (!nearKPart) {
                activeRecentHistory = [];
            }
            else if (nearKPart.content !== recentHistory.join('\n')) {
                activeRecentHistory = nearKPart.content.split('\n').filter(l => l.length > 0);
            }
        }
    }
    // ── systemPrompt 组装（静态世界知识）──────────────────────────────────────────
    const systemParts = [
        '你是一款中文武侠模拟游戏的叙事 AI。请按下方渲染参数为当前拍生成一段叙事（50-80 字），',
        '描述当前场景氛围与主角动作，不要捏造不在场景中的人物或秘密。',
        '',
        // ── Anti-Labeling Directive（静态系统人格模板·不进切片指纹）─────────────────────
        '## 人格表达铁律（Anti-Labeling Directive）',
        '禁止在输出文本中使用抽象性格名词（善良/勇敢/阴险/忠诚/正直/冷酷/懦弱等）。',
        '人物性格须通过当下动作细节、对话语气、生理反应、决策倾向呈现，不直接贴标签。',
        '以 OCEAN(0-100) 数值和近期记忆为驱动依据；输出文本中不得出现数值或性格标签。',
        '',
        '## 主角（操控视角·不得与在场配角主客互换）',
        `姓名：${pcName}  称呼：${pc.称呼 ?? ''}`,
        `背景：${pcBio}`,
        `属性：${pcAttrStr}`,
        `身上：${pcHolding}${currency}`,
    ];
    // lore 底层切片（R7-b·叙事注入·仅在有 lorePredCtx 且有匹配且预算允许时插入）
    if (activeLoreLines.length > 0) {
        systemParts.push('', '## 世界常识（lore）');
        for (const l of activeLoreLines)
            systemParts.push(l);
    }
    systemParts.push('', '## 地点', locName, '', '## 在场人物');
    systemParts.push(npcLines.join('\n') || '（无）');
    // 编年史（表层公共·预算末位降级件）
    if (activeChronicleLines.length > 0) {
        systemParts.push('', '## 近期编年史');
        for (const c of activeChronicleLines)
            systemParts.push(c);
    }
    // POV 认知投影（表层投影）
    if (cogLines.length > 0) {
        systemParts.push('', '## 主角认知投影（他以为）');
        for (const c of cogLines)
            systemParts.push(c);
    }
    systemParts.push(...secretSection);
    const systemPrompt = systemParts.join('\n');
    // ── userPrompt 组装（动态每拍状态）────────────────────────────────────────────
    const recentActions = (actionHistory ?? []).slice(-6).join(' → ');
    const userParts = [
        `拍#${state._tick?.拍计数 ?? 1}`,
    ];
    // live 账本摘要（若提供了账本数据）
    if (balances) {
        const balEntries = Object.entries(balances)
            .map(([k2, v]) => `${k2}:${v}${currency}`)
            .join(' / ');
        userParts.push(`【账目】${balEntries}`);
    }
    // 近 K 拍叙事历史（预算超限时已截断）
    if (activeRecentHistory.length > 0) {
        userParts.push('', '【近期叙事】');
        activeRecentHistory.forEach((h, i) => userParts.push(`${i + 1}. ${h}`));
    }
    // 最近动作序列
    if (recentActions) {
        userParts.push(`【最近动作顺序】${recentActions}`);
    }
    // 当拍约定账变（B-E2-01·不进指纹·R7-b·让 LLM 使用规范货币单位）
    // 口径：CANONICAL_UNITS=文/文钱（与 reconcileGate 解析口径一致·禁铜钱/枚/块/两）
    if (proposalConstraints) {
        const constraintLines = [];
        for (const t of (proposalConstraints.transfers ?? [])) {
            const fromName = state.NPC?.[t.from]?.姓名 ?? t.from;
            const toName = state.NPC?.[t.to]?.姓名 ?? t.to;
            constraintLines.push(`${fromName}→${toName}: ${t.amount}${currency}`);
        }
        for (const item of (proposalConstraints.items ?? [])) {
            constraintLines.push(`物品「${item.id}」×${item.quantity}件`);
        }
        if (constraintLines.length > 0) {
            userParts.push(`【当拍约定账变（叙事须覆盖·货币单位写"${currency}"·禁铜钱/枚/块/两）】`, ...constraintLines);
        }
    }
    const userPrompt = userParts.join('\n');
    return { systemPrompt, userPrompt };
}
