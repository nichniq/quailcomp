/**
 * Test utilities for book metadata provider tests
 *
 * Provides common mocking helpers, sample data, and assertion utilities
 * for testing all metadata providers.
 */

import { expect } from "bun:test";
import type { BookMetadata, BookMetadataProvider } from "@/types";
import {
  ServiceUnavailableError,
  TimeoutError,
  BookMetadataServiceError,
} from "@/types";

// =============================================================================
// Sample Test Data
// =============================================================================

/** Sample ISBNs for testing */
export const sampleISBNs = {
  /** Effective Java (3rd Edition) - commonly used in tests */
  effectiveJava: "9780134685991",
  effectiveJavaISBN10: "0134685997",

  /** Clean Code - another popular test book */
  cleanCode: "9780132350884",
  cleanCodeISBN10: "0132350882",

  /** ISBN with hyphens (should be normalized) */
  withHyphens: "978-0-13-468599-1",

  /** ISBN with spaces (should be normalized) */
  withSpaces: "978 0 13 468599 1",
};

/** Sample book metadata for Effective Java */
export const sampleBookMetadata: Omit<BookMetadata, "source"> = {
  isbn: "9780134685991",
  isbn10: "0134685997",
  isbn13: "9780134685991",
  title: "Effective Java",
  subtitle: "Best Practices for the Java Platform",
  authors: ["Joshua Bloch"],
  publisher: "Addison-Wesley Professional",
  publishedDate: "2017",
  description:
    "The Definitive Guide to Java Platform Best Practices--Updated for Java 7, 8, and 9",
  pageCount: 416,
  language: "en",
  subjects: ["Java (Computer program language)", "Programming"],
  thumbnailUrl: "http://books.google.com/books/content?id=example",
};

// =============================================================================
// Fetch Mocking Utilities
// =============================================================================

/**
 * Creates a mock fetch function that returns predefined responses based on URL patterns
 *
 * @param responses - Map of URL patterns to responses
 * @returns Mock fetch function
 *
 * @example
 * ```ts
 * const mockFetch = createMockFetch(new Map([
 *   ["google", { ok: true, json: async () => ({ items: [...] }) }],
 *   ["openlibrary", { ok: true, json: async () => ({ title: "..." }) }]
 * ]));
 * global.fetch = mockFetch;
 * ```
 */
export function createMockFetch(
  responses: Map<string, Partial<Response> | Error>
): typeof fetch {
  return async (url: string | URL | Request): Promise<Response> => {
    const urlString = url.toString();

    for (const [pattern, response] of responses.entries()) {
      if (urlString.includes(pattern)) {
        if (response instanceof Error) {
          throw response;
        }

        return {
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => ({}),
          text: async () => "",
          ...response,
        } as Response;
      }
    }

    // Default 404 response
    return {
      ok: false,
      status: 404,
      statusText: "Not Found",
      json: async () => ({}),
      text: async () => "",
    } as Response;
  };
}

/**
 * Creates a mock fetch that simulates an AbortError (timeout)
 */
export function createTimeoutFetch(): typeof fetch {
  return async () => {
    const error = new Error("The operation was aborted");
    error.name = "AbortError";
    throw error;
  };
}

/**
 * Creates a mock fetch that simulates a network error
 */
export function createNetworkErrorFetch(): typeof fetch {
  return async () => {
    throw new Error("Network request failed");
  };
}

// =============================================================================
// Assertion Utilities
// =============================================================================

/**
 * Asserts that a BookMetadata object matches expected values
 *
 * @param result - The metadata to check
 * @param expected - Expected partial metadata
 */
export function expectProviderMetadata(
  result: BookMetadata | null,
  expected: Partial<BookMetadata>
): void {
  expect(result).not.toBeNull();
  if (!result) return; // Type guard

  for (const [key, value] of Object.entries(expected)) {
    expect(result[key as keyof BookMetadata]).toEqual(value);
  }
}

/**
 * Asserts that a promise rejects with a ServiceUnavailableError
 *
 * @param promise - Promise that should reject
 * @param provider - Expected provider name
 */
export async function expectServiceUnavailableError(
  promise: Promise<unknown>,
  provider: BookMetadataProvider
): Promise<void> {
  await expect(promise).rejects.toThrow(ServiceUnavailableError);
  try {
    await promise;
  } catch (error) {
    if (error instanceof ServiceUnavailableError) {
      expect(error.provider).toBe(provider);
      expect(error.name).toBe("ServiceUnavailableError");
    }
  }
}

/**
 * Asserts that a promise rejects with a TimeoutError
 *
 * @param promise - Promise that should reject
 * @param provider - Expected provider name
 * @param timeoutMs - Expected timeout value
 */
export async function expectTimeoutError(
  promise: Promise<unknown>,
  provider: BookMetadataProvider,
  timeoutMs?: number
): Promise<void> {
  await expect(promise).rejects.toThrow(TimeoutError);
  try {
    await promise;
  } catch (error) {
    if (error instanceof TimeoutError) {
      expect(error.provider).toBe(provider);
      expect(error.name).toBe("TimeoutError");
      if (timeoutMs !== undefined) {
        expect(error.timeoutMs).toBe(timeoutMs);
      }
    }
  }
}

/**
 * Asserts that a result is null (book not found)
 */
export function expectNotFound(result: BookMetadata | null): void {
  expect(result).toBeNull();
}

/**
 * Asserts basic metadata structure is valid
 */
export function expectValidMetadata(
  result: BookMetadata | null,
  provider: BookMetadataProvider
): void {
  expect(result).not.toBeNull();
  if (!result) return;

  expect(result.isbn).toBeDefined();
  expect(result.title).toBeDefined();
  expect(result.authors).toBeInstanceOf(Array);
  expect(result.source).toBe(provider);
}
