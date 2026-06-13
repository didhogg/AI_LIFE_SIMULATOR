// H2 assertFinite — fail-fast guard against NaN / ±Infinity in the check chain.
// NaN entering a comparison (NaN > DC) is silently false → check produces wrong tier
// without any error. This guard stops NaN at the derivation boundary, not after.

/** Thrown when a non-finite value is detected; caller can catch to roll back (P0-7). */
export class FiniteAssertionError extends Error {
  readonly value: number;
  readonly ctx: string;

  constructor(value: number, ctx: string) {
    super(
      `[assertFinite] Non-finite value at "${ctx}": ${String(value)} — ` +
        `derivation chain must not produce NaN / ±Infinity before this point.`,
    );
    this.name = 'FiniteAssertionError';
    this.value = value;
    this.ctx = ctx;
  }
}

// Dev mode  = throw immediately (stack trace shows exact derivation path).
// Prod mode = log first so the record survives any silent upstream catch, then throw.
// P0-7 runTick will catch FiniteAssertionError and roll back to the pre-tick anchor.
const IS_PROD = process.env['NODE_ENV'] === 'production';

/**
 * Assert that `value` is a finite number (not NaN, not ±Infinity).
 *
 * @param value  Numeric value to validate.
 * @param ctx    Context label — derivation chain / field path for diagnosis,
 *               e.g. `"check.属性项 ← resolveAttribute[魅力]"`.
 *
 * Throws {@link FiniteAssertionError} on violation.
 * In prod mode, also logs to `console.error` before throwing so the record
 * persists even if an upstream handler swallows the error.
 */
export function assertFinite(value: number, ctx: string): void {
  if (!Number.isFinite(value)) {
    const err = new FiniteAssertionError(value, ctx);
    if (IS_PROD) {
      console.error(err.message);
    }
    throw err;
  }
}
