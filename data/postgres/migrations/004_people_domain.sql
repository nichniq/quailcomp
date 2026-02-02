-- Migration: Add People domain
-- Description: Stores people entities (authors, gift-givers, borrowers)
-- Author: Claude Code
-- Date: 2026-02-01

-- No new tables needed - uses existing entities table
-- Just need to register the entity type and add indexes

-- Enable pg_trgm extension for trigram similarity searches
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add GIN index for people name searches (case-insensitive, fuzzy)
-- This enables trigram similarity searches for "John" matching "Jonathan", etc.
CREATE INDEX IF NOT EXISTS idx_people_name_gin
ON entities USING gin ((data->>'name') gin_trgm_ops)
WHERE type = 'person' AND deleted_at IS NULL;

-- Add index for email lookups
-- This enables fast queries like "find person by email"
CREATE INDEX IF NOT EXISTS idx_people_email
ON entities ((data->>'email'))
WHERE type = 'person' AND deleted_at IS NULL AND (data->>'email') IS NOT NULL;

-- Add index for relationship filtering
-- This enables queries like "find all people who are gift_givers"
CREATE INDEX IF NOT EXISTS idx_people_relationships
ON entities USING gin ((data->'relationships') jsonb_path_ops)
WHERE type = 'person' AND deleted_at IS NULL;

COMMENT ON INDEX idx_people_name_gin IS
'Trigram index for fuzzy name searches on people entities';

COMMENT ON INDEX idx_people_email IS
'Email lookup index for people entities';

COMMENT ON INDEX idx_people_relationships IS
'JSONB index for filtering people by relationship types';
