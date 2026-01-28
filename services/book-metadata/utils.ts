/**
 * Book Metadata Service Utilities
 *
 * ISBN validation, normalization, and shared helpers.
 */

import { InvalidISBNError } from "./types";

/**
 * Normalize an ISBN by removing hyphens and spaces, and validating format.
 *
 * @param isbn - ISBN-10 or ISBN-13, optionally with hyphens
 * @returns Normalized ISBN (uppercase, no hyphens)
 * @throws InvalidISBNError if the format is invalid
 */
export function normalizeISBN(isbn: string): string {
  // Remove hyphens and spaces
  const normalized = isbn.replace(/[-\s]/g, "");

  // Validate length (ISBN-10 or ISBN-13)
  if (normalized.length !== 10 && normalized.length !== 13) {
    throw new InvalidISBNError(isbn);
  }

  // Basic character validation
  // ISBN-10 can end with X (represents 10), ISBN-13 is all digits
  if (normalized.length === 10) {
    if (!/^\d{9}[\dX]$/i.test(normalized)) {
      throw new InvalidISBNError(isbn);
    }
  } else {
    if (!/^\d{13}$/.test(normalized)) {
      throw new InvalidISBNError(isbn);
    }
  }

  return normalized.toUpperCase();
}

/**
 * Convert ISBN-10 to ISBN-13.
 *
 * @param isbn10 - A valid ISBN-10
 * @returns The equivalent ISBN-13
 * @throws InvalidISBNError if the input is not a valid ISBN-10
 */
export function isbn10ToIsbn13(isbn10: string): string {
  const normalized = normalizeISBN(isbn10);
  if (normalized.length !== 10) {
    throw new InvalidISBNError(isbn10);
  }

  // Remove check digit, prepend 978
  const base = "978" + normalized.slice(0, 9);

  // Calculate new check digit using ISBN-13 algorithm
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(base[i], 10) * (i % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;

  return base + checkDigit;
}

/**
 * Convert ISBN-13 to ISBN-10 (only works for 978 prefix).
 *
 * @param isbn13 - A valid ISBN-13 with 978 prefix
 * @returns The equivalent ISBN-10, or null if conversion not possible
 */
export function isbn13ToIsbn10(isbn13: string): string | null {
  const normalized = normalizeISBN(isbn13);
  if (normalized.length !== 13) {
    return null;
  }

  // Only 978 prefix can be converted to ISBN-10
  if (!normalized.startsWith("978")) {
    return null;
  }

  // Extract the 9-digit body (removing 978 prefix and check digit)
  const body = normalized.slice(3, 12);

  // Calculate ISBN-10 check digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(body[i], 10) * (10 - i);
  }
  const remainder = sum % 11;
  const checkDigit = remainder === 0 ? "0" : remainder === 1 ? "X" : String(11 - remainder);

  return body + checkDigit;
}

/**
 * Create an AbortController with automatic timeout.
 *
 * @param timeoutMs - Timeout in milliseconds
 * @returns Object with signal and clear function
 */
export function createAbortController(timeoutMs: number): {
  signal: AbortSignal;
  clear: () => void;
} {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeoutId),
  };
}
