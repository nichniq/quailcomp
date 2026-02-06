#!/usr/bin/env bun

/**
 * Main orchestrator for the DevTools watch system
 *
 * Watches files based on rules and executes tasks when changes are detected.
 * Maintains in-memory state for the UI to query.
 */

import { watch } from 'fs'
import { join } from 'node:path'
import { minimatch } from 'minimatch'
import { rules } from './rules'
import { createTaskExecutor } from './runner'
import type { WatcherState, WatchRule, TaskExecution } from './types'

const PROJECT_ROOT = join(import.meta.dir, '../..')

// Global state (exposed for UI server)
export const watcherState: WatcherState = {
  rules,
  executions: [],
  currentlyRunning: new Set(),
}

// Event emitter for broadcasting updates to UI
type StateChangeListener = (state: WatcherState) => void
const stateChangeListeners: StateChangeListener[] = []

export function onStateChange(listener: StateChangeListener): () => void {
  stateChangeListeners.push(listener)
  // Return unsubscribe function
  return () => {
    const index = stateChangeListeners.indexOf(listener)
    if (index > -1) {
      stateChangeListeners.splice(index, 1)
    }
  }
}

function notifyStateChange() {
  for (const listener of stateChangeListeners) {
    listener(watcherState)
  }
}

// Create task executor
const executor = createTaskExecutor({
  onExecutionStart(ruleName) {
    console.log(`\n⏳ [${new Date().toISOString()}] Starting: ${ruleName}`)
    watcherState.currentlyRunning.add(ruleName)
    notifyStateChange()
  },
  onExecutionEnd(execution) {
    const status = execution.status === 'success' ? '✓' : execution.status === 'warning' ? '⚠' : '✗'
    console.log(
      `${status} [${new Date().toISOString()}] ${execution.ruleName} (${execution.duration}ms)`
    )

    if (execution.stdout) {
      console.log(execution.stdout)
    }
    if (execution.stderr) {
      console.error(execution.stderr)
    }

    watcherState.currentlyRunning.delete(execution.ruleName)
    watcherState.executions.push(execution)

    // Keep only last 100 executions
    if (watcherState.executions.length > 100) {
      watcherState.executions.shift()
    }

    notifyStateChange()
  },
})

// Debounce map: rule name -> timeout
const debounceTimers = new Map<string, Timer>()

// Pending changes map: rule name -> Set of changed files
const pendingChanges = new Map<string, Set<string>>()

/**
 * Check if a file path matches a glob pattern
 */
function matchesPattern(filePath: string, pattern: string): boolean {
  // Remove leading ./ if present
  const normalizedPath = filePath.startsWith('./') ? filePath.slice(2) : filePath

  return minimatch(normalizedPath, pattern, {
    dot: true,
    matchBase: false,
  })
}

/**
 * Find rules that match a changed file
 */
function findMatchingRules(filePath: string): WatchRule[] {
  return rules.filter((rule) => {
    return rule.watch.some((pattern) => matchesPattern(filePath, pattern))
  })
}

/**
 * Handle a file change event
 */
function handleFileChange(filePath: string) {
  const matchingRules = findMatchingRules(filePath)

  if (matchingRules.length === 0) {
    return
  }

  console.log(`📝 File changed: ${filePath}`)

  for (const rule of matchingRules) {
    // Add to pending changes
    if (!pendingChanges.has(rule.name)) {
      pendingChanges.set(rule.name, new Set())
    }
    pendingChanges.get(rule.name)!.add(filePath)

    // Clear existing debounce timer
    const existingTimer = debounceTimers.get(rule.name)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // Set new debounce timer
    const debounce = rule.debounce ?? 300
    const timer = setTimeout(() => {
      const changedFiles = Array.from(pendingChanges.get(rule.name) || [])
      pendingChanges.delete(rule.name)
      debounceTimers.delete(rule.name)

      // Execute task (don't wait)
      executor.execute(rule, changedFiles).catch((error) => {
        console.error(`Error executing ${rule.name}:`, error)
      })
    }, debounce)

    debounceTimers.set(rule.name, timer)
  }
}

/**
 * Start watching files
 */
async function startWatcher() {
  console.log('🚀 DevTools Watcher Starting...')
  console.log(`📁 Project root: ${PROJECT_ROOT}`)
  console.log(`📋 Loaded ${rules.length} watch rules:\n`)

  for (const rule of rules) {
    console.log(`  - ${rule.name}`)
    console.log(`    ${rule.description}`)
    console.log(`    Watching: ${rule.watch.join(', ')}`)
    console.log(`    Debounce: ${rule.debounce ?? 300}ms`)
    console.log()
  }

  console.log('👀 Watching for changes...\n')

  // Watch the entire project directory
  const watcher = watch(
    PROJECT_ROOT,
    { recursive: true },
    (eventType, filename) => {
      if (!filename) return

      // Ignore node_modules, .git, and dist directories
      if (
        filename.includes('node_modules') ||
        filename.includes('.git') ||
        filename.includes('/dist/') ||
        filename.includes('/coverage/')
      ) {
        return
      }

      handleFileChange(filename)
    }
  )

  // Handle graceful shutdown
  const shutdown = () => {
    console.log('\n\n🛑 Shutting down watcher...')

    // Clear all debounce timers
    for (const timer of debounceTimers.values()) {
      clearTimeout(timer)
    }
    debounceTimers.clear()
    pendingChanges.clear()

    watcher.close()
    console.log('✓ Watcher stopped')
    process.exit(0)
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

// Manual trigger function (for UI)
export async function triggerRule(ruleName: string): Promise<void> {
  const rule = rules.find((r) => r.name === ruleName)
  if (!rule) {
    throw new Error(`Rule not found: ${ruleName}`)
  }

  console.log(`\n🔄 Manual trigger: ${ruleName}`)
  await executor.execute(rule, [])
}

// Start watcher if run directly
if (import.meta.main) {
  startWatcher().catch((error) => {
    console.error('Failed to start watcher:', error)
    process.exit(1)
  })
}
