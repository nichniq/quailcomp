-- Rollback: Remove Series domain indexes
-- Description: Drops indexes created for series domain support
-- Author: Claude Code
-- Date: 2026-02-01

DROP INDEX IF EXISTS idx_series_name_gin;
DROP INDEX IF EXISTS idx_books_series_id;
DROP INDEX IF EXISTS idx_books_series_volume;
