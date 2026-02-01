/**
 * Pino-based logger implementation
 *
 * Provides production-ready logging with:
 * - Pretty printing in development
 * - JSON logging in production
 * - Redaction of sensitive fields
 * - Request ID support
 */

import pino from "pino";
import type { Logger as PinoLogger } from "pino";
import type { Logger, LoggerOptions, LogLevel } from "./logger";

/**
 * Sensitive fields that should be redacted from logs
 */
const REDACTED_FIELDS = [
  "password",
  "token",
  "accessToken",
  "refreshToken",
  "secret",
  "apiKey",
  "authorization",
  "cookie",
];

/**
 * Convert our LogLevel to Pino level
 */
function toPinoLevel(level: LogLevel): pino.Level {
  return level;
}

/**
 * Create the underlying Pino logger instance
 */
function createPinoInstance(level: LogLevel): PinoLogger {
  const isDevelopment = process.env.NODE_ENV !== "production";

  return pino({
    level: toPinoLevel(level),

    // Redact sensitive fields
    redact: {
      paths: REDACTED_FIELDS,
      censor: "[REDACTED]",
    },

    // Pretty print in development, JSON in production
    transport: isDevelopment
      ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss.l",
          ignore: "pid,hostname",
          singleLine: false,
        },
      }
      : undefined,

    // Base configuration
    base: {
      pid: process.pid,
    },

    // Timestamp format
    timestamp: () => `,"time":"${new Date().toISOString()}"`,
  });
}

/**
 * Adapter class that implements our Logger interface using Pino
 */
class PinoLoggerAdapter implements Logger {
  constructor(
    private pinoLogger: PinoLogger,
    private context: Record<string, unknown> = {}
  ) {}

  debug(message: string, data?: Record<string, unknown>): void {
    this.pinoLogger.debug({ ...this.context, ...data }, message);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.pinoLogger.info({ ...this.context, ...data }, message);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.pinoLogger.warn({ ...this.context, ...data }, message);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.pinoLogger.error({ ...this.context, ...data }, message);
  }

  child(context: Record<string, unknown>): Logger {
    const childPino = this.pinoLogger.child(context);
    return new PinoLoggerAdapter(childPino, { ...this.context, ...context });
  }
}

/**
 * Create a new Pino-based logger instance
 */
export function createPinoLogger(options?: LoggerOptions): Logger {
  const level =
    options?.level ?? (process.env.LOG_LEVEL as LogLevel) ?? "info";
  const pinoInstance = createPinoInstance(level);

  // If we have initial context, create a child logger with it
  if (options?.context) {
    const childPino = pinoInstance.child(options.context);
    return new PinoLoggerAdapter(childPino, options.context);
  }

  return new PinoLoggerAdapter(pinoInstance);
}
