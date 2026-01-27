/**
 * Request metrics middleware
 *
 * Collects request counts and latency metrics.
 */

import type { Middleware } from "../middleware/types";
import { metrics } from "./collector";

/**
 * Normalize path for metrics (replace IDs with placeholders)
 *
 * /api/entities/123 -> /api/entities/{id}
 */
function normalizePath(pathname: string): string {
  return pathname
    .split("/")
    .map((segment) => {
      // Replace numeric segments with {id}
      if (/^\d+$/.test(segment)) {
        return "{id}";
      }
      // Replace UUID-like segments with {id}
      if (
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          segment
        )
      ) {
        return "{id}";
      }
      return segment;
    })
    .join("/");
}

/**
 * Middleware that collects request metrics
 */
export const requestMetrics: Middleware = (next) => async (ctx, req) => {
  const url = new URL(req.url);
  const labels = {
    method: req.method,
    path: normalizePath(url.pathname),
  };

  // Count incoming request
  metrics.inc("http_requests_total", labels);

  try {
    const response = await next(ctx, req);

    // Record latency
    const durationMs = Date.now() - ctx.startTime;
    metrics.observe(
      "http_request_duration_ms",
      { ...labels, status: String(response.status) },
      durationMs
    );

    // Count response by status
    metrics.inc("http_responses_total", {
      ...labels,
      status: String(response.status),
    });

    return response;
  } catch (error) {
    // Count errors
    metrics.inc("http_errors_total", labels);
    throw error;
  }
};
