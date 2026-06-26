// D-a-lore: lore 触发谓词创建即冻结·永不重算·配 L-21 纪律
// 冻结后的谓词串聚合为 lore谓词集合 → hashJudgmentBundle.lore谓词集合 → 指纹
// 血统：freeze 时 event_id 注入 content_hash 聚合链（同 L-21 口径经 B1c 路径）
// 红线：不 import rng.ts / gate.ts / fixed.ts
// commit-1 (1a): collectLorePredicates — 触发谓词聚合·仅非空·assertLorePredicateFrozen 守卫
// commit-2 (1b/1c): 状态转移触发条件 + 硬约束禁令谓词 freeze·复合键并入 lore谓词集合

import { tryParsePred } from './dsl/parser.js';

/** 包含 lore 谓词冻结字段的条目最小形状 */
export interface FreezableLoreEntry {
  触发谓词?: string;
  触发谓词_冻结?: boolean;
}

/** 冻结写入结果（触发谓词_冻结 永远为 true） */
export interface LorePredicateFreezeResult {
  readonly 触发谓词: string;
  readonly 触发谓词_冻结: true;
}

/**
 * D-a-lore: 创建 lore 条目触发谓词并立即冻结。
 *
 * 只允许在 lore 条目「创建/导入时」调用一次；创建后永不重算。
 * 已冻结（触发谓词_冻结=true）时调用 → 抛出 D-a-lore 不可逆错误。
 * 非空谓词不可解析 → fail-closed（禁止落库非法谓词）。
 * 空谓词串 → 允许冻结（表示此条目无 gate 判定谓词·叙事只读路径）。
 *
 * @param currentEntry 当前 lore 条目（只读·读取冻结状态）
 * @param rawPredicate 原始谓词串（DSL 文法·过 DSL parser·空串合法）
 */
export function freezeLorePredicate(
  currentEntry: FreezableLoreEntry,
  rawPredicate: string,
): LorePredicateFreezeResult {
  if (currentEntry.触发谓词_冻结) {
    throw new Error(
      `D-a-lore 违规: lore 触发谓词已冻结（当前值: "${currentEntry.触发谓词 ?? ''}"），禁止重算`,
    );
  }
  if (rawPredicate !== '') {
    const parsed = tryParsePred(rawPredicate);
    if (parsed === null) {
      throw new Error(
        `D-a-lore: lore 触发谓词解析失败，禁止落库非法谓词: "${rawPredicate}"`,
      );
    }
  }
  return { 触发谓词: rawPredicate, 触发谓词_冻结: true };
}

/**
 * D-a-lore 守卫：断言 lore 条目触发谓词已冻结。
 * 未冻结 → throw（导入流程漏调 freezeLorePredicate）。
 *
 * @param entry   待检查的 lore 条目
 * @param loreKey lore 键（仅用于错误诊断）
 */
export function assertLorePredicateFrozen(
  entry: FreezableLoreEntry,
  loreKey: string,
): void {
  if (!entry.触发谓词_冻结) {
    throw new Error(
      `D-a-lore 守卫: lore「${loreKey}」触发谓词未冻结（谓词: "${entry.触发谓词 ?? ''}"）——导入流程须先调 freezeLorePredicate`,
    );
  }
}

/**
 * 安全读取已冻结的 lore 触发谓词。
 * 未冻结时返回 defaultValue（fail-open·不抛）。
 */
export function readFrozenLorePredicate(
  entry: FreezableLoreEntry,
  defaultValue = '',
): string {
  if (!entry.触发谓词_冻结) return defaultValue;
  return entry.触发谓词 ?? defaultValue;
}

// ── D-a-lore (1b): 状态转移触发条件 freeze ───────────────────────────────────

/** 状态转移条目最小冻结形状 */
export interface FreezableLoreTransitionEntry {
  触发条件?: string;
  触发条件_冻结?: boolean;
}

/** 状态转移冻结写入结果（触发条件_冻结 永远为 true） */
export interface LoreTransitionPredicateFreezeResult {
  readonly 触发条件: string;
  readonly 触发条件_冻结: true;
}

/**
 * D-a-lore (1b): 冻结状态转移条目的触发条件谓词。
 * 极性：空串 = 不转移（永不触发）；caller 勿将空串解读为"总触发"。
 * 已冻结再调 → throw D-a-lore 违规。非空非法谓词 → fail-closed throw。
 */
export function freezeLoreTransitionPredicate(
  currentEntry: FreezableLoreTransitionEntry,
  rawPredicate: string,
): LoreTransitionPredicateFreezeResult {
  if (currentEntry.触发条件_冻结) {
    throw new Error(
      `D-a-lore 违规: lore 状态转移触发条件已冻结（当前值: "${currentEntry.触发条件 ?? ''}"），禁止重算`,
    );
  }
  if (rawPredicate !== '') {
    const parsed = tryParsePred(rawPredicate);
    if (parsed === null) {
      throw new Error(
        `D-a-lore: lore 状态转移触发条件解析失败，禁止落库非法谓词: "${rawPredicate}"`,
      );
    }
  }
  return { 触发条件: rawPredicate, 触发条件_冻结: true };
}

/**
 * D-a-lore 守卫：断言状态转移条目触发条件已冻结。
 * @param key 复合键形如 'loreKey:转移[i]'（仅用于错误诊断）
 */
export function assertLoreTransitionPredicateFrozen(
  entry: FreezableLoreTransitionEntry,
  key: string,
): void {
  if (!entry.触发条件_冻结) {
    throw new Error(
      `D-a-lore 守卫: lore 状态转移「${key}」触发条件未冻结——导入流程须先调 freezeLoreTransitionPredicate`,
    );
  }
}

// ── D-a-lore (1c): 硬约束禁令谓词 freeze ────────────────────────────────────

/** 硬约束条目最小冻结形状 */
export interface FreezableLoreConstraintEntry {
  禁令谓词?: string;
  禁令谓词_冻结?: boolean;
}

/** 硬约束冻结写入结果（禁令谓词_冻结 永远为 true） */
export interface LoreConstraintPredicateFreezeResult {
  readonly 禁令谓词: string;
  readonly 禁令谓词_冻结: true;
}

/**
 * D-a-lore (1c): 冻结硬约束条目的禁令谓词。
 * 极性：空串 = 不禁（永不拒绝）；caller 勿将空串解读为"总拒绝"。
 * 已冻结再调 → throw D-a-lore 违规。非空非法谓词 → fail-closed throw。
 */
export function freezeLoreConstraintPredicate(
  currentEntry: FreezableLoreConstraintEntry,
  rawPredicate: string,
): LoreConstraintPredicateFreezeResult {
  if (currentEntry.禁令谓词_冻结) {
    throw new Error(
      `D-a-lore 违规: lore 硬约束禁令谓词已冻结（当前值: "${currentEntry.禁令谓词 ?? ''}"），禁止重算`,
    );
  }
  if (rawPredicate !== '') {
    const parsed = tryParsePred(rawPredicate);
    if (parsed === null) {
      throw new Error(
        `D-a-lore: lore 硬约束禁令谓词解析失败，禁止落库非法谓词: "${rawPredicate}"`,
      );
    }
  }
  return { 禁令谓词: rawPredicate, 禁令谓词_冻结: true };
}

/**
 * D-a-lore 守卫：断言硬约束条目禁令谓词已冻结。
 * @param key 复合键形如 'loreKey:禁令[i]'（仅用于错误诊断）
 */
export function assertLoreConstraintPredicateFrozen(
  entry: FreezableLoreConstraintEntry,
  key: string,
): void {
  if (!entry.禁令谓词_冻结) {
    throw new Error(
      `D-a-lore 守卫: lore 硬约束「${key}」禁令谓词未冻结——导入流程须先调 freezeLoreConstraintPredicate`,
    );
  }
}

// ── D-a-lore: FreezableLoreEntryFull + lore谓词集合聚合 ──────────────────────

/** 支持全三类谓词 freeze 的完整条目形状（extends FreezableLoreEntry·backward compat） */
export interface FreezableLoreEntryFull extends FreezableLoreEntry {
  状态转移?: Array<FreezableLoreTransitionEntry>;
  硬约束?: Array<FreezableLoreConstraintEntry>;
}

/**
 * D-a-lore (1a+1b+1c): 聚合 lore知识库全条目三类谓词集。
 *
 * - 1a 触发谓词：{loreKey → 谓词串}（仅非空）
 * - 1b 状态转移触发条件：{'loreKey:转移[i]' → 谓词串}（仅非空·i=array index）
 * - 1c 硬约束禁令谓词：{'loreKey:禁令[i]' → 谓词串}（仅非空·i=array index）
 *
 * 对全部条目及子条目调对应 assert 守卫（未冻结 → throw）。
 * 空集合返回 undefined → hashJudgmentBundle canonicalize 跳过 → 指纹不变（Option B）。
 *
 * @param loreBag _lore知识库（全 record·已完成 import freeze 流程）
 */
export function collectLorePredicates(
  loreBag: Record<string, FreezableLoreEntryFull>,
): Record<string, string> | undefined {
  const result: Record<string, string> = {};
  for (const [loreKey, entry] of Object.entries(loreBag)) {
    // 1a: 触发谓词
    assertLorePredicateFrozen(entry, loreKey);
    const mainPred = readFrozenLorePredicate(entry);
    if (mainPred !== '') result[loreKey] = mainPred;

    // 1b: 状态转移触发条件
    for (let i = 0; i < (entry.状态转移?.length ?? 0); i++) {
      const trans = entry.状态转移![i]!;
      const compKey = `${loreKey}:转移[${i}]`;
      assertLoreTransitionPredicateFrozen(trans, compKey);
      const tPred = trans.触发条件_冻结 ? (trans.触发条件 ?? '') : '';
      if (tPred !== '') result[compKey] = tPred;
    }

    // 1c: 硬约束禁令谓词
    for (let i = 0; i < (entry.硬约束?.length ?? 0); i++) {
      const constr = entry.硬约束![i]!;
      const compKey = `${loreKey}:禁令[${i}]`;
      assertLoreConstraintPredicateFrozen(constr, compKey);
      const cPred = constr.禁令谓词_冻结 ? (constr.禁令谓词 ?? '') : '';
      if (cPred !== '') result[compKey] = cPred;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}
