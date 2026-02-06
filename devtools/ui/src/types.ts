/**
 * Type definitions for DevTools UI
 * Mirrors the types from the watch system
 */

export interface WatchRule {
  name: string
  description: string
  watch: string[]
  debounce?: number
  runOnStart?: boolean
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
  executions: TaskExecution[]
  currentlyRunning: Set<string>
}

// API response type (Set is serialized as Array)
export interface WatcherStateResponse {
  rules: WatchRule[]
  executions: TaskExecution[]
  currentlyRunning: string[]
}
