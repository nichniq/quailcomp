/**
 * Analytics Query Functions
 *
 * Common analytics query patterns for deriving insights from analytics events.
 * These functions leverage the specialized indexes created in migration 003.
 *
 * Query patterns include:
 * - Daily active users (DAU)
 * - HTTP error rates by endpoint
 * - Metadata provider performance statistics
 * - Latency percentiles
 * - User engagement metrics
 * - Feature adoption tracking
 */

import { EventsClient, getConnection } from "@quailcomp/data";
import type {
  HttpRequestEvent,
  MetadataLookupEvent,
  MetadataProviderResult,
  UserSessionStartedEvent,
} from "@quailcomp/domains/types/analytics";

const eventsClient = new EventsClient(getConnection());

/**
 * Daily Active Users (DAU)
 *
 * Counts unique users who started sessions each day within the date range.
 * Returns a map of date strings (YYYY-MM-DD) to user counts.
 *
 * @param startDate - Start of date range (inclusive)
 * @param endDate - End of date range (inclusive)
 * @returns Map of dates to unique user counts
 */
export async function getDailyActiveUsers(
  startDate: Date,
  endDate: Date
): Promise<Map<string, number>> {
  const events = await eventsClient.getByTimeRange(startDate, endDate);
  const loginEvents = events.filter(
    (e) =>
      e.eventType === "analytics.user_session_started" && e.voidedAt === null
  );

  // Group by date, tracking unique user_ids
  const dau = new Map<string, Set<number>>();

  for (const event of loginEvents) {
    const date = event.occurredAt.toISOString().split("T")[0];
    const userId = (event.data as UserSessionStartedEvent).user_id;

    if (!dau.has(date)) {
      dau.set(date, new Set());
    }
    dau.get(date)!.add(userId);
  }

  // Convert Sets to counts
  return new Map([...dau].map(([date, users]) => [date, users.size]));
}

/**
 * HTTP Error Rate
 *
 * Calculates the percentage of HTTP requests that resulted in errors (status >= 400)
 * within the date range, optionally filtered by endpoint path.
 *
 * @param startDate - Start of date range
 * @param endDate - End of date range
 * @param endpoint - Optional endpoint path filter (e.g., "/api/books")
 * @returns Error rate as a percentage (0-100)
 */
export async function getHttpErrorRate(
  startDate: Date,
  endDate: Date,
  endpoint?: string
): Promise<number> {
  const events = await eventsClient.getByTimeRange(startDate, endDate);
  const httpRequests = events.filter(
    (e) => e.eventType === "analytics.http_request" && e.voidedAt === null
  );

  const filtered = endpoint
    ? httpRequests.filter((e) => (e.data as HttpRequestEvent).path === endpoint)
    : httpRequests;

  if (filtered.length === 0) return 0;

  const errorCount = filtered.filter(
    (e) => (e.data as HttpRequestEvent).status_code >= 400
  ).length;

  return (errorCount / filtered.length) * 100;
}

/**
 * Metadata Provider Statistics
 *
 * Aggregates performance statistics for each metadata provider including:
 * - Average response time
 * - Success rate
 * - Total calls
 *
 * @param startDate - Start of date range
 * @param endDate - End of date range
 * @returns Array of provider statistics
 */
export async function getMetadataProviderStats(
  startDate: Date,
  endDate: Date
): Promise<
  Array<{
    providerName: string;
    avgDurationMs: number;
    successRate: number;
    totalCalls: number;
    successCount: number;
  }>
> {
  const events = await eventsClient.getByTimeRange(startDate, endDate);
  const lookupEvents = events.filter(
    (e) => e.eventType === "analytics.metadata_lookup" && e.voidedAt === null
  );

  // Aggregate provider results
  const providerStats = new Map<
    string,
    {
      durations: number[];
      successCount: number;
      totalCalls: number;
    }
  >();

  for (const event of lookupEvents) {
    const providers = (event.data as MetadataLookupEvent).providers;

    for (const provider of providers) {
      if (!providerStats.has(provider.name)) {
        providerStats.set(provider.name, {
          durations: [],
          successCount: 0,
          totalCalls: 0,
        });
      }

      const stats = providerStats.get(provider.name)!;
      stats.durations.push(provider.duration_ms);
      stats.totalCalls++;
      if (provider.success) {
        stats.successCount++;
      }
    }
  }

  // Calculate averages and rates
  return Array.from(providerStats.entries()).map(([name, stats]) => ({
    providerName: name,
    avgDurationMs:
      stats.durations.reduce((sum, d) => sum + d, 0) / stats.durations.length,
    successRate: (stats.successCount / stats.totalCalls) * 100,
    totalCalls: stats.totalCalls,
    successCount: stats.successCount,
  }));
}

/**
 * Latency Percentiles
 *
 * Calculates p50, p95, and p99 latency percentiles for HTTP requests,
 * optionally filtered by endpoint path.
 *
 * @param startDate - Start of date range
 * @param endDate - End of date range
 * @param endpoint - Optional endpoint path filter
 * @returns Object with p50, p95, p99 in milliseconds
 */
export async function getLatencyPercentiles(
  startDate: Date,
  endDate: Date,
  endpoint?: string
): Promise<{ p50: number; p95: number; p99: number }> {
  const events = await eventsClient.getByTimeRange(startDate, endDate);
  const httpRequests = events.filter(
    (e) => e.eventType === "analytics.http_request" && e.voidedAt === null
  );

  const filtered = endpoint
    ? httpRequests.filter((e) => (e.data as HttpRequestEvent).path === endpoint)
    : httpRequests;

  const durations = filtered
    .map((e) => (e.data as HttpRequestEvent).duration_ms)
    .sort((a, b) => a - b);

  if (durations.length === 0) {
    return { p50: 0, p95: 0, p99: 0 };
  }

  const p50 = durations[Math.floor(durations.length * 0.5)];
  const p95 = durations[Math.floor(durations.length * 0.95)];
  const p99 = durations[Math.floor(durations.length * 0.99)];

  return { p50, p95, p99 };
}

/**
 * User Engagement Metrics
 *
 * Aggregates engagement metrics for a specific user including:
 * - Total requests made
 * - Unique days active
 * - Features used
 * - Milestones reached
 *
 * @param userId - User ID to analyze
 * @param startDate - Start of date range
 * @param endDate - End of date range
 * @returns User engagement summary
 */
export async function getUserEngagementMetrics(
  userId: number,
  startDate: Date,
  endDate: Date
): Promise<{
  totalRequests: number;
  uniqueDaysActive: number;
  featuresUsed: Set<string>;
  milestonesReached: Set<string>;
}> {
  const events = await eventsClient.getByTimeRange(startDate, endDate);

  // Filter events for this user
  const userEvents = events.filter((e) => {
    const data = e.data as { user_id?: number | null };
    return data.user_id === userId && e.voidedAt === null;
  });

  // Count HTTP requests
  const totalRequests = userEvents.filter(
    (e) => e.eventType === "analytics.http_request"
  ).length;

  // Count unique days active
  const activeDays = new Set(
    userEvents.map((e) => e.occurredAt.toISOString().split("T")[0])
  );

  // Collect features used
  const featuresUsed = new Set<string>(
    userEvents
      .filter((e) => e.eventType === "analytics.feature_used")
      .map((e) => (e.data as { feature: string }).feature)
  );

  // Collect milestones reached
  const milestonesReached = new Set<string>(
    userEvents
      .filter((e) => e.eventType === "analytics.user_milestone")
      .map((e) => (e.data as { milestone: string }).milestone)
  );

  return {
    totalRequests,
    uniqueDaysActive: activeDays.size,
    featuresUsed,
    milestonesReached,
  };
}

/**
 * Feature Adoption
 *
 * Counts how many times a specific feature was used within the date range.
 *
 * @param feature - Feature name to track
 * @param startDate - Start of date range
 * @param endDate - End of date range
 * @returns Total usage count
 */
export async function getFeatureAdoption(
  feature: string,
  startDate: Date,
  endDate: Date
): Promise<number> {
  const events = await eventsClient.getByTimeRange(startDate, endDate);
  const featureEvents = events.filter(
    (e) =>
      e.eventType === "analytics.feature_used" &&
      (e.data as { feature: string }).feature === feature &&
      e.voidedAt === null
  );

  return featureEvents.length;
}

/**
 * Request Counts by Endpoint
 *
 * Aggregates HTTP request counts grouped by endpoint path.
 *
 * @param startDate - Start of date range
 * @param endDate - End of date range
 * @returns Map of endpoint paths to request counts
 */
export async function getRequestCountsByEndpoint(
  startDate: Date,
  endDate: Date
): Promise<Map<string, number>> {
  const events = await eventsClient.getByTimeRange(startDate, endDate);
  const httpRequests = events.filter(
    (e) => e.eventType === "analytics.http_request" && e.voidedAt === null
  );

  const counts = new Map<string, number>();

  for (const event of httpRequests) {
    const path = (event.data as HttpRequestEvent).path;
    counts.set(path, (counts.get(path) || 0) + 1);
  }

  return counts;
}

/**
 * Time to First Book
 *
 * Calculates the average time (in days) between user registration and
 * adding their first book.
 *
 * @param startDate - Start of registration date range
 * @param endDate - End of registration date range
 * @returns Average days to first book
 */
export async function getTimeToFirstBook(
  startDate: Date,
  endDate: Date
): Promise<number> {
  const events = await eventsClient.getByTimeRange(startDate, endDate);

  const milestones = events.filter(
    (e) => e.eventType === "analytics.user_milestone" && e.voidedAt === null
  );

  const firstBookEvents = milestones.filter(
    (e) => (e.data as { milestone: string }).milestone === "first_book_added"
  );

  const daysToFirstBook = firstBookEvents
    .map(
      (e) =>
        (e.data as { days_since_registration?: number })
          .days_since_registration || 0
    )
    .filter((days) => days !== undefined);

  if (daysToFirstBook.length === 0) return 0;

  return (
    daysToFirstBook.reduce((sum, days) => sum + days, 0) /
    daysToFirstBook.length
  );
}
