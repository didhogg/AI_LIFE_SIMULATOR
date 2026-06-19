// P7-4a 级联结算轮段 + 挂起命中队列 (J1/J6)
// 单写者 worklist 不动点迭代 · visited 防环 · 有界轮次（超界 throw）

export const MAX_CASCADE_ROUNDS = 8;

/** 级联触发条目 */
export interface CascadeEntry {
  entityKey:   string;
  triggerId:   string;
  triggerType: '阈值' | '日期' | '标志' | '关系';
}

export interface CascadeResult {
  rounds:    number;
  processed: readonly string[];  // visited 三元组 ID 列表
}

/**
 * J1/J6 级联 worklist — 不动点迭代（纯函数·无副作用）。
 *
 * 终止条件：worklist 为空（已收敛）。
 * 循环防护：visited set 对 (triggerType:entityKey:triggerId) 去重，重入即跳过。
 * 有界保护：超过 MAX_CASCADE_ROUNDS 轮次即 throw（禁无限迭代）。
 *
 * 单写者模型：applyTrigger 是唯一的 worklist 写入点；外部不得直接 push。
 */
export function runCascadeWorklist(
  initial:        readonly CascadeEntry[],
  applyTrigger:   (entry: CascadeEntry) => CascadeEntry[],
): CascadeResult {
  const visited  = new Set<string>();
  let   worklist: CascadeEntry[] = [...initial];
  let   rounds   = 0;
  const processed: string[] = [];

  while (worklist.length > 0) {
    rounds++;
    if (rounds > MAX_CASCADE_ROUNDS) {
      throw new Error(
        `J1 级联超界：超过最大轮次 ${MAX_CASCADE_ROUNDS}·` +
        `已处理 ${visited.size} 条触发（可能存在无收敛回路）`,
      );
    }
    const current  = worklist;
    worklist = [];
    for (const entry of current) {
      const id = `${entry.triggerType}:${entry.entityKey}:${entry.triggerId}`;
      if (visited.has(id)) continue;      // visited 防环
      visited.add(id);
      processed.push(id);
      const cascaded = applyTrigger(entry);
      worklist.push(...cascaded);
    }
  }

  return { rounds, processed };
}
