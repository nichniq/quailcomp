import type { Tracer } from './tracer';
import type { MetricsRecorder } from './metrics';
import type { ErrorTracker } from './error-tracker';

/**
 * Observability context carries tracing, metrics, and error tracking
 *
 * Similar to RequestContext, but specifically for observability
 */

export interface ObservabilityContext {
  /** Tracer for distributed tracing */
  tracer: Tracer;

  /** Metrics recorder */
  metrics: MetricsRecorder;

  /** Error tracker */
  errors: ErrorTracker;

  /** Create child context with additional attributes */
  child(attributes: Record<string, unknown>): ObservabilityContext;
}

/**
 * Implementation of ObservabilityContext
 */
class ObservabilityContextImpl implements ObservabilityContext {
  constructor(
    public tracer: Tracer,
    public metrics: MetricsRecorder,
    public errors: ErrorTracker
  ) {}

  child(attributes: Record<string, unknown>): ObservabilityContext {
    return new ObservabilityContextImpl(
      this.tracer.child(attributes),
      this.metrics,
      this.errors
    );
  }
}

/**
 * Create an observability context
 */
export function createObservabilityContext(
  tracer: Tracer,
  metrics: MetricsRecorder,
  errors: ErrorTracker
): ObservabilityContext {
  return new ObservabilityContextImpl(tracer, metrics, errors);
}
