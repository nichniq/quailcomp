#!/usr/bin/env bun

/**
 * DevTools Storage Setup
 *
 * Creates the .devtools directory and initializes it with empty/default files.
 * This ensures the DevTools UI can function even before tests have been run.
 */

import { join } from 'path'
import { mkdir, writeFile, readFile } from 'fs/promises'
import { existsSync } from 'fs'

const projectRoot = join(import.meta.dir, '../..')
const storageDir = join(projectRoot, '.devtools')
const gitignorePath = join(projectRoot, '.gitignore')

/**
 * Create the .devtools directory
 */
async function createStorageDirectory(): Promise<void> {
  try {
    await mkdir(storageDir, { recursive: true })
    console.log('✓ Created .devtools directory')
  } catch (error) {
    console.log('  .devtools directory already exists')
  }
}

/**
 * Initialize empty test results file
 */
async function initializeTestResults(): Promise<void> {
  const resultsPath = join(storageDir, 'test-results.json')

  if (existsSync(resultsPath)) {
    console.log('  test-results.json already exists')
    return
  }

  const emptyResults = {
    timestamp: Date.now(),
    summary: {
      passed: 0,
      failed: 0,
      skipped: 0,
      total: 0,
    },
    files: [],
  }

  await writeFile(resultsPath, JSON.stringify(emptyResults, null, 2))
  console.log('✓ Initialized test-results.json')
}

/**
 * Add .devtools/ to .gitignore if not already present
 */
async function updateGitignore(): Promise<void> {
  try {
    let gitignoreContent = ''

    if (existsSync(gitignorePath)) {
      gitignoreContent = await readFile(gitignorePath, 'utf-8')
    }

    // Check if .devtools/ is already in .gitignore
    if (gitignoreContent.includes('.devtools/')) {
      console.log('  .devtools/ already in .gitignore')
      return
    }

    // Add .devtools/ to .gitignore
    const updatedContent = gitignoreContent.trim() + '\n\n# DevTools storage\n.devtools/\n'
    await writeFile(gitignorePath, updatedContent)
    console.log('✓ Added .devtools/ to .gitignore')
  } catch (error) {
    console.error('Failed to update .gitignore:', error)
  }
}

/**
 * Main setup function
 */
async function setupStorage(): Promise<void> {
  console.log('Setting up DevTools storage...\n')

  await createStorageDirectory()
  await initializeTestResults()
  await updateGitignore()

  console.log('\n✓ DevTools storage setup complete')
}

// Run setup
setupStorage().catch((error) => {
  console.error('Failed to setup DevTools storage:', error)
  process.exit(1)
})
