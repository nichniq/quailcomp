/**
 * Run TypeScript type checking on domains directory
 *
 * Extracted from .githooks/pre-commit to work as a watch task
 */

import { $ } from 'bun'
import { join } from 'path'
import type { TaskResult } from '../types'

const PROJECT_ROOT = join(import.meta.dir, '../../..')
const DOMAINS_DIR = join(PROJECT_ROOT, 'domains')

/**
 * Run TypeScript type checking on domains directory
 */
export async function typecheckDomains(changed: string[]): Promise<TaskResult> {
  const startTime = Date.now()
  const output: string[] = []
  const errors: string[] = []

  try {
    output.push('Running TypeScript type checks on domains...')

    // Change to domains directory and run tsc
    const result = await $`cd ${DOMAINS_DIR} && bunx tsc --noEmit`.nothrow()

    if (result.exitCode !== 0) {
      errors.push('❌ TypeScript type checking failed in domains directory.')
      errors.push(result.stderr.toString())

      return {
        success: false,
        stdout: output.join('\n'),
        stderr: errors.join('\n'),
        duration: Date.now() - startTime,
      }
    }

    output.push('✓ TypeScript checks passed!')

    return {
      success: true,
      stdout: output.join('\n'),
      stderr: '',
      duration: Date.now() - startTime,
    }
  } catch (error) {
    errors.push(`❌ Error running type check: ${error}`)

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
  const result = await typecheckDomains([])
  console.log(result.stdout)
  if (result.stderr) {
    console.error(result.stderr)
  }
  process.exit(result.success ? 0 : 1)
}
