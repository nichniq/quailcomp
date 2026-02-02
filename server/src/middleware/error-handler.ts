/**
 * Global error handler middleware
 *
 * Catches unhandled errors and returns appropriate HTTP responses.
 */

import { captureError } from "@/observability/sentry";
import type { Middleware } from "@/middleware/types";
import type {
  ErrorResponse,
  ValidationErrorDetail,
} from "@/middleware/error-types";

/**
 * Base error class for HTTP errors
 */
export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/**
 * 400 Bad Request
 */
export class BadRequestError extends HttpError {
  constructor(message: string, code?: string, details?: Record<string, unknown>) {
    super(400, message, code, details);
    this.name = "BadRequestError";
  }
}

/**
 * 400 Bad Request - Validation Error
 */
export class ValidationError extends BadRequestError {
  constructor(message: string, public fields: ValidationErrorDetail[]) {
    super(message, "VALIDATION_ERROR", { fields });
    this.name = "ValidationError";
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
  constructor(message: string, code?: string, details?: Record<string, unknown>) {
    super(409, message, code, details);
    this.name = "ConflictError";
  }
}

/**
 * 500 Internal Server Error
 */
export class InternalServerError extends HttpError {
  constructor(
    message = "Internal server error",
    code = "INTERNAL_ERROR",
    details?: Record<string, unknown>
  ) {
    super(500, message, code, details);
    this.name = "InternalServerError";
  }
}

/**
 * Get default error code for HTTP status code
 */
function getDefaultCode(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return "BAD_REQUEST";
    case 401:
      return "UNAUTHORIZED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 500:
      return "INTERNAL_ERROR";
    default:
      return "UNKNOWN_ERROR";
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
      const response: ErrorResponse = {
        error: error.message,
        code: error.code || getDefaultCode(error.statusCode),
        path: new URL(req.url).pathname,
        requestId: ctx.requestId,
      };

      // Add details if present
      if (error.details) {
        response.details = error.details;
      }

      return Response.json(response, { status: error.statusCode });
    }

    // Log unexpected errors
    ctx.log.error("Unhandled error", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Capture error in Sentry (for unexpected errors only)
    if (error instanceof Error) {
      captureError(error, {
        tags: {
          requestId: ctx.requestId,
        },
        extra: {
          path: req.url,
          method: req.method,
        },
        user: ctx.user
          ? {
            id: ctx.user.userId.toString(),
            email: ctx.user.email,
            username: ctx.user.username ?? undefined,
          }
          : undefined,
      });
    }

    // Return generic 500 for unexpected errors
    const response: ErrorResponse = {
      error: "Internal server error",
      code: "INTERNAL_ERROR",
      path: new URL(req.url).pathname,
      requestId: ctx.requestId,
    };

    return Response.json(response, { status: 500 });
  }
};
