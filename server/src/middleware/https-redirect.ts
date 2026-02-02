/**
 * HTTPS redirect middleware
 *
 * Redirects HTTP requests to HTTPS in production.
 */

import { env, isProduction } from "@/config";
import type { Middleware } from "@/middleware/types";

/**
 * HTTPS redirect middleware
 *
 * In production (when HTTPS_REDIRECT is enabled), redirects all HTTP
 * requests to HTTPS with a 301 permanent redirect.
 *
 * In development, does nothing (allows HTTP).
 */
export const httpsRedirect: Middleware = (next) => async (ctx, req) => {
  // Only redirect in production if enabled
  if (!isProduction || !env.HTTPS_REDIRECT) {
    return next(ctx, req);
  }

  const url = new URL(req.url);

  // Check if request is already HTTPS
  // In production behind a reverse proxy, check X-Forwarded-Proto header
  const forwardedProto = req.headers.get("X-Forwarded-Proto");
  const isHttps = url.protocol === "https:" || forwardedProto === "https";

  if (!isHttps) {
    // Redirect to HTTPS version of the URL
    const httpsUrl = new URL(req.url);
    httpsUrl.protocol = "https:";

    return new Response(null, {
      status: 301,
      headers: {
        Location: httpsUrl.toString(),
      },
    });
  }

  return next(ctx, req);
};
