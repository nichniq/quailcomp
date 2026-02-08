import type { Tracer, Span, TracerOptions } from '@/observability/tracer';

/**
 * No-op tracer that does nothing
 *
 * Use when tracing is disabled or not yet implemented
 */

class NoOpSpan implements Span {
  setAttribute(): void {}
  addEvent(): void {}
  recordException(): void {}
  end(): void {}
}

export class NoOpTracer implements Tracer {
  private context: Record<string, unknown>;

  constructor(options: TracerOptions = {}) {
    this.context = options.context ?? {};
  }

  startSpan(): Span {
    return new NoOpSpan();
  }

  getActiveSpan(): Span | null {
    return null;
  }

  child(context: Record<string, unknown>): Tracer {
    return new NoOpTracer({ context: { ...this.context, ...context } });
  }
}

export function createNoOpTracer(options?: TracerOptions): Tracer {
  return new NoOpTracer(options);
}
