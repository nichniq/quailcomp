/**
 * Tracer interface for distributed tracing
 *
 * Implementations: NoOpTracer, OTelTracer (future)
 */

export interface Span {
  /** Set an attribute on the span */
  setAttribute(key: string, value: string | number | boolean): void;

  /** Record an event (breadcrumb) */
  addEvent(name: string, data?: Record<string, unknown>): void;

  /** Record an exception */
  recordException(error: Error): void;

  /** Mark span as completed */
  end(): void;
}

export interface Tracer {
  /** Start a new span */
  startSpan(name: string, attributes?: Record<string, unknown>): Span;

  /** Get the currently active span (if any) */
  getActiveSpan(): Span | null;

  /** Create a child tracer with additional context */
  child(context: Record<string, unknown>): Tracer;
}

export interface TracerOptions {
  context?: Record<string, unknown>;
}
