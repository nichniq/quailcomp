/**
 * Run ESLint on changed TypeScript/Vue files
 *
 * Extracted from .githooks/pre-commit to work as a watch task
 */

import { $ } from 'bun'
import { join } from 'path'
import type { TaskResult } from '../types'

const PROJECT_ROOT = join(import.meta.dir, '../../..')

/**
 * Filter files to only include lintable extensions
 */
function filterLintableFiles(files: string[]): string[] {
  const lintExtensions = ['.ts', '.tsx', '.js', '.jsx', '.vue']
  return files.filter((file) => lintExtensions.some((ext) => file.endsWith(ext)))
}

/**
 * Run ESLint on changed files
 */
export async function lintStaged(changed: string[]): Promise<TaskResult> {
  const startTime = Date.now()
  const output: string[] = []
  const errors: string[] = []

  try {
    const lintableFiles = filterLintableFiles(changed)

    if (lintableFiles.length === 0) {
      output.push('ℹ️  No lintable files changed')
      return {
        success: true,
        stdout: output.join('\n'),
        stderr: '',
        duration: Date.now() - startTime,
      }
    }

    output.push(`Running ESLint on ${lintableFiles.length} file(s)...`)

    // Run ESLint from project root
    const result = await $`cd ${PROJECT_ROOT} && bun run lint`.nothrow()

    if (result.exitCode !== 0) {
      errors.push('❌ ESLint found errors.')
      errors.push('   Tip: Run \'bun run lint:fix\' to auto-fix some issues.')
      errors.push('')
      errors.push(result.stderr.toString())

      return {
        success: false,
        stdout: output.join('\n'),
        stderr: errors.join('\n'),
        duration: Date.now() - startTime,
      }
    }

    output.push('✓ ESLint passed!')

    return {
      success: true,
      stdout: output.join('\n'),
      stderr: '',
      duration: Date.now() - startTime,
    }
  } catch (error) {
    errors.push(`❌ Error running lint: ${error}`)

    return {
      success: false,
      stdout: output.join('\n'),
      stderr: errors.join('\n'),
      duration: Date.now() - startTime,
      error: error as Error,
    }
  }
}

// Allow running standalone for testing
if (import.meta.main) {
  const result = await lintStaged(['src/test.ts', 'frontend/src/App.vue'])
  console.log(result.stdout)
  if (result.stderr) {
    console.error(result.stderr)
  }
  process.exit(result.success ? 0 : 1)
}
