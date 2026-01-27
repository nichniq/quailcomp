/**
 * Core types for the middleware system
 */

import type { RequestContext } from "@/context";

/**
 * Handler receives context and request, returns Response
 */
export type Handler = (
  ctx: RequestContext,
  req: Request
) => Promise<Response> | Response;

/**
 * Middleware wraps a handler, can short-circuit or augment context
 */
export type Middleware = (next: Handler) => Handler;

/**
 * HTTP methods supported by the router
 */
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS";

/**
 * Route definition
 */
export interface Route {
  method: HttpMethod;
  path: string;
  handler: Handler;
  middleware?: Middleware[];
}

/**
 * Route match result with extracted parameters
 */
export interface RouteMatch {
  route: Route;
  params: Record<string, string>;
}
