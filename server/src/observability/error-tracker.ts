/**
 * Error tracking interface
 *
 * Implementations: NoOpErrorTracker, SentryErrorTracker, OTelErrorTracker (future)
 */

export interface ErrorTracker {
  /** Capture an error */
  captureError(
    error: Error,
    context?: {
      tags?: Record<string, string>;
      extra?: Record<string, unknown>;
      user?: { id?: string; email?: string; username?: string };
    }
  ): void;

  /** Capture a message (non-error event) */
  captureMessage(
    message: string,
    level?: 'debug' | 'info' | 'warning' | 'error',
    context?: {
      tags?: Record<string, string>;
      extra?: Record<string, unknown>;
    }
  ): void;

  /** Add a breadcrumb */
  addBreadcrumb(
    message: string,
    data?: Record<string, unknown>,
    category?: string
  ): void;

  /** Set user context */
  setUser(user: { id?: string; email?: string; username?: string }): void;

  /** Clear user context */
  clearUser(): void;

  /** Flush pending events */
  flush(timeout?: number): Promise<boolean>;
}
