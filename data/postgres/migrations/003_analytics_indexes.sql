-- ============================================================================
-- Migration 003: Analytics Indexes
-- ============================================================================
--
-- This migration adds indexes optimized for analytics queries on the events
-- table without modifying the table structure. Analytics events are stored
-- alongside domain events, distinguished by the 'analytics.*' event_type prefix.
--
-- Key additions:
-- - Composite index on (event_type, occurred_at) for time-series analytics
-- - Partial GIN index on JSONB data for analytics event filtering
-- - Database comments documenting analytics conventions and retention policy
--
-- Retention policy:
-- - Analytics events (analytics.*): 90 days
-- - Domain events (all others): Indefinite
--
-- Related documentation:
-- - /domains/analytics.md - Analytics event type definitions
-- - /docs/explanation/event-sourcing.md - Events vs entities architecture
-- ============================================================================

-- Analytics event type index for efficient time-series queries by type
-- This index is critical for queries like:
--   SELECT * FROM events
--   WHERE event_type = 'analytics.http_request'
--     AND occurred_at >= NOW() - INTERVAL '7 days'
--     AND voided_at IS NULL
--   ORDER BY occurred_at DESC;
CREATE INDEX IF NOT EXISTS idx_events_analytics_type_occurred
  ON events (event_type, occurred_at DESC)
  WHERE voided_at IS NULL
    AND event_type LIKE 'analytics.%';

COMMENT ON INDEX idx_events_analytics_type_occurred IS
  'Optimizes time-series analytics queries by event type. Partial index only covers active (non-voided) analytics events.';

-- Enhanced JSONB index specifically for analytics event data filtering
-- This index enables fast queries on analytics event properties like:
--   SELECT * FROM events
--   WHERE event_type = 'analytics.http_request'
--     AND data @> '{"status_code": 500}'::jsonb
--     AND voided_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_events_analytics_data ON events USING GIN (data)
  WHERE voided_at IS NULL
    AND event_type LIKE 'analytics.%';

COMMENT ON INDEX idx_events_analytics_data IS
  'GIN index for JSONB containment queries on analytics events. Enables filtering by status codes, user IDs, request paths, etc.';

-- Document analytics conventions on the events table
COMMENT ON TABLE events IS
  'Append-only event log using event sourcing pattern. Stores both domain events (book_acquired, user_registered) and analytics events (analytics.http_request, analytics.metadata_lookup). Analytics events use the analytics.* prefix and have a 90-day retention policy, while domain events are kept indefinitely.';

-- Document the event_type column conventions
COMMENT ON COLUMN events.event_type IS
  'Event type identifier. Domain events use lowercase_snake_case (e.g., book_acquired, user_registered). Analytics events use analytics.* prefix (e.g., analytics.http_request, analytics.metadata_lookup). Event type determines retention policy.';

-- Document retention policy on the voided_at column
COMMENT ON COLUMN events.voided_at IS
  'Soft void timestamp. Analytics events are voided after 90 days. Domain events are kept indefinitely unless explicitly voided. NULL indicates active event.';
