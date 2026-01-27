/**
 * Authentication types
 *
 * Based on authentication-architecture.md
 */

// ============================================================================
// Credential Types
// ============================================================================

export type CredentialType =
  | "password"
  | "passkey"
  | "oauth_google"
  | "oauth_github"
  | "api_key";

// ============================================================================
// User Types
// ============================================================================

export interface User {
  userId: number;
  username: string | null;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Credential {
  credentialId: number;
  userId: number;
  credentialType: CredentialType;
  credentialData: CredentialData;
  createdAt: Date;
  lastUsedAt: Date | null;
  isActive: boolean;
}

// ============================================================================
// Credential Data Types
// ============================================================================

export type CredentialData =
  | PasswordCredentialData
  | PasskeyCredentialData
  | OAuthCredentialData
  | ApiKeyCredentialData;

export interface PasswordCredentialData {
  identifier: string; // email or username
  password_hash: string;
}

export interface PasskeyCredentialData {
  credential_id: string;
  public_key: string;
  counter: number;
  device_name?: string;
  aaguid?: string;
  transports?: ("usb" | "nfc" | "ble" | "internal")[];
}

export interface OAuthCredentialData {
  provider_user_id: string;
  email: string;
  profile?: {
    name?: string;
    avatar_url?: string;
    locale?: string;
    [key: string]: unknown;
  };
  access_token_hash?: string;
  refresh_token_hash?: string;
  token_expires_at?: string;
}

export interface ApiKeyCredentialData {
  key_hash: string;
  prefix: string;
  last_4: string;
  name?: string;
  scopes?: string[];
  ip_whitelist?: string[];
  rate_limit?: number;
}

// ============================================================================
// JWT Types
// ============================================================================

export interface JWTPayload {
  user_id: number;
  email: string;
  username?: string;
  iat: number;
  exp: number;
  credential_id?: number;
  auth_method?: CredentialType;
  session_id?: string;
}

// ============================================================================
// Request/Response Types
// ============================================================================

export interface RegisterRequest {
  email: string;
  username?: string;
  password: string;
}

export interface LoginRequest {
  identifier: string; // email or username
  password: string;
}

export interface AuthResponse {
  user: {
    userId: number;
    email: string;
    username: string | null;
  };
  token: string;
  expiresAt: string;
}

// ============================================================================
// Error Types
// ============================================================================

export type AuthErrorCode =
  | "EMAIL_EXISTS"
  | "USERNAME_EXISTS"
  | "INVALID_CREDENTIALS"
  | "PASSWORD_TOO_SHORT"
  | "PASSWORD_TOO_WEAK"
  | "INVALID_EMAIL"
  | "USER_NOT_FOUND"
  | "CREDENTIAL_INACTIVE";

export class AuthError extends Error {
  constructor(
    message: string,
    public code: AuthErrorCode
  ) {
    super(message);
    this.name = "AuthError";
  }
}
