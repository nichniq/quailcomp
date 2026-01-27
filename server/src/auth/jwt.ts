/**
 * JWT utilities
 *
 * Uses the jose library for JWT signing and verification.
 */

import * as jose from "jose";

import type { CredentialType, JWTPayload } from "@domains/authentication";

// JWT configuration from environment
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "development-secret-change-me-in-production"
);
const JWT_EXPIRES_IN = Number(process.env.JWT_EXPIRES_IN) || 3600; // 1 hour default
const JWT_ALGORITHM = "HS256";

/**
 * Sign a JWT token
 */
export async function signToken(
  payload: Omit<JWTPayload, "iat" | "exp">
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  return new jose.SignJWT({
    ...payload,
  })
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setIssuedAt(now)
    .setExpirationTime(now + JWT_EXPIRES_IN)
    .sign(JWT_SECRET);
}

/**
 * Verify and decode a JWT token
 *
 * Returns the payload if valid, null if invalid or expired
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET, {
      algorithms: [JWT_ALGORITHM],
    });

    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * Extract JWT token from Authorization header
 *
 * Expects: Authorization: Bearer <token>
 */
export function extractToken(req: Request): string | null {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7);
}

/**
 * Get token expiration time
 */
export function getTokenExpiration(): Date {
  return new Date(Date.now() + JWT_EXPIRES_IN * 1000);
}
