/**
 * Analytics Retention and Cleanup
 *
 * Automated cleanup of old analytics events following the 90-day retention policy.
 * Domain events are never voided automatically - only analytics events (analytics.*).
 *
 * Usage:
 *   bun run server/src/analytics/retention.ts
 *
 * Or add to cron:
 *   0 2 * * * cd /path/to/quailcomp && bun run server/src/analytics/retention.ts
 */

import { EventsClient, getConnection } from "@quailcomp/data";
import type { Sql } from "@quailcomp/data";
import { createLogger } from "@/logging/logger";

const retentionLogger = createLogger().child({ context: "analytics-retention" });
const db: Sql = getConnection();

/**
 * Retention policy in days for analytics events
 */
const ANALYTICS_RETENTION_DAYS = 90;

/**
 * Clean up analytics events older than the retention period
 *
 * This function:
 * 1. Finds all analytics events older than ANALYTICS_RETENTION_DAYS
 * 2. Aggregates key metrics before deletion (optional)
 * 3. Voids old analytics events (soft delete)
 * 4. Leaves domain events untouched
 *
 * @returns Number of events voided
 */
export async function cleanupOldAnalytics(): Promise<number> {
  const eventsClient = new EventsClient(db);

  // Calculate cutoff date
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - ANALYTICS_RETENTION_DAYS);

  retentionLogger.info("Starting analytics retention cleanup", {
    cutoff_date: cutoffDate.toISOString(),
    retention_days: ANALYTICS_RETENTION_DAYS,
  });

  try {
    // Find all active analytics events older than cutoff
    const oldEvents = await db`
      SELECT event_id, event_type, occurred_at, data
      FROM events
      WHERE event_type LIKE 'analytics.%'
        AND occurred_at < ${cutoffDate}
        AND voided_at IS NULL
      ORDER BY occurred_at ASC
    `;

    if (oldEvents.length === 0) {
      retentionLogger.info("No analytics events to void");
      return 0;
    }

    retentionLogger.info("Found analytics events to void", {
      count: oldEvents.length,
      oldest: oldEvents[0]?.occurred_at,
      newest: oldEvents[oldEvents.length - 1]?.occurred_at,
    });

    // Optional: Aggregate metrics before voiding
    await aggregateBeforeVoiding(oldEvents);

    // Void each old analytics event
    let voidedCount = 0;
    for (const event of oldEvents) {
      try {
        await eventsClient.void({
          eventId: event.event_id,
          eventType: event.event_type,
          occurredAt: new Date(event.occurred_at),
          data: event.data,
        });
        voidedCount++;
      } catch (error) {
        retentionLogger.error("Failed to void event", {
          event_id: event.event_id,
          event_type: event.event_type,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    retentionLogger.info("Analytics retention cleanup completed", {
      voided_count: voidedCount,
      failed_count: oldEvents.length - voidedCount,
    });

    return voidedCount;
  } catch (error) {
    retentionLogger.error("Analytics retention cleanup failed", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

/**
 * Aggregate key metrics before voiding events
 *
 * Creates summary events containing pre-aggregated analytics data
 * that can be queried even after raw events are voided.
 *
 * @param events - Events to aggregate
 */
async function aggregateBeforeVoiding(
  events: Array<{
    event_id: number;
    event_type: string;
    occurred_at: string | Date;
    data: unknown;
  }>
): Promise<void> {
  const eventsClient = new EventsClient(db);

  // Group events by type
  const eventsByType = new Map<string, typeof events>();
  for (const event of events) {
    if (!eventsByType.has(event.event_type)) {
      eventsByType.set(event.event_type, []);
    }
    eventsByType.get(event.event_type)!.push(event);
  }

  // Create aggregation summary for each type
  for (const [eventType, typeEvents] of eventsByType.entries()) {
    try {
      const summary = {
        event_type: eventType,
        period_start:
          typeEvents[0]?.occurred_at,
        period_end:
          typeEvents[typeEvents.length - 1]?.occurred_at,
        event_count: typeEvents.length,
        aggregated_at: new Date().toISOString(),
      };

      await eventsClient.record({
        eventType: "analytics.aggregated_summary",
        occurredAt: new Date(),
        data: summary,
      });

      retentionLogger.info("Created aggregation summary", {
        event_type: eventType,
        event_count: typeEvents.length,
      });
    } catch (error) {
      retentionLogger.error("Failed to create aggregation summary", {
        event_type: eventType,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

/**
 * Get retention statistics
 *
 * Returns counts of analytics events by age bucket.
 *
 * @returns Statistics object with event counts
 */
export async function getRetentionStats(): Promise<{
  total_analytics_events: number;
  voided_analytics_events: number;
  active_analytics_events: number;
  events_older_than_retention: number;
  oldest_event_age_days: number | null;
}> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - ANALYTICS_RETENTION_DAYS);

  const stats = await db`
    SELECT
      COUNT(*) FILTER (WHERE event_type LIKE 'analytics.%') as total_analytics,
      COUNT(*) FILTER (WHERE event_type LIKE 'analytics.%' AND voided_at IS NOT NULL) as voided_analytics,
      COUNT(*) FILTER (WHERE event_type LIKE 'analytics.%' AND voided_at IS NULL) as active_analytics,
      COUNT(*) FILTER (WHERE event_type LIKE 'analytics.%' AND occurred_at < ${cutoffDate} AND voided_at IS NULL) as older_than_retention,
      EXTRACT(DAY FROM (NOW() - MIN(occurred_at) FILTER (WHERE event_type LIKE 'analytics.%' AND voided_at IS NULL))) as oldest_age_days
    FROM events
  `;

  return {
    total_analytics_events: Number(stats[0]?.total_analytics || 0),
    voided_analytics_events: Number(stats[0]?.voided_analytics || 0),
    active_analytics_events: Number(stats[0]?.active_analytics || 0),
    events_older_than_retention: Number(
      stats[0]?.older_than_retention || 0
    ),
    oldest_event_age_days: stats[0]?.oldest_age_days
      ? Number(stats[0].oldest_age_days)
      : null,
  };
}

/**
 * Main execution when run as script
 */
if (import.meta.main) {
  retentionLogger.info("Analytics retention script started");

  // Show stats before cleanup
  const statsBefore = await getRetentionStats();
  retentionLogger.info("Retention stats before cleanup", statsBefore);

  // Run cleanup
  const voidedCount = await cleanupOldAnalytics();

  // Show stats after cleanup
  const statsAfter = await getRetentionStats();
  retentionLogger.info("Retention stats after cleanup", statsAfter);

  retentionLogger.info("Analytics retention script completed", {
    voided_count: voidedCount,
  });

  process.exit(0);
}
