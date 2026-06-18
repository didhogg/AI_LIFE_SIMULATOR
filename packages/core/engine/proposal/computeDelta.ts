// ⊕-1 computeDelta — pure compute-only (no state writes, no clampLedger).
// Validates path segments (AA4 + _/$ prefix guard), checks value types,
// applies op and optional max_delta cap, returns { path, proposedValue }.
// clampLedger is the ⊕-2 orchestrator's responsibility (single-write, field-policy).

import { 是JS保留键 } from '../../schema/governedKeySpace.js';

// Identical to governedKeySpace.ts:51 路径段命名正则 (not exported from that module;
// this is a faithful copy — not an independent implementation).
const 路径段命名正则 = /^[\p{L}\p{N}_]+$/u;

// ─── Public types ──────────────────────────────────────────────────────────────

export type DeltaOp = 'set' | 'add' | 'sub' | 'lock';

export interface DeltaEntry {
  readonly path: string;
  readonly op: DeltaOp;
  readonly value?: unknown;
  readonly max_delta?: number;
}

export interface ComputeResult {
  readonly path: string;
  readonly proposedValue: unknown;
}

export interface ComputeDeltaOptions {
  readonly lockedPaths?: ReadonlySet<string>;
}

// ─── Error ────────────────────────────────────────────────────────────────────

export type ComputeDeltaErrorCode =
  | 'lock-violation'
  | 'path-not-found'
  | 'type-mismatch'
  | 'non-integer-value'
  | 'invalid-path-segment'
  | 'reserved-key-segment'
  | 'forbidden-prefix';

export class ComputeDeltaError extends Error {
  constructor(
    public readonly code: ComputeDeltaErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ComputeDeltaError';
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function validatePath(path: string): void {
  if (path === '') {
    throw new ComputeDeltaError('invalid-path-segment', '路径为空');
  }
  for (const seg of path.split('.')) {
    if (seg === '') {
      throw new ComputeDeltaError(
        'invalid-path-segment',
        `路径含空段（连续点号或首尾点号）: 「${path}」`,
      );
    }
    if (是JS保留键(seg)) {
      throw new ComputeDeltaError('reserved-key-segment', `路径段命中 JS 保留键「${seg}」`);
    }
    if (!路径段命名正则.test(seg)) {
      throw new ComputeDeltaError(
        'invalid-path-segment',
        `路径段「${seg}」不符合命名正则（允许 \\p{L}\\p{N}_）`,
      );
    }
    // Gate③ defense-in-depth: _/$ prefixed segments are B5.6 read-only derived fields.
    if (seg.startsWith('_') || seg.startsWith('$')) {
      throw new ComputeDeltaError(
        'forbidden-prefix',
        `路径段「${seg}」以 _ 或 $ 开头·只读派生字段禁写`,
      );
    }
  }
}

function getAtPath(
  state: Record<string, unknown>,
  path: string,
): { found: true; value: unknown } | { found: false } {
  let cur: unknown = state;
  for (const seg of path.split('.')) {
    if (cur === null || typeof cur !== 'object' || Array.isArray(cur)) {
      return { found: false };
    }
    const obj = cur as Record<string, unknown>;
    if (!Object.prototype.hasOwnProperty.call(obj, seg)) {
      return { found: false };
    }
    cur = obj[seg];
  }
  return { found: true, value: cur };
}

function typesMatch(a: unknown, b: unknown): boolean {
  if (a === null || b === null) return a === null && b === null;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  return typeof a === typeof b;
}

// ─── computeDelta ─────────────────────────────────────────────────────────────

/**
 * Pure compute-only: reads the current value at `path` in `state`, applies `entry.op`
 * with optional `max_delta` magnitude cap, and returns `{ path, proposedValue }`.
 * Never writes to `state`. Never calls clampLedger.
 */
export function computeDelta(
  state: Record<string, unknown>,
  entry: DeltaEntry,
  opts?: ComputeDeltaOptions,
): ComputeResult {
  const { path, op, value, max_delta } = entry;

  // 1. Path segment validation: AA4 reserved-key rejection + naming regex + _/$ prefix.
  validatePath(path);

  // 2. Lock check: any write op on a locked path is refused.
  if (opts?.lockedPaths?.has(path) && op !== 'lock') {
    throw new ComputeDeltaError('lock-violation', `路径「${path}」已被 lock·op=${op} 被拒`);
  }

  // 3. 'lock' is a marker op; proposedValue is undefined (orchestrator tracks lock set).
  if (op === 'lock') {
    return { path, proposedValue: undefined };
  }

  // 4. Path must already exist — no auto-vivify (prevents arbitrary key injection).
  const lookup = getAtPath(state, path);
  if (!lookup.found) {
    throw new ComputeDeltaError(
      'path-not-found',
      `路径「${path}」在当前 state 中不存在·禁 auto-vivify`,
    );
  }
  const currentValue = lookup.value;

  // 5. 'set' op: value type must match current type.
  if (op === 'set') {
    if (!typesMatch(currentValue, value)) {
      const cur = currentValue === null ? 'null' : typeof currentValue;
      const val = value === null ? 'null' : typeof value;
      throw new ComputeDeltaError(
        'type-mismatch',
        `set op 类型不匹配: 目标「${path}」为 ${cur}·value 为 ${val}`,
      );
    }
    return { path, proposedValue: value };
  }

  // 6. 'add' / 'sub': numeric fields only, integer-safe.
  if (typeof currentValue !== 'number') {
    throw new ComputeDeltaError(
      'type-mismatch',
      `${op} op 要求目标字段为 number·「${path}」实为 ${typeof currentValue}`,
    );
  }
  if (typeof value !== 'number') {
    throw new ComputeDeltaError(
      'type-mismatch',
      `${op} op 要求 value 为 number·实为 ${typeof value}`,
    );
  }
  if (!Number.isInteger(value)) {
    throw new ComputeDeltaError(
      'non-integer-value',
      `${op} op 要求 value 为整数·实为 ${value}（账本=整数文·禁 float 漂移）`,
    );
  }

  // max_delta cap: clamp |delta| to max_delta (must be non-negative integer).
  let delta = value;
  if (max_delta !== undefined) {
    if (!Number.isInteger(max_delta) || max_delta < 0) {
      throw new ComputeDeltaError(
        'non-integer-value',
        `max_delta 须为非负整数·实为 ${max_delta}`,
      );
    }
    const sign = delta >= 0 ? 1 : -1;
    delta = sign * Math.min(Math.abs(delta), max_delta);
  }

  const proposed = op === 'add' ? currentValue + delta : currentValue - delta;
  return { path, proposedValue: proposed };
}

// ─── setAtPath ────────────────────────────────────────────────────────────────

/**
 * Immutable deep-set: returns a new object tree with `value` placed at `path`.
 * Does NOT validate the path — the caller (⊕-2 orchestrator) must run computeDelta first.
 * Intermediate nodes that are absent or non-objects are replaced with `{}`.
 */
export function setAtPath(
  state: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  return setDeep(state, path.split('.'), value);
}

function setDeep(
  obj: Record<string, unknown>,
  segs: string[],
  value: unknown,
): Record<string, unknown> {
  const head = segs[0] as string;
  if (segs.length === 1) {
    return { ...obj, [head]: value };
  }
  const child = obj[head];
  const childObj =
    child !== null && typeof child === 'object' && !Array.isArray(child)
      ? (child as Record<string, unknown>)
      : {};
  return { ...obj, [head]: setDeep(childObj, segs.slice(1), value) };
}
