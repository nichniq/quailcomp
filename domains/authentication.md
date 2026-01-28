# Authentication

> Manages user identity and provides multiple methods for verifying who someone is.

This domain handles the "who are you?" question through various authentication methods
including passwords, passwordless (passkeys), OAuth providers, and API keys. Each user
has a stable identity (`user_id`) that persists regardless of which authentication
method they use to log in.

**Key Principle**: Authentication is separate from authorization. This domain proves
identity; the Authorization domain determines what an authenticated user can do.

## Authentication vs Authorization

> Authentication answers "Who are you?" while Authorization answers "What can you do?"

Authentication establishes identity by verifying credentials. Once authenticated, the
system operates entirely on `user_id` - a stable identifier that doesn't change
regardless of how the user logged in (password, passkey, OAuth, or API key).

This separation allows:

- Adding new authentication methods without changing domain logic
- Users having multiple ways to access the same account
- Authorization rules that are independent of authentication method

Example: A user (user_id=1) can log in with:

- Password: <nick@example.com> + password123
- Passkey: Biometrics on their iPhone
- OAuth: "Login with Google" button
- API Key: For automation scripts

All four methods authenticate to the same account and receive a JWT containing
the same `user_id`, granting identical permissions.

## User Identity

> A user is a person or service with a unique stable identifier in the system.

Every user has a `user_id` (numeric primary key) that never changes. Users also
have an email (required, unique) and optionally a username. Email serves as the
stable identifier across authentication methods - if a user logs in via Google OAuth
and later adds password authentication, the email links these credentials together.

Username is optional to support OAuth-only accounts where the provider might not
supply a username.

```typescript
export interface User {
  userId: number
  username: string | null
  email: string
  createdAt: Date
  updatedAt: Date
}
```

## Credentials

> A credential is a specific authentication method attached to a user account.

One user can have multiple credentials (one password + two passkeys + one OAuth + one API key).
Each credential is independently managed - users can add, remove, or temporarily disable
credentials without affecting others.

Credentials store method-specific data in a JSONB field, allowing each authentication
type to have its own structure (password hash, public key, OAuth tokens, etc.).

### Credential Types

> Five authentication methods are supported, each stored as a different credential type.

```typescript
export type CredentialType =
  | "password"
  | "passkey"
  | "oauth_google"
  | "oauth_github"
  | "api_key"
```

### Credential Record

> The complete credential entry as stored in the database.

```typescript
export interface Credential {
  credentialId: number
  userId: number
  credentialType: CredentialType
  credentialData: CredentialData
  createdAt: Date
  lastUsedAt: Date | null
  isActive: boolean
}
```

## Authentication Methods

> Each authentication method stores different credential data.

### Password Authentication

> Traditional username/password authentication using bcrypt for hashing.

Password credentials store an identifier (email or username) and a bcrypt hash.
The identifier allows users to log in with either their email or username.
Passwords must meet minimum requirements (8+ characters) and are hashed using
bcrypt with cost factor 10.

**Security considerations:**

- Passwords are never stored in plain text
- Rate limiting prevents brute force attacks
- Failed login attempts may trigger account lockout
- Consider checking against breach databases (HaveIBeenPwned)

**Authentication flow:**

1. User provides identifier + password
2. Look up credential by type='password' and identifier
3. Verify password against bcrypt hash
4. Update last_used_at timestamp
5. Generate and return JWT with user_id

```typescript
export interface PasswordCredentialData {
  identifier: string
  password_hash: string
}
```

### Passkey/WebAuthn Authentication

> Modern passwordless authentication using public-key cryptography and device biometrics.

Passkeys are phishing-resistant credentials stored on user devices (phone, laptop,
hardware security key). The private key never leaves the device; the server stores
only the public key. Users authenticate with device biometrics (Face ID, Touch ID,
Windows Hello) or device PIN.

**Key concepts:**

- credential_id: Unique identifier from the WebAuthn device
- public_key: Used to verify signatures (private key stays on device)
- counter: Signature counter prevents replay attacks
- device_name: Optional user-friendly label ("Nick's iPhone")
- transports: How the device communicates (USB, NFC, Bluetooth, internal)

**Registration flow:**

1. User initiates passkey registration
2. Server generates challenge (random bytes)
3. Device creates key pair, returns credential_id + public_key
4. Server stores public_key in credential_data
5. Private key never leaves user's device

**Authentication flow:**

1. User initiates passkey login
2. Server generates challenge
3. Device signs challenge with private key
4. Look up credential by type='passkey' and credential_id
5. Verify signature using stored public_key
6. Check and update counter (prevents replay attacks)
7. Update last_used_at timestamp
8. Generate and return JWT with user_id

**Security considerations:**

- Phishing-resistant (signature tied to domain)
- No password to steal or forget
- Requires HTTPS in production
- Need fallback recovery method if device is lost

```typescript
export interface PasskeyCredentialData {
  credential_id: string
  public_key: string
  counter: number
  device_name?: string
  aaguid?: string
  transports?: ("usb" | "nfc" | "ble" | "internal")[]
}
```

### OAuth Authentication

> Third-party authentication via OAuth 2.0 providers (Google, GitHub, etc.).

OAuth credentials link a user account to their account at an external provider.
The provider handles authentication and returns user profile information. Users
can "Login with Google" or "Login with GitHub" instead of managing passwords.

**Key concepts:**

- provider_user_id: Provider's unique ID for this user (never changes)
- email: From OAuth profile (used to link accounts)
- profile: Optional cached profile data (name, avatar, locale)
- token hashes: Optional stored tokens for API access (never store raw tokens)

**Authentication flow:**

1. User clicks "Login with Google"
2. Redirect to OAuth provider's authorization URL
3. User authorizes, provider redirects back with authorization code
4. Exchange code for access token and user profile
5. Look up credential by type='oauth_google' and provider_user_id
6. If not found, create new user + credential (account creation)
7. Update last_used_at timestamp
8. Generate and return JWT with user_id

**Account linking:**
If a user is already logged in, they can link an OAuth account to their existing
account. This prevents duplicate accounts when users have multiple login methods.
Example: User signs up with password, later adds "Login with Google" to same account.

**Security considerations:**

- Validate state parameter (CSRF protection)
- Verify token signatures if using ID tokens
- Handle email changes at provider
- Consider provider-specific scopes and permissions

```typescript
export interface OAuthCredentialData {
  provider_user_id: string
  email: string
  profile?: {
    name?: string
    avatar_url?: string
    locale?: string
    [key: string]: unknown
  }
  access_token_hash?: string
  refresh_token_hash?: string
  token_expires_at?: string
}
```

### API Key Authentication

> Long-lived tokens for programmatic access and service-to-service communication.

API keys are tokens that applications use to authenticate without user interaction.
Common use cases: CI/CD pipelines, automation scripts, mobile apps, third-party
integrations. Keys can have restricted scopes and IP whitelists.

**Key concepts:**

- key_hash: SHA-256 hash of full key (never store raw key)
- prefix: Visible prefix for identification ("pk_live_")
- last_4: Last 4 characters for user reference
- name: User-provided label ("GitHub Actions CI")
- scopes: Optional permission restrictions
- ip_whitelist: Optional IP address restrictions
- rate_limit: Optional per-hour rate limit

**Generation flow:**

1. User requests new API key
2. Server generates secure random key: `pk_live_<random_32_bytes>`
3. Display full key to user ONCE (never shown again)
4. Store hash of full key in credential_data
5. Store prefix and last_4 for user reference

**Authentication flow:**

1. Client sends key in header: `Authorization: Bearer pk_live_abc123...`
2. Hash the provided key
3. Look up credential by type='api_key' and key_hash
4. Verify key is active and within rate limits
5. Check IP whitelist if configured
6. Update last_used_at timestamp
7. Proceed with request using associated user_id

**Security considerations:**

- Keys should be long and cryptographically random
- Support key rotation (multiple active keys)
- Support key revocation (set is_active = false)
- Log key usage for audit trail
- Consider key expiration policies
- Rate limiting per key

```typescript
export interface ApiKeyCredentialData {
  key_hash: string
  prefix: string
  last_4: string
  name?: string
  scopes?: string[]
  ip_whitelist?: string[]
  rate_limit?: number
}
```

### Credential Data Union

> All credential data variants in a discriminated union.

The actual credential data stored depends on the credential_type. Use type guards
to safely narrow the type based on the credential.

```typescript
export type CredentialData =
  | PasswordCredentialData
  | PasskeyCredentialData
  | OAuthCredentialData
  | ApiKeyCredentialData
```

## JWT Tokens

> JSON Web Tokens (JWT) are the session mechanism used after successful authentication.

Regardless of authentication method, all successful logins produce a JWT with
standardized claims. The token is stateless (no server-side session storage) and
contains everything needed to identify the user and their authentication context.

**Token lifecycle:**

- Short-lived access tokens (15 minutes - 1 hour)
- Optional refresh tokens for longer sessions
- Token expiration forces re-authentication
- Consider token blacklist for logout/revocation

**Claims:**

- user_id: Always present - the authenticated user
- email: Stable identifier
- username: May be null for OAuth-only users
- iat: Issued at (Unix timestamp)
- exp: Expires (Unix timestamp)
- credential_id: Which credential was used for this login (optional)
- auth_method: How user authenticated (optional)
- session_id: Optional session tracking identifier

Example JWT payload:

```json
{
  user_id: 1,
  email: 'nick@example.com',
  username: 'nick',
  iat: 1706372800,
  exp: 1706376400,
  credential_id: 5,
  auth_method: 'passkey',
  session_id: 'sess_abc123'
}
```

```typescript
export interface JWTPayload {
  user_id: number
  email: string
  username?: string
  iat: number
  exp: number
  credential_id?: number
  auth_method?: CredentialType
  session_id?: string
}
```

## Request/Response Types

> Types for authentication API endpoints.

### Registration

> Creating a new user account with password authentication.

```typescript
export interface RegisterRequest {
  email: string
  username?: string
  password: string
}
```

### Login

> Authenticating with email/username and password.

```typescript
export interface LoginRequest {
  identifier: string
  password: string
}
```

### Authentication Response

> Successful authentication result containing user info and JWT.

```typescript
export interface AuthResponse {
  user: {
    userId: number
    email: string
    username: string | null
  }
  token: string
  expiresAt: string
}
```

## Error Handling

> Authentication-specific error codes and error class.

All authentication operations throw AuthError with specific codes for different
failure scenarios. This allows clients to handle errors appropriately (show
user-friendly messages, trigger account recovery flows, etc.).

```typescript
export type AuthErrorCode =
  | "EMAIL_EXISTS"
  | "USERNAME_EXISTS"
  | "INVALID_CREDENTIALS"
  | "PASSWORD_TOO_SHORT"
  | "PASSWORD_TOO_WEAK"
  | "INVALID_EMAIL"
  | "USER_NOT_FOUND"
  | "CREDENTIAL_INACTIVE"

export class AuthError extends Error {
  constructor(
    message: string,
    public code: AuthErrorCode
  ) {
    super(message)
    this.name = "AuthError"
  }
}
```

## Persistence Types

> Types for storing authentication data in the database.

Authentication data is stored across two tables: `users` (identity) and
`user_credentials` (authentication methods). These types represent the complete
database rows including system-managed fields.

### User Row

> The complete database row for a user from the users table.

```typescript
export interface UserRow {
  user_id: number
  username: string | null
  email: string
  created_at: Date
  updated_at: Date
}
```

### Credential Row

> The complete database row for a credential from the user_credentials table.

```typescript
export interface CredentialRow {
  credential_id: number
  user_id: number
  credential_type: CredentialType
  credential_data: CredentialData
  created_at: Date
  last_used_at: Date | null
  is_active: boolean
}
```

## Type Guards

> Runtime type checking for credential data variants.

Use these to safely narrow the CredentialData union type based on the credential_type.

```typescript
export function isPasswordCredential(data: CredentialData): data is PasswordCredentialData {
  return "password_hash" in data && "identifier" in data
}

export function isPasskeyCredential(data: CredentialData): data is PasskeyCredentialData {
  return "credential_id" in data && "public_key" in data && "counter" in data
}

export function isOAuthCredential(data: CredentialData): data is OAuthCredentialData {
  return "provider_user_id" in data
}

export function isApiKeyCredential(data: CredentialData): data is ApiKeyCredentialData {
  return "key_hash" in data && "prefix" in data && "last_4" in data
}
```

## Display Utilities

> Helper functions for presenting authentication information.

### Get Credential Display Name

> Creates a human-readable name for a credential.

Shows the credential type and relevant identifier for user-facing display.

Examples:

- "Password (<nick@example.com>)"
- "Passkey (Nick's iPhone)"
- "Google (<nick@gmail.com>)"
- "API Key (CI/CD Pipeline)"

```typescript
export function getCredentialDisplayName(credential: Credential): string {
  switch (credential.credentialType) {
    case "password": {
      const data = credential.credentialData as PasswordCredentialData
      return `Password (${data.identifier})`
    }
    case "passkey": {
      const data = credential.credentialData as PasskeyCredentialData
      return data.device_name ? `Passkey (${data.device_name})` : "Passkey"
    }
    case "oauth_google":
      return `Google (${(credential.credentialData as OAuthCredentialData).email})`
    case "oauth_github":
      return `GitHub (${(credential.credentialData as OAuthCredentialData).email})`
    case "api_key": {
      const data = credential.credentialData as ApiKeyCredentialData
      return data.name ? `API Key (${data.name})` : `API Key (${data.prefix}...${data.last_4})`
    }
  }
}
```

### Get Credential Type Label

> User-friendly label for credential type.

```typescript
export function getCredentialTypeLabel(type: CredentialType): string {
  switch (type) {
    case "password":
      return "Password"
    case "passkey":
      return "Passkey"
    case "oauth_google":
      return "Google"
    case "oauth_github":
      return "GitHub"
    case "api_key":
      return "API Key"
  }
}
```

## References to Other Domains

> Authentication references the Authorization domain for permissions.

Once a user is authenticated (receives a JWT with user_id), the Authorization domain
determines what entities and resources they can access. See the Authorization domain
for details on permission checking and access control.

## Invariants

> Rules that must be maintained.

**Hard Invariants** (enforced by system):

1. Every user has a unique user_id
2. Every user has a unique email address
3. Usernames are unique when present
4. Users must have at least one active credential to log in
5. Credential data matches the credential_type
6. Passwords are never stored in plain text
7. API keys are never stored in plain text

**Soft Expectations** (usually true, not enforced):

- Most users have a username
- Users typically have 1-3 credentials
- Credentials are used regularly (last_used_at is recent)
- OAuth email matches user email

## Use Cases

> Primary ways this domain is used.

**Primary Use Cases:**

1. User registration (create account with password)
2. User login (authenticate with any credential type)
3. Add additional authentication methods to existing account
4. Remove authentication methods
5. List user's credentials
6. Generate API keys for automation
7. Verify JWT tokens on protected endpoints

**Key Queries:**

- Find user by email
- Find credential by identifier (password login)
- Find credential by provider_user_id (OAuth login)
- Find credential by key_hash (API key auth)
- List all credentials for user
- List active credentials for user

**Example: Account with Multiple Credentials**

Nick's account (user_id=1) with five different authentication methods:

```js
const user = {
  userId: 1,
  email: 'nick@example.com',
  username: 'nick',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-26')
}

const credentials = [
  {
    credentialId: 1,
    userId: 1,
    credentialType: 'password',
    credentialData: {
      identifier: 'nick@example.com',
      password_hash: '$2b$10$...'
    },
    lastUsedAt: new Date('2026-01-25')
  },
  {
    credentialId: 2,
    userId: 1,
    credentialType: 'passkey',
    credentialData: {
      credential_id: 'base64_...',
      public_key: 'base64_...',
      counter: 5,
      device_name: "Nick's iPhone"
    },
    lastUsedAt: new Date('2026-01-26')
  },
  {
    credentialId: 3,
    userId: 1,
    credentialType: 'passkey',
    credentialData: {
      credential_id: 'base64_...',
      public_key: 'base64_...',
      counter: 12,
      device_name: "Nick's Laptop"
    },
    lastUsedAt: new Date('2026-01-20')
  },
  {
    credentialId: 4,
    userId: 1,
    credentialType: 'oauth_google',
    credentialData: {
      provider_user_id: '123456789',
      email: 'nick@gmail.com',
      profile: { name: 'Nick', avatar_url: 'https://...' }
    },
    lastUsedAt: new Date('2026-01-24')
  },
  {
    credentialId: 5,
    userId: 1,
    credentialType: 'api_key',
    credentialData: {
      key_hash: 'sha256_...',
      prefix: 'pk_live_',
      last_4: 'c123',
      name: 'CI/CD Pipeline',
      scopes: ['read:entities', 'write:entities']
    },
    lastUsedAt: new Date('2026-01-26')
  }
]
```

Nick can authenticate using any of these five methods, and each produces a JWT
with the same `user_id: 1`, granting identical permissions.
