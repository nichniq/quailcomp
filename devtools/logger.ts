/**
 * Shared logging infrastructure for devtools
 * Broadcasts logs to SSE clients and maintains a circular buffer
 */

export interface LogEntry {
  id: string
  timestamp: number
  level: 'info' | 'warn' | 'error' | 'debug'
  source: string
  message: string
  data?: unknown
}

type LogListener = (entry: LogEntry) => void

class DevLogger {
  private buffer: LogEntry[] = []
  private listeners: Set<LogListener> = new Set()
  private maxBufferSize = 1000
  private idCounter = 0

  /**
   * Log an info message
   */
  info(source: string, message: string, data?: unknown): void {
    this.log('info', source, message, data)
  }

  /**
   * Log a warning message
   */
  warn(source: string, message: string, data?: unknown): void {
    this.log('warn', source, message, data)
  }

  /**
   * Log an error message
   */
  error(source: string, message: string, data?: unknown): void {
    this.log('error', source, message, data)
  }

  /**
   * Log a debug message
   */
  debug(source: string, message: string, data?: unknown): void {
    this.log('debug', source, message, data)
  }

  /**
   * Internal logging method
   */
  private log(
    level: LogEntry['level'],
    source: string,
    message: string,
    data?: unknown
  ): void {
    const entry: LogEntry = {
      id: `log-${++this.idCounter}`,
      timestamp: Date.now(),
      level,
      source,
      message,
      data,
    }

    // Add to circular buffer
    this.buffer.push(entry)
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift()
    }

    // Notify listeners
    this.listeners.forEach((listener) => listener(entry))

    // Also log to console (with color coding in development)
    this.logToConsole(entry)
  }

  /**
   * Log to console with color coding
   */
  private logToConsole(entry: LogEntry): void {
    const timestamp = new Date(entry.timestamp).toISOString()
    const prefix = `[${timestamp}] [${entry.source}]`

    const colors = {
      info: '\x1b[36m', // cyan
      warn: '\x1b[33m', // yellow
      error: '\x1b[31m', // red
      debug: '\x1b[90m', // gray
    }
    const reset = '\x1b[0m'

    const color = colors[entry.level]
    const formattedMessage = `${color}${prefix} ${entry.message}${reset}`

    if (entry.data !== undefined) {
      console[entry.level](formattedMessage, entry.data)
    } else {
      console[entry.level](formattedMessage)
    }
  }

  /**
   * Subscribe to log events
   */
  subscribe(listener: LogListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * Get all buffered log entries
   */
  getBuffer(): LogEntry[] {
    return [...this.buffer]
  }

  /**
   * Clear the log buffer
   */
  clearBuffer(): void {
    this.buffer = []
  }
}

// Singleton instance
export const logger = new DevLogger()
