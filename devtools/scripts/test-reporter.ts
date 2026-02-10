#!/usr/bin/env bun

/**
 * Test Results Reporter
 *
 * Runs all test suites and aggregates results into a JSON file for the DevTools UI.
 * Parses test output from both Bun test and Vitest to extract pass/fail/skip counts.
 */

import { join } from 'path'
import { mkdir, writeFile } from 'fs/promises'

interface TestFileResult {
  file: string
  passed: number
  failed: number
  skipped: number
  total: number
}

interface TestResults {
  timestamp: number
  summary: {
    passed: number
    failed: number
    skipped: number
    total: number
  }
  files: TestFileResult[]
}

interface TestSuite {
  name: string
  command: string[]
  cwd?: string
}

const projectRoot = join(import.meta.dir, '../..')
const storageDir = join(projectRoot, '.devtools')
const resultsPath = join(storageDir, 'test-results.json')

/**
 * Parse Bun test output to extract test counts
 */
function parseBunTestOutput(output: string): { passed: number; failed: number; skipped: number } {
  let passed = 0
  let failed = 0
  let skipped = 0

  // Bun test summary format: "13 pass", "2 fail", "1 skip"
  const passMatch = output.match(/(\d+)\s+pass/i)
  const failMatch = output.match(/(\d+)\s+fail/i)
  const skipMatch = output.match(/(\d+)\s+skip/i)

  if (passMatch) passed = parseInt(passMatch[1], 10)
  if (failMatch) failed = parseInt(failMatch[1], 10)
  if (skipMatch) skipped = parseInt(skipMatch[1], 10)

  return { passed, failed, skipped }
}

/**
 * Parse Vitest output to extract test counts
 */
function parseVitestOutput(output: string): { passed: number; failed: number; skipped: number } {
  let passed = 0
  let failed = 0
  let skipped = 0

  // Vitest summary format: "Tests  45 passed (45)", "2 failed", "1 skipped"
  const passMatch = output.match(/Tests\s+(\d+)\s+passed/i)
  const failMatch = output.match(/(\d+)\s+failed/i)
  const skipMatch = output.match(/(\d+)\s+skipped/i)

  if (passMatch) passed = parseInt(passMatch[1], 10)
  if (failMatch) failed = parseInt(failMatch[1], 10)
  if (skipMatch) skipped = parseInt(skipMatch[1], 10)

  return { passed, failed, skipped }
}

/**
 * Run a test suite and capture results
 */
async function runTestSuite(suite: TestSuite): Promise<TestFileResult | null> {
  try {
    console.log(`Running ${suite.name} tests...`)

    const proc = Bun.spawn(suite.command, {
      cwd: suite.cwd || projectRoot,
      stdout: 'pipe',
      stderr: 'pipe',
    })

    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const output = stdout + stderr

    await proc.exited

    // Determine which parser to use based on output
    let counts: { passed: number; failed: number; skipped: number }
    if (output.includes('vitest') || output.includes('Vitest')) {
      counts = parseVitestOutput(output)
    } else {
      counts = parseBunTestOutput(output)
    }

    const total = counts.passed + counts.failed + counts.skipped

    console.log(`  ${suite.name}: ${counts.passed} passed, ${counts.failed} failed, ${counts.skipped} skipped`)

    return {
      file: suite.name,
      passed: counts.passed,
      failed: counts.failed,
      skipped: counts.skipped,
      total,
    }
  } catch (error) {
    console.error(`  ${suite.name}: Failed to run tests - ${error}`)
    return null
  }
}

/**
 * Main function to run all tests and generate report
 */
async function generateTestReport(): Promise<void> {
  console.log('Generating test results report...\n')

  // Ensure storage directory exists
  try {
    await mkdir(storageDir, { recursive: true })
  } catch {
    // Directory already exists, that's fine
  }

  // Define test suites to run
  const testSuites: TestSuite[] = [
    {
      name: 'data/client',
      command: ['bun', 'test'],
      cwd: join(projectRoot, 'data/client'),
    },
    {
      name: 'server',
      command: ['bun', 'test'],
      cwd: join(projectRoot, 'server'),
    },
    {
      name: 'cli',
      command: ['bun', 'test'],
      cwd: join(projectRoot, 'cli'),
    },
    {
      name: 'frontend',
      command: ['bun', 'run', 'test'],
      cwd: join(projectRoot, 'frontend'),
    },
  ]

  // Run all test suites
  const results: TestFileResult[] = []
  for (const suite of testSuites) {
    const result = await runTestSuite(suite)
    if (result) {
      results.push(result)
    }
  }

  // Calculate summary
  const summary = {
    passed: results.reduce((sum, r) => sum + r.passed, 0),
    failed: results.reduce((sum, r) => sum + r.failed, 0),
    skipped: results.reduce((sum, r) => sum + r.skipped, 0),
    total: results.reduce((sum, r) => sum + r.total, 0),
  }

  // Create final results object
  const testResults: TestResults = {
    timestamp: Date.now(),
    summary,
    files: results,
  }

  // Write to file
  await writeFile(resultsPath, JSON.stringify(testResults, null, 2))

  console.log(`\n✓ Test results written to ${resultsPath}`)
  console.log(`  Total: ${summary.passed} passed, ${summary.failed} failed, ${summary.skipped} skipped`)

  // Exit with error code if tests failed
  if (summary.failed > 0) {
    process.exit(1)
  }
}

// Run the reporter
generateTestReport().catch((error) => {
  console.error('Failed to generate test report:', error)
  process.exit(1)
})
