// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

// ── Selector groups ───────────────────────────────────────────────────────────
// Each group is an array of { selector, message } objects so they can be merged
// into a single 'no-restricted-syntax' rule array per file scope.
// ESLint flat config does NOT merge rule arrays — the last matching block wins.
// The scoped blocks below ensure each file is covered by exactly one block.

const WALL_CLOCK = [
  {
    selector:
      'CallExpression[callee.type="MemberExpression"][callee.object.name="Date"][callee.property.name="now"]',
    message:
      'Date.now() is forbidden in core — use the engine tick counter (纪元分钟) instead.',
  },
  {
    selector: 'NewExpression[callee.name="Date"]',
    message: 'new Date() is forbidden in core — use EpochMinute integer instead.',
  },
  {
    selector:
      'CallExpression[callee.type="MemberExpression"][callee.object.name="Date"][callee.property.name="UTC"]',
    message: 'Date.UTC() is forbidden in core — use the engine tick counter instead.',
  },
];

const SEEDED_RNG = [
  {
    selector:
      'CallExpression[callee.type="MemberExpression"][callee.object.name="Math"][callee.property.name="random"]',
    message:
      'Math.random() is forbidden in core — use the seeded RNG from pure-rand instead.',
  },
];

const DOM_FREE = [
  {
    selector: 'Identifier[name="window"]',
    message: 'window is forbidden in core — keep core DOM-free.',
  },
  {
    selector: 'Identifier[name="document"]',
    message: 'document is forbidden in core — keep core DOM-free.',
  },
  {
    selector: 'Identifier[name="TavernHelper"]',
    message:
      'TavernHelper is forbidden in core — use the host adapter in hosts/tavern instead.',
  },
];

const LOCALE_FREE = [
  {
    selector:
      'CallExpression[callee.type="MemberExpression"][callee.property.name="localeCompare"]',
    message:
      'localeCompare() is forbidden in core — sort keys must be locale-independent.',
  },
  {
    selector:
      'NewExpression[callee.type="MemberExpression"][callee.object.name="Intl"][callee.property.name="Collator"]',
    message: 'Intl.Collator is forbidden in core — sort keys must be locale-independent.',
  },
];

const PLATFORM_MATH = [
  {
    selector:
      'CallExpression[callee.type="MemberExpression"][callee.object.name="Math"][callee.property.name="pow"]',
    message: 'Math.pow() is forbidden in core — use fixedPow() from engine/math/fixed.ts.',
  },
  {
    selector:
      'CallExpression[callee.type="MemberExpression"][callee.object.name="Math"][callee.property.name="exp"]',
    message: 'Math.exp() is forbidden in core — use fixedExp() from engine/math/fixed.ts.',
  },
  {
    selector:
      'CallExpression[callee.type="MemberExpression"][callee.object.name="Math"][callee.property.name="log"]',
    message:
      'Math.log() is forbidden in core — use fixedLog1p() from engine/math/fixed.ts.',
  },
  {
    selector:
      'CallExpression[callee.type="MemberExpression"][callee.object.name="Math"][callee.property.name="expm1"]',
    message:
      'Math.expm1() is forbidden in core — use fixedExpm1() from engine/math/fixed.ts.',
  },
  {
    selector:
      'CallExpression[callee.type="MemberExpression"][callee.object.name="Math"][callee.property.name="log1p"]',
    message:
      'Math.log1p() is forbidden in core — use fixedLog1p() from engine/math/fixed.ts.',
  },
];

// Ring 0 D-segment must stay synchronous. NOT applied to tests/ (tests use async/await).
const RING0_SYNC = [
  {
    selector: 'AwaitExpression',
    message:
      'await is forbidden in Ring 0 engine files — D-segment settlement must be synchronous.',
  },
];

// Sole canonical-serialize implementation lives in engine/text/canonicalize.ts (whitelisted).
const CANONICAL_SERIALIZE = [
  {
    selector:
      'CallExpression[callee.type="MemberExpression"][callee.object.name="JSON"][callee.property.name="stringify"]',
    message:
      'JSON.stringify() is forbidden in engine files — use canonicalize() from engine/text/canonicalize.ts.',
  },
];

// Sole canonical-normalize implementation lives in engine/text/normalize.ts (whitelisted).
const CANONICAL_NORMALIZE = [
  {
    selector:
      'CallExpression[callee.type="MemberExpression"][callee.property.name="normalize"]',
    message:
      'str.normalize() is forbidden in engine files — use normalizeNFC()/normalizeNFKC() from engine/text/normalize.ts.',
  },
];

// BASE = rules that apply everywhere in core (non-engine AND engine files alike).
const BASE = [...WALL_CLOCK, ...SEEDED_RNG, ...DOM_FREE, ...LOCALE_FREE];

// ── Config ────────────────────────────────────────────────────────────────────

export default tseslint.config(
  {
    ignores: ['**/node_modules/**', '**/dist/**', 'docs/**', 'fixtures/**'],
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,

  // ── Block A: non-engine core files (schema/ migration/ prompt/ tests/) ──────
  // AwaitExpression intentionally absent: test files legitimately use async/await.
  {
    files: ['packages/core/**/*.ts'],
    ignores: ['packages/core/engine/**/*.ts'],
    rules: {
      'no-restricted-syntax': ['error', ...BASE, ...PLATFORM_MATH],
    },
  },

  // ── Block B: engine files — all bans ─────────────────────────────────────────
  // The three whitelist blocks below override this block for specific files.
  {
    files: ['packages/core/engine/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...BASE,
        ...PLATFORM_MATH,
        ...RING0_SYNC,
        ...CANONICAL_SERIALIZE,
        ...CANONICAL_NORMALIZE,
      ],
    },
  },

  // ── Whitelist: engine/math/fixed.ts ─ sole PLATFORM_MATH implementation ──────
  {
    files: ['packages/core/engine/math/fixed.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...BASE,
        ...RING0_SYNC,
        ...CANONICAL_SERIALIZE,
        ...CANONICAL_NORMALIZE,
      ],
    },
  },

  // ── Whitelist: engine/text/canonicalize.ts ─ sole CANONICAL_SERIALIZE impl ───
  {
    files: ['packages/core/engine/text/canonicalize.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...BASE,
        ...PLATFORM_MATH,
        ...RING0_SYNC,
        ...CANONICAL_NORMALIZE,
      ],
    },
  },

  // ── Whitelist: engine/text/normalize.ts ─ sole CANONICAL_NORMALIZE impl ──────
  {
    files: ['packages/core/engine/text/normalize.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...BASE,
        ...PLATFORM_MATH,
        ...RING0_SYNC,
        ...CANONICAL_SERIALIZE,
      ],
    },
  },
);
