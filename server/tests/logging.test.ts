/**
 * Logging Test Suite
 *
 * Tests for:
 * - Logger (structured JSON output, log levels, child loggers)
 * - Request logger middleware (request lifecycle logging)
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from "bun:test";
import { getConnection } from "@quailcomp/data";
import type { Sql } from "@quailcomp/data";

import { createLogger, type Logger } from "@/logging/logger";
import { requestLogger } from "@/logging/request-logger";
import { createContext, type RequestContext } from "@/context";
import type { Handler } from "@/middleware/types";

// Test database setup
let sql: Sql;

beforeAll(async () => {
  sql = getConnection();
});

afterAll(async () => {
  await sql.end();
});

// Console capture utilities
let capturedLogs: Array<{ type: "log" | "warn" | "error"; message: string }> = [];
let originalLog: typeof console.log;
let originalWarn: typeof console.warn;
let originalError: typeof console.error;

function captureConsole() {
  capturedLogs = [];
  originalLog = console.log;
  originalWarn = console.warn;
  originalError = console.error;

  console.log = (message: string) => {
    capturedLogs.push({ type: "log", message });
  };
  console.warn = (message: string) => {
    capturedLogs.push({ type: "warn", message });
  };
  console.error = (message: string) => {
    capturedLogs.push({ type: "error", message });
  };
}

function restoreConsole() {
  console.log = originalLog;
  console.warn = originalWarn;
  console.error = originalError;
}

function getLastLog() {
  return capturedLogs[capturedLogs.length - 1];
}

function parseLogEntry(log: { type: string; message: string }) {
  return JSON.parse(log.message);
}

// =============================================================================
// Logger Tests
// =============================================================================

describe("createLogger", () => {
  beforeEach(captureConsole);
  afterEach(restoreConsole);

  test("creates logger with default info level", () => {
    const logger = createLogger();

    logger.info("test message");

    expect(capturedLogs.length).toBe(1);
    const entry = parseLogEntry(getLastLog());
    expect(entry.level).toBe("info");
    expect(entry.message).toBe("test message");
    expect(entry.timestamp).toBeDefined();
  });

  test("logs debug messages when level is debug", () => {
    const logger = createLogger({ level: "debug" });

    logger.debug("debug message");

    expect(capturedLogs.length).toBe(1);
    const entry = parseLogEntry(getLastLog());
    expect(entry.level).toBe("debug");
    expect(entry.message).toBe("debug message");
  });

  test("does not log debug when level is info", () => {
    const logger = createLogger({ level: "info" });

    logger.debug("should not appear");

    expect(capturedLogs.length).toBe(0);
  });

  test("logs info messages", () => {
    const logger = createLogger();

    logger.info("info message", { userId: 123 });

    expect(capturedLogs.length).toBe(1);
    const entry = parseLogEntry(getLastLog());
    expect(entry.level).toBe("info");
    expect(entry.message).toBe("info message");
    expect(entry.userId).toBe(123);
  });

  test("logs warn messages to console.warn", () => {
    const logger = createLogger();

    logger.warn("warning message");

    expect(capturedLogs.length).toBe(1);
    const log = getLastLog();
    expect(log.type).toBe("warn");
    const entry = parseLogEntry(log);
    expect(entry.level).toBe("warn");
    expect(entry.message).toBe("warning message");
  });

  test("logs error messages to console.error", () => {
    const logger = createLogger();

    logger.error("error message", { code: "ERR_001" });

    expect(capturedLogs.length).toBe(1);
    const log = getLastLog();
    expect(log.type).toBe("error");
    const entry = parseLogEntry(log);
    expect(entry.level).toBe("error");
    expect(entry.message).toBe("error message");
    expect(entry.code).toBe("ERR_001");
  });

  test("includes context in all log entries", () => {
    const logger = createLogger({ context: { requestId: "abc123" } });

    logger.info("message");

    const entry = parseLogEntry(getLastLog());
    expect(entry.requestId).toBe("abc123");
  });

  test("child logger inherits parent context", () => {
    const parent = createLogger({ context: { requestId: "parent123" } });
    const child = parent.child({ userId: 456 });

    child.info("child message");

    const entry = parseLogEntry(getLastLog());
    expect(entry.requestId).toBe("parent123");
    expect(entry.userId).toBe(456);
  });

  test("child logger inherits parent log level", () => {
    const parent = createLogger({ level: "warn" });
    const child = parent.child({ component: "auth" });

    child.info("should not appear");
    child.warn("should appear");

    expect(capturedLogs.length).toBe(1);
    const entry = parseLogEntry(getLastLog());
    expect(entry.level).toBe("warn");
    expect(entry.component).toBe("auth");
  });

  test("outputs valid JSON", () => {
    const logger = createLogger();

    logger.info("test", { nested: { data: "value" } });

    const log = getLastLog();
    expect(() => JSON.parse(log.message)).not.toThrow();
  });

  test("handles special characters in message", () => {
    const logger = createLogger();

    logger.info('Message with "quotes" and newlines\n');

    const entry = parseLogEntry(getLastLog());
    expect(entry.message).toContain("quotes");
  });

  test("merges data with context", () => {
    const logger = createLogger({ context: { service: "api" } });

    logger.info("test", { endpoint: "/users" });

    const entry = parseLogEntry(getLastLog());
    expect(entry.service).toBe("api");
    expect(entry.endpoint).toBe("/users");
  });
});

// =============================================================================
// Request Logger Middleware Tests
// =============================================================================

describe("requestLogger middleware", () => {
  beforeEach(captureConsole);
  afterEach(restoreConsole);

  function createMockHandler(responseText: string = "success"): Handler {
    return async (ctx: RequestContext, req: Request) => {
      return new Response(responseText);
    };
  }

  test("logs request start", async () => {
    const request = new Request("http://localhost/api/test?foo=bar");
    const ctx = createContext(request, sql);
    const handler = createMockHandler();
    const middleware = requestLogger(handler);

    await middleware(ctx, request);

    const startLog = parseLogEntry(capturedLogs[0]);
    expect(startLog.message).toBe("Request started");
    expect(startLog.method).toBe("GET");
    expect(startLog.path).toBe("/api/test");
    expect(startLog.query).toBe("?foo=bar");
  });

  test("logs request completion with timing", async () => {
    const request = new Request("http://localhost/api/test");
    const ctx = createContext(request, sql);
    const handler = createMockHandler();
    const middleware = requestLogger(handler);

    await middleware(ctx, request);

    const completionLog = parseLogEntry(capturedLogs[1]);
    expect(completionLog.message).toBe("Request completed");
    expect(completionLog.status).toBe(200);
    expect(completionLog.durationMs).toBeGreaterThanOrEqual(0);
    expect(completionLog.path).toBe("/api/test");
  });

  test("logs POST request method", async () => {
    const request = new Request("http://localhost/api/test", {
      method: "POST",
    });
    const ctx = createContext(request, sql);
    const handler = createMockHandler();
    const middleware = requestLogger(handler);

    await middleware(ctx, request);

    const startLog = parseLogEntry(capturedLogs[0]);
    expect(startLog.method).toBe("POST");
  });

  test("logs user agent when present", async () => {
    const request = new Request("http://localhost/api/test", {
      headers: {
        "user-agent": "Mozilla/5.0",
      },
    });
    const ctx = createContext(request, sql);
    const handler = createMockHandler();
    const middleware = requestLogger(handler);

    await middleware(ctx, request);

    const startLog = parseLogEntry(capturedLogs[0]);
    expect(startLog.userAgent).toBe("Mozilla/5.0");
  });

  test("omits user agent when not present", async () => {
    const request = new Request("http://localhost/api/test");
    const ctx = createContext(request, sql);
    const handler = createMockHandler();
    const middleware = requestLogger(handler);

    await middleware(ctx, request);

    const startLog = parseLogEntry(capturedLogs[0]);
    expect(startLog.userAgent).toBeUndefined();
  });

  test("logs different status codes", async () => {
    const request = new Request("http://localhost/api/test");
    const ctx = createContext(request, sql);
    const handler: Handler = async () => {
      return new Response("created", { status: 201 });
    };
    const middleware = requestLogger(handler);

    await middleware(ctx, request);

    const completionLog = parseLogEntry(capturedLogs[1]);
    expect(completionLog.status).toBe(201);
  });

  test("logs request failure on error", async () => {
    const request = new Request("http://localhost/api/test");
    const ctx = createContext(request, sql);
    const handler: Handler = async () => {
      throw new Error("Something went wrong");
    };
    const middleware = requestLogger(handler);

    try {
      await middleware(ctx, request);
    } catch (error) {
      // Expected to throw
    }

    const errorLog = parseLogEntry(capturedLogs[1]);
    expect(errorLog.message).toBe("Request failed");
    expect(errorLog.error).toBe("Something went wrong");
    expect(errorLog.stack).toBeDefined();
    expect(errorLog.durationMs).toBeGreaterThanOrEqual(0);
  });

  test("re-throws errors after logging", async () => {
    const request = new Request("http://localhost/api/test");
    const ctx = createContext(request, sql);
    const handler: Handler = async () => {
      throw new Error("Test error");
    };
    const middleware = requestLogger(handler);

    await expect(middleware(ctx, request)).rejects.toThrow("Test error");
  });

  test("omits query string when not present", async () => {
    const request = new Request("http://localhost/api/test");
    const ctx = createContext(request, sql);
    const handler = createMockHandler();
    const middleware = requestLogger(handler);

    await middleware(ctx, request);

    const startLog = parseLogEntry(capturedLogs[0]);
    expect(startLog.query).toBeUndefined();
  });

  test("includes requestId from context", async () => {
    const request = new Request("http://localhost/api/test");
    const ctx = createContext(request, sql);
    const handler = createMockHandler();
    const middleware = requestLogger(handler);

    await middleware(ctx, request);

    const startLog = parseLogEntry(capturedLogs[0]);
    expect(startLog.requestId).toBe(ctx.requestId);

    const completionLog = parseLogEntry(capturedLogs[1]);
    expect(completionLog.requestId).toBe(ctx.requestId);
  });

  test("handles non-Error throws", async () => {
    const request = new Request("http://localhost/api/test");
    const ctx = createContext(request, sql);
    const handler: Handler = async () => {
      throw "string error";
    };
    const middleware = requestLogger(handler);

    try {
      await middleware(ctx, request);
    } catch (error) {
      // Expected to throw
    }

    const errorLog = parseLogEntry(capturedLogs[1]);
    expect(errorLog.message).toBe("Request failed");
    expect(errorLog.error).toBe("Unknown error");
    expect(errorLog.stack).toBeUndefined();
  });
});
