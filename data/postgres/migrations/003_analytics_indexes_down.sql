-- ============================================================================
-- Rollback migration 003: Analytics Indexes
-- ============================================================================
-- This migration removes the analytics-specific indexes and comments added
-- in migration 003. The events table structure and data are NOT modified.
--
-- This is a SAFE rollback - no data is lost, only performance optimizations
-- for analytics queries are removed.
-- ============================================================================

-- Drop analytics-specific indexes
DROP INDEX IF EXISTS idx_events_analytics_data;
DROP INDEX IF EXISTS idx_events_analytics_type_occurred;

-- Remove table and column comments (restore to migration 001 state)
COMMENT ON TABLE events IS
  'Append-only event log using event sourcing pattern. Each entry represents a point-in-time snapshot of an event.';

COMMENT ON COLUMN events.event_type IS
  'Type of event (e.g., book_acquired, book_lent)';

COMMENT ON COLUMN events.voided_at IS
  'NULL for active events, timestamp when event was voided/cancelled';

-- ============================================================================
-- NOTE: Analytics Events Remain
-- ============================================================================
-- This rollback does NOT delete analytics events from the events table.
-- To delete all analytics events, run:
--
--   DELETE FROM events WHERE event_type LIKE 'analytics.%';
--
-- However, this violates the append-only principle. To properly void them:
--
--   INSERT INTO events (event_id, event_type, occurred_at, data, voided_at)
--   SELECT event_id, event_type, occurred_at, data, NOW()
--   FROM events
--   WHERE event_type LIKE 'analytics.%'
--     AND voided_at IS NULL;
-- ============================================================================
