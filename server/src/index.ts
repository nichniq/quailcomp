/**
 * Server entry point
 */

import { initSentry, flushSentry } from "@/observability/sentry";
import { createServer } from "@/server";

// Initialize Sentry before everything else
initSentry();

const server = createServer();

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
      console.log("All requests completed, flushing Sentry...");
      await flushSentry();
      console.log("Exiting...");
      process.exit(0);
    })
    .catch(async (error) => {
      console.error("Error during shutdown:", error);
      await flushSentry();
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
  const { captureError } = await import("@/observability/sentry");
  captureError(error, { tags: { type: "uncaught_exception" } });
  gracefulShutdown("UNCAUGHT_EXCEPTION");
});

process.on("unhandledRejection", async (reason, promise) => {
  console.error("Unhandled rejection at:", promise, "reason:", reason);
  const { captureError } = await import("@/observability/sentry");
  if (reason instanceof Error) {
    captureError(reason, { tags: { type: "unhandled_rejection" } });
  }
  gracefulShutdown("UNHANDLED_REJECTION");
});
