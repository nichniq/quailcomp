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
 */
export function validatePassword(password: string): string | null {
  if (password.length < 8) {
    return "Password must be at least 8 characters";
  }

  // Add more validation rules as needed:
  // - Require uppercase/lowercase
  // - Require numbers
  // - Require special characters
  // - Check against common passwords

  return null;
}
