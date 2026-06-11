// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/node_modules/**', '**/dist/**', 'docs/**', 'fixtures/**'],
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    // Restrictions that enforce the "core is DOM-free and wall-clock-free" contract.
    // Any violation is a hard lint error — CI will go red.
    files: ['packages/core/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'CallExpression[callee.type="MemberExpression"][callee.object.name="Date"][callee.property.name="now"]',
          message:
            'Date.now() is forbidden in core — use the engine tick counter (纪元分钟) instead.',
        },
        {
          selector: 'NewExpression[callee.name="Date"]',
          message:
            'new Date() is forbidden in core — use EpochMinute integer instead.',
        },
        {
          selector:
            'CallExpression[callee.type="MemberExpression"][callee.object.name="Math"][callee.property.name="random"]',
          message:
            'Math.random() is forbidden in core — use the seeded RNG from pure-rand instead.',
        },
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
      ],
    },
  },
);
