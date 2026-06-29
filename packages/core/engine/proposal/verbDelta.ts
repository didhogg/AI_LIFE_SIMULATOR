// verbDelta — 变量驱动翻译底座（R9 重做·单一确定性路径·零 per-verb 分支·零占位符）
// 读 envelope.提案.目标引用（全状态路径）+ 数值槽（带符号整数）+ 关联实体（对手方全路径列表）
// → 按路径现有值类型派生 op → K5DeltaEntry[]
//
// 规则（三条·无分叉）：
//   1. 目标引用 = 全状态路径；数值槽 带符号（正→add·负→sub·0/undefined→no-op）
//   2. 关联实体[i] = 对手方全路径，同量反向（数值槽取反）
//   3. 非数值路径 / 路径不存在 → 可观测 no-op（返回 []·非静默：调用方 empty packs 可检测）
//
// 守恒：写到 货币系统.账户.* 的条目自动参与 tick.ts Phase9 assertConservation；此处不检查。
// E-2（多变量多值·txn_id 组）是下一步，本批仅覆盖单主路径 + 同量对手方。

import type { 指令信封Type } from '../../schema/proposal.js';
import type { RootState } from '../../schema/index.js';
import type { K5DeltaEntry } from '../../interfaces/interventionMerge.js';

function getAtPath(obj: Record<string, unknown>, path: string): unknown {
  let cur: unknown = obj;
  for (const seg of path.split('.')) {
    if (seg === '') return undefined;
    if (cur === null || typeof cur !== 'object' || Array.isArray(cur)) return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

function makeEntry(path: string, 数值: number): K5DeltaEntry | null {
  if (!Number.isInteger(数值) || 数值 === 0) return null;
  const op = 数值 > 0 ? 'add' : 'sub';
  return { path, op, value: Math.abs(数值) };
}

export function deriveVerbDelta(
  envelope: 指令信封Type,
  state: RootState,
  _seatId: string,
): ReadonlyArray<ReadonlyArray<K5DeltaEntry>> {
  const 提案 = envelope.提案;
  const targetPath = 提案.目标引用;
  const 数值 = 提案.数值槽;

  if (!targetPath || 数值 === undefined) return [];

  const stateObj = state as unknown as Record<string, unknown>;

  const primaryVal = getAtPath(stateObj, targetPath);
  if (typeof primaryVal !== 'number') return [];

  const primaryEntry = makeEntry(targetPath, 数值);
  if (primaryEntry === null) return [];

  const entries: K5DeltaEntry[] = [primaryEntry];

  // 关联实体：同量反向（对手方）
  const opposite = -数值;
  for (const counterPath of 提案.关联实体) {
    if (!counterPath) continue;
    const counterVal = getAtPath(stateObj, counterPath);
    if (typeof counterVal !== 'number') continue;
    const entry = makeEntry(counterPath, opposite);
    if (entry !== null) entries.push(entry);
  }

  return [entries];
}
