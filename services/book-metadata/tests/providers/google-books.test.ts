/**
 * Tests for Google Books API Provider
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { createGoogleBooksProvider } from "@/providers/google-books";
import type { BookMetadata } from "@/types";
import {
  ServiceUnavailableError,
  TimeoutError,
} from "@/types";
import {
  sampleISBNs,
  createMockFetch,
  createTimeoutFetch,
  createNetworkErrorFetch,
  expectProviderMetadata,
  expectServiceUnavailableError,
  expectTimeoutError,
  expectNotFound,
  expectValidMetadata,
} from "@/tests/helpers/provider-test-utils";

// Save original fetch
const originalFetch = global.fetch;

describe("Google Books Provider", () => {
  afterEach(() => {
    // Restore original fetch after each test
    global.fetch = originalFetch;
  });

  describe("Happy Path", () => {
    test("returns metadata for valid ISBN", async () => {
      const mockResponse = {
        totalItems: 1,
        items: [
          {
            volumeInfo: {
              title: "Effective Java",
              subtitle: "Best Practices for the Java Platform",
              authors: ["Joshua Bloch"],
              publisher: "Addison-Wesley Professional",
              publishedDate: "2017",
              description: "The Definitive Guide to Java Platform Best Practices",
              industryIdentifiers: [
                { type: "ISBN_10", identifier: "0134685997" },
                { type: "ISBN_13", identifier: "9780134685991" },
              ],
              pageCount: 416,
              language: "en",
              categories: ["Computers"],
              imageLinks: {
                thumbnail: "http://books.google.com/books/content?id=example",
              },
            },
          },
        ],
      };

      global.fetch = createMockFetch(
        new Map([["googleapis.com", { ok: true, json: async () => mockResponse }]])
      );

      const provider = createGoogleBooksProvider();
      const result = await provider.lookup(sampleISBNs.effectiveJava);

      expectValidMetadata(result, "google-books");
      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.title).toBe("Effective Java");
      expect(result.subtitle).toBe("Best Practices for the Java Platform");
      expect(result.authors).toEqual(["Joshua Bloch"]);
      expect(result.publisher).toBe("Addison-Wesley Professional");
      expect(result.publishedDate).toBe("2017");
      expect(result.isbn10).toBe("0134685997");
      expect(result.isbn13).toBe("9780134685991");
      expect(result.pageCount).toBe(416);
      expect(result.language).toBe("en");
      expect(result.subjects).toEqual(["Computers"]);
      expect(result.thumbnailUrl).toBe("http://books.google.com/books/content?id=example");
    });

    test("normalizes ISBN before lookup", async () => {
      let capturedUrl = "";

      global.fetch = async (url: string | URL | Request) => {
        capturedUrl = url.toString();
        return {
          ok: true,
          json: async () => ({ totalItems: 0 }),
        } as Response;
      };

      const provider = createGoogleBooksProvider();
      await provider.lookup(sampleISBNs.withHyphens);

      // Should normalize to plain digits (check for URL-encoded or plain)
      const decodedUrl = decodeURIComponent(capturedUrl);
      expect(decodedUrl).toContain("isbn:9780134685991");
      expect(decodedUrl).not.toContain("-");
    });

    test("includes API key when provided", async () => {
      let capturedUrl = "";

      global.fetch = async (url: string | URL | Request) => {
        capturedUrl = url.toString();
        return {
          ok: true,
          json: async () => ({ totalItems: 0 }),
        } as Response;
      };

      const provider = createGoogleBooksProvider({ apiKey: "test-key-123" });
      await provider.lookup(sampleISBNs.effectiveJava);

      expect(capturedUrl).toContain("key=test-key-123");
    });

    test("works without API key", async () => {
      let capturedUrl = "";

      global.fetch = async (url: string | URL | Request) => {
        capturedUrl = url.toString();
        return {
          ok: true,
          json: async () => ({ totalItems: 0 }),
        } as Response;
      };

      const provider = createGoogleBooksProvider();
      await provider.lookup(sampleISBNs.effectiveJava);

      expect(capturedUrl).not.toContain("key=");
    });
  });

  describe("Response Mapping", () => {
    test("handles missing subtitle", async () => {
      const mockResponse = {
        totalItems: 1,
        items: [
          {
            volumeInfo: {
              title: "Test Book",
              authors: ["Author"],
              // No subtitle
            },
          },
        ],
      };

      global.fetch = createMockFetch(
        new Map([["googleapis.com", { ok: true, json: async () => mockResponse }]])
      );

      const provider = createGoogleBooksProvider();
      const result = await provider.lookup(sampleISBNs.effectiveJava);

      expect(result).not.toBeNull();
      if (!result) return;
      expect(result.subtitle).toBeUndefined();
    });

    test("handles missing authors array", async () => {
      const mockResponse = {
        totalItems: 1,
        items: [
          {
            volumeInfo: {
              title: "Test Book",
              // No authors
            },
          },
        ],
      };

      global.fetch = createMockFetch(
        new Map([["googleapis.com", { ok: true, json: async () => mockResponse }]])
      );

      const provider = createGoogleBooksProvider();
      const result = await provider.lookup(sampleISBNs.effectiveJava);

      expect(result).not.toBeNull();
      if (!result) return;
      expect(result.authors).toEqual([]);
    });

    test("handles missing imageLinks", async () => {
      const mockResponse = {
        totalItems: 1,
        items: [
          {
            volumeInfo: {
              title: "Test Book",
              authors: ["Author"],
              // No imageLinks
            },
          },
        ],
      };

      global.fetch = createMockFetch(
        new Map([["googleapis.com", { ok: true, json: async () => mockResponse }]])
      );

      const provider = createGoogleBooksProvider();
      const result = await provider.lookup(sampleISBNs.effectiveJava);

      expect(result).not.toBeNull();
      if (!result) return;
      expect(result.thumbnailUrl).toBeUndefined();
    });

    test("extracts ISBN-10 and ISBN-13 from identifiers", async () => {
      const mockResponse = {
        totalItems: 1,
        items: [
          {
            volumeInfo: {
              title: "Test Book",
              authors: ["Author"],
              industryIdentifiers: [
                { type: "ISBN_10", identifier: "0134685997" },
                { type: "ISBN_13", identifier: "9780134685991" },
                { type: "OTHER", identifier: "something-else" },
              ],
            },
          },
        ],
      };

      global.fetch = createMockFetch(
        new Map([["googleapis.com", { ok: true, json: async () => mockResponse }]])
      );

      const provider = createGoogleBooksProvider();
      const result = await provider.lookup(sampleISBNs.effectiveJava);

      expect(result).not.toBeNull();
      if (!result) return;
      expect(result.isbn10).toBe("0134685997");
      expect(result.isbn13).toBe("9780134685991");
    });

    test("handles missing industryIdentifiers", async () => {
      const mockResponse = {
        totalItems: 1,
        items: [
          {
            volumeInfo: {
              title: "Test Book",
              authors: ["Author"],
              // No industryIdentifiers
            },
          },
        ],
      };

      global.fetch = createMockFetch(
        new Map([["googleapis.com", { ok: true, json: async () => mockResponse }]])
      );

      const provider = createGoogleBooksProvider();
      const result = await provider.lookup(sampleISBNs.effectiveJava);

      expect(result).not.toBeNull();
      if (!result) return;
      expect(result.isbn10).toBeUndefined();
      expect(result.isbn13).toBeUndefined();
    });

    test("handles all optional fields being null or undefined", async () => {
      const mockResponse = {
        totalItems: 1,
        items: [
          {
            volumeInfo: {
              title: "Minimal Book",
              // All other fields missing
            },
          },
        ],
      };

      global.fetch = createMockFetch(
        new Map([["googleapis.com", { ok: true, json: async () => mockResponse }]])
      );

      const provider = createGoogleBooksProvider();
      const result = await provider.lookup(sampleISBNs.effectiveJava);

      expect(result).not.toBeNull();
      if (!result) return;
      expect(result.title).toBe("Minimal Book");
      expect(result.authors).toEqual([]);
      expect(result.subtitle).toBeUndefined();
      expect(result.publisher).toBeUndefined();
      expect(result.description).toBeUndefined();
      expect(result.pageCount).toBeUndefined();
      expect(result.thumbnailUrl).toBeUndefined();
    });
  });

  describe("Error Handling", () => {
    test("returns null when no items found", async () => {
      const mockResponse = {
        totalItems: 0,
        items: [],
      };

      global.fetch = createMockFetch(
        new Map([["googleapis.com", { ok: true, json: async () => mockResponse }]])
      );

      const provider = createGoogleBooksProvider();
      const result = await provider.lookup(sampleISBNs.effectiveJava);

      expectNotFound(result);
    });

    test("returns null when items array is missing", async () => {
      const mockResponse = {
        totalItems: 0,
        // No items array
      };

      global.fetch = createMockFetch(
        new Map([["googleapis.com", { ok: true, json: async () => mockResponse }]])
      );

      const provider = createGoogleBooksProvider();
      const result = await provider.lookup(sampleISBNs.effectiveJava);

      expectNotFound(result);
    });

    test("throws ServiceUnavailableError on HTTP 404", async () => {
      global.fetch = createMockFetch(
        new Map([["googleapis.com", { ok: false, status: 404 }]])
      );

      const provider = createGoogleBooksProvider();
      await expectServiceUnavailableError(
        provider.lookup(sampleISBNs.effectiveJava),
        "google-books"
      );
    });

    test("throws ServiceUnavailableError on HTTP 500", async () => {
      global.fetch = createMockFetch(
        new Map([["googleapis.com", { ok: false, status: 500 }]])
      );

      const provider = createGoogleBooksProvider();
      await expectServiceUnavailableError(
        provider.lookup(sampleISBNs.effectiveJava),
        "google-books"
      );
    });

    test("throws TimeoutError when request times out", async () => {
      global.fetch = createTimeoutFetch();

      const provider = createGoogleBooksProvider({ timeout: 5000 });
      await expectTimeoutError(
        provider.lookup(sampleISBNs.effectiveJava),
        "google-books",
        5000
      );
    });

    test("throws ServiceUnavailableError on network error", async () => {
      global.fetch = createNetworkErrorFetch();

      const provider = createGoogleBooksProvider();
      await expectServiceUnavailableError(
        provider.lookup(sampleISBNs.effectiveJava),
        "google-books"
      );
    });

    test("throws ServiceUnavailableError on malformed JSON", async () => {
      global.fetch = createMockFetch(
        new Map([
          [
            "googleapis.com",
            {
              ok: true,
              json: async () => {
                throw new Error("Invalid JSON");
              },
            },
          ],
        ])
      );

      const provider = createGoogleBooksProvider();
      await expectServiceUnavailableError(
        provider.lookup(sampleISBNs.effectiveJava),
        "google-books"
      );
    });
  });

  describe("Edge Cases", () => {
    test("handles response with empty items array", async () => {
      const mockResponse = {
        totalItems: 0,
        items: [],
      };

      global.fetch = createMockFetch(
        new Map([["googleapis.com", { ok: true, json: async () => mockResponse }]])
      );

      const provider = createGoogleBooksProvider();
      const result = await provider.lookup(sampleISBNs.effectiveJava);

      expect(result).toBeNull();
    });

    test("respects custom timeout configuration", async () => {
      global.fetch = createTimeoutFetch();

      const customTimeout = 3000;
      const provider = createGoogleBooksProvider({ timeout: customTimeout });

      await expectTimeoutError(
        provider.lookup(sampleISBNs.effectiveJava),
        "google-books",
        customTimeout
      );
    });

    test("uses default timeout when not specified", async () => {
      global.fetch = createTimeoutFetch();

      const provider = createGoogleBooksProvider();

      await expectTimeoutError(
        provider.lookup(sampleISBNs.effectiveJava),
        "google-books",
        10000 // DEFAULT_TIMEOUT
      );
    });

    test("provider property is set correctly", () => {
      const provider = createGoogleBooksProvider();
      expect(provider.provider).toBe("google-books");
    });
  });
});
