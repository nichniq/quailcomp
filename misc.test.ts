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

describe('Code Coverage Infrastructure', () => {
  test('coverage scripts exist', async () => {
    expect(await Bun.file('scripts/merge-coverage.ts').exists()).toBe(true)
    expect(await Bun.file('scripts/coverage-report.ts').exists()).toBe(true)
  })

  test('bunfig.toml has coverage config', async () => {
    const config = await Bun.file('bunfig.toml').text()
    expect(config).toContain('coverageThreshold')
    expect(config).toContain('0.9')
  })
})

describe('Deployment Infrastructure', () => {
  test('systemd service file exists and has correct structure', async () => {
    const servicePath = 'deployment/systemd/quailcomp.service'
    const serviceFile = Bun.file(servicePath)

    expect(await serviceFile.exists()).toBe(true)

    const content = await serviceFile.text()

    // Check for required systemd sections
    expect(content).toContain('[Unit]')
    expect(content).toContain('[Service]')
    expect(content).toContain('[Install]')

    // Check for essential service configuration
    expect(content).toContain('Type=simple')
    expect(content).toContain('User=quailcomp')
    expect(content).toContain('Group=quailcomp')
    expect(content).toContain('WorkingDirectory=/opt/quailcomp')

    // Check for restart policy
    expect(content).toContain('Restart=on-failure')

    // Check for security hardening
    expect(content).toContain('NoNewPrivileges=true')
    expect(content).toContain('PrivateTmp=true')

    // Check for resource limits
    expect(content).toContain('MemoryMax=')
    expect(content).toContain('CPUQuota=')

    // Check for proper dependencies
    expect(content).toContain('After=network.target postgresql.service')
    expect(content).toContain('Wants=postgresql.service')
  })

  test('logrotate configuration exists and is valid', async () => {
    const logrotateFile = Bun.file('deployment/systemd/logrotate.conf')

    expect(await logrotateFile.exists()).toBe(true)

    const content = await logrotateFile.text()

    // Check for log path
    expect(content).toContain('/opt/quailcomp/logs/*.log')

    // Check for rotation settings
    expect(content).toContain('daily')
    expect(content).toContain('rotate 14')
    expect(content).toContain('compress')

    // Check for safety options
    expect(content).toContain('missingok')
    expect(content).toContain('notifempty')
  })

  test('installation script exists and is executable', async () => {
    const installScript = 'deployment/install.sh'
    const file = Bun.file(installScript)

    expect(await file.exists()).toBe(true)

    // Check if executable
    const stat = await $`stat -f "%Lp" ${installScript}`.text()
    const permissions = stat.trim()
    expect(permissions).toMatch(/[1-9]/) // Has execute permission

    const content = await file.text()

    // Check for bash shebang
    expect(content).toMatch(/^#!\/usr\/bin\/env bash/)

    // Check for essential functions
    expect(content).toContain('check_prerequisites')
    expect(content).toContain('create_service_user')
    expect(content).toContain('install_dependencies')
    expect(content).toContain('build_frontend')
    expect(content).toContain('install_systemd_service')

    // Check for error handling
    expect(content).toContain('set -euo pipefail')
  })

  test('deployment README exists and covers key topics', async () => {
    const readme = Bun.file('deployment/README.md')

    expect(await readme.exists()).toBe(true)

    const content = await readme.text()

    // Check for essential sections
    expect(content).toContain('# Quailcomp Deployment Guide')
    expect(content).toContain('## Prerequisites')
    expect(content).toContain('## Installation')
    expect(content).toContain('## Service Management')
    expect(content).toContain('## Troubleshooting')

    // Check for systemd commands
    expect(content).toContain('systemctl start quailcomp')
    expect(content).toContain('systemctl stop quailcomp')
    expect(content).toContain('systemctl status quailcomp')

    // Check for Nginx configuration
    expect(content).toContain('Nginx')

    // Check for SSL/HTTPS setup
    expect(content).toContain('SSL')
    expect(content).toContain('Let\'s Encrypt')
  })
})

describe('Graceful Shutdown', () => {
  test('test script exists and is executable', async () => {
    const scriptPath = 'scripts/test-shutdown.sh'
    const file = Bun.file(scriptPath)

    expect(await file.exists()).toBe(true)

    // Check if executable
    const stat = await $`stat -f "%Lp" ${scriptPath}`.text()
    const permissions = stat.trim()
    expect(permissions).toMatch(/[1-9]/) // Has execute permission

    const content = await file.text()
    expect(content).toContain('#!/bin/bash')
    expect(content).toContain('graceful shutdown')
  })

  test('server index.ts has signal handlers', async () => {
    const indexFile = await Bun.file('server/src/index.ts').text()

    // Check for signal handlers
    expect(indexFile).toContain('process.on("SIGTERM"')
    expect(indexFile).toContain('process.on("SIGINT"')
    expect(indexFile).toContain('gracefulShutdown')

    // Check for error handlers
    expect(indexFile).toContain('process.on("uncaughtException"')
    expect(indexFile).toContain('process.on("unhandledRejection"')
  })
})

describe('Static File Serving', () => {
  test('test script exists and is executable', async () => {
    const scriptPath = 'scripts/test-static-files.sh'
    const file = Bun.file(scriptPath)

    expect(await file.exists()).toBe(true)

    // Check if executable
    const stat = await $`stat -f "%Lp" ${scriptPath}`.text()
    const permissions = stat.trim()
    expect(permissions).toMatch(/[1-9]/) // Has execute permission

    const content = await file.text()
    expect(content).toContain('#!/bin/bash')
    expect(content).toContain('static file serving')
  })

  test('server.ts has static file serving in production', async () => {
    const serverFile = await Bun.file('server/src/server.ts').text()

    // Check for production mode check
    expect(serverFile).toContain('isProduction')

    // Check for frontend/dist serving
    expect(serverFile).toContain('frontend/dist')

    // Check for SPA fallback
    expect(serverFile).toContain('index.html')

    // Check for non-API route filtering
    expect(serverFile).toContain('/api/')
  })
})
