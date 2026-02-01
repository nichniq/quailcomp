-- ============================================================================
-- Rollback migration 002: Authentication and Authorization Tables
-- ============================================================================
-- This migration removes the users, user_credentials, and entity_access tables.
--
-- WARNING: This will DELETE ALL USER DATA and PERMISSIONS.
-- Only run this if you are certain you want to remove the authentication system.
-- ============================================================================

-- Drop indexes first
DROP INDEX IF EXISTS idx_entity_access_by_entity;
DROP INDEX IF EXISTS idx_entity_access_by_user;
DROP INDEX IF EXISTS idx_user_credentials_by_user;
DROP INDEX IF EXISTS idx_user_credentials_lookup;
DROP INDEX IF EXISTS idx_users_email;

-- Drop tables (CASCADE handles foreign key dependencies)
DROP TABLE IF EXISTS entity_access CASCADE;
DROP TABLE IF EXISTS user_credentials CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================================================
-- PERMISSION CLEANUP
-- ============================================================================
-- Revoke permissions that were granted in the up migration
REVOKE ALL ON entity_access FROM quailcomp_app;
REVOKE ALL ON user_credentials FROM quailcomp_app;
REVOKE ALL ON users FROM quailcomp_app;

-- Note: Sequences are auto-dropped when their owning tables are dropped
-- (users_user_id_seq and user_credentials_credential_id_seq)
-- ============================================================================
