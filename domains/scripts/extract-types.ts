#!/usr/bin/env bun

/**
 * Extract TypeScript code blocks from domain markdown files and generate types.ts
 *
 * This script:
 * 1. Scans /domains for .md files (excluding README.md)
 * 2. Extracts all TypeScript code blocks from each file
 * 3. Groups types by domain into namespaces
 * 4. Generates domains/types.ts with all extracted types
 */

import { readdir, readFile, writeFile } from 'fs/promises'
import { join, basename } from 'path'
import { createHash } from 'crypto'

// Allow override for testing, otherwise default to parent of script directory
const DOMAINS_DIR = process.env.DOMAINS_DIR || join(import.meta.dir, '..')
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
 * Extract TypeScript code blocks from markdown content
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
      // Filter to only include exports and their dependencies
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
 * Filter code block to only include exported statements and their dependencies
 * Preserves multi-line exports like interfaces, types, classes, etc.
 * Also includes const/let/var declarations that exported code may depend on.
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

    // Check if this line starts an export or top-level declaration
    const isExport = trimmed.startsWith('export ')
    const isDeclaration = /^(const|let|var|class|function|enum|interface|type)\s+/.test(trimmed)

    if (isExport || (!inStatement && isDeclaration)) {
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
 * This file is automatically generated by domains/scripts/extract-types.ts
 * which extracts TypeScript code blocks from the markdown domain documentation.
 *
 * To make changes:
 * 1. Edit the corresponding .md file in /domains
 * 2. Run: bun run domains/scripts/extract-types.ts
 * 3. Or commit changes - the pre-commit hook will regenerate automatically
 */

`
}

/**
 * Main extraction logic
 */
async function main() {
  try {
    console.log('Loading cache...')
    const cache = await loadCache()

    console.log('Finding domain files...')
    const domainFiles = await findDomainFiles()

    if (domainFiles.length === 0) {
      console.warn('No domain .md files found in /domains')
      process.exit(0)
    }

    console.log(`Found ${domainFiles.length} domain files:`, domainFiles.join(', '))

    // Ensure output directory exists
    const { mkdir } = await import('fs/promises')
    await mkdir(OUTPUT_DIR, { recursive: true })

    const newCache: Cache = {}
    const generatedFiles: string[] = []

    for (const filename of domainFiles) {
      const filePath = join(DOMAINS_DIR, filename)
      const content = await readFile(filePath, 'utf-8')
      const hash = hashContent(content)

      // Check cache
      const cached = cache[filename]
      let extractedTypes: string

      if (cached && cached.hash === hash) {
        console.log(`  ${filename}: using cached extraction`)
        extractedTypes = cached.extracted
      } else {
        console.log(`  ${filename}: extracting types...`)
        extractedTypes = extractTypeScriptBlocks(content)

        if (!extractedTypes) {
          console.warn(`  ${filename}: no TypeScript code blocks found`)
          continue
        }
      }

      const domainName = getDomainName(filename)
      const outputFile = join(OUTPUT_DIR, `${domainName}.ts`)

      // Generate file content
      const output = generateHeader(domainName) + extractedTypes + '\n'

      await writeFile(outputFile, output, 'utf-8')
      generatedFiles.push(outputFile)

      // Update cache
      newCache[filename] = { hash, extracted: extractedTypes }
    }

    if (generatedFiles.length === 0) {
      console.error('No TypeScript code blocks extracted from any domain files')
      process.exit(1)
    }

    console.log(`✓ Generated ${generatedFiles.length} type files in ${OUTPUT_DIR}`)

    console.log('Saving cache...')
    await saveCache(newCache)

    console.log('✓ Done!')
  } catch (error) {
    console.error('Error during extraction:', error)
    process.exit(1)
  }
}

main()
