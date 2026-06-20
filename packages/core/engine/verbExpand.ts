// V3 展开器 runtime 接线 + V3 写入口侧
// 动词目标槽按真键字典序展开（单态已锁·确定性·无随机源）
// 真键字典序 = Unicode 码点序（Array.prototype.sort() 默认行为·禁 localeCompare 六禁④）
// 写入口侧: 接收 expandVerbTarget() 展开结果并对每个目标依次应用效果函数
// 红线: 不 import rng.ts / gate.ts / fixed.ts

/** 展开结果：展开后的实体键列表（Unicode 码点序·只读） */
export type ExpandedTargets = readonly string[];

/** 通配符常量（展开到全部实体键） */
export const VERB_TARGET_WILDCARD = '*';
export const VERB_TARGET_WILDCARD_ZH = '全部';

/**
 * V3: 展开动词目标槽到具体实体键列表。
 *
 * 规则（按优先级）：
 *   ''（空串）           → []（无目标）
 *   '*' | '全部'         → 全部 entityKeys，Unicode 码点序排序
 *   精确 entityKey 字面  → [slot]（单元素列表）
 *   其余选择器/DSL 谓词  → []（待 DSL parser·defer P2）
 *
 * @param slot       动词目标槽值（动词目标槽Schema string·verb.ts:44）
 * @param entityKeys 当前世界所有实体键集合（调用方提供·来源于 RootState）
 */
export function expandVerbTarget(
  slot: string,
  entityKeys: readonly string[],
): ExpandedTargets {
  if (!slot) return [];
  // 通配符：展开为全部实体键（Unicode 码点序）
  if (slot === VERB_TARGET_WILDCARD || slot === VERB_TARGET_WILDCARD_ZH) {
    return [...entityKeys].sort(); // 禁 localeCompare（六禁④）
  }
  // 字面键精确匹配
  if (entityKeys.includes(slot)) return [slot];
  // 未知选择器（含 DSL 谓词·待 parser 就绪·defer P2）
  return [];
}

/**
 * V3 写入口侧：将动词效果顺序写入所有展开目标。
 *
 * 契约：
 *   · 纯函数（accumulator pattern）；调用方在进入前已完成 structuredClone。
 *   · 遍历顺序 = expandedTargets 传入序（= Unicode 码点序）。
 *   · expandedTargets 为空时返回原 acc（空转不变）。
 *
 * @param expandedTargets expandVerbTarget() 的输出
 * @param applyFn         对单目标的效果应用函数（纯函数·禁副作用）
 * @param acc             累积器（初始值 = 拍前状态快照副本）
 */
export function applyVerbToTargets<S>(
  expandedTargets: ExpandedTargets,
  applyFn: (state: S, targetKey: string) => S,
  acc: S,
): S {
  let result = acc;
  for (const key of expandedTargets) {
    result = applyFn(result, key);
  }
  return result;
}
