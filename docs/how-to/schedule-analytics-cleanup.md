# Schedule Analytics Cleanup

Analytics events have a 90-day retention policy by default. This guide covers scheduling automated cleanup.

## Quick Start

Test the cleanup script first:

```bash
# Dry run - see what would be cleaned
bun run scripts/cleanup-analytics.ts --dry-run

# Actually clean up old events
bun run scripts/cleanup-analytics.ts
```

## Scheduling Options

### Option 1: Cron Job (Linux/macOS)

Add to your crontab to run daily at 2 AM:

```bash
# Edit crontab
crontab -e

# Add this line
0 2 * * * cd /path/to/quailcomp && bun run scripts/cleanup-analytics.ts >> /var/log/quailcomp-cleanup.log 2>&1
```

Replace `/path/to/quailcomp` with your actual installation path.

### Option 2: Systemd Timer (Linux)

Create `/etc/systemd/system/quailcomp-cleanup.service`:

```ini
[Unit]
Description=Quailcomp Analytics Cleanup

[Service]
Type=oneshot
User=quailcomp
WorkingDirectory=/path/to/quailcomp
Environment=DATABASE_URL=postgres://quailcomp_app:password@localhost/quailcomp
ExecStart=/usr/bin/bun run scripts/cleanup-analytics.ts
```

Create `/etc/systemd/system/quailcomp-cleanup.timer`:

```ini
[Unit]
Description=Run Quailcomp Analytics Cleanup Daily

[Timer]
OnCalendar=daily
Persistent=true

[Install]
WantedBy=timers.target
```

Enable and start:

```bash
sudo systemctl enable quailcomp-cleanup.timer
sudo systemctl start quailcomp-cleanup.timer

# Check timer status
sudo systemctl list-timers --all | grep quailcomp

# View logs
sudo journalctl -u quailcomp-cleanup.service
```

### Option 3: Database pg_cron Extension

If you have the `pg_cron` extension installed:

```sql
-- Install extension (one time)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily cleanup at 2 AM
SELECT cron.schedule(
  'cleanup-analytics',
  '0 2 * * *',
  $$
  WITH events_to_void AS (
    SELECT DISTINCT ON (event_id) event_id, event_type, occurred_at, data
    FROM events
    WHERE event_type LIKE 'analytics.%'
      AND occurred_at < NOW() - INTERVAL '90 days'
      AND voided_at IS NULL
    ORDER BY event_id, entered_at DESC
  )
  INSERT INTO events (event_id, event_type, occurred_at, data, voided_at)
  SELECT event_id, event_type, occurred_at, data, NOW()
  FROM events_to_void
  $$
);

-- View scheduled jobs
SELECT * FROM cron.job;

-- Remove job if needed
SELECT cron.unschedule('cleanup-analytics');
```

## Configuration

### Custom Retention Period

Set a different retention period:

```bash
# Clean up events older than 30 days
bun run scripts/cleanup-analytics.ts --days=30
```

Or set the environment variable:

```bash
# In .env or systemd service file
ANALYTICS_RETENTION_DAYS=30
```

### Environment Variables

The cleanup script uses:

| Variable | Default | Description |
|----------|---------|-------------|
| `ANALYTICS_RETENTION_DAYS` | `90` | Days to retain analytics events |
| `DATABASE_URL` | (required) | PostgreSQL connection URL |

## Monitoring

### Check What Would Be Cleaned

Always test with a dry run first:

```bash
bun run scripts/cleanup-analytics.ts --dry-run
```

### View Analytics Event Count

```sql
-- Count all analytics events
SELECT COUNT(*)
FROM events
WHERE event_type LIKE 'analytics.%'
  AND voided_at IS NULL;

-- Count by age
SELECT
  CASE
    WHEN occurred_at > NOW() - INTERVAL '30 days' THEN '< 30 days'
    WHEN occurred_at > NOW() - INTERVAL '60 days' THEN '30-60 days'
    WHEN occurred_at > NOW() - INTERVAL '90 days' THEN '60-90 days'
    ELSE '> 90 days'
  END AS age_range,
  COUNT(*) as count
FROM events
WHERE event_type LIKE 'analytics.%'
  AND voided_at IS NULL
GROUP BY age_range
ORDER BY age_range;
```

### View Voided Events

```sql
-- Count voided analytics events
SELECT COUNT(*)
FROM events
WHERE event_type LIKE 'analytics.%'
  AND voided_at IS NOT NULL;

-- Recent voidings
SELECT
  event_type,
  COUNT(*) as count,
  MIN(voided_at) as first_voided,
  MAX(voided_at) as last_voided
FROM events
WHERE event_type LIKE 'analytics.%'
  AND voided_at IS NOT NULL
  AND voided_at > NOW() - INTERVAL '7 days'
GROUP BY event_type
ORDER BY count DESC;
```

## Troubleshooting

### Script Fails with "Database Connection Failed"

Ensure `DATABASE_URL` environment variable is set:

```bash
export DATABASE_URL=postgres://quailcomp_app:password@localhost/quailcomp
bun run scripts/cleanup-analytics.ts --dry-run
```

### Permission Denied

The database user needs INSERT permission on the events table:

```sql
GRANT INSERT ON events TO quailcomp_app;
```

### No Events Cleaned

Check if analytics events exist:

```sql
SELECT COUNT(*)
FROM events
WHERE event_type LIKE 'analytics.%'
  AND occurred_at < NOW() - INTERVAL '90 days'
  AND voided_at IS NULL;
```

If count is 0, either:

- Analytics events are newer than 90 days
- They've already been voided
- Analytics tracking isn't enabled

## Best Practices

1. **Test first**: Always run with `--dry-run` before actual cleanup
2. **Monitor**: Check logs after first few scheduled runs
3. **Backup**: Take database backups before major cleanups
4. **Gradual rollout**: Start with longer retention (180 days) and decrease
5. **Off-peak hours**: Schedule during low-traffic periods (e.g., 2-4 AM)

## Related

- [Analytics Domain](../../domains/analytics.md) - Analytics event types
- [Event Sourcing](../explanation/event-sourcing.md) - Voiding vs deletion
- [Environment Variables](../reference/environment-variables.md) - Configuration
