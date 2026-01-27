/**
 * Simple path-based router with parameter extraction
 *
 * Supports static paths and path parameters (e.g., /api/entities/:id)
 */

import type { Handler, HttpMethod, Middleware, Route, RouteMatch } from "@/middleware/types";

export class Router {
  private routes: Route[] = [];

  /**
   * Add a route to the router
   */
  add(route: Route): void {
    this.routes.push(route);
  }

  /**
   * Match request to route, extract params
   */
  match(method: string, pathname: string): RouteMatch | null {
    for (const route of this.routes) {
      if (route.method !== method) continue;

      const params = matchPath(route.path, pathname);
      if (params !== null) {
        return { route, params };
      }
    }
    return null;
  }

  // Convenience methods for adding routes

  get(path: string, handler: Handler, middleware?: Middleware[]): void {
    this.add({ method: "GET", path, handler, middleware });
  }

  post(path: string, handler: Handler, middleware?: Middleware[]): void {
    this.add({ method: "POST", path, handler, middleware });
  }

  put(path: string, handler: Handler, middleware?: Middleware[]): void {
    this.add({ method: "PUT", path, handler, middleware });
  }

  patch(path: string, handler: Handler, middleware?: Middleware[]): void {
    this.add({ method: "PATCH", path, handler, middleware });
  }

  delete(path: string, handler: Handler, middleware?: Middleware[]): void {
    this.add({ method: "DELETE", path, handler, middleware });
  }

  options(path: string, handler: Handler, middleware?: Middleware[]): void {
    this.add({ method: "OPTIONS", path, handler, middleware });
  }
}

/**
 * Match a path pattern against a pathname
 *
 * @param pattern - Route pattern (e.g., "/api/entities/:id")
 * @param pathname - Actual URL pathname (e.g., "/api/entities/123")
 * @returns Extracted params or null if no match
 */
function matchPath(
  pattern: string,
  pathname: string
): Record<string, string> | null {
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = pathname.split("/").filter(Boolean);

  if (patternParts.length !== pathParts.length) {
    return null;
  }

  const params: Record<string, string> = {};

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i];
    const pathPart = pathParts[i];

    if (patternPart.startsWith(":")) {
      // Parameter segment - extract value
      const paramName = patternPart.slice(1);
      params[paramName] = decodeURIComponent(pathPart);
    } else if (patternPart !== pathPart) {
      // Static segment doesn't match
      return null;
    }
  }

  return params;
}

/**
 * Create a new router instance
 */
export function createRouter(): Router {
  return new Router();
}
