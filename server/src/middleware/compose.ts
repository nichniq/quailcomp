/**
 * Middleware composition utility
 *
 * Composes middleware right-to-left so they execute left-to-right.
 * This allows natural ordering: compose(a, b, c) executes as a -> b -> c -> handler
 */

import type { Handler, Middleware } from "./types";

/**
 * Compose multiple middleware into a single middleware
 *
 * @example
 * const handler = compose(logging, metrics, auth)(finalHandler);
 * // Executes: logging -> metrics -> auth -> finalHandler
 */
export function compose(...middlewares: Middleware[]): Middleware {
  return (handler: Handler): Handler => {
    return middlewares.reduceRight(
      (next, middleware) => middleware(next),
      handler
    );
  };
}

/**
 * Apply middleware to a handler directly
 *
 * @example
 * const wrappedHandler = applyMiddleware(handler, logging, metrics);
 */
export function applyMiddleware(
  handler: Handler,
  ...middlewares: Middleware[]
): Handler {
  return compose(...middlewares)(handler);
}
