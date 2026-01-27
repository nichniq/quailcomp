-- ============================================================================
-- Migration 000: Schema Migrations Tracking Table
-- ============================================================================
--
-- This migration creates the tracking table used by the migration runner.
-- It must be the first migration (000) to enable all subsequent tracking.
--
-- Table tracks:
-- - version: Migration filename (e.g., "001_initial_schema")
-- - applied_at: When the migration was executed
-- - checksum: SHA256 hash to detect file modifications
-- - execution_time_ms: Performance tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(100) PRIMARY KEY,
    applied_at TIMESTAMPTZ DEFAULT NOW(),
    checksum VARCHAR(64) NOT NULL,
    execution_time_ms INTEGER
);

COMMENT ON TABLE schema_migrations IS 'Tracks which migrations have been applied to this database';
COMMENT ON COLUMN schema_migrations.version IS 'Migration filename without .sql extension (e.g., 001_initial_schema)';
COMMENT ON COLUMN schema_migrations.checksum IS 'SHA256 hash of migration file contents at time of application';
