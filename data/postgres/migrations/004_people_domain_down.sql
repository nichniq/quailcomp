-- Rollback: Remove People domain indexes
-- Description: Removes indexes created for people domain
-- Author: Claude Code
-- Date: 2026-02-01

DROP INDEX IF EXISTS idx_people_name_gin;
DROP INDEX IF EXISTS idx_people_email;
DROP INDEX IF EXISTS idx_people_relationships;
