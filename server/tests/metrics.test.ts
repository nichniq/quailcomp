/**
 * Metrics Test Suite
 *
 * Tests for:
 * - MetricsCollector (counters, histograms, snapshots)
 * - Request metrics middleware (request counting, latency tracking)
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { getConnection } from "@quailcomp/data";
import type { Sql } from "@quailcomp/data";

import {
  createInMemoryMetrics,
  createNoOpTracer,
  createNoOpErrorTracker,
} from "@/observability/adapters";
import { createObservabilityContext } from "@/observability/context";
import type { ObservabilityContext } from "@/observability/context";
import { requestMetrics } from "@/metrics/request-metrics";
import { createContext, type RequestContext } from "@/context";
import type { Handler } from "@/middleware/types";
import type { MetricsRecorder } from "@/observability/metrics";

// Test database setup
let sql: Sql;
let metrics: MetricsRecorder;
let sharedObservability: ObservabilityContext;

beforeAll(async () => {
  sql = getConnection();
});

beforeEach(() => {
  // Create fresh metrics instance before each test
  metrics = createInMemoryMetrics();

  // Create shared observability for middleware tests
  sharedObservability = createObservabilityContext(
    createNoOpTracer(),
    metrics,
    createNoOpErrorTracker()
  );
});

// Test helper
function createMockHandler(responseText: string = "success", status: number = 200): Handler {
  return async (ctx: RequestContext, req: Request) => {
    return new Response(responseText, { status });
  };
}

// =============================================================================
// MetricsCollector Tests
// =============================================================================

describe("MetricsCollector", () => {
  test("inc() creates new counter", () => {
    metrics.incrementCounter("test_counter");

    const snapshot = metrics.snapshot();
    expect(snapshot.counters.length).toBe(1);
    expect(snapshot.counters[0].name).toBe("test_counter");
    expect(snapshot.counters[0].value).toBe(1);
  });

  test("inc() increments existing counter", () => {
    metrics.incrementCounter("test_counter");
    metrics.incrementCounter("test_counter");
    metrics.incrementCounter("test_counter");

    const snapshot = metrics.snapshot();
    expect(snapshot.counters.length).toBe(1);
    expect(snapshot.counters[0].value).toBe(3);
  });

  test("inc() can increment by custom value", () => {
    metrics.incrementCounter("test_counter", 5);
    metrics.incrementCounter("test_counter", 3);

    const snapshot = metrics.snapshot();
    expect(snapshot.counters[0].value).toBe(8);
  });

  test("inc() handles labels", () => {
    metrics.incrementCounter("requests", 1, { method: "GET", path: "/api" });
    metrics.incrementCounter("requests", 1, { method: "POST", path: "/api" });

    const snapshot = metrics.snapshot();
    expect(snapshot.counters.length).toBe(2);
  });

  test("inc() groups by same labels", () => {
    metrics.incrementCounter("requests", 1, { method: "GET", path: "/users" });
    metrics.incrementCounter("requests", 1, { method: "GET", path: "/users" });

    const snapshot = metrics.snapshot();
    expect(snapshot.counters.length).toBe(1);
    expect(snapshot.counters[0].value).toBe(2);
  });

  test("observe() records histogram observation", () => {
    metrics.recordHistogram("latency", 150);

    const snapshot = metrics.snapshot();
    expect(snapshot.histograms.length).toBe(1);
    expect(snapshot.histograms[0].name).toBe("latency");
    expect(snapshot.histograms[0].count).toBe(1);
    expect(snapshot.histograms[0].sum).toBe(150);
    expect(snapshot.histograms[0].avg).toBe(150);
  });

  test("observe() calculates average correctly", () => {
    metrics.recordHistogram("latency", 100);
    metrics.recordHistogram("latency", 200);
    metrics.recordHistogram("latency", 300);

    const snapshot = metrics.snapshot();
    expect(snapshot.histograms[0].count).toBe(3);
    expect(snapshot.histograms[0].sum).toBe(600);
    expect(snapshot.histograms[0].avg).toBe(200);
  });

  test("observe() updates histogram buckets", () => {
    metrics.recordHistogram("latency", 25);
    metrics.recordHistogram("latency", 100);
    metrics.recordHistogram("latency", 500);

    const snapshot = metrics.snapshot();
    const buckets = snapshot.histograms[0].buckets;

    // Cumulative buckets
    expect(buckets["25"]).toBe(1); // Only 25ms value
    expect(buckets["100"]).toBe(2); // 25ms and 100ms values
    expect(buckets["500"]).toBe(3); // All values
    expect(buckets["1000"]).toBe(3); // All values under 1000ms
  });

  test("observe() handles same labels", () => {
    metrics.recordHistogram("latency", 100, { endpoint: "/api" });
    metrics.recordHistogram("latency", 200, { endpoint: "/api" });

    const snapshot = metrics.snapshot();
    expect(snapshot.histograms.length).toBe(1);
    expect(snapshot.histograms[0].count).toBe(2);
  });

  test("observe() separates different labels", () => {
    metrics.recordHistogram("latency", 100, { endpoint: "/api" });
    metrics.recordHistogram("latency", 50, { endpoint: "/health" });

    const snapshot = metrics.snapshot();
    expect(snapshot.histograms.length).toBe(2);
  });

  test("snapshot() includes timestamp", () => {
    metrics.incrementCounter("test");

    const snapshot = metrics.snapshot();
    expect(snapshot.timestamp).toBeDefined();
    expect(new Date(snapshot.timestamp)).toBeInstanceOf(Date);
  });

  test("snapshot() returns empty arrays when no metrics", () => {
    const snapshot = metrics.snapshot();

    expect(snapshot.counters).toEqual([]);
    expect(snapshot.histograms).toEqual([]);
  });

  test("reset() clears all metrics", () => {
    metrics.incrementCounter("counter1");
    metrics.incrementCounter("counter2");
    metrics.recordHistogram("histogram1", 100);

    metrics.reset();

    const snapshot = metrics.snapshot();
    expect(snapshot.counters.length).toBe(0);
    expect(snapshot.histograms.length).toBe(0);
  });

  test("labels are sorted for consistent keys", () => {
    metrics.incrementCounter("test", 1, { z: "last", a: "first", m: "middle" });
    metrics.incrementCounter("test", 1, { a: "first", m: "middle", z: "last" });

    const snapshot = metrics.snapshot();
    expect(snapshot.counters.length).toBe(1);
    expect(snapshot.counters[0].value).toBe(2);
  });
});

// =============================================================================
// Request Metrics Middleware Tests
// =============================================================================

describe("requestMetrics middleware", () => {
  test("increments request counter", async () => {
    const request = new Request("http://localhost/api/test");
    const ctx = createContext(request, sql, sharedObservability);
    const handler = createMockHandler();
    const middleware = requestMetrics(handler);

    await middleware(ctx, request);

    const snapshot = metrics.snapshot();
    const requestCounter = snapshot.counters.find(
      (c) => c.name === "http_requests_total"
    );

    expect(requestCounter).toBeDefined();
    expect(requestCounter?.value).toBe(1);
  });

  test("records request with method and path labels", async () => {
    const request = new Request("http://localhost/api/users", {
      method: "POST",
    });
    const ctx = createContext(request, sql, sharedObservability);
    const handler = createMockHandler();
    const middleware = requestMetrics(handler);

    await middleware(ctx, request);

    const snapshot = metrics.snapshot();
    const requestCounter = snapshot.counters.find(
      (c) => c.name === "http_requests_total"
    );

    expect(requestCounter?.labels.method).toBe("POST");
    expect(requestCounter?.labels.path).toBe("/api/users");
  });

  test("records response counter with status", async () => {
    const request = new Request("http://localhost/api/test");
    const ctx = createContext(request, sql, sharedObservability);
    const handler = createMockHandler("created", 201);
    const middleware = requestMetrics(handler);

    await middleware(ctx, request);

    const snapshot = metrics.snapshot();
    const responseCounter = snapshot.counters.find(
      (c) => c.name === "http_responses_total"
    );

    expect(responseCounter).toBeDefined();
    expect(responseCounter?.labels.status).toBe("201");
  });

  test("records request duration histogram", async () => {
    const request = new Request("http://localhost/api/test");
    const ctx = createContext(request, sql, sharedObservability);
    const handler = createMockHandler();
    const middleware = requestMetrics(handler);

    await middleware(ctx, request);

    const snapshot = metrics.snapshot();
    const durationHistogram = snapshot.histograms.find(
      (h) => h.name === "http_request_duration_ms"
    );

    expect(durationHistogram).toBeDefined();
    expect(durationHistogram?.count).toBe(1);
    expect(durationHistogram?.sum).toBeGreaterThanOrEqual(0);
  });

  test("normalizes numeric IDs in path", async () => {
    const request = new Request("http://localhost/api/users/123");
    const ctx = createContext(request, sql, sharedObservability);
    const handler = createMockHandler();
    const middleware = requestMetrics(handler);

    await middleware(ctx, request);

    const snapshot = metrics.snapshot();
    const requestCounter = snapshot.counters.find(
      (c) => c.name === "http_requests_total"
    );

    expect(requestCounter?.labels.path).toBe("/api/users/{id}");
  });

  test("normalizes UUID in path", async () => {
    const request = new Request(
      "http://localhost/api/entities/550e8400-e29b-41d4-a716-446655440000"
    );
    const ctx = createContext(request, sql, sharedObservability);
    const handler = createMockHandler();
    const middleware = requestMetrics(handler);

    await middleware(ctx, request);

    const snapshot = metrics.snapshot();
    const requestCounter = snapshot.counters.find(
      (c) => c.name === "http_requests_total"
    );

    expect(requestCounter?.labels.path).toBe("/api/entities/{id}");
  });

  test("groups requests to same normalized path", async () => {
    const ctx1 = createContext(new Request("http://localhost/api/users/123"), sql, sharedObservability);
    const ctx2 = createContext(new Request("http://localhost/api/users/456"), sql, sharedObservability);
    const handler = createMockHandler();
    const middleware = requestMetrics(handler);

    await middleware(ctx1, new Request("http://localhost/api/users/123"));
    await middleware(ctx2, new Request("http://localhost/api/users/456"));

    const snapshot = metrics.snapshot();
    const requestCounter = snapshot.counters.find(
      (c) => c.name === "http_requests_total" && c.labels.path === "/api/users/{id}"
    );

    expect(requestCounter?.value).toBe(2);
  });

  test("counts errors separately", async () => {
    const request = new Request("http://localhost/api/test");
    const ctx = createContext(request, sql, sharedObservability);
    const handler: Handler = async () => {
      throw new Error("Test error");
    };
    const middleware = requestMetrics(handler);

    try {
      await middleware(ctx, request);
    } catch (error) {
      // Expected to throw
    }

    const snapshot = metrics.snapshot();
    const errorCounter = snapshot.counters.find(
      (c) => c.name === "http_errors_total"
    );

    expect(errorCounter).toBeDefined();
    expect(errorCounter?.value).toBe(1);
  });

  test("re-throws errors after recording", async () => {
    const request = new Request("http://localhost/api/test");
    const ctx = createContext(request, sql, sharedObservability);
    const handler: Handler = async () => {
      throw new Error("Test error");
    };
    const middleware = requestMetrics(handler);

    await expect(middleware(ctx, request)).rejects.toThrow("Test error");
  });

  test("tracks different status codes separately", async () => {
    const ctx1 = createContext(new Request("http://localhost/api/test"), sql, sharedObservability);
    const ctx2 = createContext(new Request("http://localhost/api/test"), sql, sharedObservability);
    const handler200 = createMockHandler("ok", 200);
    const handler404 = createMockHandler("not found", 404);

    await requestMetrics(handler200)(ctx1, new Request("http://localhost/api/test"));
    await requestMetrics(handler404)(ctx2, new Request("http://localhost/api/test"));

    const snapshot = metrics.snapshot();
    const responses = snapshot.counters.filter(
      (c) => c.name === "http_responses_total"
    );

    expect(responses.length).toBe(2);
    expect(responses.some((r) => r.labels.status === "200")).toBe(true);
    expect(responses.some((r) => r.labels.status === "404")).toBe(true);
  });

  test("measures actual request duration", async () => {
    const request = new Request("http://localhost/api/test");
    const ctx = createContext(request, sql, sharedObservability);
    const handler: Handler = async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return new Response("delayed");
    };
    const middleware = requestMetrics(handler);

    await middleware(ctx, request);

    const snapshot = metrics.snapshot();
    const durationHistogram = snapshot.histograms.find(
      (h) => h.name === "http_request_duration_ms"
    );

    expect(durationHistogram?.avg).toBeGreaterThanOrEqual(10);
  });
});
