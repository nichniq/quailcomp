import * as Sentry from '@sentry/bun';
import type { ErrorTracker } from '@/observability/error-tracker';

/**
 * Sentry error tracker adapter
 *
 * Wraps Sentry SDK behind the ErrorTracker interface
 */

// Map our level names to Sentry's severity levels
const LEVEL_MAP: Record<string, Sentry.SeverityLevel> = {
  debug: 'debug',
  info: 'info',
  warning: 'warning',
  error: 'error',
};

export class SentryErrorTracker implements ErrorTracker {
  captureError(
    error: Error,
    context?: {
      tags?: Record<string, string>;
      extra?: Record<string, unknown>;
      user?: { id?: string; email?: string; username?: string };
    }
  ): void {
    Sentry.captureException(error, {
      tags: context?.tags,
      extra: context?.extra,
      user: context?.user,
    });
  }

  captureMessage(
    message: string,
    level: 'debug' | 'info' | 'warning' | 'error' = 'info',
    context?: {
      tags?: Record<string, string>;
      extra?: Record<string, unknown>;
    }
  ): void {
    Sentry.captureMessage(message, {
      level: LEVEL_MAP[level] ?? 'info',
      tags: context?.tags,
      extra: context?.extra,
    });
  }

  addBreadcrumb(
    message: string,
    data?: Record<string, unknown>,
    category?: string
  ): void {
    Sentry.addBreadcrumb({
      message,
      data,
      category: category ?? 'default',
      level: 'info',
      timestamp: Date.now() / 1000,
    });
  }

  setUser(user: { id?: string; email?: string; username?: string }): void {
    Sentry.setUser(user);
  }

  clearUser(): void {
    Sentry.setUser(null);
  }

  async flush(timeout = 2000): Promise<boolean> {
    return await Sentry.close(timeout);
  }
}

export function createSentryErrorTracker(): ErrorTracker {
  return new SentryErrorTracker();
}
