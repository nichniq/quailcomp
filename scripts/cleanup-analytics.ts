#!/usr/bin/env bun
/**
 * Clean up old analytics events based on retention policy.
 *
 * Default: Void analytics events older than 90 days.
 *
 * Usage:
 *   bun run scripts/cleanup-analytics.ts
 *   bun run scripts/cleanup-analytics.ts --days=30
 *   bun run scripts/cleanup-analytics.ts --dry-run
 */

import { SQL } from "bun";

interface CleanupOptions {
  retentionDays: number;
  dryRun: boolean;
}

/**
 * Get database connection from environment
 */
function getConnection(): SQL {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL environment variable is required. " +
        "Example: postgres://quailcomp_app:password@localhost/quailcomp"
    );
  }
  return new SQL({ url: databaseUrl });
}

/**
 * Clean up old analytics events by voiding them
 */
async function cleanupAnalytics(
  options: CleanupOptions
): Promise<void> {
  const sql = getConnection();

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - options.retentionDays);

    console.log(
      `🗑️  Cleaning up analytics events older than ${options.retentionDays} days`
    );
    console.log(`   Cutoff date: ${cutoffDate.toISOString()}`);

    if (options.dryRun) {
      // Dry run - just count
      const result = await sql`
        SELECT COUNT(*) as count
        FROM events
        WHERE event_type LIKE 'analytics.%'
          AND occurred_at < ${cutoffDate}
          AND voided_at IS NULL
      `;

      const count = result[0]?.count || 0;
      console.log(`   Would void ${count} events (DRY RUN)`);
    } else {
      // Actually void events by inserting new entries with voided_at
      // This maintains the append-only event log integrity
      const result = await sql`
        WITH events_to_void AS (
          SELECT DISTINCT ON (event_id) event_id, event_type, occurred_at, data
          FROM events
          WHERE event_type LIKE 'analytics.%'
            AND occurred_at < ${cutoffDate}
            AND voided_at IS NULL
          ORDER BY event_id, entered_at DESC
        )
        INSERT INTO events (event_id, event_type, occurred_at, data, voided_at)
        SELECT event_id, event_type, occurred_at, data, NOW()
        FROM events_to_void
        RETURNING event_id
      `;

      console.log(`✅ Voided ${result.length} old analytics events`);
    }
  } catch (error) {
    console.error(`❌ Failed to cleanup analytics:`, error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const daysArg = args.find((arg) => arg.startsWith("--days="));
const retentionDays = daysArg
  ? parseInt(daysArg.split("=")[1])
  : parseInt(process.env.ANALYTICS_RETENTION_DAYS || "90");
const dryRun = args.includes("--dry-run");

// Validate retention days
if (isNaN(retentionDays) || retentionDays <= 0) {
  console.error(
    "Error: --days must be a positive number. Example: --days=30"
  );
  process.exit(1);
}

await cleanupAnalytics({ retentionDays, dryRun });
