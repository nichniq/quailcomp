/**
 * Password hashing utilities
 *
 * Uses Bun's built-in Bun.password API which provides bcrypt.
 */

const BCRYPT_COST = 10;

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, {
    algorithm: "bcrypt",
    cost: BCRYPT_COST,
  });
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return Bun.password.verify(password, hash);
}

/**
 * Validate password strength
 *
 * Returns an error message if invalid, null if valid
 *
 * Note: This uses the enhanced password validator which checks
 * minimum length, complexity requirements, and common passwords.
 */
export { validatePassword } from "./password-validator";
