// P7-4a 级联结算轮段 + 挂起命中队列 (J1/J6)
// 单写者 worklist 不动点迭代 · visited 防环 · 有界轮次（超界 throw）

export const MAX_CASCADE_ROUNDS = 8;

/**
 * J1/J6 级联 worklist — 不动点迭代。
 */
export function runCascadeWorklist(initial, applyTrigger) {
  const visited  = new Set();
  let   worklist = [...initial];
  let   rounds   = 0;
  const processed = [];

  while (worklist.length > 0) {
    rounds++;
    if (rounds > MAX_CASCADE_ROUNDS) {
      throw new Error(
        `J1 级联超界：超过最大轮次 ${MAX_CASCADE_ROUNDS}·` +
        `已处理 ${visited.size} 条触发（可能存在无收敛回路）`,
      );
    }
    const current = worklist;
    worklist = [];
    for (const entry of current) {
      const id = `${entry.triggerType}:${entry.entityKey}:${entry.triggerId}`;
      if (visited.has(id)) continue;
      visited.add(id);
      processed.push(id);
      const cascaded = applyTrigger(entry);
      worklist.push(...cascaded);
    }
  }

  return { rounds, processed };
}
