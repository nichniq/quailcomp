/**
 * Check that directories with changed files have README.md files
 *
 * Extracted from .githooks/pre-commit to work as a watch task
 */

import { stat } from 'fs/promises'
import { dirname, join } from 'path'
import type { TaskResult } from '../types'

const PROJECT_ROOT = join(import.meta.dir, '../../..')

/**
 * Check if a directory should have a README
 * (skip generated directories)
 */
function shouldHaveReadme(dir: string): boolean {
  const skipPatterns = [
    'node_modules',
    '.git',
    'dist',
    'build',
    'coverage',
    '.cache',
  ]

  return !skipPatterns.some((pattern) => dir.includes(pattern))
}

/**
 * Check if a file exists
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

/**
 * Get unique directories from list of file paths
 */
function getDirectories(files: string[]): string[] {
  const dirs = new Set<string>()

  for (const file of files) {
    const dir = dirname(file)
    if (dir !== '.') {
      dirs.add(dir)
    }
  }

  return Array.from(dirs).sort()
}

/**
 * Check README maintenance for changed files
 */
export async function checkReadmes(changed: string[]): Promise<TaskResult> {
  const startTime = Date.now()
  const output: string[] = []
  const warnings: string[] = []

  try {
    output.push('Checking README maintenance...')

    // Get directories with changed files
    const changedDirs = getDirectories(changed)

    const missingReadmes: string[] = []
    const outdatedReadmes: string[] = []

    for (const dir of changedDirs) {
      // Skip directories that shouldn't have READMEs
      if (!shouldHaveReadme(dir)) {
        continue
      }

      const readmePath = join(PROJECT_ROOT, dir, 'README.md')
      const exists = await fileExists(readmePath)

      if (!exists) {
        missingReadmes.push(`  - ${dir}/`)
      } else {
        // Check if README.md was also modified
        const readmeChanged = changed.some(
          (file) => file === join(dir, 'README.md') || file === `${dir}/README.md`
        )

        if (!readmeChanged) {
          outdatedReadmes.push(`  - ${dir}/README.md`)
        }
      }
    }

    if (missingReadmes.length > 0) {
      warnings.push('')
      warnings.push('⚠️  New directories without README.md:')
      warnings.push(...missingReadmes)
      warnings.push('   Consider adding README.md files to document these directories.')
      warnings.push('   See: docs/how-to/maintain-readmes.md')
    }

    if (outdatedReadmes.length > 0) {
      warnings.push('')
      warnings.push('ℹ️  Files changed but README not updated:')
      warnings.push(...outdatedReadmes)
      warnings.push('   Consider updating these READMEs if needed.')
    }

    if (missingReadmes.length === 0 && outdatedReadmes.length === 0) {
      output.push('✓ All directories with changes have up-to-date READMEs')
    }

    // Warnings don't fail the task, just inform
    return {
      success: true,
      stdout: output.join('\n'),
      stderr: warnings.join('\n'),
      duration: Date.now() - startTime,
    }
  } catch (error) {
    return {
      success: false,
      stdout: output.join('\n'),
      stderr: `❌ Error checking READMEs: ${error}`,
      duration: Date.now() - startTime,
      error: error as Error,
    }
  }
}

// Allow running standalone for testing
if (import.meta.main) {
  const result = await checkReadmes(['src/test.ts', 'cli/src/commands/test.ts'])
  console.log(result.stdout)
  if (result.stderr) {
    console.error(result.stderr)
  }
  process.exit(result.success ? 0 : 1)
}
