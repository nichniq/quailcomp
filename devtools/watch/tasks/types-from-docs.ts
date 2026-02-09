/**
 * Extract TypeScript code blocks from domain markdown files and generate types
 *
 * Adapted from domains/scripts/extract-types.ts to work as a watch task
 */

import { readdir, readFile, writeFile, mkdir } from 'fs/promises'
import { join, basename } from 'path'
import { createHash } from 'crypto'
import type { TaskResult } from '../types'

// Project root is 2 levels up from this file
const PROJECT_ROOT = join(import.meta.dir, '../../..')
const DOMAINS_DIR = join(PROJECT_ROOT, 'domains')
const OUTPUT_DIR = join(DOMAINS_DIR, 'types')
const CACHE_FILE = join(DOMAINS_DIR, '.domains-cache.json')

interface CacheEntry {
  hash: string
  extracted: string
}

type Cache = Record<string, CacheEntry>

/**
 * Calculate SHA-256 hash of file content
 */
function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

/**
 * Load cache from disk
 */
async function loadCache(): Promise<Cache> {
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
async function saveCache(cache: Cache): Promise<void> {
  await writeFile(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8')
}

/**
 * Filter code block to only include exported statements
 * Preserves multi-line exports like interfaces, types, classes, etc.
 */
function filterExportedCode(code: string): string {
  const lines = code.split('\n')
  const exportedLines: string[] = []
  let inStatement = false
  let braceDepth = 0
  let parenDepth = 0
  let bracketDepth = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // Check if this line starts an export or import
    const isExport = trimmed.startsWith('export ')
    const isImport = trimmed.startsWith('import ')
    // Skip function declarations (they end with semicolon and have no implementation)
    const isFunctionDeclaration = isExport && /^export\s+function\s+\w+\([^)]*\):[^;{]+;$/.test(trimmed)

    if ((isExport && !isFunctionDeclaration) || isImport) {
      inStatement = true
      exportedLines.push(line)

      // Count opening/closing delimiters
      braceDepth = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length
      parenDepth = (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length
      bracketDepth = (line.match(/\[/g) || []).length - (line.match(/\]/g) || []).length

      // Check if statement definitely ends on this line
      // (semicolon AND all delimiters balanced)
      if (trimmed.endsWith(';') && braceDepth === 0 && parenDepth === 0 && bracketDepth === 0) {
        inStatement = false
      }
      // If all delimiters balanced (no semicolon), check if next line is a continuation
      else if (braceDepth === 0 && parenDepth === 0 && bracketDepth === 0) {
        // Check if next line is a continuation (starts with | or & or ,)
        const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : ''
        if (!nextLine.startsWith('|') && !nextLine.startsWith('&') && !nextLine.startsWith(',')) {
          inStatement = false
        }
      }
      continue
    }

    // If we're inside a multi-line statement, continue collecting lines
    if (inStatement) {
      exportedLines.push(line)

      // Update delimiter depths
      braceDepth += (line.match(/{/g) || []).length - (line.match(/}/g) || []).length
      parenDepth += (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length
      bracketDepth += (line.match(/\[/g) || []).length - (line.match(/\]/g) || []).length

      // Check if statement definitely ends (semicolon AND all delimiters balanced)
      if (trimmed.endsWith(';') && braceDepth === 0 && parenDepth === 0 && bracketDepth === 0) {
        inStatement = false
      }
      // If all delimiters balanced (no semicolon), check if next line is a continuation
      else if (braceDepth === 0 && parenDepth === 0 && bracketDepth === 0) {
        // Check if next line is a continuation (starts with | or & or ,)
        const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : ''
        if (!nextLine.startsWith('|') && !nextLine.startsWith('&') && !nextLine.startsWith(',')) {
          inStatement = false
        }
      }
    }
  }

  return exportedLines.join('\n').trim()
}

/**
 * Extract TypeScript code blocks from markdown content
 * Only extracts blocks that contain exported declarations
 */
function extractTypeScriptBlocks(markdown: string): string {
  const codeBlockRegex = /```typescript\n([\s\S]*?)```/g
  const blocks: string[] = []

  let match
  while ((match = codeBlockRegex.exec(markdown)) !== null) {
    const codeBlock = match[1].trim()
    // Check if this code block has ANY exports
    const hasExports = /^\s*export\s+/m.test(codeBlock)

    if (hasExports) {
      // Filter to only include exports
      const filtered = filterExportedCode(codeBlock)
      if (filtered) {
        blocks.push(filtered)
      }
    }
    // If no exports in this block, skip it entirely (it's example code)
  }

  return blocks.join('\n\n')
}

/**
 * Get domain name from filename (e.g., "books.md" -> "books")
 */
function getDomainName(filename: string): string {
  return basename(filename, '.md')
}

/**
 * Find all .md files in domains directory (excluding README.md)
 */
async function findDomainFiles(): Promise<string[]> {
  const entries = await readdir(DOMAINS_DIR, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md')
    .map((entry) => entry.name)
}

/**
 * Generate the header comment for individual type files
 */
function generateHeader(domainName: string): string {
  return `/**
 * Auto-generated from domains/${domainName}.md
 *
 * DO NOT EDIT THIS FILE DIRECTLY
 *
 * This file is automatically generated by devtools/watch/tasks/types-from-docs.ts
 * which extracts TypeScript code blocks from the markdown domain documentation.
 *
 * To make changes:
 * 1. Edit the corresponding .md file in /domains
 * 2. The devtools watcher will regenerate automatically
 * 3. Or run manually: bun run devtools/watch/tasks/types-from-docs.ts
 */

`
}

/**
 * Main extraction logic (adapted for watch task)
 */
export async function extractTypes(changed: string[]): Promise<TaskResult> {
  const startTime = Date.now()
  const output: string[] = []
  const errors: string[] = []

  try {
    output.push('Loading cache...')
    const cache = await loadCache()

    output.push('Finding domain files...')
    const domainFiles = await findDomainFiles()

    if (domainFiles.length === 0) {
      output.push('⚠ No domain .md files found in /domains')
      return {
        success: true,
        stdout: output.join('\n'),
        stderr: '',
        duration: Date.now() - startTime,
      }
    }

    output.push(`Found ${domainFiles.length} domain files: ${domainFiles.join(', ')}`)

    // Ensure output directory exists
    await mkdir(OUTPUT_DIR, { recursive: true })

    const newCache: Cache = {}
    const generatedFiles: string[] = []
    const processedFiles: string[] = []

    for (const filename of domainFiles) {
      const filePath = join(DOMAINS_DIR, filename)
      const content = await readFile(filePath, 'utf-8')
      const hash = hashContent(content)

      // Check cache
      const cached = cache[filename]
      let extractedTypes: string

      if (cached && cached.hash === hash) {
        output.push(`  ${filename}: using cached extraction`)
        extractedTypes = cached.extracted
      } else {
        output.push(`  ${filename}: extracting types...`)
        extractedTypes = extractTypeScriptBlocks(content)

        if (!extractedTypes) {
          output.push(`  ${filename}: ⚠ no TypeScript code blocks found`)
          continue
        }
      }

      const domainName = getDomainName(filename)
      const outputFile = join(OUTPUT_DIR, `${domainName}.ts`)

      // Generate file content
      const fileContent = generateHeader(domainName) + extractedTypes + '\n'

      // Only write if content has changed (prevents infinite watch loops)
      let existingContent = ''
      try {
        existingContent = await readFile(outputFile, 'utf-8')
      } catch {
        // File doesn't exist yet, will write it
      }

      if (existingContent !== fileContent) {
        await writeFile(outputFile, fileContent, 'utf-8')
        generatedFiles.push(outputFile)
        output.push(`  ${domainName}.ts: written`)
      } else {
        output.push(`  ${domainName}.ts: unchanged, skipped write`)
      }

      processedFiles.push(outputFile)

      // Update cache
      newCache[filename] = { hash, extracted: extractedTypes }
    }

    if (processedFiles.length === 0) {
      errors.push('❌ No TypeScript code blocks extracted from any domain files')
      return {
        success: false,
        stdout: output.join('\n'),
        stderr: errors.join('\n'),
        duration: Date.now() - startTime,
      }
    }

    if (generatedFiles.length > 0) {
      output.push(`✓ Generated ${generatedFiles.length} type file(s) in ${OUTPUT_DIR}`)
    }
    output.push(`✓ Processed ${processedFiles.length} total type file(s) (${processedFiles.length - generatedFiles.length} unchanged)`)

    // Only save cache if it changed (prevents unnecessary file writes and watch triggers)
    const cacheChanged = JSON.stringify(cache) !== JSON.stringify(newCache)
    if (cacheChanged) {
      output.push('Saving cache...')
      await saveCache(newCache)
    } else {
      output.push('Cache unchanged, skipped write')
    }

    output.push('✓ Done!')

    return {
      success: true,
      stdout: output.join('\n'),
      stderr: '',
      duration: Date.now() - startTime,
    }
  } catch (error) {
    errors.push(`❌ Error during extraction: ${error}`)
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
  const result = await extractTypes([])
  console.log(result.stdout)
  if (result.stderr) {
    console.error(result.stderr)
  }
  process.exit(result.success ? 0 : 1)
}
