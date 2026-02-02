/**
 * Error response helper functions
 *
 * These helpers reduce boilerplate in route handlers by providing
 * convenient functions to throw typed HTTP errors.
 */

import {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  type ValidationErrorDetail,
} from "@/middleware/error-handler";

/**
 * Throw a 400 Bad Request error
 */
export function badRequest(
  message: string,
  code?: string,
  details?: Record<string, unknown>
): never {
  throw new BadRequestError(message, code, details);
}

/**
 * Throw a 401 Unauthorized error
 */
export function unauthorized(
  message = "Authentication required",
  code?: string
): never {
  throw new UnauthorizedError(message, code);
}

/**
 * Throw a 403 Forbidden error
 */
export function forbidden(message = "Access denied", code?: string): never {
  throw new ForbiddenError(message, code);
}

/**
 * Throw a 404 Not Found error
 */
export function notFound(message = "Not found", code?: string): never {
  throw new NotFoundError(message, code);
}

/**
 * Throw a 409 Conflict error
 */
export function conflict(
  message: string,
  code?: string,
  details?: Record<string, unknown>
): never {
  throw new ConflictError(message, code, details);
}

/**
 * Throw a validation error with field-level details
 */
export function validationError(
  message: string,
  fields: ValidationErrorDetail[]
): never {
  throw new ValidationError(message, fields);
}

/**
 * Helper to validate and extract entity ID from route params
 *
 * @param params - Route params object with id field
 * @param entityType - Optional entity type for better error messages
 * @returns Parsed entity ID
 * @throws BadRequestError if ID is invalid
 */
export function getValidEntityId(
  params: { id: string },
  entityType = "entity"
): number {
  const id = parseInt(params.id, 10);
  if (isNaN(id)) {
    badRequest(`Invalid ${entityType} ID`, "INVALID_ID");
  }
  return id;
}

/**
 * Helper to parse and validate JSON body
 *
 * @param req - Request object
 * @returns Parsed JSON body
 * @throws BadRequestError if body is invalid JSON
 */
export async function parseJsonBody<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    badRequest("Invalid JSON body", "INVALID_BODY");
  }
}
