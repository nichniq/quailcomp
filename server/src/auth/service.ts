/**
 * Authentication service
 *
 * Handles user registration, login, and credential management.
 */

import type { Sql } from "@quailcomp/data";
import { hashPassword, validatePassword, verifyPassword } from "./password";
import { getTokenExpiration, signToken } from "./jwt";
import {
  AuthError,
  type AuthResponse,
  type LoginRequest,
  type PasswordCredentialData,
  type RegisterRequest,
  type User,
} from "../../../domains/authentication";

export class AuthService {
  constructor(private sql: Sql) {}

  /**
   * Register a new user with password authentication
   */
  async register(input: RegisterRequest): Promise<AuthResponse> {
    // Validate email format
    if (!this.isValidEmail(input.email)) {
      throw new AuthError("Invalid email format", "INVALID_EMAIL");
    }

    // Validate password strength
    const passwordError = validatePassword(input.password);
    if (passwordError) {
      throw new AuthError(passwordError, "PASSWORD_TOO_SHORT");
    }

    // Check for existing email
    const existingEmail = await this.sql`
      SELECT user_id FROM users WHERE email = ${input.email}
    `;
    if (existingEmail.length > 0) {
      throw new AuthError("Email already registered", "EMAIL_EXISTS");
    }

    // Check for existing username if provided
    if (input.username) {
      const existingUsername = await this.sql`
        SELECT user_id FROM users WHERE username = ${input.username}
      `;
      if (existingUsername.length > 0) {
        throw new AuthError("Username already taken", "USERNAME_EXISTS");
      }
    }

    // Hash password
    const passwordHash = await hashPassword(input.password);

    // Create user and credential in transaction
    const result = await this.sql.begin(async (tx) => {
      // Create user
      const [user] = await tx`
        INSERT INTO users (email, username)
        VALUES (${input.email}, ${input.username ?? null})
        RETURNING user_id, email, username, created_at, updated_at
      `;

      // Create password credential
      const credentialData: PasswordCredentialData = {
        identifier: input.email,
        password_hash: passwordHash,
      };

      const [credential] = await tx`
        INSERT INTO user_credentials (user_id, credential_type, credential_data)
        VALUES (${user.user_id}, 'password', ${credentialData})
        RETURNING credential_id
      `;

      return { user, credentialId: credential.credential_id };
    });

    // Generate token
    const token = await signToken({
      user_id: result.user.user_id,
      email: result.user.email,
      username: result.user.username ?? undefined,
      credential_id: result.credentialId,
      auth_method: "password",
    });

    return {
      user: {
        userId: result.user.user_id,
        email: result.user.email,
        username: result.user.username,
      },
      token,
      expiresAt: getTokenExpiration().toISOString(),
    };
  }

  /**
   * Login with password authentication
   */
  async login(input: LoginRequest): Promise<AuthResponse> {
    // Find credential by identifier (email or username)
    const credentials = await this.sql`
      SELECT
        c.credential_id,
        c.user_id,
        c.credential_data,
        c.is_active,
        u.email,
        u.username
      FROM user_credentials c
      JOIN users u ON c.user_id = u.user_id
      WHERE c.credential_type = 'password'
        AND c.is_active = true
        AND (
          c.credential_data->>'identifier' = ${input.identifier}
          OR u.username = ${input.identifier}
        )
    `;

    if (credentials.length === 0) {
      throw new AuthError("Invalid credentials", "INVALID_CREDENTIALS");
    }

    const credential = credentials[0];

    // Check if credential is active
    if (!credential.is_active) {
      throw new AuthError("Credential is inactive", "CREDENTIAL_INACTIVE");
    }

    const credentialData = credential.credential_data as PasswordCredentialData;

    // Verify password
    const valid = await verifyPassword(
      input.password,
      credentialData.password_hash
    );
    if (!valid) {
      throw new AuthError("Invalid credentials", "INVALID_CREDENTIALS");
    }

    // Update last_used_at
    await this.sql`
      UPDATE user_credentials
      SET last_used_at = NOW()
      WHERE credential_id = ${credential.credential_id}
    `;

    // Generate token
    const token = await signToken({
      user_id: credential.user_id,
      email: credential.email,
      username: credential.username ?? undefined,
      credential_id: credential.credential_id,
      auth_method: "password",
    });

    return {
      user: {
        userId: credential.user_id,
        email: credential.email,
        username: credential.username,
      },
      token,
      expiresAt: getTokenExpiration().toISOString(),
    };
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: number): Promise<User | null> {
    const users = await this.sql`
      SELECT user_id, username, email, created_at, updated_at
      FROM users
      WHERE user_id = ${userId}
    `;

    if (users.length === 0) {
      return null;
    }

    return this.mapUser(users[0]);
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    const users = await this.sql`
      SELECT user_id, username, email, created_at, updated_at
      FROM users
      WHERE email = ${email}
    `;

    if (users.length === 0) {
      return null;
    }

    return this.mapUser(users[0]);
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Map database row to User type
   */
  private mapUser(row: Record<string, unknown>): User {
    return {
      userId: row.user_id as number,
      username: row.username as string | null,
      email: row.email as string,
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
    };
  }
}
