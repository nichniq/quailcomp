#!/usr/bin/env bun
/**
 * Merge LCOV coverage reports from all workspaces
 *
 * Bun generates coverage/lcov.info in each workspace.
 * This script combines them into a single root-level coverage/lcov.info
 * with normalized paths and deduplication.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, resolve, relative } from 'path'

const WORKSPACES = [
  'data/client',
  'cli',
  'services/book-metadata',
  '.', // Root level (misc.test.ts)
]

interface FunctionInfo {
  lineNumber: number
  functionName: string
  hitCount: number
}

interface CoverageData {
  lines: Map<number, number> // line number -> hit count
  functions: Map<string, FunctionInfo> // function name -> info
  branches: Map<string, number> // branch identifier -> hit count
  functionsFound: number // FNF: total functions
  functionsHit: number // FNH: functions hit
  branchesFound: number // BRF: total branches
  branchesHit: number // BRH: branches hit
}

/**
 * Parse LCOV file into a map of absolute file paths to coverage data
 */
function parseLcov(content: string, workspaceDir: string): Map<string, CoverageData> {
  const projectRoot = process.cwd()
  const coverageMap = new Map<string, CoverageData>()

  let currentFile: string | null = null
  let currentData: CoverageData | null = null

  for (const line of content.split('\n')) {
    if (line.startsWith('SF:')) {
      // Extract source file path
      const filePath = line.substring(3)

      // Normalize path to absolute
      let absolutePath: string
      if (filePath.startsWith('/')) {
        absolutePath = filePath
      } else {
        // Resolve relative to workspace directory
        const workspacePath = workspaceDir === '.' ? projectRoot : join(projectRoot, workspaceDir)
        absolutePath = resolve(workspacePath, filePath)
      }

      currentFile = absolutePath
      currentData = coverageMap.get(currentFile) || {
        lines: new Map(),
        functions: new Map(),
        branches: new Map(),
        functionsFound: 0,
        functionsHit: 0,
        branchesFound: 0,
        branchesHit: 0,
      }
      coverageMap.set(currentFile, currentData)
    } else if (line.startsWith('FN:')) {
      // Function definition: FN:line,functionName
      const match = line.substring(3).match(/^(\d+),(.+)$/)
      if (match && currentData) {
        const lineNumber = Number(match[1])
        const fnName = match[2]
        if (!currentData.functions.has(fnName)) {
          currentData.functions.set(fnName, {
            lineNumber,
            functionName: fnName,
            hitCount: 0,
          })
        }
      }
    } else if (line.startsWith('DA:')) {
      // Line coverage: DA:line,hitCount
      const [lineNum, hitCount] = line.substring(3).split(',').map(Number)
      if (currentData) {
        const existing = currentData.lines.get(lineNum) || 0
        currentData.lines.set(lineNum, existing + hitCount)
      }
    } else if (line.startsWith('FNDA:')) {
      // Function coverage: FNDA:hitCount,functionName
      const match = line.substring(5).match(/^(\d+),(.+)$/)
      if (match && currentData) {
        const hitCount = Number(match[1])
        const fnName = match[2]
        const existing = currentData.functions.get(fnName)
        if (existing) {
          existing.hitCount += hitCount
        } else {
          // Create entry if it doesn't exist (FN: might be missing)
          currentData.functions.set(fnName, {
            lineNumber: 0,
            functionName: fnName,
            hitCount,
          })
        }
      }
    } else if (line.startsWith('BRDA:')) {
      // Branch coverage: BRDA:line,block,branch,hitCount
      if (currentData) {
        const existing = currentData.branches.get(line) || 0
        const hitCount = line.split(',')[3]
        currentData.branches.set(line, existing + (hitCount === '-' ? 0 : Number(hitCount)))
      }
    } else if (line.startsWith('FNF:')) {
      if (currentData) {
        currentData.functionsFound = Number(line.substring(4))
      }
    } else if (line.startsWith('FNH:')) {
      if (currentData) {
        currentData.functionsHit = Number(line.substring(4))
      }
    } else if (line.startsWith('BRF:')) {
      if (currentData) {
        currentData.branchesFound = Number(line.substring(4))
      }
    } else if (line.startsWith('BRH:')) {
      if (currentData) {
        currentData.branchesHit = Number(line.substring(4))
      }
    }
  }

  return coverageMap
}

/**
 * Convert coverage map back to LCOV format with normalized paths
 */
function generateLcov(coverageMap: Map<string, CoverageData>): string {
  const projectRoot = process.cwd()
  let output = ''

  for (const [absolutePath, data] of coverageMap.entries()) {
    // Convert to relative path from project root
    const relativePath = relative(projectRoot, absolutePath)

    output += `SF:${relativePath}\n`

    // Write function definitions first
    for (const fnInfo of data.functions.values()) {
      output += `FN:${fnInfo.lineNumber},${fnInfo.functionName}\n`
    }

    // Write function coverage
    for (const fnInfo of data.functions.values()) {
      output += `FNDA:${fnInfo.hitCount},${fnInfo.functionName}\n`
    }

    // Write function summary (prefer explicit counts over computed)
    if (data.functionsFound > 0) {
      output += `FNF:${data.functionsFound}\n`
      output += `FNH:${data.functionsHit}\n`
    } else if (data.functions.size > 0) {
      output += `FNF:${data.functions.size}\n`
      const fnHit = Array.from(data.functions.values()).filter(f => f.hitCount > 0).length
      output += `FNH:${fnHit}\n`
    }

    // Write branch coverage
    for (const [branchId, hitCount] of data.branches.entries()) {
      output += `${branchId.substring(0, branchId.lastIndexOf(',') + 1)}${hitCount}\n`
    }

    // Write branch summary (prefer explicit counts over computed)
    if (data.branchesFound > 0) {
      output += `BRF:${data.branchesFound}\n`
      output += `BRH:${data.branchesHit}\n`
    } else if (data.branches.size > 0) {
      output += `BRF:${data.branches.size}\n`
      const brHit = Array.from(data.branches.values()).filter(c => c > 0).length
      output += `BRH:${brHit}\n`
    }

    // Write line coverage
    for (const [lineNum, hitCount] of data.lines.entries()) {
      output += `DA:${lineNum},${hitCount}\n`
    }
    if (data.lines.size > 0) {
      output += `LF:${data.lines.size}\n`
      const lnHit = Array.from(data.lines.values()).filter(c => c > 0).length
      output += `LH:${lnHit}\n`
    }

    output += 'end_of_record\n'
  }

  return output
}

async function mergeCoverage() {
  const coverageDir = 'coverage'
  const outputFile = join(coverageDir, 'lcov.info')

  // Ensure coverage directory exists
  if (!existsSync(coverageDir)) {
    mkdirSync(coverageDir, { recursive: true })
  }

  const allCoverage = new Map<string, CoverageData>()
  let filesFound = 0

  for (const workspace of WORKSPACES) {
    const lcovPath =
      workspace === '.' ? join(coverageDir, 'lcov.info') : join(workspace, 'coverage', 'lcov.info')

    if (existsSync(lcovPath)) {
      const content = readFileSync(lcovPath, 'utf-8')
      const workspaceCoverage = parseLcov(content, workspace)

      // Merge into allCoverage
      for (const [file, data] of workspaceCoverage.entries()) {
        if (allCoverage.has(file)) {
          // Merge coverage data for duplicate file
          const existing = allCoverage.get(file)!
          for (const [lineNum, hitCount] of data.lines.entries()) {
            const existingHits = existing.lines.get(lineNum) || 0
            existing.lines.set(lineNum, existingHits + hitCount)
          }
          for (const [fnName, fnInfo] of data.functions.entries()) {
            const existingFn = existing.functions.get(fnName)
            if (existingFn) {
              existingFn.hitCount += fnInfo.hitCount
            } else {
              existing.functions.set(fnName, { ...fnInfo })
            }
          }
          for (const [branchId, hitCount] of data.branches.entries()) {
            const existingHits = existing.branches.get(branchId) || 0
            existing.branches.set(branchId, existingHits + hitCount)
          }
          // Merge summary statistics (take max since they should be the same)
          existing.functionsFound = Math.max(existing.functionsFound, data.functionsFound)
          existing.functionsHit = Math.max(existing.functionsHit, data.functionsHit)
          existing.branchesFound = Math.max(existing.branchesFound, data.branchesFound)
          existing.branchesHit = Math.max(existing.branchesHit, data.branchesHit)
        } else {
          allCoverage.set(file, data)
        }
      }

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

  // Generate merged LCOV with normalized paths
  const mergedContent = generateLcov(allCoverage)
  writeFileSync(outputFile, mergedContent)
  console.log(`\n✅ Merged ${filesFound} coverage reports to ${outputFile}`)
  console.log(`📊 Total unique files: ${allCoverage.size}`)
}

mergeCoverage().catch((error) => {
  console.error('❌ Coverage merge failed:', error)
  process.exit(1)
})
