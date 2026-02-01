/**
 * Request ID middleware
 *
 * Echoes X-Request-Id in response headers for request tracing.
 * The request ID is already extracted/generated in createContext().
 */

import type { Middleware } from "./types";

/**
 * Request ID middleware
 *
 * - Request ID is already in ctx.requestId (set by createContext)
 * - Echoes request ID in response headers for client visibility
 */
export const requestIdMiddleware: Middleware = (next) => async (ctx, req) => {
  // Call next handler
  const response = await next(ctx, req);

  // Echo request ID in response headers
  const headers = new Headers(response.headers);
  headers.set("x-request-id", ctx.requestId);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};
