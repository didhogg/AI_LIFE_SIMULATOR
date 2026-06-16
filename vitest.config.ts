import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/tests/**/*.test.ts', 'packages/*/chaos/**/*.test.ts', 'hosts/slice/tests/**/*.test.ts'],
  },
});
