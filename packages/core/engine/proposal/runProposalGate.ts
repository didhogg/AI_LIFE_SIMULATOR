// ⊕-2 runProposalGate — five-gate proposal pipeline orchestrator.
// Gate① Zod shape · Gate② whitelist+C6 · Gate③ M3 prefix ·
// Gate④ K5 merge+clamp+computeDelta · Gate⑤ atomic commit+log.
// Fail-closed: any gate failure returns { ok:false, state: structuredClone(original) }.

import { 指令信封Schema } from '../../schema/proposal.js';
import type { RootState } from '../../schema/index.js';
import { deriveModAwareWhitelist, type DerivedEntry } from '../../loader/modWhitelist.js';
import { computeLoadOrder } from '../../loader/modGraph.js';
import { getM3Violation } from '../../interfaces/patchInvariant.js';
import { isLegalCharTransition, isLegalItemTransition } from '../../interfaces/itemCharStateInvariant.js';
import { checkM2Violation } from '../../interfaces/authGate.js';
import { checkC6SeatScope } from '../../interfaces/seatScope.js';
import { mergeInterventionDeltas, type K5DeltaEntry } from '../../interfaces/interventionMerge.js';
import { validateExtensionEntry } from '../extensionParams.js';
import { clampLedger } from '../math/ledger.js';
import { computeDelta, setAtPath, ComputeDeltaError } from './computeDelta.js';

// ─── Public types ──────────────────────────────────────────────────────────────

export type ProposalGateResult =
  | { readonly ok: true; readonly state: RootState }
  | { readonly ok: false; readonly gate: string; readonly reason: string; readonly state: RootState };

// ─── Internal helpers ─────────────────────────────────────────────────────────

// Matches a concrete path (e.g. 'NPC.npc_wang.属性') against a wildcard pattern
// (e.g. 'NPC.{id}.属性') where {id} and {i} accept any non-empty segment.
function pathMatchesWildcard(concrete: string, pattern: string): boolean {
  const concSegs = concrete.split('.');
  const patSegs = pattern.split('.');
  if (concSegs.length !== patSegs.length) return false;
  for (let i = 0; i < concSegs.length; i++) {
    const p = patSegs[i] as string;
    if (p === '{id}' || p === '{i}') continue;
    if (p !== concSegs[i]) return false;
  }
  return true;
}

function isWhitelisted(path: string, whitelist: DerivedEntry[]): boolean {
  return whitelist.some(e => e.layer === 'writable' && pathMatchesWildcard(path, e.path));
}

// P9-3: NPC.{npc}.物品.{item}.扩展参数.{key} — 6段·位置4='扩展参数'
function isItemExtensionParamPath(path: string): boolean {
  const parts = path.split('.');
  return parts.length === 6 && parts[0] === 'NPC' && parts[4] === '扩展参数';
}

function readAtPath(obj: Record<string, unknown>, path: string): unknown {
  let cur: unknown = obj;
  for (const seg of path.split('.')) {
    if (cur === null || typeof cur !== 'object' || Array.isArray(cur)) return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

// ─── runProposalGate ──────────────────────────────────────────────────────────

/**
 * Five-gate proposal pipeline.
 * seatId and 授权源 are orchestrator-level parameters (not in proposal schema).
 * packs = K5 intervention constraint packs in deterministic load order.
 */
export function runProposalGate(
  rawEnvelope: unknown,
  state: RootState,
  seatId: string,
  授权源: string,
  packs?: ReadonlyArray<ReadonlyArray<K5DeltaEntry>>,
  extraWhitelistPaths?: readonly DerivedEntry[], // P9-3 additive: 运行期扩展参数路径
): ProposalGateResult {
  // Gate①: Zod shape validation.
  const parsed = 指令信封Schema.safeParse(rawEnvelope);
  if (!parsed.success) {
    return { ok: false, gate: '①-shape', reason: parsed.error.message, state };
  }
  const envelope = parsed.data;

  // Snapshot for atomic rollback (structuredClone: Node 24 built-in, no JSON.stringify).
  const snapshot = structuredClone(state) as RootState;

  // Gate③-M2: 覆写授权源 pre-check（proposal-level·fail-closed·zero state write）
  const m2 = checkM2Violation(授权源);
  if (m2.violation) {
    return { ok: false, gate: '③-M2', reason: m2.诊断, state: snapshot };
  }

  // K5 merge: combine packs into a single deterministic delta list.
  const merged = mergeInterventionDeltas(packs ?? []);

  // Whitelist derived once per run (static base E-e; P9-3 additive extension param paths).
  const whitelist: DerivedEntry[] = [
    ...deriveModAwareWhitelist(computeLoadOrder({}), {}),
    ...(extraWhitelistPaths ?? []),
  ];

  // Gate② + Gate③: validate all merged delta paths before any write (fail-fast).
  for (const delta of merged) {
    const { path, op, value } = delta;

    // Gate②-a: path must appear in the writable whitelist.
    if (!isWhitelisted(path, whitelist)) {
      return { ok: false, gate: '②-whitelist', reason: `路径「${path}」不在白名单`, state: snapshot };
    }

    // Gate②-a.1: P9-3 扩展参数声明缩减闸（defense-in-depth·FIX-2 后 Gate②-a 已覆盖主路径）
    // FIX-2 post-filter 已剔除静态通配符·只有 extraWhitelistPaths 具体路径可授权。
    // FIX-1 类型守门：set op 须与声明类型匹配（value 在前·完整 decl 传入·fail-closed）。
    if (
      extraWhitelistPaths &&
      extraWhitelistPaths.some(e => e.path.includes('扩展参数')) &&
      isItemExtensionParamPath(path)
    ) {
      const declaredEntry = extraWhitelistPaths.find(e => e.layer === 'writable' && e.path === path);
      if (!declaredEntry) {
        return { ok: false, gate: '②-whitelist', reason: `扩展参数键「${path}」未在变量模板中声明`, state: snapshot };
      }
      if (op === 'set' && declaredEntry.decl != null && !validateExtensionEntry(value, declaredEntry.decl)) {
        return { ok: false, gate: '②-whitelist', reason: '扩展参数值类型与模板声明不符', state: snapshot };
      }
    }

    // Gate②-b: C6 seat scope check — only for NPC.* top-level paths.
    const firstSeg = path.split('.')[0] ?? '';
    if (firstSeg === 'NPC') {
      const targetCharKey = path.split('.')[1] ?? '';
      const c6 = checkC6SeatScope(seatId, state._席位表, targetCharKey);
      if (!c6.eligible) {
        return { ok: false, gate: '②-C6', reason: c6.reason, state: snapshot };
      }
    }

    // Gate③: M3 structural invariant. For set ops, pass old/new values for forward-only comparison.
    // dead-defense: current M3_FORWARD_ONLY_PATHS entries are structurally blocked by Gate②
    // (their top-level keys don't exist or are read-only in RootSchema). This gate becomes
    // reachable if schema evolution adds a writable forward-only path; see whitelist guard test.
    const oldVal = op === 'set' ? readAtPath(state as unknown as Record<string, unknown>, path) : undefined;
    const newVal = op === 'set' ? (value as unknown) : undefined;
    const m3 = getM3Violation(path, op, oldVal, newVal);
    if (m3 !== null) {
      return { ok: false, gate: '③-M3', reason: m3, state: snapshot };
    }

    // Gate③-L15: 存活状态/物品状态 不可逆转移（L-15·fail-closed·同 M3 pattern）
    const lastPathSeg = path.split('.').pop() ?? '';
    if (op === 'set' && (lastPathSeg === '存活状态' || lastPathSeg === '物品状态')) {
      const oldStr = typeof oldVal === 'string' ? oldVal : undefined;
      const newStr = typeof value === 'string' ? value : '';
      if (lastPathSeg === '存活状态') {
        const hasRevivalFlag = envelope.转域续命授权 === true;
        if (!isLegalCharTransition(oldStr, newStr, { hasRevivalFlag })) {
          const hint = oldStr === '已故' && !hasRevivalFlag ? '（已故→在世 需转域续命授权）' : '';
          return {
            ok: false,
            gate: '③-L15',
            reason: `L-15: 存活状态非法转移「${String(oldStr)}」→「${newStr}」${hint}`,
            state: snapshot,
          };
        }
      }
      if (lastPathSeg === '物品状态') {
        if (!isLegalItemTransition(oldStr, newStr)) {
          return {
            ok: false,
            gate: '③-L15',
            reason: `L-15: 物品状态非法转移「${String(oldStr)}」→「${newStr}」`,
            state: snapshot,
          };
        }
      }
    }
  }

  // Gate④: apply merged deltas to a working copy.
  let working: Record<string, unknown> = structuredClone(state) as Record<string, unknown>;

  // Pre-pass: collect all locked paths before applying any content delta.
  // This ensures lock semantics hold regardless of (path, op) sort order.
  const lockedPaths = new Set<string>();
  for (const delta of merged) {
    if (delta.op === 'lock') lockedPaths.add(delta.path);
  }

  for (const delta of merged) {
    const { path, op, value, max_delta } = delta;

    if (op === 'lock') continue; // already registered above

    if (op === 'clamp') {
      // K5 clamp: fold into clampLedger with hardHi = ceiling.
      // lo = -Infinity (overdraft allowed; no hardcoded floor).
      // DSL string ceilings deferred to B6 DSL evaluator — skip as no-op.
      if (typeof value !== 'number') continue;
      const cur = readAtPath(working, path);
      if (typeof cur !== 'number') continue;
      const clamped = clampLedger(cur, -Infinity, Infinity, path, value);
      working = setAtPath(working, path, clamped.value);
      continue;
    }

    // set / add / sub: computeDelta (Gate③ defense-in-depth inside computeDelta).
    // exactOptionalPropertyTypes: conditionally include max_delta to avoid undefined property.
    const castOp = op as 'set' | 'add' | 'sub';
    const deltaEntry = max_delta !== undefined
      ? { path, op: castOp, value: value as unknown, max_delta }
      : { path, op: castOp, value: value as unknown };
    try {
      const result = computeDelta(working, deltaEntry, { lockedPaths });
      working = setAtPath(working, path, result.proposedValue);
    } catch (e) {
      return {
        ok: false,
        gate: '④-delta',
        reason: e instanceof ComputeDeltaError ? `[${e.code}] ${e.message}` : String(e),
        state: snapshot,
      };
    }
  }

  // Gate⑤: append audit log entry via setAtPath (system write — bypasses _-prefix guard).
  const worldClock = (state._状态机 as { 双时钟: { 世界钟: number } }).双时钟.世界钟;

  const logEntry: Record<string, unknown> = {
    时间: worldClock,
    授权源,
    级别: 'L1',
    目标: envelope.提案.目标引用,
    理由: '',
    是否作弊: false,
    ...(envelope.txn_id !== undefined ? { 提案单引用: envelope.txn_id } : {}),
  };

  const existing全局 = working['全局'] as Record<string, unknown> | undefined;
  const existingLog = (existing全局?.['_覆写日志'] as unknown[]) ?? [];
  working = setAtPath(working, '全局._覆写日志', [...existingLog, logEntry]);

  return { ok: true, state: working as RootState };
}
