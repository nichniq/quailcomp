/**
 * Request logging middleware
 *
 * Logs request start and completion with timing information.
 */

import type { Middleware } from "../middleware/types";

/**
 * Middleware that logs request start and completion
 */
export const requestLogger: Middleware = (next) => async (ctx, req) => {
  const url = new URL(req.url);

  ctx.log.info("Request started", {
    method: req.method,
    path: url.pathname,
    query: url.search || undefined,
    userAgent: req.headers.get("user-agent") || undefined,
  });

  try {
    const response = await next(ctx, req);

    const durationMs = Date.now() - ctx.startTime;
    ctx.log.info("Request completed", {
      method: req.method,
      path: url.pathname,
      status: response.status,
      durationMs,
    });

    return response;
  } catch (error) {
    const durationMs = Date.now() - ctx.startTime;
    ctx.log.error("Request failed", {
      method: req.method,
      path: url.pathname,
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      durationMs,
    });
    throw error;
  }
};
