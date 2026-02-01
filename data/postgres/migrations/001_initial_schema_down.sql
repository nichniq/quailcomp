-- ============================================================================
-- Rollback migration 001: Initial Schema
-- ============================================================================
-- This migration removes the entities and events tables and their supporting
-- infrastructure (triggers, functions, indexes, sequences).
--
-- WARNING: This will DELETE ALL DATA in entities and events tables.
-- Only run this if you are certain you want to completely remove the schema.
-- ============================================================================

-- Drop triggers first (they depend on functions)
DROP TRIGGER IF EXISTS check_event_id ON events;
DROP TRIGGER IF EXISTS check_entity_id ON entities;

-- Drop trigger functions
DROP FUNCTION IF EXISTS validate_event_id();
DROP FUNCTION IF EXISTS validate_entity_id();

-- Drop indexes on events (CASCADE not needed for indexes)
DROP INDEX IF EXISTS idx_events_data_gin;
DROP INDEX IF EXISTS idx_events_type_occurred;
DROP INDEX IF EXISTS idx_events_occurred;
DROP INDEX IF EXISTS idx_events_active;

-- Drop indexes on entities
DROP INDEX IF EXISTS idx_entities_data_gin;
DROP INDEX IF EXISTS idx_entities_type_active;
DROP INDEX IF EXISTS idx_entities_active;

-- Drop tables (CASCADE to remove dependent objects)
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS entities CASCADE;

-- Drop sequences
DROP SEQUENCE IF EXISTS event_id_seq;
DROP SEQUENCE IF EXISTS entity_id_seq;

-- ============================================================================
-- PERMISSION CLEANUP
-- ============================================================================
-- Note: This does NOT revoke permissions from roles or drop roles.
-- To fully clean up, you would need to manually:
--
-- 1. Revoke table permissions:
--    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM quailcomp_app;
--
-- 2. Revoke sequence permissions:
--    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM quailcomp_app;
--
-- 3. Drop roles (if desired):
--    DROP ROLE IF EXISTS quailcomp_app;
--    DROP ROLE IF EXISTS quailcomp_owner;
--
-- These are not included here to avoid breaking other migrations or applications.
-- ============================================================================
