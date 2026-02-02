/**
 * Password strength validation
 *
 * Validates password complexity and strength requirements.
 */

import { env } from "@/config";

/**
 * Common weak passwords to reject
 * (subset of most common passwords - expand as needed)
 */
const COMMON_PASSWORDS = new Set([
  "password",
  "password123",
  "123456",
  "12345678",
  "qwerty",
  "abc123",
  "monkey",
  "letmein",
  "trustno1",
  "dragon",
  "baseball",
  "iloveyou",
  "master",
  "sunshine",
  "ashley",
  "bailey",
  "passw0rd",
  "shadow",
  "123123",
  "654321",
  "superman",
  "qazwsx",
  "michael",
  "football",
]);

/**
 * Password validation result
 */
export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
  strength: "weak" | "medium" | "strong";
  entropy: number;
}

/**
 * Calculate password entropy (bits)
 *
 * Estimates the information entropy of a password
 */
function calculateEntropy(password: string): number {
  let charsetSize = 0;

  // Check which character sets are used
  if (/[a-z]/.test(password)) charsetSize += 26; // lowercase
  if (/[A-Z]/.test(password)) charsetSize += 26; // uppercase
  if (/[0-9]/.test(password)) charsetSize += 10; // numbers
  if (/[^a-zA-Z0-9]/.test(password)) charsetSize += 32; // special chars (estimate)

  // Entropy = log2(charset^length)
  return password.length * Math.log2(charsetSize);
}

/**
 * Get password strength rating based on entropy
 */
function getStrengthRating(entropy: number): "weak" | "medium" | "strong" {
  if (entropy < 50) return "weak";
  if (entropy < 70) return "medium";
  return "strong";
}

/**
 * Validate password strength with detailed feedback
 *
 * Checks:
 * - Minimum length (configurable, default 12)
 * - Complexity requirements (if enabled)
 * - Common passwords
 * - Entropy calculation
 */
export function validatePasswordStrength(
  password: string
): PasswordValidationResult {
  const errors: string[] = [];
  const minLength = env.PASSWORD_MIN_LENGTH;
  const requireComplexity = env.PASSWORD_REQUIRE_COMPLEXITY;

  // Check minimum length
  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters`);
  }

  // Check complexity requirements (if enabled)
  if (requireComplexity) {
    if (!/[a-z]/.test(password)) {
      errors.push("Password must contain at least one lowercase letter");
    }
    if (!/[A-Z]/.test(password)) {
      errors.push("Password must contain at least one uppercase letter");
    }
    if (!/[0-9]/.test(password)) {
      errors.push("Password must contain at least one number");
    }
    if (!/[^a-zA-Z0-9]/.test(password)) {
      errors.push("Password must contain at least one special character");
    }
  }

  // Check against common passwords (case-insensitive, strip non-alphanumeric)
  const normalizedPassword = password.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (COMMON_PASSWORDS.has(normalizedPassword)) {
    errors.push("Password is too common");
  }

  // Calculate entropy and strength
  const entropy = calculateEntropy(password);
  const strength = getStrengthRating(entropy);

  return {
    valid: errors.length === 0,
    errors,
    strength,
    entropy,
  };
}

/**
 * Simple password validation (returns error message or null)
 *
 * This is a convenience wrapper for use in existing code
 * that expects a string | null return value.
 */
export function validatePassword(password: string): string | null {
  const result = validatePasswordStrength(password);
  return result.valid ? null : result.errors[0];
}
