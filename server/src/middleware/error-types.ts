/**
 * Standard error response types
 *
 * Defines the standard error response format for all API endpoints.
 */

/**
 * Standard error response format for all API endpoints
 */
export interface ErrorResponse {
  /** Human-readable error message */
  error: string;

  /** Machine-readable error code (UPPER_SNAKE_CASE) */
  code: string;

  /** Optional additional details (validation errors, context, etc.) */
  details?: Record<string, unknown>;

  /** The request path where the error occurred */
  path?: string;

  /** Request ID for tracking */
  requestId?: string;
}

/**
 * Validation error detail for field-level errors
 */
export interface ValidationErrorDetail {
  field: string;
  message: string;
  value?: unknown;
}

/**
 * Standard validation error response
 */
export interface ValidationErrorResponse extends ErrorResponse {
  code: "VALIDATION_ERROR";
  details: {
    fields: ValidationErrorDetail[];
  };
}
