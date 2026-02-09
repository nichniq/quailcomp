/**
 * Tests for Hardcover API Provider
 */

import { describe, test, expect, afterEach } from "bun:test";
import { createHardcoverProvider } from "@/providers/hardcover";
import {
  ServiceUnavailableError,
  TimeoutError,
} from "@/types";
import {
  sampleISBNs,
  createMockFetch,
  createTimeoutFetch,
  createNetworkErrorFetch,
  expectServiceUnavailableError,
  expectTimeoutError,
  expectNotFound,
  expectValidMetadata,
} from "@/tests/helpers/provider-test-utils";

// Save original fetch
const originalFetch = global.fetch;

describe("Hardcover Provider", () => {
  afterEach(() => {
    // Restore original fetch after each test
    global.fetch = originalFetch;
  });

  describe("Happy Path", () => {
    test("returns metadata for valid ISBN with API key", async () => {
      const mockResponse = {
        data: {
          books: [
            {
              id: "123",
              title: "Effective Java",
              subtitle: "Best Practices",
              description: "The definitive guide",
              pages: 416,
              release_year: 2017,
              language: "en",
              isbn_10: "0134685997",
              isbn_13: "9780134685991",
              image: "https://example.com/cover.jpg",
              authors: [{ name: "Joshua Bloch" }],
              contributions: [],
            },
          ],
        },
      };

      let capturedHeaders: HeadersInit | undefined;

      global.fetch = async (url: string | URL | Request, options?: RequestInit) => {
        capturedHeaders = options?.headers;
        return {
          ok: true,
          json: async () => mockResponse,
        } as Response;
      };

      const provider = createHardcoverProvider({ apiKey: "test-key-123" });
      const result = await provider.lookup(sampleISBNs.effectiveJava);

      expectValidMetadata(result, "hardcover");
      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.title).toBe("Effective Java");
      expect(result.subtitle).toBe("Best Practices");
      expect(result.description).toBe("The definitive guide");
      expect(result.authors).toEqual(["Joshua Bloch"]);
      expect(result.pageCount).toBe(416);
      expect(result.publishedDate).toBe("2017");
      expect(result.language).toBe("en");
      expect(result.isbn10).toBe("0134685997");
      expect(result.isbn13).toBe("9780134685991");
      expect(result.thumbnailUrl).toBe("https://example.com/cover.jpg");

      // Verify Authorization header was set
      expect(capturedHeaders).toBeDefined();
      const headers = capturedHeaders as Record<string, string>;
      expect(headers["Authorization"]).toBe("Bearer test-key-123");
    });

    test("uses POST method with GraphQL query", async () => {
      let capturedMethod = "";
      let capturedBody = "";

      global.fetch = async (url: string | URL | Request, options?: RequestInit) => {
        capturedMethod = options?.method || "GET";
        capturedBody = options?.body as string;
        return {
          ok: true,
          json: async () => ({ data: { books: [] } }),
        } as Response;
      };

      const provider = createHardcoverProvider({ apiKey: "test-key" });
      await provider.lookup(sampleISBNs.effectiveJava);

      expect(capturedMethod).toBe("POST");
      expect(capturedBody).toContain("BookByISBN");
      expect(capturedBody).toContain("9780134685991");
    });

    test("deduplicates authors from both sources", async () => {
      const mockResponse = {
        data: {
          books: [
            {
              id: "123",
              title: "Test Book",
              authors: [
                { name: "Joshua Bloch" },
                { name: "Author Two" },
              ],
              contributions: [
                { author: { name: "Joshua Bloch" } }, // Duplicate
                { author: { name: "Author Three" } },
              ],
            },
          ],
        },
      };

      global.fetch = createMockFetch(
        new Map([["hardcover.app", { ok: true, json: async () => mockResponse }]])
      );

      const provider = createHardcoverProvider({ apiKey: "test-key" });
      const result = await provider.lookup(sampleISBNs.effectiveJava);

      expect(result).not.toBeNull();
      if (!result) return;
      // Should have 3 unique authors (Joshua Bloch only once)
      expect(result.authors).toHaveLength(3);
      expect(result.authors).toContain("Joshua Bloch");
      expect(result.authors).toContain("Author Two");
      expect(result.authors).toContain("Author Three");
    });

    test("converts release_year to string", async () => {
      const mockResponse = {
        data: {
          books: [
            {
              id: "123",
              title: "Test Book",
              release_year: 2020,
            },
          ],
        },
      };

      global.fetch = createMockFetch(
        new Map([["hardcover.app", { ok: true, json: async () => mockResponse }]])
      );

      const provider = createHardcoverProvider({ apiKey: "test-key" });
      const result = await provider.lookup(sampleISBNs.effectiveJava);

      expect(result).not.toBeNull();
      if (!result) return;
      expect(result.publishedDate).toBe("2020");
      expect(typeof result.publishedDate).toBe("string");
    });
  });

  describe("Response Mapping", () => {
    test("handles missing contributions array", async () => {
      const mockResponse = {
        data: {
          books: [
            {
              id: "123",
              title: "Test Book",
              authors: [{ name: "Author One" }],
              // No contributions
            },
          ],
        },
      };

      global.fetch = createMockFetch(
        new Map([["hardcover.app", { ok: true, json: async () => mockResponse }]])
      );

      const provider = createHardcoverProvider({ apiKey: "test-key" });
      const result = await provider.lookup(sampleISBNs.effectiveJava);

      expect(result).not.toBeNull();
      if (!result) return;
      expect(result.authors).toEqual(["Author One"]);
    });

    test("handles missing authors array", async () => {
      const mockResponse = {
        data: {
          books: [
            {
              id: "123",
              title: "Test Book",
              contributions: [{ author: { name: "Contributor" } }],
              // No authors
            },
          ],
        },
      };

      global.fetch = createMockFetch(
        new Map([["hardcover.app", { ok: true, json: async () => mockResponse }]])
      );

      const provider = createHardcoverProvider({ apiKey: "test-key" });
      const result = await provider.lookup(sampleISBNs.effectiveJava);

      expect(result).not.toBeNull();
      if (!result) return;
      expect(result.authors).toEqual(["Contributor"]);
    });

    test("handles all optional fields missing", async () => {
      const mockResponse = {
        data: {
          books: [
            {
              id: "123",
              title: "Minimal Book",
              // All other fields missing
            },
          ],
        },
      };

      global.fetch = createMockFetch(
        new Map([["hardcover.app", { ok: true, json: async () => mockResponse }]])
      );

      const provider = createHardcoverProvider({ apiKey: "test-key" });
      const result = await provider.lookup(sampleISBNs.effectiveJava);

      expect(result).not.toBeNull();
      if (!result) return;
      expect(result.title).toBe("Minimal Book");
      expect(result.authors).toEqual([]);
      expect(result.subtitle).toBeUndefined();
      expect(result.description).toBeUndefined();
    });
  });

  describe("Error Handling", () => {
    test("returns null when no books found", async () => {
      const mockResponse = {
        data: {
          books: [],
        },
      };

      global.fetch = createMockFetch(
        new Map([["hardcover.app", { ok: true, json: async () => mockResponse }]])
      );

      const provider = createHardcoverProvider({ apiKey: "test-key" });
      const result = await provider.lookup(sampleISBNs.effectiveJava);

      expectNotFound(result);
    });

    test("returns null when data.books is missing", async () => {
      const mockResponse = {
        data: {},
      };

      global.fetch = createMockFetch(
        new Map([["hardcover.app", { ok: true, json: async () => mockResponse }]])
      );

      const provider = createHardcoverProvider({ apiKey: "test-key" });
      const result = await provider.lookup(sampleISBNs.effectiveJava);

      expectNotFound(result);
    });

    test("throws on GraphQL errors", async () => {
      const mockResponse = {
        errors: [{ message: "Invalid API key" }],
      };

      global.fetch = createMockFetch(
        new Map([["hardcover.app", { ok: true, json: async () => mockResponse }]])
      );

      const provider = createHardcoverProvider({ apiKey: "invalid-key" });
      await expectServiceUnavailableError(
        provider.lookup(sampleISBNs.effectiveJava),
        "hardcover"
      );
    });

    test("throws ServiceUnavailableError on HTTP 401", async () => {
      global.fetch = createMockFetch(
        new Map([["hardcover.app", { ok: false, status: 401 }]])
      );

      const provider = createHardcoverProvider({ apiKey: "test-key" });
      await expectServiceUnavailableError(
        provider.lookup(sampleISBNs.effectiveJava),
        "hardcover"
      );
    });

    test("throws ServiceUnavailableError on HTTP 500", async () => {
      global.fetch = createMockFetch(
        new Map([["hardcover.app", { ok: false, status: 500 }]])
      );

      const provider = createHardcoverProvider({ apiKey: "test-key" });
      await expectServiceUnavailableError(
        provider.lookup(sampleISBNs.effectiveJava),
        "hardcover"
      );
    });

    test("throws TimeoutError when request times out", async () => {
      global.fetch = createTimeoutFetch();

      const provider = createHardcoverProvider({ apiKey: "test-key", timeout: 5000 });
      await expectTimeoutError(
        provider.lookup(sampleISBNs.effectiveJava),
        "hardcover",
        5000
      );
    });

    test("throws ServiceUnavailableError on network error", async () => {
      global.fetch = createNetworkErrorFetch();

      const provider = createHardcoverProvider({ apiKey: "test-key" });
      await expectServiceUnavailableError(
        provider.lookup(sampleISBNs.effectiveJava),
        "hardcover"
      );
    });
  });

  describe("Edge Cases", () => {
    test("skips authors without names", async () => {
      const mockResponse = {
        data: {
          books: [
            {
              id: "123",
              title: "Test Book",
              authors: [
                { name: "Valid Author" },
                { name: "" }, // Empty name
                {}, // Missing name
              ],
            },
          ],
        },
      };

      global.fetch = createMockFetch(
        new Map([["hardcover.app", { ok: true, json: async () => mockResponse }]])
      );

      const provider = createHardcoverProvider({ apiKey: "test-key" });
      const result = await provider.lookup(sampleISBNs.effectiveJava);

      expect(result).not.toBeNull();
      if (!result) return;
      // Should only include valid author
      expect(result.authors).toEqual(["Valid Author"]);
    });

    test("respects custom timeout configuration", async () => {
      global.fetch = createTimeoutFetch();

      const customTimeout = 3000;
      const provider = createHardcoverProvider({ apiKey: "test-key", timeout: customTimeout });

      await expectTimeoutError(
        provider.lookup(sampleISBNs.effectiveJava),
        "hardcover",
        customTimeout
      );
    });

    test("provider property is set correctly", () => {
      const provider = createHardcoverProvider({ apiKey: "test-key" });
      expect(provider.provider).toBe("hardcover");
    });
  });
});
