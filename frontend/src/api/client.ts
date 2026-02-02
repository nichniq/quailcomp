/**
 * API client with comprehensive error handling
 *
 * Provides timeout handling, network error detection, and structured error responses.
 */

import {
  ApiError,
  NetworkError,
  TimeoutError,
  parseErrorResponse,
} from "./errors";

const API_BASE = "/api";
const DEFAULT_TIMEOUT = 10000; // 10 seconds

export interface ApiResponse<T> {
  data: T | null;
  error: ApiError | null;
}

/**
 * Enhanced API request with comprehensive error handling
 *
 * Features:
 * - Timeout handling with configurable timeout
 * - Network error detection
 * - Structured error parsing
 * - Auto-logout on authentication errors
 * - Detailed error context
 *
 * @param endpoint - API endpoint (e.g., "/books/123")
 * @param options - Fetch options with optional timeout
 * @returns Promise with data or error
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit & { timeout?: number } = {}
): Promise<ApiResponse<T>> {
  const token = localStorage.getItem("auth_token");
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  try {
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Parse response
    const contentType = response.headers.get("content-type");
    const isJson = contentType?.includes("application/json");
    const body = isJson ? await response.json() : await response.text();

    // Handle non-OK responses
    if (!response.ok) {
      const error = parseErrorResponse(response.status, body);

      // Auto-logout on authentication errors
      if (error.isAuthError()) {
        localStorage.removeItem("auth_token");
        // Redirect to login if not already there
        if (!window.location.pathname.includes("/login")) {
          window.location.href = "/login";
        }
      }

      return { data: null, error };
    }

    return { data: body as T, error: null };
  } catch (err) {
    // Handle timeout
    if (err instanceof Error && err.name === "AbortError") {
      return { data: null, error: new TimeoutError(timeout) };
    }

    // Handle network errors
    if (err instanceof TypeError && err.message.includes("fetch")) {
      return {
        data: null,
        error: new NetworkError("Network request failed", err),
      };
    }

    // Handle other errors
    if (err instanceof ApiError) {
      return { data: null, error: err };
    }

    return {
      data: null,
      error: new NetworkError("An unexpected error occurred", err as Error),
    };
  }
}

/**
 * Convenience methods for common HTTP verbs
 */
export const api = {
  /**
   * GET request
   */
  get: <T>(endpoint: string, options?: RequestInit) =>
    apiRequest<T>(endpoint, { ...options, method: "GET" }),

  /**
   * POST request
   */
  post: <T>(endpoint: string, body: unknown, options?: RequestInit) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: "POST",
      body: JSON.stringify(body),
    }),

  /**
   * PUT request
   */
  put: <T>(endpoint: string, body: unknown, options?: RequestInit) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: "PUT",
      body: JSON.stringify(body),
    }),

  /**
   * DELETE request
   */
  delete: <T>(endpoint: string, options?: RequestInit) =>
    apiRequest<T>(endpoint, { ...options, method: "DELETE" }),
};
