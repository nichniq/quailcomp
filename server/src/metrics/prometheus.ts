/**
 * Prometheus text format exporter
 *
 * Converts in-memory metrics to Prometheus exposition format.
 * See: https://prometheus.io/docs/instrumenting/exposition_formats/
 */

import { metrics } from "./collector";
import type { Counter, MetricsSnapshot } from "./collector";

/**
 * Escape label values for Prometheus format
 */
function escapeLabel(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n");
}

/**
 * Format labels for Prometheus text format
 * Example: {method="GET",status="200"}
 */
function formatLabels(labels: Record<string, string>): string {
  const entries = Object.entries(labels);
  if (entries.length === 0) return "";

  const formatted = entries
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}="${escapeLabel(value)}"`)
    .join(",");

  return `{${formatted}}`;
}

/**
 * Format a counter metric in Prometheus text format
 */
function formatCounter(counter: Counter): string {
  const labels = formatLabels(counter.labels);
  return `${counter.name}${labels} ${counter.value}`;
}

/**
 * Format a histogram metric in Prometheus text format
 *
 * Histograms produce multiple lines:
 * - bucket lines (one per bucket)
 * - _sum line
 * - _count line
 */
function formatHistogram(
  histogram: MetricsSnapshot["histograms"][number]
): string[] {
  const lines: string[] = [];
  const baseLabels = histogram.labels;
  const baseName = histogram.name;

  // Output buckets in ascending order (buckets is already a plain object)
  const buckets = Object.entries(histogram.buckets)
    .map(([le, count]) => [Number(le), count] as const)
    .sort(([a], [b]) => a - b);

  for (const [le, count] of buckets) {
    const labels = formatLabels({ ...baseLabels, le: le.toString() });
    lines.push(`${baseName}_bucket${labels} ${count}`);
  }

  // Add +Inf bucket (always equals total count)
  const infLabels = formatLabels({ ...baseLabels, le: "+Inf" });
  lines.push(`${baseName}_bucket${infLabels} ${histogram.count}`);

  // Add sum and count
  const baseLabelsStr = formatLabels(baseLabels);
  lines.push(`${baseName}_sum${baseLabelsStr} ${histogram.sum}`);
  lines.push(`${baseName}_count${baseLabelsStr} ${histogram.count}`);

  return lines;
}

/**
 * Generate Prometheus text format output
 */
export function generatePrometheusMetrics(): string {
  const snapshot = metrics.snapshot();
  const lines: string[] = [];

  // Group counters by name for HELP and TYPE comments
  const countersByName = new Map<string, Counter[]>();
  for (const counter of snapshot.counters) {
    const existing = countersByName.get(counter.name) ?? [];
    existing.push(counter);
    countersByName.set(counter.name, existing);
  }

  // Output counters
  for (const [name, counters] of countersByName.entries()) {
    lines.push(`# HELP ${name} Total count`);
    lines.push(`# TYPE ${name} counter`);
    for (const counter of counters) {
      lines.push(formatCounter(counter));
    }
  }

  // Group histograms by name for HELP and TYPE comments
  const histogramsByName = new Map<string, Histogram[]>();
  for (const histogram of snapshot.histograms) {
    const existing = histogramsByName.get(histogram.name) ?? [];
    existing.push(histogram);
    histogramsByName.set(histogram.name, existing);
  }

  // Output histograms
  for (const [name, histograms] of histogramsByName.entries()) {
    lines.push(`# HELP ${name} Histogram`);
    lines.push(`# TYPE ${name} histogram`);
    for (const histogram of histograms) {
      lines.push(...formatHistogram(histogram));
    }
  }

  // Add newline at the end
  return lines.join("\n") + "\n";
}

/**
 * HTTP handler for /metrics endpoint
 *
 * Returns Prometheus text format with appropriate content type.
 */
export function prometheusMetricsHandler(): Response {
  const metrics = generatePrometheusMetrics();

  return new Response(metrics, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
    },
  });
}
