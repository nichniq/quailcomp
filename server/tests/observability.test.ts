/**
 * Observability features tests
 *
 * Tests Prometheus metrics, request ID tracking, and logging.
 */

import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { createServer, type ServerInstance } from "@/server";
import { metrics } from "@/metrics/collector";

describe("Observability", () => {
  let server: ServerInstance;
  let baseUrl: string;

  beforeAll(() => {
    server = createServer({ port: 0 });
    baseUrl = server.url.toString().replace(/\/$/, "");
  });

  afterAll(() => {
    server.stop();
  });

  test("GET /metrics returns Prometheus text format", async () => {
    const response = await fetch(`${baseUrl}/metrics`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");

    const text = await response.text();

    // Should contain Prometheus format markers
    expect(text).toContain("# HELP");
    expect(text).toContain("# TYPE");

    // Should NOT be JSON
    expect(() => JSON.parse(text)).toThrow();
  });

  test("GET /metrics/json returns JSON format", async () => {
    // Reset metrics for clean test
    metrics.reset();

    // Make a request to generate some metrics
    await fetch(`${baseUrl}/health`);

    const response = await fetch(`${baseUrl}/metrics/json`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");

    const data = await response.json();

    // Should have metrics structure
    expect(data).toHaveProperty("counters");
    expect(data).toHaveProperty("histograms");
    expect(data).toHaveProperty("timestamp");

    // Should have recorded the health check
    expect(Array.isArray(data.counters)).toBe(true);
    expect(data.counters.length).toBeGreaterThan(0);
  });

  test("X-Request-Id header is echoed in response", async () => {
    const requestId = "test-request-id-12345";

    const response = await fetch(`${baseUrl}/health`, {
      headers: {
        "x-request-id": requestId,
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBe(requestId);
  });

  test("X-Request-Id is generated when not provided", async () => {
    const response = await fetch(`${baseUrl}/health`);

    expect(response.status).toBe(200);

    const requestId = response.headers.get("x-request-id");
    expect(requestId).toBeTruthy();
    expect(typeof requestId).toBe("string");
    expect(requestId!.length).toBeGreaterThan(0);
  });

  test("Prometheus metrics track HTTP requests", async () => {
    // Reset metrics
    metrics.reset();

    // Make some requests
    await fetch(`${baseUrl}/health`);
    await fetch(`${baseUrl}/health`);

    // Get metrics in Prometheus format
    const response = await fetch(`${baseUrl}/metrics`);
    const text = await response.text();

    // Should track request counts
    expect(text).toContain("http_requests_total");
    expect(text).toContain("http_responses_total");

    // Should track request duration
    expect(text).toContain("http_request_duration_ms");

    // Should include labels
    expect(text).toContain('method="GET"');
    expect(text).toContain('path="/health"');
    expect(text).toContain('status="200"');
  });
});
