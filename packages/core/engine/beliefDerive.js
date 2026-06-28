// P0-8 Batch 2: P–R–B 信念派生管线
// R7-b 双轨铁律:
//   trackPath='gate'     → 信念命中被 gate 消费 → 确定性 → 进指纹
//   trackPath='narrative' → 叙事召回路径 → 不进指纹（同 Batch 1 lore 叙事注入路径）
// 铁律: 纯函数·同入参同输出·不修改入参·零副作用
// ── 推理规则（可配·零 Math 超越函数）───────────────────────────────────────────────
const TRUST_STRENGTH_THRESHOLD = 60; // 默认值·与 formulaRegistry 同步
const NEGATIVE_POLARITIES = ['负', '中负'];
const POSITIVE_POLARITIES = ['正', '中正'];
import { resolveFormula } from './formulaRegistry.js';
/**
 * P–R–B 信念派生（纯函数）。
 *
 * 从 POV 认知档案 + 知情过滤后秘密推导结构化信念态。
 *
 * @param cogArchive  POV 实体的认知档案（来自 state.认知档案[povKey]）
 * @param filteredSecrets  经 filterSecretsForPOV 过滤后的秘密（POV 可见集）
 * @param povKey  POV 实体键
 * @param trackPath  R7-b 路径标记（默认 'narrative'·叙事召回不进指纹）
 */
export function deriveBeliefState(cogArchive, filteredSecrets, povKey, trackPath = 'narrative', formulaConfig) {
    const _trustThreshold = resolveFormula('belief_trust_threshold', formulaConfig);
    const 感知 = [];
    const 推理 = [];
    const 信念 = [];
    // ── P（感知层）：认知档案印象 → 感知条目 ──────────────────────────────────────────
    if (cogArchive) {
        for (const [targetKey, cog] of Object.entries(cogArchive)) {
            if (targetKey === povKey)
                continue; // 跳过自我认知
            for (const imp of cog.印象 ?? []) {
                if (!imp.标签)
                    continue;
                感知.push({
                    subjectKey: targetKey,
                    fact: `${imp.标签}（${imp.极性 ?? '中'}·强度${imp.强度 ?? 0}）`,
                    certainty: imp.强度 ?? 0,
                });
            }
        }
    }
    // ── R（推理层）：强印象 → 单步推断 ────────────────────────────────────────────────
    for (const p of 感知) {
        if (p.certainty <= _trustThreshold)
            continue;
        const polarityMatch = p.fact.match(/（(.+)·强度/);
        if (!polarityMatch)
            continue;
        const pol = polarityMatch[1] ?? '';
        const isPositive = POSITIVE_POLARITIES.some(s => pol.startsWith(s));
        const isNegative = NEGATIVE_POLARITIES.some(s => pol.startsWith(s));
        if (!isPositive && !isNegative)
            continue;
        推理.push({
            basis: `对 ${p.subjectKey} 的感知: ${p.fact}`,
            inference: isPositive
                ? `${p.subjectKey} 是可信任的对象`
                : `对 ${p.subjectKey} 需保持警惕`,
            certainty: p.certainty,
        });
    }
    // ── B（信念层）：认知档案印象 → 具名信念（R7-b 双轨标记）──────────────────────────
    if (cogArchive) {
        for (const [targetKey, cog] of Object.entries(cogArchive)) {
            if (targetKey === povKey)
                continue;
            const imps = (cog.印象 ?? []).slice(-3); // 同 Batch 1 表层投影口径（最近3条）
            for (const imp of imps) {
                if (!imp.标签)
                    continue;
                信念.push({
                    subjectKey: targetKey,
                    content: `他以为 ${targetKey} 是${imp.标签}的`,
                    certainty: imp.强度 ?? 50,
                    trackPath,
                });
            }
        }
    }
    // 知情秘密 → 知情信念（R7-b narrative 路径·谓词判定已走 lore谓词集合 不重复进指纹）
    for (const [id, secret] of Object.entries(filteredSecrets)) {
        信念.push({
            subjectKey: id,
            content: `知晓秘密 ${id}：${secret.母题}（暴露度${secret.暴露度}）`,
            certainty: 80,
            trackPath,
        });
    }
    return { povKey, 感知, 推理, 信念 };
}
