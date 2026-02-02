/**
 * Security headers middleware
 *
 * Adds security-related HTTP headers to all responses.
 * Based on OWASP security best practices.
 */

import { isProduction } from "@/config";
import type { Middleware } from "@/middleware/types";

/**
 * Security headers to add to all responses
 */
function getSecurityHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    // Prevent clickjacking attacks
    "X-Frame-Options": "SAMEORIGIN",

    // Prevent MIME type sniffing
    "X-Content-Type-Options": "nosniff",

    // Enable XSS protection (legacy browsers)
    "X-XSS-Protection": "1; mode=block",

    // Control referrer information
    "Referrer-Policy": "strict-origin-when-cross-origin",

    // Restrict browser features and APIs
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",

    // Content Security Policy
    // Allow same-origin content and specific CDNs for Swagger UI
    "Content-Security-Policy": [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
      "img-src 'self' data: https:",
      "font-src 'self' https://cdn.jsdelivr.net",
      "connect-src 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  };

  // Only add HSTS in production (requires HTTPS)
  if (isProduction) {
    headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
  }

  return headers;
}

/**
 * Security headers middleware
 *
 * Adds security headers to all responses
 */
export const securityHeaders: Middleware = (next) => async (ctx, req) => {
  const response = await next(ctx, req);

  // Clone response with security headers
  const headers = new Headers(response.headers);
  const securityHeaders = getSecurityHeaders();

  for (const [key, value] of Object.entries(securityHeaders)) {
    headers.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};
