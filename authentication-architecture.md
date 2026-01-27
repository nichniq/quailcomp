# Authentication Architecture

## Overview

This document describes the authentication and authorization architecture for the personal data management system. The design supports multiple authentication methods (password, passkeys, OAuth, API keys) while maintaining clean separation between authentication (who you are) and authorization (what you can do).

## Key Concepts

### Authentication vs Authorization

- **Authentication**: Proving identity ("Who are you?")
- **Authorization**: Determining permissions ("What can you do?")

### Core Principle

Authentication methods are implementation details. The system always operates on `user_id`, regardless of how that user authenticated. This separation allows:

- Adding new authentication methods without changing domain logic
- Users having multiple ways to log in to the same account
- Authorization rules that are independent of authentication method

## Database Schema

### Users Table

The core identity table representing "who exists in the system."

```sql
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username TEXT UNIQUE,        -- may be null for OAuth-only users
    email TEXT UNIQUE NOT NULL,  -- stable identifier across auth methods
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### User Credentials Table

Flexible storage for multiple authentication methods per user.

```sql
CREATE TABLE user_credentials (
    credential_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    credential_type TEXT NOT NULL,  -- 'password', 'passkey', 'oauth_google', 'oauth_github', 'api_key'
    credential_data JSONB NOT NULL, -- type-specific authentication data
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    
    -- Ensure credential_type is from allowed set
    CONSTRAINT valid_credential_type CHECK (
        credential_type IN ('password', 'passkey', 'oauth_google', 'oauth_github', 'api_key')
    )
);

-- Index for credential lookups during authentication
CREATE INDEX idx_user_credentials_lookup 
    ON user_credentials(credential_type, (credential_data->>'identifier'))
    WHERE is_active = true;

-- Index for user credential management
CREATE INDEX idx_user_credentials_by_user 
    ON user_credentials(user_id)
    WHERE is_active = true;
```

### Entity Access Table

Authorization layer defining what users can access (separate from authentication).

```sql
CREATE TABLE entity_access (
    entity_id INTEGER NOT NULL REFERENCES entities(entity_id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    access_level TEXT NOT NULL DEFAULT 'owner',  -- 'owner', 'write', 'read'
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
```

## Authentication Methods

### Password Authentication

Traditional username/password authentication using bcrypt for password hashing.

**Credential Data Schema:**
```json
{
    "identifier": "nick@example.com",  // email or username
    "password_hash": "$2b$10$...",     // bcrypt hash
    "salt": "..."                       // optional, bcrypt includes salt in hash
}
```

**Authentication Flow:**
1. User provides identifier (email/username) + password
2. Look up credential: `WHERE credential_type = 'password' AND credential_data->>'identifier' = ?`
3. Verify password against stored hash using bcrypt
4. Update `last_used_at`
5. Generate and return JWT with `user_id`

**Security Considerations:**
- Minimum password requirements (length, complexity)
- Rate limiting on failed login attempts
- Consider password breach checking (HaveIBeenPwned API)

### Passkey/WebAuthn

Modern passwordless authentication using public-key cryptography and device biometrics.

**Credential Data Schema:**
```json
{
    "credential_id": "base64_encoded_credential_id",  // from WebAuthn device
    "public_key": "base64_encoded_public_key",        // stored server-side
    "counter": 0,                                      // signature counter for replay protection
    "device_name": "Nick's iPhone",                    // optional user-friendly name
    "aaguid": "...",                                   // optional authenticator info
    "transports": ["usb", "nfc", "ble"]               // optional supported transports
}
```

**Registration Flow:**
1. User initiates passkey registration
2. Server generates challenge (random bytes)
3. Device creates key pair, returns credential_id + public_key
4. Server stores public_key in credential_data
5. Private key never leaves user's device

**Authentication Flow:**
1. User initiates passkey login
2. Server generates challenge
3. Device signs challenge with private key
4. Look up credential: `WHERE credential_type = 'passkey' AND credential_data->>'credential_id' = ?`
5. Verify signature using stored public_key
6. Check and update counter (prevents replay attacks)
7. Update `last_used_at`
8. Generate and return JWT with `user_id`

**Security Considerations:**
- Phishing-resistant (signature tied to domain)
- No password to steal or forget
- Requires HTTPS
- Need fallback recovery method

### OAuth (Google, GitHub, etc.)

Third-party authentication via OAuth 2.0 providers.

**Credential Data Schema:**
```json
{
    "provider_user_id": "1234567890",           // Provider's unique ID for this user
    "email": "nick@gmail.com",                  // From OAuth profile
    "profile": {                                 // Optional cached profile data
        "name": "Nick",
        "avatar_url": "https://...",
        "locale": "en-US"
    },
    "access_token_hash": "hash...",             // Optional: for API access
    "refresh_token_hash": "hash...",            // Optional: for token refresh
    "token_expires_at": "2026-02-01T00:00:00Z" // Optional: token expiration
}
```

**Authentication Flow:**
1. User clicks "Login with Google"
2. Redirect to OAuth provider's authorization URL
3. User authorizes, provider redirects back with authorization code
4. Exchange code for access token and user profile
5. Look up credential: `WHERE credential_type = 'oauth_google' AND credential_data->>'provider_user_id' = ?`
6. If not found, create new user + credential (account creation)
7. Update `last_used_at`
8. Generate and return JWT with `user_id`

**Account Linking:**
- If user is already logged in, can link OAuth account to existing user
- Prevents duplicate accounts when user has multiple login methods

**Security Considerations:**
- Validate state parameter (CSRF protection)
- Verify token signatures if using ID tokens
- Handle email changes at provider
- Consider provider-specific scopes and permissions

### API Keys

Long-lived tokens for programmatic access and service-to-service communication.

**Credential Data Schema:**
```json
{
    "key_hash": "sha256_hash_of_full_key",  // Never store raw key
    "prefix": "pk_live_",                    // For display/identification
    "last_4": "c123",                        // Last 4 chars for user reference
    "name": "GitHub Actions CI",             // User-provided label
    "scopes": ["read:entities", "write:entities"],  // Optional permission scopes
    "ip_whitelist": ["192.168.1.0/24"],     // Optional IP restrictions
    "rate_limit": 1000                       // Optional per-hour rate limit
}
```

**Generation Flow:**
1. User requests new API key
2. Server generates secure random key: `pk_live_<random_32_bytes>`
3. Display full key to user ONCE (never shown again)
4. Store hash of full key in credential_data
5. Store prefix and last_4 for user reference

**Authentication Flow:**
1. Client sends key in header: `Authorization: Bearer pk_live_abc123...`
2. Hash the provided key
3. Look up credential: `WHERE credential_type = 'api_key' AND credential_data->>'key_hash' = ?`
4. Verify key is active and within rate limits
5. Check IP whitelist if configured
6. Update `last_used_at`
7. Proceed with request using associated `user_id`

**Security Considerations:**
- Keys should be long and cryptographically random
- Support key rotation (multiple active keys)
- Support key revocation (set is_active = false)
- Log key usage for audit trail
- Consider key expiration policies
- Rate limiting per key

## JWT Token Structure

Regardless of authentication method, the JWT contains standardized claims:

```typescript
interface JWTPayload {
    user_id: number;           // Always present - the authenticated user
    email: string;             // Stable identifier
    username?: string;         // May be null for OAuth-only users
    iat: number;              // Issued at (Unix timestamp)
    exp: number;              // Expires (Unix timestamp)
    
    // Optional metadata
    credential_id?: number;    // Which credential was used for this login
    auth_method?: string;      // 'password' | 'passkey' | 'oauth_google' | 'api_key'
    session_id?: string;       // Optional session tracking
}
```

**Token Lifecycle:**
- Short-lived access tokens (15 minutes - 1 hour)
- Optional refresh tokens for longer sessions
- Token expiration forces re-authentication
- Consider token blacklist for logout/revocation

## TypeScript Types

```typescript
// Credential types
type CredentialType = 
    | 'password'
    | 'passkey'
    | 'oauth_google'
    | 'oauth_github'
    | 'api_key';

// Base credential interface
interface Credential {
    credential_id: number;
    user_id: number;
    credential_type: CredentialType;
    credential_data: CredentialData;
    created_at: Date;
    last_used_at: Date | null;
    is_active: boolean;
}

// Credential data variants
type CredentialData = 
    | PasswordCredential
    | PasskeyCredential
    | OAuthCredential
    | APIKeyCredential;

interface PasswordCredential {
    identifier: string;
    password_hash: string;
}

interface PasskeyCredential {
    credential_id: string;
    public_key: string;
    counter: number;
    device_name?: string;
    aaguid?: string;
    transports?: ('usb' | 'nfc' | 'ble' | 'internal')[];
}

interface OAuthCredential {
    provider_user_id: string;
    email: string;
    profile?: {
        name?: string;
        avatar_url?: string;
        locale?: string;
        [key: string]: any;
    };
    access_token_hash?: string;
    refresh_token_hash?: string;
    token_expires_at?: string;
}

interface APIKeyCredential {
    key_hash: string;
    prefix: string;
    last_4: string;
    name?: string;
    scopes?: string[];
    ip_whitelist?: string[];
    rate_limit?: number;
}

// Access control
type AccessLevel = 'owner' | 'write' | 'read';

interface EntityAccess {
    entity_id: number;
    user_id: number;
    access_level: AccessLevel;
    granted_at: Date;
    granted_by: number | null;
}
```

## Implementation Phases

### Phase 1: No Authentication (Current)

**Goal:** Build domain logic without authentication complexity.

```sql
-- Minimal setup
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL
);

-- Single hardcoded user
INSERT INTO users (user_id, username) VALUES (1, 'nick');

-- Helper function for development
CREATE FUNCTION current_user_id() RETURNS INTEGER AS $$
    SELECT 1;  -- Always return the single user
$$ LANGUAGE SQL STABLE;
```

**Focus:** 
- Build entity management
- Implement domains (Books, Contacts, etc.)
- Develop frontend without auth UI

### Phase 2: Basic Password Authentication

**Goal:** Add security with simple username/password.

**Steps:**
1. Create `user_credentials` table
2. Implement password hashing with bcrypt
3. Create login endpoint
4. Generate JWT tokens
5. Add authorization middleware
6. Implement `current_user_id()` from JWT

**New Endpoints:**
- `POST /auth/register` - Create user + password credential
- `POST /auth/login` - Authenticate and return JWT
- `POST /auth/logout` - Invalidate token (if using blacklist)

### Phase 3: Passkeys (Passwordless)

**Goal:** Modern, secure authentication without passwords.

**Steps:**
1. Add passkey credential type
2. Implement WebAuthn registration flow
3. Implement WebAuthn authentication flow
4. Build passkey management UI
5. Support multiple passkeys per user

**New Endpoints:**
- `POST /auth/passkey/register/start` - Begin registration
- `POST /auth/passkey/register/finish` - Complete registration
- `POST /auth/passkey/login/start` - Begin authentication
- `POST /auth/passkey/login/finish` - Complete authentication
- `GET /auth/passkeys` - List user's passkeys
- `DELETE /auth/passkeys/:id` - Remove passkey

### Phase 4: OAuth Providers

**Goal:** Social login (Google, GitHub, etc.)

**Steps:**
1. Register OAuth applications with providers
2. Add OAuth credential type
3. Implement OAuth flows
4. Handle account linking
5. Support profile synchronization

**New Endpoints:**
- `GET /auth/oauth/:provider/login` - Start OAuth flow
- `GET /auth/oauth/:provider/callback` - Handle provider redirect
- `POST /auth/oauth/:provider/link` - Link OAuth to existing account
- `DELETE /auth/oauth/:provider/unlink` - Remove OAuth connection

### Phase 5: API Keys

**Goal:** Programmatic access for automation and integrations.

**Steps:**
1. Add API key credential type
2. Implement key generation
3. Add key management UI
4. Implement scoped permissions
5. Add rate limiting

**New Endpoints:**
- `POST /auth/api-keys` - Generate new API key
- `GET /auth/api-keys` - List user's API keys
- `PATCH /auth/api-keys/:id` - Update key settings
- `DELETE /auth/api-keys/:id` - Revoke API key

## Security Best Practices

### General
- Always use HTTPS in production
- Implement rate limiting on all auth endpoints
- Log authentication events for audit trail
- Use secure random number generation
- Rotate secrets regularly

### Password Security
- Minimum 8-10 characters
- Use bcrypt with appropriate cost factor (10-12)
- Implement account lockout after failed attempts
- Consider breach checking (HaveIBeenPwned)
- Never log or display passwords

### Token Security
- Short expiration times (15-60 minutes)
- Use refresh tokens for longer sessions
- Sign tokens with strong secret (256+ bits)
- Validate token claims thoroughly
- Implement token revocation mechanism

### API Key Security
- Generate keys with cryptographic randomness
- Never store raw keys (only hashes)
- Support key rotation
- Implement per-key rate limiting
- Log key usage for security monitoring

### OAuth Security
- Validate state parameter (CSRF protection)
- Use PKCE for public clients
- Verify redirect URIs strictly
- Handle token refresh securely
- Don't trust profile data without verification

## Account Linking Example

A user can have multiple authentication methods for the same account:

```sql
-- Nick's account with multiple credentials
SELECT * FROM users WHERE user_id = 1;
-- user_id | username | email           | created_at
-- --------|----------|-----------------|------------
-- 1       | nick     | nick@example.com| 2026-01-01

SELECT * FROM user_credentials WHERE user_id = 1;
-- credential_id | user_id | credential_type | last_used_at
-- --------------|---------|-----------------|-------------
-- 1             | 1       | password        | 2026-01-25
-- 2             | 1       | passkey         | 2026-01-26  (iPhone)
-- 3             | 1       | passkey         | 2026-01-20  (Laptop)
-- 4             | 1       | oauth_google    | 2026-01-24
-- 5             | 1       | api_key         | 2026-01-26  (CI/CD)
-- 6             | 1       | api_key         | 2026-01-23  (Mobile app)
```

Nick can now:
- Log in with password
- Use biometrics on iPhone or laptop
- Click "Login with Google"
- Use API keys for automation

All methods authenticate to the same `user_id = 1`, giving access to the same entities and data.

## Authorization Flow

Once authenticated, every request goes through authorization:

```typescript
// Middleware pseudocode
async function authorizeRequest(request: Request) {
    // 1. Extract and verify JWT (or API key)
    const token = extractToken(request);
    const payload = verifyJWT(token);
    const userId = payload.user_id;
    
    // 2. For entity operations, check access
    const entityId = request.params.entityId;
    const access = await db.query(`
        SELECT access_level 
        FROM entity_access 
        WHERE entity_id = $1 AND user_id = $2
    `, [entityId, userId]);
    
    // 3. Verify sufficient access level
    const requiredLevel = getRequiredAccessLevel(request.method);
    if (!hasAccess(access.access_level, requiredLevel)) {
        throw new ForbiddenError();
    }
    
    // 4. Proceed with request
    request.userId = userId;
    next();
}
```

## Future Considerations

### Multi-tenancy
If expanding beyond personal use:
- Add `organization_id` to users table
- Separate entity_access per organization
- Consider organization-level API keys

### Advanced Features
- Two-factor authentication (2FA/MFA)
- Conditional access (device, location, risk-based)
- Session management (view/revoke active sessions)
- Audit logs for all authentication events
- Account recovery flows
- Email verification
- Magic links (passwordless email login)

### Performance Optimization
- Cache user lookups
- Optimize credential lookup queries
- Consider Redis for session/token storage
- Implement connection pooling

## References

- [OAuth 2.0 RFC](https://tools.ietf.org/html/rfc6749)
- [WebAuthn Specification](https://www.w3.org/TR/webauthn/)
- [JWT RFC](https://tools.ietf.org/html/rfc7519)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)

## Document History

- 2026-01-26: Initial architecture documented
- Last updated: 2026-01-26
