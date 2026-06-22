// G1b3a · AOHP 调试控制台 · 核心批
//
// 功能 1-6（C1: 1-3, C2: 4-6）:
//   1. 菜单生成检视（过滤前后对比 + 被滤除原因码）
//   2. option_id 校验链逐步可视（FORMAT→MENU→KNOWLEDGE→GATE→TICK）
//   3. 执行前后 state diff（认知档案/涟漪/关系网 Phase6/资源）
//   4. 时间推进控制（单步/跳N拍/跳拍号/固定seed重放 + 时间日志）
//   5. LLM 双模 + 失败注入（demo↔llm切换·callNarrativeSafe兜底验证）
//   6. 场景 fixture 切换（3个调试世界·seeded可复现）
//
// 铁律:
//   - 全部代码落 web-debug 宿主层，不进指纹，core 宿主无关
//   - core 函数体零改动（runTick/AOHP校验/callRegistry/menuFilter 只调用）
//   - 手动注入/重放走既有 runTick / AOHP 校验路径，严禁旁路校验闸
//   - UI 层对 state 只读 + 经合法 API 驱动；不在 UI 层私写 core state
//   - 黄金向量/指纹84/schemaKeys52 全恒等；tsc/lint 新增 0；test 净增

import type { RootState } from '@ai-life-sim/core';
import { runTick } from '@ai-life-sim/core/engine/tick';
import { buildMenuOptionIds } from '@ai-life-sim/core/engine/aohp';
import type { MenuOptionWithId } from '@ai-life-sim/core/engine/aohp';

import { filterMenuCandidates } from '../slice/engine/menuFilter.js';
import type { MenuFilterCandidate, MenuFilterResult } from '../slice/engine/menuFilter.js';
import { runReconcileGate } from '../slice/engine/reconcileGate.js';
import type { TickProposal } from '../slice/ledger/proposalSchema.js';
import { callNarrativeSafe } from './llmAdapter.js';
import {
  buildWorld,
  PC, NPC_WANG, NPC_HONG,
  LOC_NAME, SECRET_S1, SAVE_SEED,
} from '../slice/fixture/world.js';
import { assemblePrompt } from '../slice/assemble.js';
import {
  applyPersonStyle,
  buildScriptedNarrative,
  PERSON_DEFAULT,
  STYLE_DEFAULT,
  type NarrativePerson,
  type NarrativeStyle,
} from './narrativeStyle.js';

export type { NarrativePerson, NarrativeStyle };

// ── 公共类型（导出供测试） ────────────────────────────────────────────────────────

export type StepName = '格式校验' | '菜单归属' | '知情过滤' | 'effect闸' | 'runTick';

export type ReasonCode =
  | 'BAD_FORMAT'
  | 'NOT_IN_MENU'
  | 'KNOWLEDGE_DENIED'
  | 'GATE_REJECTED'
  | 'GATE_SKIPPED'
  | 'TICK_ERROR';

export interface ValidationStep {
  stepName: StepName;
  pass: boolean;
  reasonCode?: ReasonCode;
  detail?: string;
}

export interface ValidationChainResult {
  optionId: string;
  steps: ValidationStep[];
  passed: boolean;
  rejectStep?: StepName;
  rejectCode?: ReasonCode;
}

export interface MenuInspectResult {
  rawCandidates: MenuFilterCandidate[];
  menuWithIds: MenuOptionWithId[];
  filterResult: MenuFilterResult;
  deniedReasons: Array<{
    optionId: string;
    reasonCode: 'KNOWLEDGE_DENIED';
    secretRef?: string;
  }>;
}

export interface ImpressChange {
  observer: string;
  target: string;
  tag: string;
  polarity: string;
  before?: number;
  after: number;
  isNew: boolean;
}

export interface RelHit {
  from: string;
  to: string;
  strength: number;
  trust: number;
  score: number;
  type: string;
}

export interface ResourceChange {
  entity: string;
  currency: string;
  before: number;
  after: number;
  delta: number;
}

export interface TickDiffResult {
  tickId: string;
  settledPhases: string[];
  cognitiveChanges: ImpressChange[];
  relationHits: RelHit[];
  resourceChanges: ResourceChange[];
  ripplesFired: number;
  afterState: RootState;
}

export type LlmMode = 'demo' | 'llm';

export interface ActionResult {
  narrative: string;
  isFallback: boolean;
  optionId: string;
  usedDefault: boolean;
}

export interface TimeEvent {
  tick: number;
  worldTime: string;
  event: string;
  settledPhases: string[];
}

/** Phase6 触发阈值（与 tick.ts REL_RIPPLE_THRESHOLD 同值·对外文档常量·不进指纹） */
export const PHASE6_THRESHOLD = 50;

// ── 功能 1: 菜单生成检视 ─────────────────────────────────────────────────────────

/**
 * 菜单生成检视 — 过滤前后对比，列出被 menuFilter 滤除的 option 及原因码。
 */
export function inspectMenu(
  state: RootState,
  pcKey: string,
  rawCandidates: MenuFilterCandidate[],
): MenuInspectResult {
  const menuWithIds = buildMenuOptionIds(rawCandidates) as Array<MenuOptionWithId & MenuFilterCandidate>;
  const filterResult = filterMenuCandidates(rawCandidates, state, pcKey);

  const deniedReasons = filterResult.denied.map(d => {
    const withId = menuWithIds.find(
      o => o.verb === d.verb && o.targetEntityId === d.targetEntityId,
    );
    return {
      optionId: withId?.option_id ?? `${d.verb}:${d.targetEntityId}`,
      reasonCode: 'KNOWLEDGE_DENIED' as const,
      ...(d.secretRef !== undefined ? { secretRef: d.secretRef } : {}),
    };
  });

  return { rawCandidates, menuWithIds, filterResult, deniedReasons };
}

// ── 功能 2: option_id 校验链逐步可视 ──────────────────────────────────────────────

/** 解析 option_id → { verb, targetEntityId, salientArgs }；格式不合法返回 null */
function parseOptionId(
  optionId: string,
): { verb: string; targetEntityId: string; salientArgs?: string } | null {
  if (!optionId || !optionId.includes(':')) return null;
  const withoutDisambig = optionId.split('#')[0]!;
  const parts = withoutDisambig.split(':');
  if (parts.length < 2) return null;
  const [verb, targetEntityId, ...rest] = parts;
  if (!verb || !targetEntityId) return null;
  return {
    verb,
    targetEntityId,
    ...(rest.length > 0 ? { salientArgs: rest.join(':') } : {}),
  };
}

/**
 * option_id 校验链逐步可视。
 *
 * 步骤:
 *   1. 格式校验  — option_id 有 verb:target[:args] 格式
 *   2. 菜单归属  — option_id 在当前菜单中（buildMenuOptionIds from rawCandidates）
 *   3. 知情过滤  — POV 实体被 filterMenuCandidates 许可（非 denied）
 *   4. effect 闸 — narrative + proposal 通过 reconcileGate（无则标 GATE_SKIPPED）
 *   5. runTick   — 执行引擎一拍（仅前四步全通才执行）
 *
 * 非法/越权 option_id 被正确拒绝且原因码可见；模型/手动只能回 option_id，无旁路。
 */
export function runValidationChain(
  optionId: string,
  state: RootState,
  pcKey: string,
  rawCandidates: MenuFilterCandidate[],
  narrative?: string,
  proposal?: TickProposal,
  tickId?: string,
): ValidationChainResult {
  const steps: ValidationStep[] = [];

  // Step 1: 格式校验
  const parsed = parseOptionId(optionId);
  if (!parsed) {
    steps.push({
      stepName: '格式校验',
      pass: false,
      reasonCode: 'BAD_FORMAT',
      detail: `option_id='${optionId}' 不含冒号分隔符（需 verb:target[:args] 格式）`,
    });
    return { optionId, steps, passed: false, rejectStep: '格式校验', rejectCode: 'BAD_FORMAT' };
  }
  steps.push({
    stepName: '格式校验',
    pass: true,
    detail: `verb='${parsed.verb}' target='${parsed.targetEntityId}'${parsed.salientArgs ? ` args='${parsed.salientArgs}'` : ''}`,
  });

  // Step 2: 菜单归属
  const menuWithIds = buildMenuOptionIds(rawCandidates);
  const inMenu = menuWithIds.some(o => o.option_id === optionId);
  if (!inMenu) {
    steps.push({
      stepName: '菜单归属',
      pass: false,
      reasonCode: 'NOT_IN_MENU',
      detail: `option_id='${optionId}' 不在当前 ${menuWithIds.length} 项菜单中`,
    });
    return { optionId, steps, passed: false, rejectStep: '菜单归属', rejectCode: 'NOT_IN_MENU' };
  }
  steps.push({
    stepName: '菜单归属',
    pass: true,
    detail: `存在于 ${menuWithIds.length} 项菜单中`,
  });

  // Step 3: 知情过滤（filterMenuCandidates）
  const filterResult = filterMenuCandidates(rawCandidates, state, pcKey);
  const candidate = rawCandidates.find(c => {
    const ids = buildMenuOptionIds([c]);
    return ids.some(o => o.option_id === optionId);
  });
  const isDenied = candidate
    ? filterResult.denied.some(
        d => d.verb === candidate.verb && d.targetEntityId === candidate.targetEntityId,
      )
    : false;
  if (isDenied) {
    steps.push({
      stepName: '知情过滤',
      pass: false,
      reasonCode: 'KNOWLEDGE_DENIED',
      detail: `POV='${pcKey}' 不满足 secretRef='${candidate?.secretRef ?? '?'}'`,
    });
    return { optionId, steps, passed: false, rejectStep: '知情过滤', rejectCode: 'KNOWLEDGE_DENIED' };
  }
  steps.push({
    stepName: '知情过滤',
    pass: true,
    detail: `POV='${pcKey}' 通过知情校验`,
  });

  // Step 4: effect 闸（有 narrative + proposal 才校验）
  if (!narrative || !proposal) {
    steps.push({
      stepName: 'effect闸',
      pass: true,
      reasonCode: 'GATE_SKIPPED',
      detail: '无 narrative/proposal·跳过 gate 校验',
    });
  } else {
    const gateResult = runReconcileGate(narrative, proposal);
    const gatePass = gateResult.status === 'covered' || gateResult.status === 'retried_covered';
    if (!gatePass) {
      steps.push({
        stepName: 'effect闸',
        pass: false,
        reasonCode: 'GATE_REJECTED',
        detail: `status='${gateResult.status}'  rollHint='${gateResult.rollHint?.ui提示 ?? '无'}'`,
      });
      return { optionId, steps, passed: false, rejectStep: 'effect闸', rejectCode: 'GATE_REJECTED' };
    }
    steps.push({
      stepName: 'effect闸',
      pass: true,
      detail: `status='${gateResult.status}'`,
    });
  }

  // Step 5: runTick（仅在前四步全通时执行）
  const tid = tickId ?? `debug:chain:${SAVE_SEED}:${state._tick?.拍计数 ?? 0}`;
  try {
    runTick(structuredClone(state) as RootState, { tickId: tid });
    steps.push({
      stepName: 'runTick',
      pass: true,
      detail: `tickId='${tid}' 执行成功`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    steps.push({
      stepName: 'runTick',
      pass: false,
      reasonCode: 'TICK_ERROR',
      detail: msg.slice(0, 120),
    });
    return { optionId, steps, passed: false, rejectStep: 'runTick', rejectCode: 'TICK_ERROR' };
  }

  return { optionId, steps, passed: true };
}

// ── 功能 3: 执行前后 state diff + 涟漪/关系网命中 ──────────────────────────────────

/**
 * 执行一拍并返回 diff（认知档案变更/关系网命中/资源变更）。
 *
 * 关系网命中 = pre-tick state 中 |强度|×(信任/100) ≥ PHASE6_THRESHOLD 的边
 *   （即 Phase6「关系触发」阶段会发射涟漪候选的边）。
 * 认知档案变更 = 新增或强度增加的印象条目（涟漪传播 Phase8 写回的可见结果）。
 */
export function runTickWithDiff(state: RootState, tickId: string): TickDiffResult {
  const before = structuredClone(state) as RootState;
  const result = runTick(structuredClone(state) as RootState, { tickId });
  const after = result.state;

  // 认知档案 diff（新增 + 强度增加）
  const cognitiveChanges: ImpressChange[] = [];
  const afterArchive = after.认知档案 ?? {};
  const beforeArchive = before.认知档案 ?? {};
  for (const [observer, targetMap] of Object.entries(afterArchive)) {
    for (const [target, entry] of Object.entries(targetMap)) {
      const beforeEntry = beforeArchive[observer]?.[target];
      for (const imp of entry.印象) {
        const beforeImp = beforeEntry?.印象.find(
          bi => bi.标签 === imp.标签 && bi.极性 === imp.极性,
        );
        if (!beforeImp) {
          cognitiveChanges.push({
            observer, target,
            tag: imp.标签, polarity: imp.极性,
            after: imp.强度, isNew: true,
          });
        } else if (imp.强度 > beforeImp.强度) {
          cognitiveChanges.push({
            observer, target,
            tag: imp.标签, polarity: imp.极性,
            before: beforeImp.强度, after: imp.强度, isNew: false,
          });
        }
      }
    }
  }

  // 关系网 Phase6 触发候选（pre-tick 状态 score ≥ PHASE6_THRESHOLD）
  const relationHits: RelHit[] = [];
  for (const [npcKey, npc] of Object.entries(before.NPC)) {
    for (const rel of npc.关系) {
      const score = Math.abs(rel.强度) * (rel.信任 / 100);
      if (score >= PHASE6_THRESHOLD) {
        relationHits.push({
          from: npcKey, to: rel.对象键,
          strength: rel.强度, trust: rel.信任,
          score, type: rel.类型,
        });
      }
    }
  }

  // 资源变更（货币账户 before/after）
  const resourceChanges: ResourceChange[] = [];
  const beforeAccts = before.货币系统?.账户 ?? {};
  const afterAccts = after.货币系统?.账户 ?? {};
  const allEntities = new Set([...Object.keys(beforeAccts), ...Object.keys(afterAccts)]);
  for (const entity of allEntities) {
    const bHeld = beforeAccts[entity]?.持有 ?? {};
    const aHeld = afterAccts[entity]?.持有 ?? {};
    const currencies = new Set([...Object.keys(bHeld), ...Object.keys(aHeld)]);
    for (const ccy of currencies) {
      const b = bHeld[ccy] ?? 0;
      const a = aHeld[ccy] ?? 0;
      if (a !== b) {
        resourceChanges.push({ entity, currency: ccy, before: b, after: a, delta: a - b });
      }
    }
  }

  return {
    tickId,
    settledPhases: result.settledPhases,
    cognitiveChanges,
    relationHits,
    resourceChanges,
    ripplesFired: cognitiveChanges.length,
    afterState: after,
  };
}

// ── 功能 4: 时间推进控制 ─────────────────────────────────────────────────────────

/**
 * 时间推进控制器 — 单步/跳N拍/跳拍号/固定seed重放 + 时间日志。
 *
 * 确定性保证：tickId = `debug:${seed}:tick:${t}` 其中 t 为拍号。
 *   同 seed + 同 baseTick → 恒等序列（固定seed重放逐位恒等）。
 * 物理隔离：不调用 Date.now / Math.random；状态走 structuredClone 深拷。
 */
export class TimeController {
  private readonly seed: number;
  private readonly baseState: RootState;
  private currentState: RootState;
  private _tickCount: number;
  private readonly _eventLog: TimeEvent[];

  private static readonly DAYS_PER_TICK = 30; // 43200 min span / 1440 min/day

  constructor(seed: number, state: RootState) {
    this.seed = seed;
    this.baseState = structuredClone(state) as RootState;
    this.currentState = structuredClone(state) as RootState;
    this._tickCount = state._tick?.拍计数 ?? 0;
    this._eventLog = [];
  }

  getTickCount(): number { return this._tickCount; }

  getCurrentState(): RootState { return structuredClone(this.currentState) as RootState; }

  getEventLog(): TimeEvent[] { return [...this._eventLog]; }

  /** 拍号 → 世界时间字符串（可用于显示） */
  worldTimeAt(tick: number): string {
    const day = tick * TimeController.DAYS_PER_TICK;
    return `纪元第${day}日（第${tick + 1}拍）`;
  }

  /** 单步/跳 N 拍，返回每拍 diff */
  step(n: number = 1): TickDiffResult[] {
    const diffs: TickDiffResult[] = [];
    for (let i = 0; i < n; i++) {
      const tickId = `debug:${this.seed}:tick:${this._tickCount}`;
      const diff = runTickWithDiff(this.currentState, tickId);
      this.currentState = diff.afterState;
      this._tickCount = this.currentState._tick?.拍计数 ?? this._tickCount + 1;
      this._eventLog.push({
        tick: this._tickCount,
        worldTime: this.worldTimeAt(this._tickCount),
        event: `runTick tickId=${tickId}`,
        settledPhases: diff.settledPhases,
      });
      diffs.push(diff);
    }
    return diffs;
  }

  /**
   * 跳转到指定拍号（从基态确定性重放到 targetTick）。
   * @param targetTick 目标拍号
   */
  jumpTo(targetTick: number): RootState {
    let st = structuredClone(this.baseState) as RootState;
    const baseTick = this.baseState._tick?.拍计数 ?? 0;
    for (let t = baseTick; t < targetTick; t++) {
      const tickId = `debug:${this.seed}:tick:${t}`;
      st = runTick(structuredClone(st) as RootState, { tickId }).state;
    }
    this.currentState = structuredClone(st) as RootState;
    this._tickCount = targetTick;
    return structuredClone(st) as RootState;
  }

  /** 固定 seed 重放 — 重置到基态 */
  replay(): RootState {
    this.currentState = structuredClone(this.baseState) as RootState;
    this._tickCount = this.baseState._tick?.拍计数 ?? 0;
    return structuredClone(this.currentState) as RootState;
  }
}

// ── 功能 5: LLM 双模 + 失败注入 ─────────────────────────────────────────────────

/**
 * LLM 双模执行 — demo(脚本化)↔llm(真实LLM) + 失败注入验证。
 *
 * LLM 失败时走默认 option（permitted 第一项）不崩；callNarrativeSafe 兜底保证。
 * 确定性：demo 模式不调用 LLM；forceFailure 不调用 LLM（均确定性）。
 */
export async function runActionInDualMode(
  state: RootState,
  pcKey: string,
  optionId: string,
  rawCandidates: MenuFilterCandidate[],
  mode: LlmMode = 'demo',
  opts: {
    forceFailure?: boolean;
    scriptedNarrative?: string;
    locName?: string;
    narrativePerson?: NarrativePerson;
    narrativeStyle?: NarrativeStyle;
  } = {},
): Promise<ActionResult> {
  const filterResult = filterMenuCandidates(rawCandidates, state, pcKey);
  const permittedIds = new Set(
    filterResult.permitted.flatMap(p => buildMenuOptionIds([p]).map(o => o.option_id)),
  );

  // 兜底 option：permitted 第一项（LLM 失败时使用）
  const defaultOptionId = filterResult.permitted.length > 0
    ? (buildMenuOptionIds([filterResult.permitted[0]!])[0]?.option_id ?? optionId)
    : optionId;

  const person = opts.narrativePerson ?? PERSON_DEFAULT;
  const style  = opts.narrativeStyle  ?? STYLE_DEFAULT;

  // demo 模式 or 强制失败注入 → 走脚本叙事，不调用 LLM
  if (mode === 'demo' || opts.forceFailure) {
    const pcName   = (state.NPC?.[pcKey] as { 姓名?: string } | undefined)?.姓名 ?? pcKey;
    const narrative = opts.scriptedNarrative
      ?? buildScriptedNarrative(person, style, pcName, defaultOptionId);
    const usedDefault = !permittedIds.has(optionId) || !!opts.forceFailure;
    return {
      narrative,
      isFallback: !!opts.forceFailure,
      optionId: usedDefault ? defaultOptionId : optionId,
      usedDefault,
    };
  }

  // LLM 模式 → 真实调用 callNarrativeSafe（注入人称 + 文风指令）
  const locName = opts.locName ?? LOC_NAME;
  const { systemPrompt: rawSystemPrompt, userPrompt } = assemblePrompt(state, {
    pcKey,
    locName,
    povEntityKey: pcKey,
  });
  const systemPrompt = applyPersonStyle(rawSystemPrompt, person, style);
  const llmResult = await callNarrativeSafe({ systemPrompt, userPrompt });

  if (llmResult.isFallback) {
    // LLM 失败 → 走默认 option，不崩
    return {
      narrative: llmResult.text,
      isFallback: true,
      optionId: defaultOptionId,
      usedDefault: true,
    };
  }

  return {
    narrative: llmResult.text,
    isFallback: false,
    optionId: permittedIds.has(optionId) ? optionId : defaultOptionId,
    usedDefault: !permittedIds.has(optionId),
  };
}

// ── 功能 6: 场景 fixture 元数据 ───────────────────────────────────────────────────

export const DEBUG_FIXTURE_LABEL = '【调试 fixture · 非真预设】';

export type FixtureName = '小城' | '大陆' | '整世界';

export interface DebugFixture {
  name: FixtureName;
  label: string;
  seed: number;
  npcCount: number;
  locationCount: number;
  buildState: () => RootState;
}

// ── Demo 候选集（基础 fixture 使用） ──────────────────────────────────────────────

export const DEMO_RAW_CANDIDATES: MenuFilterCandidate[] = [
  { verb: '对话', targetEntityId: NPC_WANG, displayText: '与王掌柜对话' },
  { verb: '给钱', targetEntityId: NPC_HONG, salientArgs: '5文', displayText: '给红姨5文钱' },
  { verb: '还账', targetEntityId: NPC_WANG, salientArgs: '8文', displayText: '还王掌柜八文钱' },
  // 需要 S1 知情 → PC 无知情 → filterMenuCandidates denied
  { verb: '询问', targetEntityId: NPC_WANG, displayText: '询问掌柜藏的人（需知S1）', secretRef: SECRET_S1 },
];

// ── 控制台输出工具 ─────────────────────────────────────────────────────────────

function hr(title: string): void {
  console.log(`\n${'─'.repeat(62)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(62));
}

function printMenuInspect(r: MenuInspectResult): void {
  hr('菜单生成检视（功能 1）');
  console.log(`  原始候选: ${r.rawCandidates.length} 项  →  同义归一后 option_id: ${r.menuWithIds.length} 项`);
  console.log('\n  过滤前完整列表:');
  for (const o of r.menuWithIds) {
    console.log(`    [${o.option_id}]  ←  ${o.displayText ?? ''}`);
  }
  console.log(`\n  过滤后 (permitted=${r.filterResult.permitted.length} / denied=${r.filterResult.denied.length}):`);
  for (const p of r.filterResult.permitted) {
    console.log(`    ✅ permitted: ${p.displayText ?? p.verb}`);
  }
  for (const d of r.filterResult.denied) {
    const dr = r.deniedReasons.find(x => x.secretRef === d.secretRef);
    console.log(`    ❌ denied:    ${d.displayText ?? d.verb}  [${dr?.reasonCode ?? 'KNOWLEDGE_DENIED'}  secretRef=${d.secretRef}]`);
  }
  if (r.filterResult.rollHint) {
    console.log(`\n  rollHint: ${r.filterResult.rollHint.ui提示}`);
  }
}

function printChain(r: ValidationChainResult): void {
  console.log(`\n  [${r.optionId}] 校验链:`);
  for (const s of r.steps) {
    const icon = s.pass ? '✅' : '❌';
    const code = s.reasonCode ? `  [${s.reasonCode}]` : '';
    const det  = s.detail ? `  · ${s.detail}` : '';
    console.log(`    ${icon} ${s.stepName}${code}${det}`);
  }
  console.log(r.passed
    ? '    → ✅ 全链通过'
    : `    → ❌ 拒绝于「${r.rejectStep}」 原因码: ${r.rejectCode}`);
}

function printDiff(d: TickDiffResult): void {
  hr('执行前后 state diff（功能 3）');
  console.log(`  tickId: ${d.tickId}`);
  console.log(`  settledPhases: ${d.settledPhases.join(' → ')}`);
  console.log(`\n  认知档案变更（${d.cognitiveChanges.length} 项）:`);
  if (d.cognitiveChanges.length === 0) {
    console.log('    （无变更）');
  } else {
    for (const c of d.cognitiveChanges) {
      const bef = c.before !== undefined ? `${c.before}→` : '新增→';
      console.log(`    ${c.observer}→${c.target}  [${c.tag}/${c.polarity}]  强度: ${bef}${c.after}${c.isNew ? ' ★新' : ''}`);
    }
  }
  console.log(`\n  关系网 Phase6 触发候选（score≥${PHASE6_THRESHOLD}, ${d.relationHits.length} 条）:`);
  if (d.relationHits.length === 0) {
    console.log('    （无边达到 Phase6 阈值·共址边 max=40 < 50）');
  } else {
    for (const r of d.relationHits) {
      console.log(`    ★ ${r.from} ─[${r.type} 强度=${r.strength}×信任${r.trust}/100=score${r.score.toFixed(1)}]→ ${r.to}`);
    }
  }
  console.log(`\n  资源变更（${d.resourceChanges.length} 项）:`);
  if (d.resourceChanges.length === 0) {
    console.log('    （无变更）');
  } else {
    for (const r of d.resourceChanges) {
      const sign = r.delta > 0 ? '+' : '';
      console.log(`    ${r.entity}  ${r.currency}: ${r.before} → ${r.after}  (${sign}${r.delta})`);
    }
  }
}

// ── 主函数 ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   G1b3a · AOHP 调试控制台 · 核心批                          ║');
  console.log('║   AOHP 回路：菜单检视·校验链·state diff·时间推进·LLM 双模   ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  const state = buildWorld();

  // ── 功能 1: 菜单生成检视 ─────────────────────────────────────────────────────
  const menuInspect = inspectMenu(state, PC, DEMO_RAW_CANDIDATES);
  printMenuInspect(menuInspect);

  // ── 功能 2: option_id 校验链 ─────────────────────────────────────────────────
  hr('option_id 校验链逐步可视（功能 2）');

  // 2a: 合法 option_id（无 gate 校验·GATE_SKIPPED）
  printChain(runValidationChain('对话:npc_wang', state, PC, DEMO_RAW_CANDIDATES));

  // 2b: 格式错误（BAD_FORMAT）
  printChain(runValidationChain('malformed_no_colon', state, PC, DEMO_RAW_CANDIDATES));

  // 2c: 非法 option_id — 不在菜单（NOT_IN_MENU）
  printChain(runValidationChain('飞行:npc_wang', state, PC, DEMO_RAW_CANDIDATES));

  // 2d: 越权 option_id — 需知情 S1 → PC 被拒（KNOWLEDGE_DENIED）
  printChain(runValidationChain('询问:npc_wang', state, PC, DEMO_RAW_CANDIDATES));

  // 2e: 合法 + effect 闸通过（给钱叙事 + 匹配 proposal）
  printChain(runValidationChain(
    '给钱:npc_hong:5文',
    state, PC, DEMO_RAW_CANDIDATES,
    '林九取出五文钱递给红姨，换来一碗热茶。',
    { transfers: [{ from: PC, to: NPC_HONG, amount: 5, reason: '给钱' }], checks: [], knowledge: [] },
  ));

  // 2f: 合法 + effect 闸拒绝（赊账语义 → hard_rejected）
  printChain(runValidationChain(
    '还账:npc_wang:8文',
    state, PC, DEMO_RAW_CANDIDATES,
    '林九赊账了八文钱的酒菜。',
    { transfers: [{ from: PC, to: NPC_WANG, amount: 8, reason: '赊账' }], checks: [], knowledge: [] },
  ));

  // ── 功能 3: state diff + 涟漪/关系命中 ───────────────────────────────────────
  const diff = runTickWithDiff(state, `debug:${SAVE_SEED}:tick:0`);
  printDiff(diff);

  // ── 功能 4: 时间推进控制 ─────────────────────────────────────────────────────
  hr('时间推进控制（功能 4）');
  const tc = new TimeController(SAVE_SEED, state);

  console.log(`  初始: 拍号=${tc.getTickCount()} 时间=${tc.worldTimeAt(tc.getTickCount())}`);
  tc.step(1);
  console.log(`  单步后: 拍号=${tc.getTickCount()} 时间=${tc.worldTimeAt(tc.getTickCount())}`);
  tc.step(2);
  console.log(`  再跳2拍: 拍号=${tc.getTickCount()} 时间=${tc.worldTimeAt(tc.getTickCount())}`);

  // jumpTo 重放
  const stateAt2 = tc.jumpTo(2);
  tc.replay();
  const stateAt2b = tc.jumpTo(2);
  const replayOk = JSON.stringify(stateAt2) === JSON.stringify(stateAt2b);
  console.log(`  jumpTo(2) 固定seed重放逐位恒等: ${replayOk ? '✅' : '❌'}`);

  console.log(`\n  时间日志 (${tc.getEventLog().length} 条):`);
  for (const e of tc.getEventLog()) {
    console.log(`    拍${e.tick} [${e.worldTime}] ${e.event}`);
  }

  // ── 功能 5: LLM 双模 + 失败注入 ────────────────────────────────────────────
  hr('LLM 双模 + 失败注入（功能 5）');

  const demoRes = await runActionInDualMode(
    state, PC, '对话:npc_wang', DEMO_RAW_CANDIDATES, 'demo',
  );
  console.log(`  [demo] option='${demoRes.optionId}' isFallback=${demoRes.isFallback}`);
  console.log(`    ${demoRes.narrative}`);

  const failRes = await runActionInDualMode(
    state, PC, '对话:npc_wang', DEMO_RAW_CANDIDATES, 'demo', { forceFailure: true },
  );
  console.log(`\n  [失败注入] option='${failRes.optionId}' isFallback=${failRes.isFallback} usedDefault=${failRes.usedDefault}`);
  console.log(`    兜底叙事: ${failRes.narrative.slice(0, 60)}`);

  const llmRes = await runActionInDualMode(
    state, PC, '对话:npc_wang', DEMO_RAW_CANDIDATES, 'llm',
  );
  console.log(`\n  [LLM] option='${llmRes.optionId}' isFallback=${llmRes.isFallback}`);
  if (llmRes.isFallback) {
    console.log(`    → LLM 不可用·已降级·走默认 option: ${llmRes.optionId}`);
  } else {
    console.log(`    叙事: ${llmRes.narrative.slice(0, 80)}`);
  }

  // ── 功能 6: 场景 fixture（C2 importFixture 实现·此处骨架） ──────────────────
  hr(`场景 fixture 切换（功能 6） ${DEBUG_FIXTURE_LABEL}`);
  console.log('  import debugFixtures.ts → buildDebugFixtureSmall/Medium/Large');
  console.log(`  当前使用: 基础 fixture（slice/fixture/world.js · seed=${SAVE_SEED}）`);

  console.log(`\n${'═'.repeat(62)}`);
  console.log('  G1b3a 调试控制台完成');
  console.log(`  AOHP 回路 ✅  校验链拒绝/原因码 ✅  state diff ✅`);
  console.log(`  时间推进/固定seed重放 ✅  LLM 双模/失败注入 ✅`);
  console.log('═'.repeat(62));
}

// 仅在 Node.js 直接执行时运行（浏览器导入时 window 存在 → 跳过）
if (typeof window === 'undefined') {
  main().catch(e => {
    console.error('[aohpDebugConsole] 未捕获异常:', e);
    process.exit(1);
  });
}
