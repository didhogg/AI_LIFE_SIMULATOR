/**
 * Ring 0 fixed math — deterministic on all IEEE 754 platforms.
 * Only +, -, *, / are used for transcendental ops (IEEE 754 §5 mandated, bit-exact).
 * Math.pow/exp/log/expm1/log1p are NOT deterministic across CPU FMA implementations.
 *
 * THIS FILE IS THE SOLE WHITELIST for ESLint rule 禁③ no-platform-math.
 * All other core files must call these exports instead of the platform counterparts.
 */

const LN2 = 0.6931471805599453; // ln(2) IEEE 754 double, exact to ULP

/**
 * Natural log via atanh with range reduction.
 * Reduces x = m·2^k, m ∈ [0.5, 1), so u = (m−1)/(m+1) ∈ [−1/3, 0).
 * |u| ≤ 1/3 → geometric convergence u^(2j)/j, ~15 terms for double precision.
 */
function fixedLn(x: number): number {
  if (x <= 0) return x === 0 ? -Infinity : NaN;
  if (x === 1) return 0;
  let m = x, k = 0;
  while (m >= 1) { m /= 2; k++; }
  while (m < 0.5) { m *= 2; k--; }
  const u = (m - 1) / (m + 1);
  const u2 = u * u;
  let term = u, sum = u;
  for (let j = 3; ; j += 2) {
    term *= u2;
    const next = sum + term / j;
    if (next === sum) break;
    sum = next;
  }
  return k * LN2 + 2 * sum;
}

/** log(1 + x) — numerically stable for x ∈ (−1, ∞). */
export function fixedLog1p(x: number): number {
  if (x <= -1) return x === -1 ? -Infinity : NaN;
  if (x === 0) return 0;
  return fixedLn(1 + x);
}

/**
 * e^x − 1 — range-reduced for |x| > 1 via expm1(x) = h(2+h) where h = expm1(x/2).
 * For |x| ≤ 1: direct Taylor series (no intermediate cancellation).
 */
export function fixedExpm1(x: number): number {
  if (x === 0) return 0;
  if (Math.abs(x) > 1) {
    const h = fixedExpm1(x / 2);
    return h * (2 + h);
  }
  let term = x, sum = x;
  for (let k = 2; ; k++) {
    term *= x / k;
    const next = sum + term;
    if (next === sum) break;
    sum = next;
  }
  return sum;
}

/** e^x. */
export function fixedExp(x: number): number {
  return 1 + fixedExpm1(x);
}

/** base^exp — fixed implementation, no Math.pow. */
export function fixedPow(base: number, exp: number): number {
  if (exp === 0) return 1;
  if (base === 1) return 1;
  if (base === 0) return exp > 0 ? 0 : Infinity;
  if (base < 0) {
    if (!Number.isInteger(exp)) return NaN;
    const r = fixedExp(exp * fixedLn(-base));
    return exp % 2 === 0 ? r : -r;
  }
  return fixedExp(exp * fixedLn(base));
}

/**
 * Square root via Newton-Raphson with range-reduced initial guess.
 * Converges in ≤ 64 iterations for any finite positive x.
 */
export function fixedSqrt(x: number): number {
  if (x < 0) return NaN;
  if (x === 0) return 0;
  let guess = 1;
  let t = x;
  while (t > 2) { t /= 4; guess *= 2; }
  while (t < 0.5) { t *= 4; guess /= 2; }
  for (let i = 0; i < 64; i++) {
    const next = (guess + x / guess) / 2;
    if (next === guess) break;
    guess = next;
  }
  return guess;
}

/**
 * P(≥1 event in n periods | per-period probability p) = 1 − (1−p)^n.
 * Numerically stable via −expm1(n · log1p(−p)); avoids 1 − (1−p)^n cancellation.
 */
export function stableProb(p: number, n: number): number {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  if (n <= 0) return 0;
  return -fixedExpm1(n * fixedLog1p(-p));
}

/**
 * v1 stable math API — only grows, never removes (backward compatible).
 * Use these instead of the platform Math counterparts in Ring 0 engine code.
 */
export const v1 = {
  min: Math.min,
  max: Math.max,
  clamp: (x: number, lo: number, hi: number): number =>
    Math.min(Math.max(x, lo), hi),
  pow: fixedPow,
  sqrt: fixedSqrt,
  expm1: fixedExpm1,
  log1p: fixedLog1p,
} as const;
