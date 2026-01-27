/**
 * Health check and metrics endpoints
 */

import type { Handler } from "../middleware/types";
import { metrics } from "../metrics/collector";

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
 * GET /metrics - Current metrics snapshot
 */
export const metricsHandler: Handler = async () => {
  const snapshot = metrics.snapshot();
  return Response.json(snapshot);
};
