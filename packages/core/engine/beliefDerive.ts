// P0-8 Batch 2: P–R–B 信念派生管线
// R7-b 双轨铁律:
//   trackPath='gate'     → 信念命中被 gate 消费 → 确定性 → 进指纹
//   trackPath='narrative' → 叙事召回路径 → 不进指纹（同 Batch 1 lore 叙事注入路径）
// 铁律: 纯函数·同入参同输出·不修改入参·零副作用

// ── 类型定义 ─────────────────────────────────────────────────────────────────────

/** R7-b 双轨路径标记 */
export type BeliefTrackPath = 'gate' | 'narrative';

/** 感知层（P）—— 直接观察/耳闻事实 */
export interface Perception {
  subjectKey: string;  // 感知对象实体键
  fact: string;        // 观察到的事实描述
  certainty: number;   // 确信度 0-100
}

/** 推理层（R）—— 从感知单步派生 */
export interface Reasoning {
  basis: string;      // 推断前提
  inference: string;  // 推断结论
  certainty: number;  // 0-100
}

/** 信念层（B）—— 对实体/秘密的最终信念态 */
export interface Belief {
  subjectKey: string;        // 信念指向的实体键或秘密 ID
  content: string;           // 信念内容描述
  certainty: number;         // 0-100
  trackPath: BeliefTrackPath; // R7-b: gate→进指纹 / narrative→不进指纹
}

/** P–R–B 三元信念态 */
export interface BeliefState {
  povKey: string;
  感知: Perception[];
  推理: Reasoning[];
  信念: Belief[];
}

// ── 内部类型别名（不导出·与 CogArchive/VisibleSecret 结构对齐）───────────────────
type CogImpression = { 标签?: string; 极性?: string; 强度?: number };
type CogEntry = { 印象?: CogImpression[] };
type CogArchive = Record<string, CogEntry>;
type FilteredSecret = { 母题: string; 严重度: number; 暴露度: number };

// ── 推理规则（可配·零 Math 超越函数）───────────────────────────────────────────────
const TRUST_STRENGTH_THRESHOLD = 60;
const NEGATIVE_POLARITIES = ['负', '中负'] as const;
const POSITIVE_POLARITIES = ['正', '中正'] as const;

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
export function deriveBeliefState(
  cogArchive: CogArchive | undefined,
  filteredSecrets: Record<string, FilteredSecret>,
  povKey: string,
  trackPath: BeliefTrackPath = 'narrative',
): BeliefState {
  const 感知: Perception[] = [];
  const 推理: Reasoning[] = [];
  const 信念: Belief[] = [];

  // ── P（感知层）：认知档案印象 → 感知条目 ──────────────────────────────────────────
  if (cogArchive) {
    for (const [targetKey, cog] of Object.entries(cogArchive)) {
      if (targetKey === povKey) continue; // 跳过自我认知
      for (const imp of cog.印象 ?? []) {
        if (!imp.标签) continue;
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
    if (p.certainty <= TRUST_STRENGTH_THRESHOLD) continue;
    const polarityMatch = p.fact.match(/（(.+)·强度/);
    if (!polarityMatch) continue;
    const pol = polarityMatch[1] ?? '';
    const isPositive = POSITIVE_POLARITIES.some(s => pol.startsWith(s));
    const isNegative = NEGATIVE_POLARITIES.some(s => pol.startsWith(s));
    if (!isPositive && !isNegative) continue;
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
      if (targetKey === povKey) continue;
      const imps = (cog.印象 ?? []).slice(-3); // 同 Batch 1 表层投影口径（最近3条）
      for (const imp of imps) {
        if (!imp.标签) continue;
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
