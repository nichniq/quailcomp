/**
 * CORS middleware
 *
 * Handles Cross-Origin Resource Sharing headers.
 */

import { env } from "@/config";
import type { Middleware } from "@/middleware/types";

export interface CorsOptions {
  origin?: string | string[] | ((origin: string) => boolean);
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}

const DEFAULT_OPTIONS: CorsOptions = {
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false,
  maxAge: 86400, // 24 hours
};

/**
 * Check if origin is allowed
 */
function isOriginAllowed(
  requestOrigin: string | null,
  allowedOrigin: CorsOptions["origin"]
): boolean {
  if (!requestOrigin) return false;
  if (allowedOrigin === "*") return true;
  if (typeof allowedOrigin === "string") return requestOrigin === allowedOrigin;
  if (Array.isArray(allowedOrigin))
    return allowedOrigin.includes(requestOrigin);
  if (typeof allowedOrigin === "function") return allowedOrigin(requestOrigin);
  return false;
}

/**
 * Get CORS headers for a request
 */
function getCorsHeaders(
  requestOrigin: string | null,
  options: CorsOptions
): Record<string, string> {
  const headers: Record<string, string> = {};

  // Access-Control-Allow-Origin
  if (options.origin === "*") {
    headers["Access-Control-Allow-Origin"] = "*";
  } else if (requestOrigin && isOriginAllowed(requestOrigin, options.origin)) {
    headers["Access-Control-Allow-Origin"] = requestOrigin;
    headers["Vary"] = "Origin";
  }

  // Access-Control-Allow-Credentials
  if (options.credentials) {
    headers["Access-Control-Allow-Credentials"] = "true";
  }

  // Access-Control-Expose-Headers
  if (options.exposedHeaders?.length) {
    headers["Access-Control-Expose-Headers"] = options.exposedHeaders.join(", ");
  }

  return headers;
}

/**
 * Get preflight CORS headers
 */
function getPreflightHeaders(
  requestOrigin: string | null,
  options: CorsOptions
): Record<string, string> {
  const headers = getCorsHeaders(requestOrigin, options);

  // Access-Control-Allow-Methods
  if (options.methods?.length) {
    headers["Access-Control-Allow-Methods"] = options.methods.join(", ");
  }

  // Access-Control-Allow-Headers
  if (options.allowedHeaders?.length) {
    headers["Access-Control-Allow-Headers"] = options.allowedHeaders.join(", ");
  }

  // Access-Control-Max-Age
  if (options.maxAge) {
    headers["Access-Control-Max-Age"] = String(options.maxAge);
  }

  return headers;
}

/**
 * Create CORS middleware with options
 */
export function cors(options: CorsOptions = {}): Middleware {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return (next) => async (ctx, req) => {
    const requestOrigin = req.headers.get("Origin");

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      const headers = getPreflightHeaders(requestOrigin, opts);
      return new Response(null, {
        status: 204,
        headers,
      });
    }

    // Handle actual requests
    const response = await next(ctx, req);
    const headers = getCorsHeaders(requestOrigin, opts);

    // Clone response with CORS headers
    const newHeaders = new Headers(response.headers);
    for (const [key, value] of Object.entries(headers)) {
      newHeaders.set(key, value);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  };
}

/**
 * Default CORS middleware (configured from environment)
 */
export const defaultCors = cors({
  origin: env.CORS_ORIGINS,
  credentials: true,
});
