/**
 * Metrics recorder interface
 *
 * Implementations: InMemoryMetrics, OTelMetrics (future)
 */

export interface MetricsRecorder {
  /** Increment a counter */
  incrementCounter(
    name: string,
    value?: number,
    labels?: Record<string, string>
  ): void;

  /** Record a histogram observation */
  recordHistogram(
    name: string,
    value: number,
    labels?: Record<string, string>
  ): void;

  /** Record a gauge value */
  recordGauge(
    name: string,
    value: number,
    labels?: Record<string, string>
  ): void;

  /** Get snapshot of all metrics */
  snapshot(): MetricsSnapshot;

  /** Reset all metrics (testing only) */
  reset(): void;
}

export interface MetricsSnapshot {
  counters: Array<{ name: string; labels: Record<string, string>; value: number }>;
  histograms: Array<{
    name: string;
    labels: Record<string, string>;
    count: number;
    sum: number;
    avg: number;
    buckets: Record<string, number>;
  }>;
  gauges: Array<{ name: string; labels: Record<string, string>; value: number }>;
  timestamp: string;
}
