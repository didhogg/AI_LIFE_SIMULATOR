// ⊕-2 runProposalGate — five-gate proposal pipeline orchestrator.
// Gate① Zod shape · Gate② whitelist+C6 · Gate③ M3 prefix ·
// Gate④ K5 merge+clamp+computeDelta · Gate⑤ atomic commit+log.
// Fail-closed: any gate failure returns { ok:false, state: structuredClone(original) }.
import { 指令信封Schema } from '../../schema/proposal.js';
import { deriveModAwareWhitelist } from '../../loader/modWhitelist.js';
import { computeLoadOrder } from '../../loader/modGraph.js';
import { getM3Violation } from '../../interfaces/patchInvariant.js';
import { checkC6SeatScope } from '../../interfaces/seatScope.js';
import { mergeInterventionDeltas } from '../../interfaces/interventionMerge.js';
import { clampLedger } from '../math/ledger.js';
import { computeDelta, setAtPath, ComputeDeltaError } from './computeDelta.js';
// ─── Internal helpers ─────────────────────────────────────────────────────────
// Matches a concrete path (e.g. 'NPC.npc_wang.属性') against a wildcard pattern
// (e.g. 'NPC.{id}.属性') where {id} and {i} accept any non-empty segment.
function pathMatchesWildcard(concrete, pattern) {
    const concSegs = concrete.split('.');
    const patSegs = pattern.split('.');
    if (concSegs.length !== patSegs.length)
        return false;
    for (let i = 0; i < concSegs.length; i++) {
        const p = patSegs[i];
        if (p === '{id}' || p === '{i}')
            continue;
        if (p !== concSegs[i])
            return false;
    }
    return true;
}
function isWhitelisted(path, whitelist) {
    return whitelist.some(e => e.layer === 'writable' && pathMatchesWildcard(path, e.path));
}
function readAtPath(obj, path) {
    let cur = obj;
    for (const seg of path.split('.')) {
        if (cur === null || typeof cur !== 'object' || Array.isArray(cur))
            return undefined;
        cur = cur[seg];
    }
    return cur;
}
// ─── runProposalGate ──────────────────────────────────────────────────────────
/**
 * Five-gate proposal pipeline.
 * seatId and 授权源 are orchestrator-level parameters (not in proposal schema).
 * packs = K5 intervention constraint packs in deterministic load order.
 */
export function runProposalGate(rawEnvelope, state, seatId, 授权源, packs) {
    // Gate①: Zod shape validation.
    const parsed = 指令信封Schema.safeParse(rawEnvelope);
    if (!parsed.success) {
        return { ok: false, gate: '①-shape', reason: parsed.error.message, state };
    }
    const envelope = parsed.data;
    // Snapshot for atomic rollback (structuredClone: Node 24 built-in, no JSON.stringify).
    const snapshot = structuredClone(state);
    // K5 merge: combine packs into a single deterministic delta list.
    const merged = mergeInterventionDeltas(packs ?? []);
    // Whitelist derived once per run (E-e static for now; DSL/mod paths via loader).
    const whitelist = deriveModAwareWhitelist(computeLoadOrder({}), {});
    // Gate② + Gate③: validate all merged delta paths before any write (fail-fast).
    for (const delta of merged) {
        const { path, op } = delta;
        // Gate②-a: path must appear in the writable whitelist.
        if (!isWhitelisted(path, whitelist)) {
            return { ok: false, gate: '②-whitelist', reason: `路径「${path}」不在白名单`, state: snapshot };
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
        // Gate③: M3 structural invariant (hard-exclude prefixes + forward-only violation).
        const m3 = getM3Violation(path, op);
        if (m3 !== null) {
            return { ok: false, gate: '③-M3', reason: m3, state: snapshot };
        }
    }
    // Gate④: apply merged deltas to a working copy.
    let working = structuredClone(state);
    // Pre-pass: collect all locked paths before applying any content delta.
    // This ensures lock semantics hold regardless of (path, op) sort order.
    const lockedPaths = new Set();
    for (const delta of merged) {
        if (delta.op === 'lock')
            lockedPaths.add(delta.path);
    }
    for (const delta of merged) {
        const { path, op, value, max_delta } = delta;
        if (op === 'lock')
            continue; // already registered above
        if (op === 'clamp') {
            // K5 clamp: fold into clampLedger with hardHi = ceiling.
            // lo = -Infinity (overdraft allowed; no hardcoded floor).
            // DSL string ceilings deferred to B6 DSL evaluator — skip as no-op.
            if (typeof value !== 'number')
                continue;
            const cur = readAtPath(working, path);
            if (typeof cur !== 'number')
                continue;
            const clamped = clampLedger(cur, -Infinity, Infinity, path, value);
            working = setAtPath(working, path, clamped.value);
            continue;
        }
        // set / add / sub: computeDelta (Gate③ defense-in-depth inside computeDelta).
        // exactOptionalPropertyTypes: conditionally include max_delta to avoid undefined property.
        const castOp = op;
        const deltaEntry = max_delta !== undefined
            ? { path, op: castOp, value: value, max_delta }
            : { path, op: castOp, value: value };
        try {
            const result = computeDelta(working, deltaEntry, { lockedPaths });
            working = setAtPath(working, path, result.proposedValue);
        }
        catch (e) {
            return {
                ok: false,
                gate: '④-delta',
                reason: e instanceof ComputeDeltaError ? `[${e.code}] ${e.message}` : String(e),
                state: snapshot,
            };
        }
    }
    // Gate⑤: append audit log entry via setAtPath (system write — bypasses _-prefix guard).
    const worldClock = state._状态机.双时钟.世界钟;
    const logEntry = {
        时间: worldClock,
        授权源,
        级别: 'L1',
        目标: envelope.提案.目标引用,
        理由: '',
        是否作弊: false,
        ...(envelope.txn_id !== undefined ? { 提案单引用: envelope.txn_id } : {}),
    };
    const existing全局 = working['全局'];
    const existingLog = existing全局?.['_覆写日志'] ?? [];
    working = setAtPath(working, '全局._覆写日志', [...existingLog, logEntry]);
    return { ok: true, state: working };
}
