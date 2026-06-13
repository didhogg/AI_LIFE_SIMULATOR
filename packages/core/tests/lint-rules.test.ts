/**
 * Reverse-assertion tests for Ring 0 ESLint bans.
 * Part A — selector unit tests (linter.verify): verify each AST selector fires.
 * Part B — config integration tests (ESLint API): verify each ban fires through
 *           the real eslint.config.js so a dropped rule is caught here too.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { Linter, ESLint } from 'eslint';
import path from 'path';

const linter = new Linter();

function assertBanned(code: string, selector: string): void {
  const msgs = linter.verify(code, [
    {
      rules: { 'no-restricted-syntax': ['error', { selector, message: 'ring0-ban' }] },
    } as Linter.Config,
  ]);
  expect(msgs.some((m) => m.ruleId === 'no-restricted-syntax')).toBe(true);
}

// ── 禁① no-date-now-in-ring0 ─────────────────────────────────────────────────

const SEL_DATE_NOW =
  'CallExpression[callee.type="MemberExpression"][callee.object.name="Date"][callee.property.name="now"]';
const SEL_NEW_DATE = 'NewExpression[callee.name="Date"]';
const SEL_DATE_UTC =
  'CallExpression[callee.type="MemberExpression"][callee.object.name="Date"][callee.property.name="UTC"]';

describe('禁① Date.now / new Date / Date.UTC', () => {
  it('Date.now() fires', () => assertBanned('const t = Date.now();', SEL_DATE_NOW));
  it('new Date() fires', () => assertBanned('const d = new Date();', SEL_NEW_DATE));
  it('Date.UTC(...) fires', () =>
    assertBanned('const ms = Date.UTC(2020, 0, 1);', SEL_DATE_UTC));
});

// ── 禁② no-await-in-d-segment ────────────────────────────────────────────────

const SEL_AWAIT = 'AwaitExpression';

describe('禁② AwaitExpression in D-segment', () => {
  it('await inside async function fires', () =>
    assertBanned(
      'async function settle() { await Promise.resolve(1); }',
      SEL_AWAIT,
    ));
});

// ── 禁③ no-platform-math ─────────────────────────────────────────────────────

const mathFns = ['pow', 'exp', 'log', 'expm1', 'log1p'] as const;

describe('禁③ Math.{pow,exp,log,expm1,log1p}', () => {
  for (const fn of mathFns) {
    const sel = `CallExpression[callee.type="MemberExpression"][callee.object.name="Math"][callee.property.name="${fn}"]`;
    it(`Math.${fn}() fires`, () =>
      assertBanned(`const x = Math.${fn}(1);`, sel));
  }
});

// ── 禁④ no-locale-compare ────────────────────────────────────────────────────

const SEL_LOCALE_COMPARE =
  'CallExpression[callee.type="MemberExpression"][callee.property.name="localeCompare"]';
const SEL_INTL_COLLATOR =
  'NewExpression[callee.type="MemberExpression"][callee.object.name="Intl"][callee.property.name="Collator"]';

describe('禁④ localeCompare / Intl.Collator', () => {
  it('str.localeCompare() fires', () =>
    assertBanned("const r = 'a'.localeCompare('b');", SEL_LOCALE_COMPARE));
  it('new Intl.Collator() fires', () =>
    assertBanned('const c = new Intl.Collator();', SEL_INTL_COLLATOR));
});

// ── 禁⑤ canonical-serialize-only ─────────────────────────────────────────────

const SEL_JSON_STRINGIFY =
  'CallExpression[callee.type="MemberExpression"][callee.object.name="JSON"][callee.property.name="stringify"]';

describe('禁⑤ JSON.stringify (bare)', () => {
  it('JSON.stringify({}) fires', () =>
    assertBanned('const s = JSON.stringify({ a: 1 });', SEL_JSON_STRINGIFY));
});

// ── 禁⑥ no-platform-normalize ───────────────────────────────────────────────

const SEL_NORMALIZE =
  'CallExpression[callee.type="MemberExpression"][callee.property.name="normalize"]';

describe('禁⑥ .normalize() (bare)', () => {
  it("str.normalize('NFC') fires", () =>
    assertBanned("const n = 'café'.normalize('NFC');", SEL_NORMALIZE));
});

// ── 六禁集成验证: 通过真实 eslint.config.js 各自独立报红 ───────────────────────
// Part B: loads the real eslint.config.js via ESLint programmatic API.
// Catches any rule accidentally dropped from the config (selector unit tests above
// only verify the AST selector syntax — they do NOT load eslint.config.js).

const ENGINE_LINT_PATH = path.join(
  process.cwd(),
  'packages/core/engine/_lint_integration_stub.ts',
);

describe('六禁集成验证: 通过 eslint.config.js 各自独立报红', () => {
  let eslintApi: ESLint;

  beforeAll(() => {
    eslintApi = new ESLint({
      overrideConfigFile: path.join(process.cwd(), 'eslint.config.js'),
    });
  });

  async function lintAsEngineFile(code: string) {
    const results = await eslintApi.lintText(code, { filePath: ENGINE_LINT_PATH });
    return results
      .flatMap((r) => r.messages)
      .filter((m) => m.ruleId === 'no-restricted-syntax');
  }

  it('禁①: Date.now() fires via real config', async () => {
    const msgs = await lintAsEngineFile('const t = Date.now();');
    expect(msgs.some((m) => m.message.includes('Date.now()'))).toBe(true);
  });

  it('禁②: AwaitExpression fires via real config', async () => {
    const msgs = await lintAsEngineFile(
      'async function f() { await Promise.resolve(1); }',
    );
    expect(msgs.some((m) => m.message.includes('await'))).toBe(true);
  });

  it('禁③: Math.pow() fires via real config', async () => {
    const msgs = await lintAsEngineFile('const x = Math.pow(2, 10);');
    expect(msgs.some((m) => m.message.includes('Math.pow()'))).toBe(true);
  });

  it('禁④: localeCompare() fires via real config', async () => {
    const msgs = await lintAsEngineFile("const r = 'a'.localeCompare('b');");
    expect(msgs.some((m) => m.message.includes('localeCompare()'))).toBe(true);
  });

  it('禁⑤: JSON.stringify() fires via real config', async () => {
    const msgs = await lintAsEngineFile('const s = JSON.stringify({ a: 1 });');
    expect(msgs.some((m) => m.message.includes('JSON.stringify()'))).toBe(true);
  });

  it("禁⑥: str.normalize() fires via real config", async () => {
    const msgs = await lintAsEngineFile("const n = 'café'.normalize('NFC');");
    expect(msgs.some((m) => m.message.includes('.normalize()'))).toBe(true);
  });
});
