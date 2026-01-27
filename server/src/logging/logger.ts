/**
 * Structured JSON logger
 *
 * Outputs logs as JSON to console for easy parsing and aggregation.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

export interface Logger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;

  /** Create child logger with additional context */
  child(context: Record<string, unknown>): Logger;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export interface LoggerOptions {
  level?: LogLevel;
  context?: Record<string, unknown>;
}

class ConsoleLogger implements Logger {
  private context: Record<string, unknown>;
  private minLevel: number;

  constructor(options: LoggerOptions = {}) {
    this.context = options.context ?? {};
    this.minLevel = LOG_LEVELS[options.level ?? "info"];
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= this.minLevel;
  }

  private log(
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>
  ): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...this.context,
      ...data,
    };

    // Output as JSON to console
    const output = JSON.stringify(entry);

    switch (level) {
      case "error":
        console.error(output);
        break;
      case "warn":
        console.warn(output);
        break;
      default:
        console.log(output);
    }
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log("debug", message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log("info", message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log("warn", message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.log("error", message, data);
  }

  child(context: Record<string, unknown>): Logger {
    return new ConsoleLogger({
      level: Object.entries(LOG_LEVELS).find(
        ([, v]) => v === this.minLevel
      )?.[0] as LogLevel,
      context: { ...this.context, ...context },
    });
  }
}

/**
 * Create a new logger instance
 */
export function createLogger(options?: LoggerOptions): Logger {
  const level =
    options?.level ?? (process.env.LOG_LEVEL as LogLevel) ?? "info";
  return new ConsoleLogger({ ...options, level });
}
