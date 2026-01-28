import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';
import vuePlugin from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.bun/**',
      '**/coverage/**',
      'data/postgres/**', // SQL files, not JS/TS
      'bun.lock', // Auto-generated lockfile
    ],
  },
  // Configuration for TypeScript files
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      import: importPlugin,
    },
    rules: {
      // Enforce using @ path aliases instead of relative imports
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../*'],
              message:
                'Relative parent imports are not allowed. Use @ path aliases instead (e.g., @/components/Button instead of ../components/Button)',
            },
          ],
        },
      ],
    },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: [
            './data/client/tsconfig.json',
            './server/tsconfig.json',
            './frontend/tsconfig.json',
          ],
        },
      },
    },
  },
  // Configuration for Vue files
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tsparser,
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      import: importPlugin,
      vue: vuePlugin,
    },
    rules: {
      // Enforce using @ path aliases instead of relative imports
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../*'],
              message:
                'Relative parent imports are not allowed. Use @ path aliases instead (e.g., @/components/Button instead of ../components/Button)',
            },
          ],
        },
      ],
      // Basic Vue rules only (not the opinionated style rules)
      'vue/multi-word-component-names': 'off',
    },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: ['./frontend/tsconfig.json'],
        },
      },
    },
  },
];
