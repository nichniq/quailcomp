#!/usr/bin/env bun
/**
 * Generate coverage report with threshold enforcement
 *
 * Parses merged LCOV file and:
 * 1. Displays coverage summary to terminal
 * 2. Checks against 90% threshold
 * 3. Exits with code 1 if below threshold
 */

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const THRESHOLD = 90 // 90% minimum coverage

interface CoverageStats {
  linesFound: number
  linesHit: number
  functionsFound: number
  functionsHit: number
  files: Map<string, { linesFound: number; linesHit: number }>
}

function parseLcov(content: string): CoverageStats {
  const lines = content.split('\n')
  const stats: CoverageStats = {
    linesFound: 0,
    linesHit: 0,
    functionsFound: 0,
    functionsHit: 0,
    files: new Map(),
  }

  let currentFile = ''

  for (const line of lines) {
    if (line.startsWith('SF:')) {
      currentFile = line.substring(3)
      stats.files.set(currentFile, { linesFound: 0, linesHit: 0 })
    } else if (line.startsWith('LF:')) {
      const count = parseInt(line.substring(3))
      stats.linesFound += count
      if (currentFile) {
        stats.files.get(currentFile)!.linesFound += count
      }
    } else if (line.startsWith('LH:')) {
      const count = parseInt(line.substring(3))
      stats.linesHit += count
      if (currentFile) {
        stats.files.get(currentFile)!.linesHit += count
      }
    } else if (line.startsWith('FNF:')) {
      stats.functionsFound += parseInt(line.substring(4))
    } else if (line.startsWith('FNH:')) {
      stats.functionsHit += parseInt(line.substring(4))
    }
  }

  return stats
}

async function generateReport() {
  const lcovPath = join('coverage', 'lcov.info')

  if (!existsSync(lcovPath)) {
    console.error('❌ No merged coverage file found. Run test:coverage:generate first.')
    process.exit(1)
  }

  const content = readFileSync(lcovPath, 'utf-8')
  const stats = parseLcov(content)

  const linePercentage = stats.linesFound > 0 ? (stats.linesHit / stats.linesFound) * 100 : 0
  const functionPercentage =
    stats.functionsFound > 0 ? (stats.functionsHit / stats.functionsFound) * 100 : 0

  console.log('\n=== Code Coverage Report ===\n')
  console.log(
    `Lines:     ${stats.linesHit}/${stats.linesFound} (${linePercentage.toFixed(2)}%)`
  )
  console.log(
    `Functions: ${stats.functionsHit}/${stats.functionsFound} (${functionPercentage.toFixed(2)}%)`
  )
  console.log(`Files:     ${stats.files.size}`)

  console.log('\n--- Coverage by File ---\n')

  // Sort files by coverage percentage (lowest first)
  const sortedFiles = Array.from(stats.files.entries())
    .map(([file, data]) => ({
      file,
      percentage: data.linesFound > 0 ? (data.linesHit / data.linesFound) * 100 : 0,
      ...data,
    }))
    .sort((a, b) => a.percentage - b.percentage)

  for (const { file, percentage } of sortedFiles) {
    const status = percentage >= THRESHOLD ? '✓' : '✗'
    console.log(`${status} ${file}: ${percentage.toFixed(2)}%`)
  }

  console.log('\n============================\n')

  // Check thresholds
  const lineFails = linePercentage < THRESHOLD
  const functionFails = functionPercentage < THRESHOLD

  if (lineFails || functionFails) {
    console.error(`❌ Coverage below ${THRESHOLD}% threshold:`)
    if (lineFails) {
      console.error(`   Lines: ${linePercentage.toFixed(2)}% (required: ${THRESHOLD}%)`)
    }
    if (functionFails) {
      console.error(`   Functions: ${functionPercentage.toFixed(2)}% (required: ${THRESHOLD}%)`)
    }
    process.exit(1)
  }

  console.log(`✅ Coverage meets ${THRESHOLD}% threshold`)
}

generateReport().catch((error) => {
  console.error('❌ Coverage report failed:', error)
  process.exit(1)
})
