import type { MetricsRecorder, MetricsSnapshot } from '@/observability/metrics';

/**
 * In-memory metrics recorder
 *
 * Wraps the existing metrics collector with the MetricsRecorder interface
 */

interface Counter {
  name: string;
  labels: Record<string, string>;
  value: number;
}

interface Histogram {
  name: string;
  labels: Record<string, string>;
  count: number;
  sum: number;
  buckets: Map<number, number>;
}

interface Gauge {
  name: string;
  labels: Record<string, string>;
  value: number;
}

// Default histogram buckets (in milliseconds for latency)
const DEFAULT_BUCKETS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

export class InMemoryMetrics implements MetricsRecorder {
  private counters = new Map<string, Counter>();
  private histograms = new Map<string, Histogram>();
  private gauges = new Map<string, Gauge>();

  /**
   * Generate a unique key for a metric + labels combination
   */
  private key(name: string, labels: Record<string, string>): string {
    const sortedLabels = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return `${name}{${sortedLabels}}`;
  }

  incrementCounter(
    name: string,
    value = 1,
    labels: Record<string, string> = {}
  ): void {
    const key = this.key(name, labels);
    const counter = this.counters.get(key) ?? { name, labels, value: 0 };
    counter.value += value;
    this.counters.set(key, counter);
  }

  recordHistogram(
    name: string,
    value: number,
    labels: Record<string, string> = {}
  ): void {
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

  recordGauge(
    name: string,
    value: number,
    labels: Record<string, string> = {}
  ): void {
    const key = this.key(name, labels);
    this.gauges.set(key, { name, labels, value });
  }

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
      gauges: Array.from(this.gauges.values()),
      timestamp: new Date().toISOString(),
    };
  }

  reset(): void {
    this.counters.clear();
    this.histograms.clear();
    this.gauges.clear();
  }
}

export function createInMemoryMetrics(): MetricsRecorder {
  return new InMemoryMetrics();
}
