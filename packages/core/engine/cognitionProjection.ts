// packages/core/engine/cognitionProjection.ts
// PR-5 · access 场 / 认知投影接缝（认知投影层 ⊥ 真相实体层）
//
// P5-1  projectCognition          — 纯函数·只读·零指纹·零写
// P5-2  co-location 临时高导通    — 同场 +colocation_boost 公式点值·读时计算·不落状态
// P5-3  covert gate               — 跨域 access=0·访问阈值门·existence-opaque
// P5-4  声望导通乘子              — 声誉.人望 → conductance 调制·闭式·确定性
// P5-5  buildInvestigationDelta   — investigation 归约为 了解度 K5 delta（走五道闸）
// P5-6  diffProjection            — 低→高 access 重投影 diff 浮现
//
// 六禁：禁 Date.now/new Date/Math.random/localeCompare/裸 JSON.stringify/NFC
// 零指纹：投影读不影响任何判定·不进 hashJudgmentBundle（R7-b 并列）
// 红线：gate.ts/rng.ts/conservation.ts/computeDelta.ts/fixed.ts/propagateRipple 函数体零 diff

import type { RootState } from '../schema/index.js';
import type { ImpressionEntry } from './tick.js';
import { isCrossDomainAccess } from './lodScheduler.js';
import { resolveFormula, type FormulaResolveConfig } from './formulaRegistry.js';

// ── 公共接口 ──────────────────────────────────────────────────────────────────

/** 投影过滤范围 */
export interface CognitionScope {
  /** 目标实体键集（空/undefined = 全部已知目标） */
  targetKeys?: string[];
  /** 维度过滤（空/undefined = 不过滤维度）— scope 降维（只看某些 factFragment.维度） */
  dimensions?: string[];
  /** 最低印象强度过滤（缺省=access_min 公式点默认值） */
  minStrength?: number;
}

/** 单条印象投影（只读·非 schema 落存·不进指纹） */
export interface ImpressionProjection {
  标签: string;
  极性: string;
  强度: number;
  来源类型?: '一手观测' | '二手转述' | '玩家陈述';
  factFragment?: ImpressionEntry['factFragment'];
}

/** 单目标投影切片 */
export interface TargetProjection {
  /** 过滤后可见印象列表（已通过 covert gate + scope + 访问阈值） */
  impressions: ImpressionProjection[];
  /** 综合导通值 [0,100]（max印象强度|了解度 + co-location + 声望乘子） */
  access: number;
  /** 是否与观察者同场（P5-2 标志） */
  coLocated: boolean;
}

/** projectCognition 返回值 */
export interface CognitionProjection {
  observerKey: string;
  /** targetKey → TargetProjection（仅含有权感知的目标） */
  baseline: Record<string, TargetProjection>;
  /** 观察者当前活跃域 ID（空串 = 无明确域·单域模式） */
  observerDomain: string;
}

// ── P5-1/P5-2/P5-3/P5-4 核心实装 ─────────────────────────────────────────────

/**
 * 认知投影：给定 (观察者, scope) → 返回该 actor 当前有权感知的事实切片。
 *
 * 纯函数·只读·零写·零指纹（R7-b 并列·不影响判定面）。
 * 退化：无观察者认知档案 → 空投影 { baseline: {} }。
 *
 * 投影管道（顺序）：
 *   ① 读 认知档案[observerKey] → 全量已知目标集
 *   ② scope 降维（targetKeys · dimensions · minStrength）
 *   ③ P5-2 co-location 加成（同场 +colocation_boost 公式点值）
 *   ④ P5-4 声望乘子（目标 声誉.人望 ∈ [-100,100] → ×[0.5,1.5]）
 *   ⑤ P5-3a 跨域 gate：impression.factFragment.来源世界域 ≠ observerDomain → 过滤
 *   ⑥ P5-3b 访问阈值：_factFragment种子库.访问阈值 > access → 对应维度印象过滤
 */
export function projectCognition(
  state: RootState,
  observerKey: string,
  scope: CognitionScope = {},
  formulaConfig?: FormulaResolveConfig,
): CognitionProjection {
  const _colocBoost    = resolveFormula('colocation_boost', formulaConfig);
  const _prestigeScale = resolveFormula('prestige_scale',   formulaConfig);
  const _accessMin     = resolveFormula('access_min',       formulaConfig);
  const observerDomain = _activeDomainId(state);
  const minStr = scope.minStrength ?? _accessMin;

  const observerArchive = state.认知档案?.[observerKey];
  if (!observerArchive) {
    return { observerKey, baseline: {}, observerDomain };
  }

  const observerLoc = state.NPC[observerKey]?.位置 ?? '';

  const rawTargetKeys = Object.keys(observerArchive);
  const targetKeys = scope.targetKeys && scope.targetKeys.length > 0
    ? scope.targetKeys.filter(k => observerArchive[k] !== undefined)
    : rawTargetKeys;

  const baseline: Record<string, TargetProjection> = {};

  for (const targetKey of targetKeys) {
    const cogEntry = observerArchive[targetKey];
    if (!cogEntry) continue;

    // P5-2: co-location 导通加成（读时计算·不落状态）
    const targetLoc = state.NPC[targetKey]?.位置 ?? '';
    const coLocated = !!observerLoc && !!targetLoc && observerLoc === targetLoc;

    // P5-4: 声望乘子（目标 声誉.人望 ∈ [-100,100] → 乘子 ∈ [0.5,1.5]）
    const prestige = state.NPC[targetKey]?.声誉?.人望 ?? 0;
    const prestigeMul = 1.0 + prestige / _prestigeScale;

    // Base conductance 仅统计同域印象（跨域印象不贡献 access·existence-opaque）
    const sameDomainImps = cogEntry.印象.filter(imp => {
      if (imp.factFragment?.来源世界域 && observerDomain) {
        return !isCrossDomainAccess(imp.factFragment.来源世界域, observerDomain);
      }
      return true; // 无域声明 → 同域兼容
    });
    const maxImpStr = sameDomainImps.reduce<number>((m, i) => Math.max(m, i.强度), 0);
    // 了解度 = P5-5 investigation 输出面（buildInvestigationDelta 写此字段）
    const baseStrength = Math.max(maxImpStr, cogEntry.了解度);
    const boostedStr = coLocated
      ? Math.min(100, baseStrength + _colocBoost)
      : baseStrength;
    const access = Math.max(0, Math.min(100, Math.round(boostedStr * prestigeMul)));

    // P5-3b: 访问阈值门（从 _factFragment种子库 按目标主体读取阈值）
    const seedLib = state.全局?._factFragment种子库 ?? {};
    const blockedDims = new Set<string>(); // '主体:维度' 被挡住的组合
    for (const seed of Object.values(seedLib)) {
      if (!seed) continue;
      if (seed.主体 === targetKey && seed.访问阈值 > access) {
        blockedDims.add(`${seed.主体}:${seed.维度}`);
      }
    }

    // 过滤印象（scope + P5-3a 跨域 + P5-3b 访问阈值）
    const filtered: ImpressionProjection[] = [];
    for (const imp of cogEntry.印象) {
      if (imp.强度 < minStr) continue;

      // scope.dimensions 降维过滤
      if (scope.dimensions && scope.dimensions.length > 0) {
        const dim = imp.factFragment?.维度 ?? '';
        if (!scope.dimensions.includes(dim)) continue;
      }

      // P5-3a: 跨域 impression gate（有域声明且 ≠ observerDomain → 不出现）
      if (imp.factFragment?.来源世界域 && observerDomain) {
        if (isCrossDomainAccess(imp.factFragment.来源世界域, observerDomain)) continue;
      }

      // P5-3b: 访问阈值 gate（factFragment 对应的 '主体:维度' 被挡 → 不出现）
      if (imp.factFragment) {
        const dimKey = `${imp.factFragment.主体}:${imp.factFragment.维度}`;
        if (blockedDims.has(dimKey)) continue;
      }

      filtered.push({
        标签: imp.标签,
        极性: imp.极性,
        强度: imp.强度,
        ...(imp.来源类型 !== undefined ? { 来源类型: imp.来源类型 } : {}),
        ...(imp.factFragment !== undefined ? { factFragment: imp.factFragment } : {}),
      });
    }

    // 跳过无可见印象且非同场且 access=0 的目标（防噪·existence-opaque）
    if (filtered.length === 0 && !coLocated && access === 0) continue;

    baseline[targetKey] = { impressions: filtered, access, coLocated };
  }

  return { observerKey, baseline, observerDomain };
}

// ── P5-5: investigation delta helper ─────────────────────────────────────────

/**
 * 「调查/搜索」归约为 K5 delta：花预算强化认知档案中 了解度 字段。
 *
 * 返回调用方可传入 runProposalGate 的路径 delta 列表（走五道闸·进指纹）。
 * 此函数仅构造 delta；不执行五道闸·不写 state·不进指纹。
 * 与 projectCognition（只读·不进指纹）两轨严格分离。
 *
 * 下次调用 projectCognition 时，conductance 提升（了解度→baseStrength 升 → access 升）。
 */
export function buildInvestigationDelta(
  observerKey: string,
  targetKey: string,
  boostAmount: number,
  formulaConfig?: FormulaResolveConfig,
): Array<{ path: string; op: 'add'; value: number }> {
  const _boostMin = resolveFormula('investigation_boost_min', formulaConfig);
  const _boostMax = resolveFormula('investigation_boost_max', formulaConfig);
  const clamped = Math.min(_boostMax, Math.max(_boostMin, Math.round(boostAmount)));
  return [{
    path: `认知档案.${observerKey}.${targetKey}.了解度`,
    op: 'add' as const,
    value: clamped,
  }];
}

// ── P5-6: 重投影 diff ─────────────────────────────────────────────────────────

/**
 * 低 access → 高 access 重投影 diff（确定性浮现·同输入逐位恒等）。
 *
 * 返回：newlyVisible（高可见·低不可见）/ lostVisible（低可见·高不可见）/ unchanged（两者均有）。
 * 纯函数·不写 state·确定性。
 */
export function diffProjection(
  low: CognitionProjection,
  high: CognitionProjection,
): { newlyVisible: string[]; lostVisible: string[]; unchanged: string[] } {
  const lowKeys  = new Set(Object.keys(low.baseline));
  const highKeys = new Set(Object.keys(high.baseline));
  // 排序保证确定性（不用 localeCompare·用码点字典序）
  const sort = (arr: string[]) => arr.sort();
  return {
    newlyVisible: sort([...highKeys].filter(k => !lowKeys.has(k))),
    lostVisible:  sort([...lowKeys].filter(k => !highKeys.has(k))),
    unchanged:    sort([...lowKeys].filter(k => highKeys.has(k))),
  };
}

// ── 内部辅助 ──────────────────────────────────────────────────────────────────

/** 当前活跃世界域 ID（首个 封存状态=false 的域；无域时返回空串） */
function _activeDomainId(state: RootState): string {
  for (const [domainId, domain] of Object.entries(state.世界域)) {
    if (domain && !domain.封存状态) return domainId;
  }
  return '';
}
