#!/usr/bin/env bun
/**
 * Merge LCOV coverage reports from all workspaces
 *
 * Bun generates coverage/lcov.info in each workspace.
 * This script combines them into a single root-level coverage/lcov.info
 * for upload to Codecov.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

const WORKSPACES = [
  'data/client',
  'cli',
  'services/book-metadata',
  '.', // Root level (misc.test.ts)
]

async function mergeCoverage() {
  const coverageDir = 'coverage'
  const outputFile = join(coverageDir, 'lcov.info')

  // Ensure coverage directory exists
  if (!existsSync(coverageDir)) {
    mkdirSync(coverageDir, { recursive: true })
  }

  let mergedContent = ''
  let filesFound = 0

  for (const workspace of WORKSPACES) {
    const lcovPath =
      workspace === '.' ? join(coverageDir, 'lcov.info') : join(workspace, 'coverage', 'lcov.info')

    if (existsSync(lcovPath)) {
      const content = readFileSync(lcovPath, 'utf-8')
      mergedContent += content
      filesFound++
      console.log(`✓ Merged coverage from ${workspace}`)
    } else {
      console.warn(`⚠ No coverage found for ${workspace}`)
    }
  }

  if (filesFound === 0) {
    console.error('❌ No coverage files found')
    process.exit(1)
  }

  // Write merged file
  writeFileSync(outputFile, mergedContent)
  console.log(`\n✅ Merged ${filesFound} coverage reports to ${outputFile}`)
}

mergeCoverage().catch((error) => {
  console.error('❌ Coverage merge failed:', error)
  process.exit(1)
})
