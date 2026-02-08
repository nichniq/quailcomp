/**
 * Request context - created for each request, passed through handlers
 *
 * Threads user identity, logging, and database access through the request lifecycle.
 */

import type { Sql } from "@quailcomp/data";

import type { Logger } from "@/logging/logger";
import { createLogger } from "@/logging/logger";
import type { ObservabilityContext } from "@/observability/context";
import { createObservabilityContext } from "@/observability/context";
import {
  createNoOpTracer,
  createInMemoryMetrics,
  createNoOpErrorTracker,
} from "@/observability/adapters";

/**
 * Authenticated user information extracted from JWT
 */
export interface AuthenticatedUser {
  userId: number;
  email: string;
  username: string | null;
  credentialId: number;
  authMethod: string;
}

/**
 * Request context passed through all handlers and middleware
 */
export interface RequestContext {
  /** Unique identifier for this request (for tracing) */
  requestId: string;

  /** Request start time in milliseconds */
  startTime: number;

  /** Authenticated user (null if unauthenticated) */
  user: AuthenticatedUser | null;

  /** Database connection */
  sql: Sql;

  /** Logger scoped to this request */
  log: Logger;

  /** URL path parameters extracted by router */
  params: Record<string, string>;

  /** Observability (tracing, metrics, error tracking) */
  observability: ObservabilityContext;
}

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Create a default observability context for tests
 */
function createDefaultObservability(): ObservabilityContext {
  return createObservabilityContext(
    createNoOpTracer(),
    createInMemoryMetrics(),
    createNoOpErrorTracker()
  );
}

/**
 * Create a new request context for an incoming request
 */
export function createContext(
  req: Request,
  sql: Sql,
  observability?: ObservabilityContext
): RequestContext {
  // Extract or generate request ID
  const requestId =
    req.headers.get("x-request-id") ?? generateRequestId();

  // Use provided observability or create default (for tests)
  const obs = observability ?? createDefaultObservability();

  return {
    requestId,
    startTime: Date.now(),
    user: null,
    sql,
    log: createLogger().child({ requestId }),
    params: {},
    observability: obs.child({ requestId }),
  };
}
