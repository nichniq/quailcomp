/**
 * Type definitions for the DevTools watch system
 */

export interface WatchRule {
  name: string // "type-generation"
  description: string // "Extract types from domain docs"
  watch: string[] // ["domains/**/*.md"]
  run: WatchTask // Function or command string
  debounce?: number // ms (default: 300)
  runOnStart?: boolean // Run immediately (default: false)
}

export type WatchTask =
  | string // Shell command
  | ((changed: string[]) => Promise<TaskResult>) // Function

export interface TaskResult {
  success: boolean
  stdout: string
  stderr: string
  duration: number // ms
  error?: Error
}

export interface TaskExecution {
  ruleName: string
  timestamp: number
  duration: number
  status: 'success' | 'error' | 'warning'
  stdout: string
  stderr: string
  changedFiles: string[]
}

export interface WatcherState {
  rules: WatchRule[]
  executions: TaskExecution[] // Last 100 executions (circular buffer)
  currentlyRunning: Set<string> // Rule names
}

// Maintain circular buffer of executions (max 100)
export const MAX_EXECUTIONS = 100
