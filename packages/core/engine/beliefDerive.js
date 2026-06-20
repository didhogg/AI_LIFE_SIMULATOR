// P0-8 Batch 2: P–R–B 信念派生管线（compiled JS）
const TRUST_STRENGTH_THRESHOLD = 60;
const NEGATIVE_POLARITIES = ['负', '中负'];
const POSITIVE_POLARITIES = ['正', '中正'];

export function deriveBeliefState(cogArchive, filteredSecrets, povKey, trackPath = 'narrative') {
  const 感知 = [];
  const 推理 = [];
  const 信念 = [];

  // P: 感知层
  if (cogArchive) {
    for (const [targetKey, cog] of Object.entries(cogArchive)) {
      if (targetKey === povKey) continue;
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

  // R: 推理层
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

  // B: 信念层（认知档案印象）
  if (cogArchive) {
    for (const [targetKey, cog] of Object.entries(cogArchive)) {
      if (targetKey === povKey) continue;
      const imps = (cog.印象 ?? []).slice(-3);
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

  // B: 知情秘密 → 信念
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
