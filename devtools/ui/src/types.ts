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

// Log types
export interface LogEntry {
  id: string
  timestamp: number
  level: 'info' | 'warn' | 'error' | 'debug'
  source: string
  message: string
  data?: unknown
}

// Server event types
export interface ServerEvent {
  id: string
  timestamp: number
  type: 'connection' | 'disconnection' | 'message' | 'error'
  endpoint: string
  clientCount?: number
  payload?: unknown
  message?: string
}

// API Key types
export interface ApiKey {
  id: string
  name: string
  keyPreview: string // Last 4 characters
  createdAt: number
  lastUsedAt?: number
  permissions: string[]
  isActive: boolean
}

export interface ApiKeyCreateRequest {
  name: string
  permissions: string[]
}

export interface ApiKeyCreateResponse {
  id: string
  key: string // Full key only shown once
  name: string
  createdAt: number
  permissions: string[]
}

// Test result types
export interface TestFileResult {
  file: string
  passed: number
  failed: number
  skipped: number
  total: number
}

export interface TestResults {
  timestamp: number
  summary: {
    passed: number
    failed: number
    skipped: number
    total: number
  }
  files: TestFileResult[]
}
