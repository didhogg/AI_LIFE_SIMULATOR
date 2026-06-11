import { describe, it, expect } from 'vitest';

// Smoke test: confirms the Vitest pipeline is wired up end-to-end.
describe('core pipeline', () => {
  it('test pipeline is live', () => {
    expect(true).toBe(true);
  });
});

// ─── How to trigger a lint error (DO NOT UNCOMMENT in normal usage) ──────────
//
// Any of the lines below will make `pnpm lint` exit non-zero with a descriptive
// error. Uncomment one, save, run `pnpm lint`, then re-comment it.
//
// const _t1 = Date.now();          // Error: Date.now() is forbidden in core
// const _t2 = new Date();          // Error: new Date() is forbidden in core
// const _t3 = Math.random();       // Error: Math.random() is forbidden in core
// const _t4 = window.location;     // Error: window is forbidden in core
// const _t5 = document.title;      // Error: document is forbidden in core
// const _t6 = TavernHelper.run();  // Error: TavernHelper is forbidden in core
