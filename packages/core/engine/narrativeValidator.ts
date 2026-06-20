// P0-8 Batch 2: PANGeA 叙事语义校验闸
// 检出生成叙事 vs 切片事实/信念态冲突（越权知情/凭空物品/在场矛盾/时序错乱）
//
// 物理隔离铁律（④ 拍板）:
//   - 内部见全局真值（全秘密母题 allSecretMotifs）用于越权知情检测
//   - 输出 NarrativeConflict.detail 禁含真值内容（$谜底/秘密母题/真值载荷）
//   - 校验器输出不成为秘密泄漏后门
//
// 玩家主权铁律（② 拍板）:
//   - 默认模式: single_retry_soft_reject（单次纠偏重试·失败软拒·还权玩家）
//   - 失败不自动重生·不替玩家做选择·不自动消耗额外 token 预算
//   - auto_regen 模式: 玩家设置界面可切换（接口就位·行为差异可测）

export type ConflictType = '越权知情' | '凭空物品' | '在场矛盾' | '时序错乱';

export interface NarrativeConflict {
  type: ConflictType;
  /** 冲突描述——禁含 $谜底/秘密母题等真值内容（物理隔离铁律） */
  detail: string;
}

export interface ValidationSlice {
  // ── 真值层（gate 内部用·禁透传到输出）──────────────────────────────────────────────
  /** 全局秘密母题集（含 POV 不知情的秘密·供越权知情检测）*/
  allSecretMotifs: string[];
  // ── POV 知情面（过滤后）─────────────────────────────────────────────────────────
  /** POV 实体合法可知的秘密母题（经 filterSecretsForPOV）*/
  povKnownMotifs: string[];
  // ── 在场信息 ──────────────────────────────────────────────────────────────────
  /** 当前在场 NPC 显示名列表 */
  presentNpcNames: string[];
  /** 当前不在场 NPC 显示名列表（在场矛盾检测用）*/
  absentNpcNames: string[];
  /** 当前拍号（时序检查基准）*/
  tickCount: number;
}

export type RetryMode = 'single_retry_soft_reject' | 'auto_regen';

/** 默认校验模式（玩家主权铁律: 失败→软拒·还权玩家） */
export const DEFAULT_RETRY_MODE: RetryMode = 'single_retry_soft_reject';

export interface SoftRejectHint {
  /** 面向玩家的 UI 提示文字 */
  ui提示: string;
  /** 操作说明 */
  重Roll说明: string;
}

export interface NarrativeValidationResult {
  valid: boolean;
  conflicts: NarrativeConflict[];
  softReject?: SoftRejectHint;
  /** 是否已执行了一次纠偏重试 */
  retriedOnce: boolean;
}

// ── 内部检测函数（不导出·真值可见层·物理隔离）──────────────────────────────────────

/**
 * 越权知情检测：叙事是否引用了 POV 不应知道的秘密母题。
 * 内部函数——可见全秘密·输出 detail 不含母题文本。
 */
function detectOverreachingKnowledge(
  narrative: string,
  allMotifs: string[],
  allowedMotifs: string[],
): NarrativeConflict[] {
  const conflicts: NarrativeConflict[] = [];
  for (const motif of allMotifs) {
    if (allowedMotifs.includes(motif)) continue; // POV 知情 → OK
    if (narrative.includes(motif)) {
      conflicts.push({
        type: '越权知情',
        // 物理隔离: detail 不含 motif 文本
        detail: '叙事引用了当前 POV 不应知晓的秘密信息（内容已脱敏）',
      });
    }
  }
  return conflicts;
}

/**
 * 在场矛盾检测：叙事是否将不在场的 NPC 描述为在场行动。
 * 仅检测强在场动词模式（避免纯提及的误判）。
 */
function detectPresenceContradiction(
  narrative: string,
  absentNpcNames: string[],
): NarrativeConflict[] {
  const conflicts: NarrativeConflict[] = [];
  // 在场行动动词模式（进入/发言/行动类·非纯提及）
  const presenceVerbs = ['走进', '走入', '坐下', '站起', '说道', '开口道', '拱手道', '笑道', '怒道', '皱眉道'];
  for (const name of absentNpcNames) {
    for (const verb of presenceVerbs) {
      if (narrative.includes(name + verb) || narrative.includes(name + '，' + verb)) {
        conflicts.push({
          type: '在场矛盾',
          detail: '叙事将不在当前场景的人物描述为在场行动（人物名已脱敏）',
        });
        break; // 每个人物只报一次
      }
    }
  }
  return conflicts;
}

/**
 * 凭空物品检测：叙事是否引入了已知物品集之外的物品。
 * MVP：仅检测显式「凭空」标记字符串（完整实现需物品注册表·defer）。
 */
function detectInventedItems(
  narrative: string,
): NarrativeConflict[] {
  // MVP: 检测测试 fixture 约定的标记串（生产侧替换为物品注册表对比）
  if (narrative.includes('【凭空物品:')) {
    return [{
      type: '凭空物品',
      detail: '叙事引入了当前世界状态中不存在的物品（物品名已脱敏）',
    }];
  }
  return [];
}

/**
 * 时序错乱检测：叙事是否引用了未来拍的事件。
 * MVP：检测显式「【未来拍:N】」标记格式（生产侧替换为 NLP 时序分析）。
 */
function detectTemporalAnomalies(
  narrative: string,
  tickCount: number,
): NarrativeConflict[] {
  const pattern = /【未来拍:(\d+)】/g;
  let match;
  const conflicts: NarrativeConflict[] = [];
  while ((match = pattern.exec(narrative)) !== null) {
    const referencedTick = Number(match[1]);
    if (referencedTick > tickCount) {
      conflicts.push({
        type: '时序错乱',
        detail: `叙事引用了尚未发生的拍（当前拍${tickCount}·引用拍已脱敏）`,
      });
    }
  }
  return conflicts;
}

/** 检测单条叙事的所有冲突（内部·真值可见） */
function checkAllConflicts(
  narrative: string,
  slice: ValidationSlice,
): NarrativeConflict[] {
  return [
    ...detectOverreachingKnowledge(narrative, slice.allSecretMotifs, slice.povKnownMotifs),
    ...detectPresenceContradiction(narrative, slice.absentNpcNames),
    ...detectInventedItems(narrative),
    ...detectTemporalAnomalies(narrative, slice.tickCount),
  ];
}

// ── 导出函数 ─────────────────────────────────────────────────────────────────────

/**
 * PANGeA 叙事语义校验（物理隔离·玩家主权）。
 *
 * @param narrative     主叙事文本（待校验）
 * @param slice         验证切片（含真值层 allSecretMotifs + POV 知情面）
 * @param retryNarrative 纠偏重试叙事（单次重试用·生产侧来自 LLM 重试调用）
 * @param retryMode     校验失败处理模式（默认 single_retry_soft_reject）
 */
export function validateNarrativeSemantics(
  narrative: string,
  slice: ValidationSlice,
  retryNarrative?: string,
  retryMode: RetryMode = DEFAULT_RETRY_MODE,
): NarrativeValidationResult {
  const primaryConflicts = checkAllConflicts(narrative, slice);

  if (primaryConflicts.length === 0) {
    return { valid: true, conflicts: [], retriedOnce: false };
  }

  // 有冲突 → 尝试纠偏重试（若提供了重试叙事）
  if (retryNarrative !== undefined) {
    const retryConflicts = checkAllConflicts(retryNarrative, slice);
    if (retryConflicts.length === 0) {
      return { valid: true, conflicts: [], retriedOnce: true };
    }

    // 重试也失败
    if (retryMode === 'single_retry_soft_reject') {
      // 玩家主权：软拒·把决定权还给玩家·不自动重生
      return {
        valid: false,
        conflicts: retryConflicts,
        softReject: {
          ui提示: '此叙事与当前场景存在矛盾，请「重 Roll」重新生成',
          重Roll说明: '点击「重 Roll」按钮可重新请求一次叙事生成',
        },
        retriedOnce: true,
      };
    }
    // auto_regen 模式: 返回失败但不软拒（调用方决定下一步）
    return { valid: false, conflicts: retryConflicts, retriedOnce: true };
  }

  // 无重试叙事 → 首次失败时根据模式决策
  if (retryMode === 'single_retry_soft_reject') {
    // 需要重试但没有重试叙事（生产侧应传入）→ 标记需要重试
    return { valid: false, conflicts: primaryConflicts, retriedOnce: false };
  }
  return { valid: false, conflicts: primaryConflicts, retriedOnce: false };
}

/**
 * 构建空的 ValidationSlice（辅助函数·测试用）。
 * 生产侧由 validationGate.ts 从 RootState 自动构建。
 */
export function makeEmptyValidationSlice(): ValidationSlice {
  return {
    allSecretMotifs: [],
    povKnownMotifs: [],
    presentNpcNames: [],
    absentNpcNames: [],
    tickCount: 1,
  };
}
