#!/usr/bin/env bun

/**
 * Generate test specifications from test files
 *
 * Extracts test structure (describe blocks, test cases) from *.test.ts files
 * and generates readable markdown specifications.
 *
 * Uses content hashing to prevent infinite watch loops.
 */

import { readdir, readFile, writeFile, stat } from 'fs/promises'
import { join, basename, relative, dirname } from 'path'
import { createHash } from 'crypto'
import type { TaskResult } from '../types'

const PROJECT_ROOT = join(import.meta.dir, '../../..')
const CACHE_FILE = join(PROJECT_ROOT, '.test-specs-cache.json')
const SPEC_FILE = join(PROJECT_ROOT, 'TEST_SPECIFICATIONS.md')

interface SpecCacheEntry {
  testFileHash: string
  generatedMarkdown: string
  lastGenerated: number
}

type SpecCache = Record<string, SpecCacheEntry>

interface TestBlock {
  type: 'describe' | 'test'
  name: string
  indentLevel: number
  lineNumber: number
}

/**
 * Calculate SHA-256 hash of file content
 */
function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

/**
 * Load cache from disk
 */
async function loadCache(): Promise<SpecCache> {
  try {
    const content = await readFile(CACHE_FILE, 'utf-8')
    return JSON.parse(content)
  } catch {
    return {}
  }
}

/**
 * Save cache to disk
 */
async function saveCache(cache: SpecCache): Promise<void> {
  await writeFile(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8')
}

/**
 * Parse test file structure to extract describe blocks and test cases
 */
function parseTestStructure(content: string): TestBlock[] {
  const lines = content.split('\n')
  const blocks: TestBlock[] = []

  const COMMENT_PATTERN = /^\s*(\/\/|\/\*|\*)/
  const DESCRIBE_PATTERN = /^\s*describe\s*\(\s*["'`]([^"'`]+)["'`]/
  const TEST_PATTERN = /^\s*(test|it)\s*\(\s*["'`]([^"'`]+)["'`]/

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Skip comments
    if (COMMENT_PATTERN.test(line)) continue

    // Get indent level (spaces/tabs)
    const indent = line.match(/^(\s*)/)
    const indentLevel = indent ? indent[1].length : 0

    // Try to match describe
    const describeMatch = line.match(DESCRIBE_PATTERN)
    if (describeMatch) {
      blocks.push({
        type: 'describe',
        name: describeMatch[1],
        indentLevel,
        lineNumber: i + 1,
      })
      continue
    }

    // Try to match test/it
    const testMatch = line.match(TEST_PATTERN)
    if (testMatch) {
      blocks.push({
        type: 'test',
        name: testMatch[2],
        indentLevel,
        lineNumber: i + 1,
      })
    }
  }

  return blocks
}

/**
 * Generate markdown specification from test blocks
 */
function generateMarkdown(testFile: string, blocks: TestBlock[]): string {
  const fileName = basename(testFile, '.test.ts')
  const relativePath = relative(PROJECT_ROOT, testFile)
  const today = new Date().toISOString().split('T')[0]

  let md = `# Test Specification: ${fileName}\n\n`
  md += `**Source:** \`${relativePath}\`\n`
  md += `**Generated:** ${today}\n\n`
  md += `## Test Structure\n\n`

  if (blocks.length === 0) {
    md += '*No test blocks found*\n'
    return md
  }

  let currentDescribe: string | null = null
  let currentDescribeIndent = 0
  let hasUncategorizedHeader = false

  // Track describe nesting stack
  const describeStack: Array<{ name: string; indent: number; level: number }> = []

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]

    if (block.type === 'describe') {
      // Pop describes from stack that are at same or higher indent level
      while (describeStack.length > 0 && describeStack[describeStack.length - 1].indent >= block.indentLevel) {
        describeStack.pop()
      }

      // Push new describe to stack
      const level = describeStack.length + 3 // Start at h3 (###)
      describeStack.push({ name: block.name, indent: block.indentLevel, level })

      // Generate heading
      const headingLevel = Math.min(level, 6) // Max h6
      md += `\n${'#'.repeat(headingLevel)} ${block.name}\n\n`
      currentDescribe = block.name
      currentDescribeIndent = block.indentLevel
    } else if (block.type === 'test') {
      // Pop describes from stack that are at higher or equal indent level
      while (describeStack.length > 0 && describeStack[describeStack.length - 1].indent >= block.indentLevel) {
        describeStack.pop()
      }

      // Check if test is inside a describe or standalone
      if (describeStack.length === 0) {
        // Standalone test (no describe block)
        if (!hasUncategorizedHeader) {
          md += '\n### Uncategorized Tests\n\n'
          hasUncategorizedHeader = true
        }
        md += `- ${block.name}\n`
      } else {
        // Test inside describe block
        // Calculate indentation based on nesting depth
        const nestingDepth = describeStack.length - 1
        const indent = '  '.repeat(nestingDepth)
        md += `${indent}- ${block.name}\n`
      }
    }
  }

  return md
}

/**
 * Process a single test file
 */
async function processTestFile(
  testFilePath: string,
  cache: SpecCache
): Promise<{ changed: boolean; markdown: string }> {
  // Read test file
  const testContent = await readFile(testFilePath, 'utf-8')
  const currentHash = hashContent(testContent)

  // Check cache
  const cached = cache[testFilePath]
  if (cached && cached.testFileHash === currentHash) {
    // Test file unchanged, use cached markdown
    return { changed: false, markdown: cached.generatedMarkdown }
  }

  // Parse and generate new markdown
  const blocks = parseTestStructure(testContent)
  const markdown = generateMarkdown(testFilePath, blocks)

  // Update cache
  cache[testFilePath] = {
    testFileHash: currentHash,
    generatedMarkdown: markdown,
    lastGenerated: Date.now(),
  }

  return { changed: true, markdown }
}

/**
 * Group test files by directory for organized output
 */
function groupTestFilesByDirectory(testFiles: string[]): Record<string, string[]> {
  const groups: Record<string, string[]> = {}

  for (const file of testFiles) {
    const relativePath = relative(PROJECT_ROOT, file)
    const dir = dirname(relativePath)

    if (!groups[dir]) {
      groups[dir] = []
    }
    groups[dir].push(file)
  }

  return groups
}

/**
 * Generate combined spec file from all test files
 */
function generateCombinedSpec(testFileSpecs: Map<string, string>): string {
  const today = new Date().toISOString().split('T')[0]

  let md = `# Test Specifications\n\n`
  md += `**Generated:** ${today}\n`
  md += `**Total Test Files:** ${testFileSpecs.size}\n\n`
  md += `This document contains specifications extracted from all test files in the project.\n\n`
  md += `---\n\n`

  // Group specs by directory
  const testFiles = Array.from(testFileSpecs.keys())
  const groups = groupTestFilesByDirectory(testFiles)
  const sortedDirs = Object.keys(groups).sort()

  for (const dir of sortedDirs) {
    const files = groups[dir].sort()

    // Add directory header
    md += `## ${dir}\n\n`

    for (const file of files) {
      const spec = testFileSpecs.get(file)
      if (spec) {
        // Add the spec content (remove the top-level heading since we group by directory)
        const specLines = spec.split('\n')
        let inContent = false

        for (const line of specLines) {
          // Skip the main title and initial metadata
          if (line.startsWith('# Test Specification:')) {
            const fileName = basename(file, '.test.ts')
            md += `### ${fileName}\n\n`
            continue
          }
          if (line.startsWith('**Source:**') || line.startsWith('**Generated:**')) {
            if (line.startsWith('**Source:**')) {
              md += `${line}\n\n`
            }
            continue
          }
          if (line.startsWith('## Test Structure')) {
            inContent = true
            continue
          }

          if (inContent) {
            // Adjust heading levels and fix indentation
            if (line.startsWith('######')) {
              // h6 -> h4 (max nesting)
              md += `${line.substring(2)}\n`
            } else if (line.startsWith('#####')) {
              // h5 -> h4 (flatten deep nesting)
              md += `${line.substring(1)}\n`
            } else if (line.startsWith('####')) {
              // h4 stays h4
              md += `${line}\n`
            } else if (line.startsWith('###')) {
              // h3 -> h4
              md += `#${line}\n`
            } else if (line.trim().startsWith('- ')) {
              // Remove leading spaces from nested list items
              md += `${line.trimStart()}\n`
            } else {
              md += `${line}\n`
            }
          }
        }

        md += `\n---\n\n`
      }
    }
  }

  return md
}

/**
 * Write combined spec file only if content has changed
 * Returns true if file was written, false if skipped
 */
async function writeCombinedSpecFile(newContent: string): Promise<boolean> {
  // Read existing spec if it exists
  let existingContent = ''
  try {
    existingContent = await readFile(SPEC_FILE, 'utf-8')
  } catch {
    // File doesn't exist, will create
  }

  // Only write if content actually changed
  if (existingContent === newContent) {
    return false // No write needed
  }

  await writeFile(SPEC_FILE, newContent, 'utf-8')
  return true // File written
}

/**
 * Recursively find all .test.ts files
 */
async function findAllTestFiles(dir: string = PROJECT_ROOT, depth = 0): Promise<string[]> {
  if (depth > 10) return [] // Safety limit

  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)

    // Skip ignored directories
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'coverage') {
        continue
      }
      // Recurse into subdirectories
      const subFiles = await findAllTestFiles(fullPath, depth + 1)
      files.push(...subFiles)
    } else if (entry.isFile() && entry.name.endsWith('.test.ts')) {
      files.push(fullPath)
    }
  }

  return files
}

/**
 * Main task function (integrates with watch system)
 * @param changed - Array of changed file paths. If empty, processes all test files in PROJECT_ROOT.
 */
export async function generateSpecs(changed: string[] = []): Promise<TaskResult> {
  const startTime = Date.now()
  const output: string[] = []
  const errors: string[] = []

  try {
    output.push('📋 Generating test specifications...')

    // Load cache
    const cache = await loadCache()

    // Determine which test files to process
    let testFiles: string[]

    if (changed.length > 0) {
      // Filter to only .test.ts files from changed list
      testFiles = changed.filter((f) => f.endsWith('.test.ts'))

      // Make paths absolute if they're relative
      testFiles = testFiles.map(f => {
        if (!f.startsWith('/')) {
          return join(PROJECT_ROOT, f)
        }
        return f
      })
    } else {
      // No changed files specified - find all test files
      output.push('Finding all test files...')
      testFiles = await findAllTestFiles()
    }

    if (testFiles.length === 0) {
      output.push('⚠ No test files found')
      return {
        success: true,
        stdout: output.join('\n'),
        stderr: '',
        duration: Date.now() - startTime,
      }
    }

    output.push(`Found ${testFiles.length} test file(s)`)

    // Process all test files and collect their specs
    const testFileSpecs = new Map<string, string>()
    let cached = 0
    let processed = 0

    for (const testFile of testFiles) {
      const result = await processTestFile(testFile, cache)
      testFileSpecs.set(testFile, result.markdown)

      if (result.changed) {
        output.push(`  ✓ ${basename(testFile)}: processed`)
        processed++
      } else {
        output.push(`  - ${basename(testFile)}: using cache`)
        cached++
      }
    }

    // Generate combined spec file
    output.push('\nGenerating combined specification file...')
    const combinedSpec = generateCombinedSpec(testFileSpecs)
    const written = await writeCombinedSpecFile(combinedSpec)

    // Save cache
    await saveCache(cache)

    if (written) {
      output.push(`✓ Combined spec file written: TEST_SPECIFICATIONS.md`)
      output.push(`  Processed ${processed} spec(s), ${cached} from cache`)
    } else {
      output.push(`- Combined spec file unchanged`)
      output.push(`  Processed ${processed} spec(s), ${cached} from cache`)
    }

    return {
      success: true,
      stdout: output.join('\n'),
      stderr: '',
      duration: Date.now() - startTime,
    }
  } catch (error) {
    errors.push(`❌ Error generating specs: ${error}`)
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
  const result = await generateSpecs([])
  console.log(result.stdout)
  if (result.stderr) {
    console.error(result.stderr)
  }
  process.exit(result.success ? 0 : 1)
}
