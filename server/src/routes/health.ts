/**
 * Health check and metrics endpoints
 */

import type { Handler } from "@/middleware/types";
import { prometheusMetricsHandler } from "@/metrics/prometheus";

/**
 * GET /health - Basic health check
 */
export const healthHandler: Handler = async (ctx) => {
  try {
    // Check database connectivity
    await ctx.sql`SELECT 1`;

    return Response.json({
      status: "healthy",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    ctx.log.error("Health check failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return Response.json(
      {
        status: "unhealthy",
        database: "disconnected",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
};

/**
 * GET /metrics - Prometheus metrics (text format)
 */
export const metricsHandler: Handler = async (ctx) => {
  const snapshot = ctx.observability.metrics.snapshot();
  return prometheusMetricsHandler(snapshot);
};

/**
 * GET /metrics/json - Current metrics snapshot (JSON format)
 */
export const metricsJsonHandler: Handler = async (ctx) => {
  const snapshot = ctx.observability.metrics.snapshot();
  return Response.json(snapshot);
};
