/**
 * Watch rule definitions for the DevTools system
 *
 * Each rule defines:
 * - What files to watch (glob patterns)
 * - What task to run when they change
 * - Debounce settings
 */

import type { WatchRule } from './types'
import { extractTypes } from './tasks/types-from-docs'
import { checkReadmes } from './tasks/check-readmes'
import { typecheckDomains } from './tasks/typecheck-domains'
import { lintStaged } from './tasks/lint-staged'
import { generateSpecs } from './tasks/specs-from-tests'
import { runTestReporter } from './tasks/test-reporter'

export const rules: WatchRule[] = [
  {
    name: 'type-generation',
    description: 'Extract TypeScript types from domain markdown files',
    watch: ['domains/**/*.md', '!domains/README.md'],
    run: extractTypes,
    debounce: 500,
    runOnStart: false,
  },
  {
    name: 'test-spec-generation',
    description: 'Generate markdown specifications from test files',
    watch: ['**/*.test.ts', '!**/node_modules/**', '!**/dist/**'],
    run: generateSpecs,
    debounce: 500,
    runOnStart: true,
  },
  {
    name: 'readme-validation',
    description: 'Check that directories with changed files have READMEs',
    watch: ['**/*.ts', '**/*.tsx', '**/*.vue', '**/*.md', '!**/node_modules/**', '!**/dist/**'],
    run: checkReadmes,
    debounce: 1000,
    runOnStart: false,
  },
  {
    name: 'typecheck-domains',
    description: 'Run TypeScript type checking on domains directory',
    watch: ['domains/**/*.ts'],
    run: typecheckDomains,
    debounce: 1000,
    runOnStart: false,
  },
  {
    name: 'lint-files',
    description: 'Run ESLint on changed TypeScript/Vue files',
    watch: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.vue', '!**/node_modules/**', '!**/dist/**'],
    run: lintStaged,
    debounce: 500,
    runOnStart: false,
  },
  {
    name: 'test-results',
    description: 'Generate test results JSON when test files change',
    watch: ['**/*.test.ts', '**/*.spec.ts', '!**/node_modules/**', '!**/dist/**'],
    run: runTestReporter,
    debounce: 2000,
    runOnStart: false,
  },
]
