import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';
import vuePlugin from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';
import noUnsafeSql from './eslint-rules/no-unsafe-sql.js';

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
      'custom-rules': {
        rules: {
          'no-unsafe-sql': noUnsafeSql,
        },
      },
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
      // Enforce parameterized SQL queries using Bun tagged templates
      'custom-rules/no-unsafe-sql': 'error',
      // Enforce 2-space indentation
      indent: ['error', 2, { SwitchCase: 1 }],
      // Enforce newline at end of file
      'eol-last': ['error', 'always'],
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
      // Enforce 2-space indentation
      indent: ['error', 2, { SwitchCase: 1 }],
      // Enforce newline at end of file
      'eol-last': ['error', 'always'],
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
