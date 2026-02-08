/**
 * Server entry point
 */

import * as Sentry from "@sentry/bun";
import { env, isProduction } from "@/config";
import { createServer } from "@/server";
import { createObservabilityContext } from "@/observability/context";
import {
  createNoOpTracer,
  createInMemoryMetrics,
  createSentryErrorTracker,
  createNoOpErrorTracker,
} from "@/observability/adapters";

// Initialize Sentry before everything else
if (env.SENTRY_DSN && env.SENTRY_ENABLED) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: isProduction ? "production" : "development",
    sampleRate: 1.0,
    tracesSampleRate: isProduction ? 0.1 : 1.0,
    enabled: env.SENTRY_ENABLED,
    release: process.env.RELEASE_VERSION,
    attachStacktrace: true,
    integrations: [Sentry.httpIntegration()],
  });
}

// Create observability context
const observability = createObservabilityContext(
  createNoOpTracer(),
  createInMemoryMetrics(),
  env.SENTRY_ENABLED && env.SENTRY_DSN
    ? createSentryErrorTracker()
    : createNoOpErrorTracker()
);

const server = createServer({ observability });

console.log(`Server running on ${server.url}`);

// Graceful shutdown handler
let isShuttingDown = false;
const activeRequests = new Set<Promise<void>>();

function gracefulShutdown(signal: string): void {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`${signal} received, shutting down gracefully...`);

  // Stop accepting new connections
  server.stop();

  // Wait for in-flight requests to complete (max 10 seconds)
  const shutdownTimeout = setTimeout(() => {
    console.warn("Graceful shutdown timeout - forcing exit");
    process.exit(1);
  }, 10000);

  // Wait for all active requests to complete
  Promise.all(Array.from(activeRequests))
    .then(async () => {
      clearTimeout(shutdownTimeout);
      console.log("All requests completed, flushing error tracker...");
      await observability.errors.flush();
      console.log("Exiting...");
      process.exit(0);
    })
    .catch(async (error) => {
      console.error("Error during shutdown:", error);
      await observability.errors.flush();
      clearTimeout(shutdownTimeout);
      process.exit(1);
    });
}

// Register signal handlers
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught errors gracefully
process.on("uncaughtException", async (error) => {
  console.error("Uncaught exception:", error);
  observability.errors.captureError(error, {
    tags: { type: "uncaught_exception" },
  });
  gracefulShutdown("UNCAUGHT_EXCEPTION");
});

process.on("unhandledRejection", async (reason, promise) => {
  console.error("Unhandled rejection at:", promise, "reason:", reason);
  if (reason instanceof Error) {
    observability.errors.captureError(reason, {
      tags: { type: "unhandled_rejection" },
    });
  }
  gracefulShutdown("UNHANDLED_REJECTION");
});
