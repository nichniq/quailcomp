/**
 * Simple in-memory metrics collector
 *
 * Collects counters and histograms for basic observability.
 * No external dependencies - just simple in-memory storage.
 */

export interface Counter {
  name: string;
  labels: Record<string, string>;
  value: number;
}

export interface Histogram {
  name: string;
  labels: Record<string, string>;
  count: number;
  sum: number;
  buckets: Map<number, number>;
}

export interface MetricsSnapshot {
  counters: Counter[];
  histograms: Array<{
    name: string;
    labels: Record<string, string>;
    count: number;
    sum: number;
    avg: number;
    buckets: Record<string, number>;
  }>;
  timestamp: string;
}

// Default histogram buckets (in milliseconds for latency)
const DEFAULT_BUCKETS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

class MetricsCollector {
  private counters = new Map<string, Counter>();
  private histograms = new Map<string, Histogram>();

  /**
   * Generate a unique key for a metric + labels combination
   */
  private key(name: string, labels: Record<string, string>): string {
    const sortedLabels = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(",");
    return `${name}{${sortedLabels}}`;
  }

  /**
   * Increment a counter
   */
  inc(name: string, labels: Record<string, string> = {}, value = 1): void {
    const key = this.key(name, labels);
    const counter = this.counters.get(key) ?? { name, labels, value: 0 };
    counter.value += value;
    this.counters.set(key, counter);
  }

  /**
   * Record a histogram observation (e.g., request latency)
   */
  observe(name: string, labels: Record<string, string>, value: number): void {
    const key = this.key(name, labels);
    let histogram = this.histograms.get(key);

    if (!histogram) {
      histogram = {
        name,
        labels,
        count: 0,
        sum: 0,
        buckets: new Map(DEFAULT_BUCKETS.map((b) => [b, 0])),
      };
    }

    histogram.count++;
    histogram.sum += value;

    // Update buckets (cumulative)
    for (const bucket of DEFAULT_BUCKETS) {
      if (value <= bucket) {
        histogram.buckets.set(bucket, (histogram.buckets.get(bucket) ?? 0) + 1);
      }
    }

    this.histograms.set(key, histogram);
  }

  /**
   * Get current metrics snapshot
   */
  snapshot(): MetricsSnapshot {
    const histogramData = Array.from(this.histograms.values()).map((h) => ({
      name: h.name,
      labels: h.labels,
      count: h.count,
      sum: h.sum,
      avg: h.count > 0 ? h.sum / h.count : 0,
      buckets: Object.fromEntries(h.buckets),
    }));

    return {
      counters: Array.from(this.counters.values()),
      histograms: histogramData,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.counters.clear();
    this.histograms.clear();
  }
}

// Global singleton instance
export const metrics = new MetricsCollector();
