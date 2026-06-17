// packages/core/loader/semver.ts — B3·K2 minimal semver primitives (zero deps)
//
// Supported range syntax: comparator [ ' ' comparator ]*
//   comparator: ('>=', '>', '<=', '<', '=', '') followed by X.Y.Z
// Unsupported: ^, ~, ||, pre-release tags — these throw explicitly.
// All functions are pure and deterministic (no Date, no Math.random, no Intl).

export interface ParsedSemver {
  major: number;
  minor: number;
  patch: number;
}

const SEMVER_RE = /^\s*(\d+)\.(\d+)\.(\d+)\s*$/;
const COERCE_RE = /^\s*(\d+)(?:\.(\d+))?(?:\.(\d+))?\s*$/;
const COMPARATOR_RE = /^\s*(>=|<=|>|<|=)?\s*(\d+\.\d+\.\d+)\s*$/;

export function parseSemver(s: string): ParsedSemver {
  const m = SEMVER_RE.exec(s);
  if (!m) throw new Error(`semver: cannot parse "${s}" — only X.Y.Z format supported`);
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

/** Coerce '4.1' → '4.1.0', '1' → '1.0.0', '1.2.3' → '1.2.3'. Throws on invalid input. */
export function coerceSemver(s: string): string {
  if (s.includes('^') || s.includes('~') || s.includes('||') || s.includes('-')) {
    throw new Error(`semver: coerceSemver does not support "${s}"`);
  }
  const m = COERCE_RE.exec(s);
  if (!m) throw new Error(`semver: cannot coerce "${s}" to X.Y.Z`);
  const major = Number(m[1]);
  const minor = m[2] !== undefined ? Number(m[2]) : 0;
  const patch = m[3] !== undefined ? Number(m[3]) : 0;
  return `${major}.${minor}.${patch}`;
}

function cmp(a: ParsedSemver, b: ParsedSemver): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

function parseComparator(raw: string): { op: string; v: ParsedSemver } {
  // Reject unsupported syntax before attempting to parse
  if (raw.includes('^') || raw.includes('~') || raw.includes('||') || raw.includes('-')) {
    throw new Error(`semver: unsupported range syntax in "${raw}"`);
  }
  const m = COMPARATOR_RE.exec(raw);
  if (!m) throw new Error(`semver: cannot parse comparator "${raw}"`);
  const op = m[1] ?? '=';
  const v = parseSemver(m[2]!);
  return { op, v };
}

function applyComparator(version: ParsedSemver, op: string, bound: ParsedSemver): boolean {
  const d = cmp(version, bound);
  switch (op) {
    case '>=': return d >= 0;
    case '>':  return d > 0;
    case '<=': return d <= 0;
    case '<':  return d < 0;
    case '=':  return d === 0;
    default:   throw new Error(`semver: unknown operator "${op}"`);
  }
}

/**
 * Test whether `version` (X.Y.Z string) satisfies `range`.
 * Range is space-AND of comparators, e.g. ">=1.0.0 <2.0.0".
 * Empty range string → always true (unconstrained).
 * Throws on unsupported syntax (^, ~, ||, pre-release).
 */
export function satisfies(version: string, range: string): boolean {
  const v = parseSemver(coerceSemver(version));
  const trimmed = range.trim();
  if (trimmed === '') return true;
  const parts = trimmed.split(/\s+/);
  for (const part of parts) {
    const { op, v: bound } = parseComparator(part);
    if (!applyComparator(v, op, bound)) return false;
  }
  return true;
}

// ── Range intersection (B3·K2·预留 "依赖带版本区间" 场景) ──────────────────────
//
// Computes the effective AND of two AND-comparator ranges as a canonical range string.
// Returns the concatenated comparator set (deduped by exact string match).
// Empty string means "any version" (no constraints).
// Does NOT evaluate whether the intersection is non-empty (requires full solver);
// callers should test a concrete version with satisfies() after intersecting.
//
// NOTE: runtime consumption of multi-mod intersection is deferred to B5/B6.
// This function is provided for future import-gate use and is tested in isolation.

export function intersect(rangeA: string, rangeB: string): string {
  const a = rangeA.trim();
  const b = rangeB.trim();
  if (a === '') return b;
  if (b === '') return a;
  // Validate both ranges before combining
  for (const part of a.split(/\s+/)) parseComparator(part);
  for (const part of b.split(/\s+/)) parseComparator(part);
  // Union of comparators (AND semantics) with dedup by exact string
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of [...a.split(/\s+/), ...b.split(/\s+/)]) {
    const key = part.trim();
    if (!seen.has(key)) { seen.add(key); result.push(key); }
  }
  return result.join(' ');
}

/** Parse a range string and throw on unsupported syntax (validation helper for schema refine). */
export function validateRange(range: string): void {
  const trimmed = range.trim();
  if (trimmed === '') return;
  for (const part of trimmed.split(/\s+/)) {
    parseComparator(part); // throws on bad syntax
  }
}
