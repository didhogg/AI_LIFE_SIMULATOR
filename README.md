# AI Life Simulator

A deterministic life/world sandbox engine. The engine handles numbers; an LLM tells the story.

## Quick start

Install dependencies (run this once, then commit `pnpm-lock.yaml`):

```
pnpm install
```

Run tests:

```
pnpm test
```

Run linter:

```
pnpm lint
```

Run type checker:

```
pnpm typecheck
```

## Project layout

```
packages/core/       Pure TS engine — zero DOM/host dependencies
  schema/            Zod schemas (P0-1)
  engine/            Tick loop, state machine, RNG, gates (P0-3 to P0-7)
  prompt/            LLM context assembly (P0-8)
  migration/         V3.1 → V4.1 save migration (P0-2)
  tests/             Unit & property tests

hosts/tavern/        SillyTavern host adapter (P0-11)
hosts/web-debug/     Browser debug UI (P0-11)

docs/spec/           Architecture blueprints (read-only)
docs/reference/      Old V3 code for reference (read-only)
fixtures/            Regression test fixtures (read-only)
```

## Rules enforced by CI

Every push and pull request runs **typecheck → lint → test**. Any failure turns CI red.

`packages/core/` has extra lint rules that reject: `Date.now()`, `new Date()`,
`Math.random()`, `window`, `document`, and any `TavernHelper` reference.
These keep the core engine free of wall-clock time and browser/host APIs.

## Notes

- After `pnpm install`, commit `pnpm-lock.yaml` so CI can use `--frozen-lockfile`.
- To verify lint rules work, see `packages/core/tests/core.test.ts` for a commented-out violation example.
