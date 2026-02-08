/**
 * Request metrics middleware
 *
 * Collects request counts and latency metrics.
 * Also persists HTTP analytics events to the events table.
 */

import type { Middleware } from "@/middleware/types";
import { analytics } from "@/analytics/service";

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
  ctx.observability.metrics.incrementCounter("http_requests_total", 1, labels);

  try {
    const response = await next(ctx, req);

    // Record latency
    const durationMs = Date.now() - ctx.startTime;
    ctx.observability.metrics.recordHistogram(
      "http_request_duration_ms",
      durationMs,
      { ...labels, status: String(response.status) }
    );

    // Count response by status
    ctx.observability.metrics.incrementCounter("http_responses_total", 1, {
      ...labels,
      status: String(response.status),
    });

    // Persist to analytics events table
    await analytics.recordHttpRequest({
      request_id: ctx.requestId,
      method: req.method,
      path: labels.path,
      status_code: response.status,
      duration_ms: durationMs,
      user_id: ctx.user?.userId ?? null,
      user_agent: req.headers.get("user-agent") ?? undefined,
    });

    return response;
  } catch (error) {
    // Count errors
    ctx.observability.metrics.incrementCounter("http_errors_total", 1, labels);

    // Record error details to analytics
    await analytics.recordHttpError({
      request_id: ctx.requestId,
      method: req.method,
      path: labels.path,
      error_message: error instanceof Error ? error.message : String(error),
      error_stack: error instanceof Error ? error.stack : undefined,
      user_id: ctx.user?.userId ?? null,
    });

    throw error;
  }
};
