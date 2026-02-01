/**
 * Server entry point
 */

import { createServer } from "@/server";

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
    .then(() => {
      clearTimeout(shutdownTimeout);
      console.log("All requests completed, exiting...");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Error during shutdown:", error);
      clearTimeout(shutdownTimeout);
      process.exit(1);
    });
}

// Register signal handlers
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught errors gracefully
process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  gracefulShutdown("UNCAUGHT_EXCEPTION");
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled rejection at:", promise, "reason:", reason);
  gracefulShutdown("UNHANDLED_REJECTION");
});
