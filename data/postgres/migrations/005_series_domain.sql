-- Migration: Add Series domain
-- Description: Adds indexes for series entities and book-to-series relationships
-- Author: Claude Code
-- Date: 2026-02-01

-- No new tables needed - uses existing entities table
-- Series entities stored with type='series'
-- Book-to-series relationship via PhysicalBook.series_id field

-- Add GIN index for series name searches (case-insensitive, fuzzy matching)
CREATE INDEX IF NOT EXISTS idx_series_name_gin
ON entities USING gin ((data->>'name') gin_trgm_ops)
WHERE type = 'series' AND deleted_at IS NULL;

-- Add index for books filtered by series_id
-- This speeds up queries like "find all books in series X"
CREATE INDEX IF NOT EXISTS idx_books_series_id
ON entities ((data->>'series_id'))
WHERE type = 'book' AND deleted_at IS NULL AND (data->>'series_id') IS NOT NULL;

-- Add index for volume number ordering within a series
-- Useful for "get books in series X ordered by volume number"
CREATE INDEX IF NOT EXISTS idx_books_series_volume
ON entities ((data->>'series_id'), ((data->>'volume_number')::int))
WHERE type = 'book' AND deleted_at IS NULL AND (data->>'series_id') IS NOT NULL;

COMMENT ON INDEX idx_series_name_gin IS
'Trigram index for fuzzy name searches on series entities';

COMMENT ON INDEX idx_books_series_id IS
'Index for finding all books belonging to a specific series';

COMMENT ON INDEX idx_books_series_volume IS
'Composite index for ordering books by volume number within a series';
