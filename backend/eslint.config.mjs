// Objetivo: reglas de calidad estática del backend (ESLint 9 flat config).
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'eslint.config.mjs'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
    },
  },
  {
    files: ['src/**/*.cli.ts', 'src/infrastructure/mail/console-mail.adapter.ts'],
    rules: { 'no-console': 'off' },
  },
);
