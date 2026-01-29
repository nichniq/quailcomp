/**
 * Miscellaneous infrastructure and tooling tests
 *
 * This file contains tests for project infrastructure, git hooks,
 * and other non-code-related functionality.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { $ } from 'bun'

describe('README Maintenance Hook', () => {
  let originalBranch: string
  const testBranch = `test-readme-hook-${Date.now()}`

  beforeAll(async () => {
    // Get current branch
    originalBranch = (await $`git rev-parse --abbrev-ref HEAD`.text()).trim()
    // Create test branch
    await $`git checkout -b ${testBranch}`.quiet()
  })

  afterAll(async () => {
    // Return to original branch
    await $`git checkout ${originalBranch}`.quiet()
    // Delete test branch
    await $`git branch -D ${testBranch}`.quiet()
    // Clean up any test files
    await $`rm -rf test-new-directory`.quiet()
    await $`rm -f cli/src/commands/new-command.ts cli/src/commands/another-command.ts`.quiet()
    await $`git checkout cli/src/commands/README.md`.quiet()
  })

  test('warns when new directory created without README', async () => {
    // Create a new directory with a file
    await $`mkdir -p test-new-directory`
    await $`echo "export const test = 'hello'" > test-new-directory/test.ts`
    await $`git add test-new-directory/test.ts`

    // Try to commit - hook output goes to stderr
    const result = await $`git commit -m "Test: new directory without README"`.nothrow()
    const output = result.stderr.toString()

    // Check that the hook warned about missing README
    expect(output).toContain('New directories without README.md')
    expect(output).toContain('test-new-directory/')

    // Reset the commit attempt
    await $`git reset --soft HEAD~1`.nothrow()
    await $`git reset HEAD test-new-directory/test.ts`
  })

  test('warns when files added to directory without updating README', async () => {
    // Add a file to an existing directory with a README
    await $`echo "export const newFeature = 'test'" > cli/src/commands/new-command.ts`
    await $`git add cli/src/commands/new-command.ts`

    // Try to commit - hook output goes to stderr
    const result = await $`git commit -m "Test: add file without updating README"`.nothrow()
    const output = result.stderr.toString()

    // Check that the hook warned about unchanged README
    expect(output).toContain('Files changed but README not updated')
    expect(output).toContain('cli/src/commands/README.md')

    // Reset the commit attempt
    await $`git reset --soft HEAD~1`.nothrow()
    await $`git reset HEAD cli/src/commands/new-command.ts`
    await $`rm -f cli/src/commands/new-command.ts`
  })

  test('does not warn when README is updated along with files', async () => {
    // Add a file and update the README
    await $`echo "export const anotherFeature = 'test'" > cli/src/commands/another-command.ts`
    await $`echo "" >> cli/src/commands/README.md`

    await $`git add cli/src/commands/another-command.ts cli/src/commands/README.md`

    // Try to commit - hook output goes to stderr
    const result = await $`git commit -m "Test: add file with README update"`.nothrow()
    const output = result.stderr.toString()

    // Check that the hook did NOT warn about cli/src/commands
    const hasWarning = output.includes('Files changed but README not updated') &&
                       output.includes('cli/src/commands/README.md')

    expect(hasWarning).toBe(false)

    // Reset the commit
    await $`git reset --soft HEAD~1`.nothrow()
    await $`git reset HEAD cli/src/commands/another-command.ts cli/src/commands/README.md`
    await $`rm -f cli/src/commands/another-command.ts`
    await $`git checkout cli/src/commands/README.md`
  })
})

describe('Git Hooks', () => {
  test('pre-commit hook exists and is executable', async () => {
    const hookPath = '.git/hooks/pre-commit'
    const file = Bun.file(hookPath)
    const exists = await file.exists()

    expect(exists).toBe(true)

    if (exists) {
      // Check if executable
      const stat = await $`stat -f "%Lp" ${hookPath}`.text()
      const permissions = stat.trim()
      // Should be executable (have execute bit set)
      expect(permissions).toMatch(/[1-9]/) // At least one execute permission
    }
  })

  test('pre-commit hook matches template', async () => {
    const templatePath = '.githooks/pre-commit'
    const installedPath = '.git/hooks/pre-commit'

    const template = await Bun.file(templatePath).text()
    const installed = await Bun.file(installedPath).text()

    expect(installed).toBe(template)
  })
})
