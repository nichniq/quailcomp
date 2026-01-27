/**
 * Global error handler middleware
 *
 * Catches unhandled errors and returns appropriate HTTP responses.
 */

import type { Middleware } from "./types";

/**
 * Base error class for HTTP errors
 */
export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/**
 * 400 Bad Request
 */
export class BadRequestError extends HttpError {
  constructor(message: string, code?: string) {
    super(400, message, code);
    this.name = "BadRequestError";
  }
}

/**
 * 401 Unauthorized
 */
export class UnauthorizedError extends HttpError {
  constructor(message = "Authentication required", code?: string) {
    super(401, message, code);
    this.name = "UnauthorizedError";
  }
}

/**
 * 403 Forbidden
 */
export class ForbiddenError extends HttpError {
  constructor(message = "Access denied", code?: string) {
    super(403, message, code);
    this.name = "ForbiddenError";
  }
}

/**
 * 404 Not Found
 */
export class NotFoundError extends HttpError {
  constructor(message = "Not found", code?: string) {
    super(404, message, code);
    this.name = "NotFoundError";
  }
}

/**
 * 409 Conflict
 */
export class ConflictError extends HttpError {
  constructor(message: string, code?: string) {
    super(409, message, code);
    this.name = "ConflictError";
  }
}

/**
 * Global error handler middleware
 */
export const errorHandler: Middleware = (next) => async (ctx, req) => {
  try {
    return await next(ctx, req);
  } catch (error) {
    // Handle known HTTP errors
    if (error instanceof HttpError) {
      return Response.json(
        {
          error: error.message,
          code: error.code,
        },
        { status: error.statusCode }
      );
    }

    // Log unexpected errors
    ctx.log.error("Unhandled error", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Return generic 500 for unexpected errors
    return Response.json(
      {
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
};
