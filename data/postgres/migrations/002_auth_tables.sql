-- ============================================================================
-- Migration 002: Authentication and Authorization Tables
-- ============================================================================
--
-- This migration adds:
-- - users: Core identity table
-- - user_credentials: Flexible authentication methods (password, passkey, oauth, api_key)
-- - entity_access: Resource-level permissions (owner, write, read)
--
-- Schema follows authentication-architecture.md
-- ============================================================================

-- ============================================================================
-- USERS TABLE
-- ============================================================================
-- Core identity table representing "who exists in the system"

CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username TEXT UNIQUE,                     -- may be null for OAuth-only users
    email TEXT UNIQUE NOT NULL,               -- stable identifier across auth methods
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for email lookups (common auth pattern)
CREATE INDEX idx_users_email ON users(email);

COMMENT ON TABLE users IS 'Core identity table - represents who exists in the system';
COMMENT ON COLUMN users.username IS 'Optional username, may be null for OAuth-only users';
COMMENT ON COLUMN users.email IS 'Stable identifier across all authentication methods';


-- ============================================================================
-- USER CREDENTIALS TABLE
-- ============================================================================
-- Flexible storage for multiple authentication methods per user
-- Supports: password, passkey, oauth_google, oauth_github, api_key

CREATE TABLE user_credentials (
    credential_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    credential_type TEXT NOT NULL,
    credential_data JSONB NOT NULL,           -- type-specific authentication data
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,

    -- Ensure credential_type is from allowed set
    CONSTRAINT valid_credential_type CHECK (
        credential_type IN ('password', 'passkey', 'oauth_google', 'oauth_github', 'api_key')
    )
);

-- Index for credential lookups during authentication
-- Used when: looking up by credential_type + identifier (e.g., email for password auth)
CREATE INDEX idx_user_credentials_lookup
    ON user_credentials(credential_type, (credential_data->>'identifier'))
    WHERE is_active = true;

-- Index for user credential management
-- Used when: listing all credentials for a user
CREATE INDEX idx_user_credentials_by_user
    ON user_credentials(user_id)
    WHERE is_active = true;

COMMENT ON TABLE user_credentials IS 'Flexible authentication methods - one user can have many credentials';
COMMENT ON COLUMN user_credentials.credential_type IS 'Type of credential: password, passkey, oauth_google, oauth_github, api_key';
COMMENT ON COLUMN user_credentials.credential_data IS 'Type-specific data (e.g., password_hash for password, public_key for passkey)';
COMMENT ON COLUMN user_credentials.is_active IS 'Soft-disable credentials without deleting them';


-- ============================================================================
-- ENTITY ACCESS TABLE
-- ============================================================================
-- Authorization layer defining what users can access
-- Separate from authentication - this is about permissions, not identity

CREATE TABLE entity_access (
    entity_id BIGINT NOT NULL,                -- references entities.entity_id
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    access_level TEXT NOT NULL DEFAULT 'owner',
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    granted_by INTEGER REFERENCES users(user_id),  -- who granted this access

    PRIMARY KEY (entity_id, user_id),

    CONSTRAINT valid_access_level CHECK (
        access_level IN ('owner', 'write', 'read')
    )
);

-- Index for "show me all entities I can access"
CREATE INDEX idx_entity_access_by_user
    ON entity_access(user_id, access_level);

-- Index for "who has access to this entity"
CREATE INDEX idx_entity_access_by_entity
    ON entity_access(entity_id);

COMMENT ON TABLE entity_access IS 'Resource-level permissions - who can access what entities';
COMMENT ON COLUMN entity_access.access_level IS 'Permission level: owner (full control), write (modify), read (view only)';
COMMENT ON COLUMN entity_access.granted_by IS 'User who granted this access (null for self-granted owner)';


-- ============================================================================
-- PERMISSIONS
-- ============================================================================
-- Grant appropriate permissions to the application role

GRANT SELECT, INSERT, UPDATE ON users TO quailcomp_app;
GRANT SELECT, INSERT, UPDATE ON user_credentials TO quailcomp_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON entity_access TO quailcomp_app;

-- Grant sequence usage for auto-increment IDs
GRANT USAGE ON SEQUENCE users_user_id_seq TO quailcomp_app;
GRANT USAGE ON SEQUENCE user_credentials_credential_id_seq TO quailcomp_app;


-- ============================================================================
-- CREDENTIAL DATA SCHEMAS (Documentation)
-- ============================================================================
--
-- Password credential_data:
-- {
--     "identifier": "nick@example.com",  // email or username
--     "password_hash": "$2b$10$..."       // bcrypt hash
-- }
--
-- Passkey credential_data:
-- {
--     "credential_id": "base64_encoded",  // from WebAuthn device
--     "public_key": "base64_encoded",     // stored server-side
--     "counter": 0,                        // signature counter
--     "device_name": "Nick's iPhone"       // optional
-- }
--
-- OAuth credential_data:
-- {
--     "provider_user_id": "1234567890",   // Provider's unique ID
--     "email": "nick@gmail.com",           // From OAuth profile
--     "profile": { ... }                   // Optional cached profile
-- }
--
-- API Key credential_data:
-- {
--     "key_hash": "sha256_hash",          // Never store raw key
--     "prefix": "pk_live_",                // For display
--     "last_4": "c123",                    // For user reference
--     "name": "GitHub Actions CI",         // User label
--     "scopes": ["read:entities"]          // Optional permissions
-- }
-- ============================================================================
