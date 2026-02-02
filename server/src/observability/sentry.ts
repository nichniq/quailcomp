/**
 * Sentry error tracking integration
 *
 * Provides error capture with context, breadcrumbs, and sampling.
 * Only enabled in production when SENTRY_DSN is configured.
 */

import * as Sentry from "@sentry/bun";
import { env, isProduction } from "@/config";

/**
 * Initialize Sentry
 *
 * Should be called once at application startup, before any other code.
 */
export function initSentry(): void {
  // Only initialize if DSN is provided and enabled
  if (!env.SENTRY_DSN || !env.SENTRY_ENABLED) {
    return;
  }

  Sentry.init({
    dsn: env.SENTRY_DSN,

    // Set environment
    environment: isProduction ? "production" : "development",

    // Sample rate (1.0 = 100% of errors)
    sampleRate: 1.0,

    // Traces sample rate (for performance monitoring)
    // Lower in production to reduce volume
    tracesSampleRate: isProduction ? 0.1 : 1.0,

    // Don't send errors in development (unless explicitly enabled)
    enabled: env.SENTRY_ENABLED,

    // Release tracking (optional, use git SHA or version)
    release: process.env.RELEASE_VERSION,

    // Attach stack traces to messages
    attachStacktrace: true,

    // Integrations (httpIntegration is built-in for @sentry/bun)
    integrations: [
      Sentry.httpIntegration({ tracing: true }),
    ],
  });
}

/**
 * Capture an error with Sentry
 *
 * Adds additional context and tags for better debugging.
 */
export function captureError(
  error: Error,
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
    user?: { id?: string; email?: string; username?: string };
  }
): string | undefined {
  // If Sentry is not enabled, skip
  if (!env.SENTRY_ENABLED || !env.SENTRY_DSN) {
    return undefined;
  }

  return Sentry.captureException(error, {
    tags: context?.tags,
    extra: context?.extra,
    user: context?.user,
  });
}

/**
 * Capture a message (non-error event)
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = "info",
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  }
): string | undefined {
  if (!env.SENTRY_ENABLED || !env.SENTRY_DSN) {
    return undefined;
  }

  return Sentry.captureMessage(message, {
    level,
    tags: context?.tags,
    extra: context?.extra,
  });
}

/**
 * Add a breadcrumb (for context in future errors)
 *
 * Breadcrumbs are a trail of events that led up to an error.
 */
export function addBreadcrumb(
  message: string,
  data?: Record<string, unknown>,
  category?: string
): void {
  if (!env.SENTRY_ENABLED || !env.SENTRY_DSN) {
    return;
  }

  Sentry.addBreadcrumb({
    message,
    data,
    category: category ?? "default",
    level: "info",
    timestamp: Date.now() / 1000,
  });
}

/**
 * Set user context for all future errors
 */
export function setUser(user: {
  id?: string;
  email?: string;
  username?: string;
}): void {
  if (!env.SENTRY_ENABLED || !env.SENTRY_DSN) {
    return;
  }

  Sentry.setUser(user);
}

/**
 * Clear user context
 */
export function clearUser(): void {
  if (!env.SENTRY_ENABLED || !env.SENTRY_DSN) {
    return;
  }

  Sentry.setUser(null);
}

/**
 * Set a tag for all future errors
 */
export function setTag(key: string, value: string): void {
  if (!env.SENTRY_ENABLED || !env.SENTRY_DSN) {
    return;
  }

  Sentry.setTag(key, value);
}

/**
 * Flush events to Sentry (useful before shutdown)
 */
export async function flushSentry(timeout = 2000): Promise<boolean> {
  if (!env.SENTRY_ENABLED || !env.SENTRY_DSN) {
    return true;
  }

  return await Sentry.close(timeout);
}
