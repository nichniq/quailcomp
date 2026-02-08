/**
 * HTTP Server using Bun.serve()
 *
 * Sets up routing, middleware, and request handling.
 */

import { getConnection, type Sql } from "@quailcomp/data";
import * as path from "path";
import { file } from "bun";

import { env, isProduction } from "@/config";
import { createContext } from "@/context";
import { compose } from "@/middleware/compose";
import { defaultCors } from "@/middleware/cors";
import { errorHandler } from "@/middleware/error-handler";
import { httpsRedirect } from "@/middleware/https-redirect";
import { requestIdMiddleware } from "@/middleware/request-id";
import { securityHeaders } from "@/middleware/security-headers";
import type { Handler, Middleware } from "@/middleware/types";
import { requestLogger } from "@/logging/request-logger";
import { requestMetrics } from "@/metrics/request-metrics";
import { createRouter, type Router } from "@/router";
import {
  healthHandler,
  metricsHandler,
  metricsJsonHandler,
} from "@/routes/health";
import { registerAuthRoutes } from "@/auth/routes";
import { registerBookRoutes } from "@/routes/books";
import { registerPeopleRoutes } from "@/routes/people";
import { registerSeriesRoutes } from "@/routes/series";
import { registerEntityRoutes } from "@/routes/entities";
import { openAPIHandler, swaggerUIHandler } from "@/routes/api-docs";
import { createWebSocketHandler } from "@/websocket/server";
import type { ObservabilityContext } from "@/observability/context";
import { createObservabilityContext } from "@/observability/context";
import {
  createNoOpTracer,
  createInMemoryMetrics,
  createNoOpErrorTracker,
} from "@/observability/adapters";

export interface ServerConfig {
  port?: number;
  hostname?: string;
  observability?: ObservabilityContext;
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
  router.get("/metrics/json", metricsJsonHandler);

  // API documentation
  router.get("/api/docs", swaggerUIHandler);
  router.get("/api/openapi.json", openAPIHandler);

  // Authentication routes
  registerAuthRoutes(router, sql);

  // Book routes
  registerBookRoutes(router, sql);

  // People routes
  registerPeopleRoutes(router, sql);

  // Series routes
  registerSeriesRoutes(router, sql);

  // Entity access routes
  registerEntityRoutes(router, sql);
}

/**
 * Create and start the HTTP server
 */
export function createServer(config: ServerConfig = {}): ServerInstance {
  const port = config.port ?? env.PORT;
  const hostname = config.hostname ?? env.HOST;

  // Use provided observability or create default (for tests)
  const observability =
    config.observability ??
    createObservabilityContext(
      createNoOpTracer(),
      createInMemoryMetrics(),
      createNoOpErrorTracker()
    );

  const router = createRouter();
  const sql = getConnection();

  // Register all routes
  registerRoutes(router, sql);

  // Global middleware stack (applied to all requests)
  const globalMiddleware = compose(
    errorHandler,
    httpsRedirect,
    securityHeaders,
    requestIdMiddleware,
    requestLogger,
    requestMetrics,
    defaultCors
  );

  const server = Bun.serve({
    port,
    hostname,

    async fetch(req: Request, server): Promise<Response | undefined> {
      const url = new URL(req.url);

      // Upgrade WebSocket connections
      if (url.pathname === "/ws") {
        const upgraded = server.upgrade(req, {
          data: {
            userId: 0,
            subscriptions: new Set<number>(),
            authenticated: false,
          },
        });
        if (upgraded) {
          return undefined;
        }
        return Response.json({ error: "WebSocket upgrade failed" }, { status: 400 });
      }

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
      const ctx = createContext(req, sql, observability);
      ctx.params = match.params;

      // Build handler chain: route middleware -> global middleware -> handler
      const routeMiddleware = match.route.middleware ?? [];
      const handler = compose(...routeMiddleware)(
        globalMiddleware(match.route.handler)
      );

      return handler(ctx, req);
    },

    // WebSocket handler
    websocket: createWebSocketHandler(sql),
  });

  return {
    url: server.url,
    stop: () => server.stop(),
    router,
  };
}
