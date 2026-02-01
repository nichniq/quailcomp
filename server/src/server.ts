/**
 * HTTP Server using Bun.serve()
 *
 * Sets up routing, middleware, and request handling.
 */

import { getConnection, type Sql } from "@quailcomp/data";
import * as path from "node:path";
import { file } from "bun";

import { env, isProduction } from "@/config";
import { createContext } from "@/context";
import { compose } from "@/middleware/compose";
import { defaultCors } from "@/middleware/cors";
import { errorHandler } from "@/middleware/error-handler";
import type { Handler, Middleware } from "@/middleware/types";
import { requestLogger } from "@/logging/request-logger";
import { requestMetrics } from "@/metrics/request-metrics";
import { createRouter, type Router } from "@/router";
import { healthHandler, metricsHandler } from "@/routes/health";
import { registerAuthRoutes } from "@/auth/routes";
import { registerBookRoutes } from "@/routes/books";
import { registerEntityRoutes } from "@/routes/entities";

export interface ServerConfig {
  port?: number;
  hostname?: string;
}

export interface ServerInstance {
  url: URL;
  stop(): void;
  router: Router;
}

/**
 * Register all routes on the router
 */
function registerRoutes(router: Router, sql: Sql): void {
  // Health and metrics
  router.get("/health", healthHandler);
  router.get("/metrics", metricsHandler);

  // Authentication routes
  registerAuthRoutes(router, sql);

  // Book routes
  registerBookRoutes(router, sql);

  // Entity access routes
  registerEntityRoutes(router, sql);
}

/**
 * Create and start the HTTP server
 */
export function createServer(config: ServerConfig = {}): ServerInstance {
  const port = config.port ?? env.PORT;
  const hostname = config.hostname ?? env.HOST;

  const router = createRouter();
  const sql = getConnection();

  // Register all routes
  registerRoutes(router, sql);

  // Global middleware stack (applied to all requests)
  const globalMiddleware = compose(
    errorHandler,
    requestLogger,
    requestMetrics,
    defaultCors
  );

  const server = Bun.serve({
    port,
    hostname,

    async fetch(req: Request): Promise<Response> {
      const url = new URL(req.url);
      const match = router.match(req.method, url.pathname);

      if (!match) {
        // In production, serve static files from frontend/dist/
        if (isProduction && !url.pathname.startsWith("/api/")) {
          const staticFilePath = url.pathname === "/"
            ? "frontend/dist/index.html"
            : `frontend/dist${url.pathname}`;

          const staticFile = file(path.join(process.cwd(), staticFilePath));

          if (await staticFile.exists()) {
            return new Response(staticFile);
          }

          // SPA fallback: serve index.html for all non-API routes
          const indexFile = file(path.join(process.cwd(), "frontend/dist/index.html"));
          if (await indexFile.exists()) {
            return new Response(indexFile);
          }
        }

        return Response.json({ error: "Not found" }, { status: 404 });
      }

      // Create request context
      const ctx = createContext(req, sql);
      ctx.params = match.params;

      // Build handler chain: route middleware -> global middleware -> handler
      const routeMiddleware = match.route.middleware ?? [];
      const handler = compose(...routeMiddleware)(
        globalMiddleware(match.route.handler)
      );

      return handler(ctx, req);
    },
  });

  return {
    url: server.url,
    stop: () => server.stop(),
    router,
  };
}
