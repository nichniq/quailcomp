/**
 * Frontend API error types
 *
 * These errors provide structured error information from API responses
 * and handle network/timeout errors gracefully.
 */

/**
 * Error response format from the API
 */
export interface ErrorResponse {
  error: string;
  code: string;
  details?: Record<string, unknown>;
  path?: string;
  requestId?: string;
}

/**
 * Base API error class
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
    public path?: string,
    public requestId?: string
  ) {
    super(message);
    this.name = "ApiError";
  }

  /**
   * Check if error matches a specific code
   */
  is(code: string): boolean {
    return this.code === code;
  }

  /**
   * Check if error is authentication-related (401)
   */
  isAuthError(): boolean {
    return this.status === 401;
  }

  /**
   * Check if error is authorization-related (403)
   */
  isAuthzError(): boolean {
    return this.status === 403;
  }

  /**
   * Check if error is validation-related
   */
  isValidationError(): boolean {
    return this.code === "VALIDATION_ERROR";
  }

  /**
   * Check if error is a not found error (404)
   */
  isNotFoundError(): boolean {
    return this.status === 404;
  }
}

/**
 * Network error (no response from server)
 */
export class NetworkError extends ApiError {
  constructor(message = "Network request failed", cause?: Error) {
    super(0, "NETWORK_ERROR", message);
    this.name = "NetworkError";
    this.cause = cause;
  }
}

/**
 * Request timeout error
 */
export class TimeoutError extends ApiError {
  constructor(public timeoutMs: number) {
    super(408, "TIMEOUT", `Request timed out after ${timeoutMs}ms`);
    this.name = "TimeoutError";
  }
}

/**
 * Parse error response from server
 *
 * @param status - HTTP status code
 * @param body - Response body (may be ErrorResponse or generic object)
 * @returns Parsed ApiError
 */
export function parseErrorResponse(
  status: number,
  body: ErrorResponse | any
): ApiError {
  if (body && typeof body === "object" && "error" in body) {
    return new ApiError(
      status,
      body.code || "UNKNOWN_ERROR",
      body.error,
      body.details,
      body.path,
      body.requestId
    );
  }

  return new ApiError(
    status,
    "UNKNOWN_ERROR",
    body?.message || body?.error || "An unexpected error occurred"
  );
}
