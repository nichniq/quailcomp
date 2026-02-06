/**
 * Task execution engine for the DevTools watch system
 *
 * Handles executing shell commands or functions, capturing output,
 * tracking execution time, and emitting events for UI updates.
 */

import { $ } from 'bun'
import type { WatchRule, TaskResult, TaskExecution } from './types'

export type TaskExecutor = {
  execute: (rule: WatchRule, changedFiles: string[]) => Promise<void>
  getHistory: () => TaskExecution[]
  clearHistory: () => void
}

export interface TaskExecutorCallbacks {
  onExecutionStart: (ruleName: string) => void
  onExecutionEnd: (execution: TaskExecution) => void
}

/**
 * Execute a watch task (function or shell command)
 */
async function executeTask(rule: WatchRule, changedFiles: string[]): Promise<TaskResult> {
  const startTime = Date.now()

  try {
    if (typeof rule.run === 'function') {
      // Execute function
      return await rule.run(changedFiles)
    } else {
      // Execute shell command
      const result = await $`${rule.run}`.nothrow().quiet()

      return {
        success: result.exitCode === 0,
        stdout: result.stdout.toString(),
        stderr: result.stderr.toString(),
        duration: Date.now() - startTime,
      }
    }
  } catch (error) {
    return {
      success: false,
      stdout: '',
      stderr: `Error executing task: ${error}`,
      duration: Date.now() - startTime,
      error: error as Error,
    }
  }
}

/**
 * Create a task executor with callbacks
 */
export function createTaskExecutor(callbacks: TaskExecutorCallbacks): TaskExecutor {
  const history: TaskExecution[] = []
  const MAX_HISTORY = 100

  async function execute(rule: WatchRule, changedFiles: string[]): Promise<void> {
    const timestamp = Date.now()

    // Notify start
    callbacks.onExecutionStart(rule.name)

    // Execute task
    const result = await executeTask(rule, changedFiles)

    // Determine status
    let status: 'success' | 'error' | 'warning' = 'success'
    if (!result.success) {
      status = 'error'
    } else if (result.stderr && result.stderr.length > 0) {
      // Has warnings in stderr but succeeded
      status = 'warning'
    }

    // Create execution record
    const execution: TaskExecution = {
      ruleName: rule.name,
      timestamp,
      duration: result.duration,
      status,
      stdout: result.stdout,
      stderr: result.stderr,
      changedFiles,
    }

    // Add to history (circular buffer)
    history.push(execution)
    if (history.length > MAX_HISTORY) {
      history.shift()
    }

    // Notify end
    callbacks.onExecutionEnd(execution)
  }

  function getHistory(): TaskExecution[] {
    return [...history]
  }

  function clearHistory(): void {
    history.length = 0
  }

  return {
    execute,
    getHistory,
    clearHistory,
  }
}
