/**
 * Test Reporter Task
 *
 * Generates test results JSON file when test files change.
 * This provides real-time test status updates in the DevTools UI.
 */

import { join } from 'path'
import type { TaskResult } from '../types'

const PROJECT_ROOT = join(import.meta.dir, '../../..')

/**
 * Run the test reporter script to generate test results
 */
export async function runTestReporter(): Promise<TaskResult> {
  const startTime = Date.now()

  try {
    const scriptPath = join(PROJECT_ROOT, 'devtools/scripts/test-reporter.ts')

    // Use Bun.spawn to run the test reporter script
    const proc = Bun.spawn(['bun', 'run', scriptPath], {
      cwd: PROJECT_ROOT,
      stdout: 'pipe',
      stderr: 'pipe',
    })

    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    return {
      success: exitCode === 0,
      stdout,
      stderr,
      duration: Date.now() - startTime,
    }
  } catch (error) {
    return {
      success: false,
      stdout: '',
      stderr: `Error running test reporter: ${error}`,
      duration: Date.now() - startTime,
      error: error as Error,
    }
  }
}
