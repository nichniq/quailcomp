import type { ErrorTracker } from '@/observability/error-tracker';

/**
 * No-op error tracker that does nothing
 *
 * Use when error tracking is disabled
 */

export class NoOpErrorTracker implements ErrorTracker {
  captureError(): void {}

  captureMessage(): void {}

  addBreadcrumb(): void {}

  setUser(): void {}

  clearUser(): void {}

  async flush(): Promise<boolean> {
    return true;
  }
}

export function createNoOpErrorTracker(): ErrorTracker {
  return new NoOpErrorTracker();
}
