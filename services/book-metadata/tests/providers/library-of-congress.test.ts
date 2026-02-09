/**
 * Tests for Library of Congress API Provider
 */

import { describe, test, expect, afterEach } from "bun:test";
import { createLibraryOfCongressProvider } from "@/providers/library-of-congress";
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

describe("Library of Congress Provider", () => {
  afterEach(() => {
    // Restore original fetch after each test
    global.fetch = originalFetch;
  });

  describe("Happy Path", () => {
    test("returns metadata for valid ISBN", async () => {
      const mockResponse = {
        results: [
          {
            title: "Effective Java",
            contributor: ["Bloch, Joshua"],
            date: "2017",
            language: ["eng"],
            subject: ["Java (Computer program language)", "Programming"],
            description: ["The definitive guide"],
            number_lccn: ["2017001234"],
          },
        ],
      };

      global.fetch = createMockFetch(
        new Map([["loc.gov", { ok: true, json: async () => mockResponse }]])
      );

      const provider = createLibraryOfCongressProvider();
      const result = await provider.lookup(sampleISBNs.effectiveJava);

      expectValidMetadata(result, "library-of-congress");
      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.title).toBe("Effective Java");
      expect(result.authors).toEqual(["Bloch, Joshua"]);
      expect(result.publishedDate).toBe("2017");
      expect(result.language).toBe("eng");
      expect(result.subjects).toEqual(["Java (Computer program language)", "Programming"]);
      expect(result.description).toBe("The definitive guide");
      expect(result.lccn).toBe("2017001234");
    });

    test("returns first result when multiple results", async () => {
      const mockResponse = {
        results: [
          { title: "First Book", contributor: ["First Author"] },
          { title: "Second Book", contributor: ["Second Author"] },
        ],
      };

      global.fetch = createMockFetch(
        new Map([["loc.gov", { ok: true, json: async () => mockResponse }]])
      );

      const provider = createLibraryOfCongressProvider();
      const result = await provider.lookup(sampleISBNs.effectiveJava);

      expect(result).not.toBeNull();
      if (!result) return;
      expect(result.title).toBe("First Book");
      expect(result.authors).toEqual(["First Author"]);
    });
  });

  describe("Response Mapping", () => {
    test("handles missing contributor array", async () => {
      const mockResponse = {
        results: [
          {
            title: "Anonymous Book",
            // No contributor
          },
        ],
      };

      global.fetch = createMockFetch(
        new Map([["loc.gov", { ok: true, json: async () => mockResponse }]])
      );

      const provider = createLibraryOfCongressProvider();
      const result = await provider.lookup(sampleISBNs.effectiveJava);

      expect(result).not.toBeNull();
      if (!result) return;
      expect(result.authors).toEqual([]);
    });

    test("handles missing optional fields", async () => {
      const mockResponse = {
        results: [
          {
            title: "Minimal Book",
            // All other fields missing
          },
        ],
      };

      global.fetch = createMockFetch(
        new Map([["loc.gov", { ok: true, json: async () => mockResponse }]])
      );

      const provider = createLibraryOfCongressProvider();
      const result = await provider.lookup(sampleISBNs.effectiveJava);

      expect(result).not.toBeNull();
      if (!result) return;
      expect(result.title).toBe("Minimal Book");
      expect(result.authors).toEqual([]);
      expect(result.publishedDate).toBeUndefined();
      expect(result.language).toBeUndefined();
      expect(result.subjects).toBeUndefined();
      expect(result.description).toBeUndefined();
      expect(result.lccn).toBeUndefined();
    });

    test("extracts first element from array fields", async () => {
      const mockResponse = {
        results: [
          {
            title: "Test Book",
            language: ["eng", "spa"], // Multiple languages
            description: ["First description", "Second description"],
            number_lccn: ["12345", "67890"],
          },
        ],
      };

      global.fetch = createMockFetch(
        new Map([["loc.gov", { ok: true, json: async () => mockResponse }]])
      );

      const provider = createLibraryOfCongressProvider();
      const result = await provider.lookup(sampleISBNs.effectiveJava);

      expect(result).not.toBeNull();
      if (!result) return;
      expect(result.language).toBe("eng"); // First element
      expect(result.description).toBe("First description"); // First element
      expect(result.lccn).toBe("12345"); // First element
    });

    test("handles multiple contributors", async () => {
      const mockResponse = {
        results: [
          {
            title: "Multi-Author Book",
            contributor: ["Author One", "Author Two", "Author Three"],
          },
        ],
      };

      global.fetch = createMockFetch(
        new Map([["loc.gov", { ok: true, json: async () => mockResponse }]])
      );

      const provider = createLibraryOfCongressProvider();
      const result = await provider.lookup(sampleISBNs.effectiveJava);

      expect(result).not.toBeNull();
      if (!result) return;
      expect(result.authors).toEqual(["Author One", "Author Two", "Author Three"]);
    });

    test("returns null when title is missing", async () => {
      const mockResponse = {
        results: [
          {
            // No title
            contributor: ["Some Author"],
            date: "2020",
          },
        ],
      };

      global.fetch = createMockFetch(
        new Map([["loc.gov", { ok: true, json: async () => mockResponse }]])
      );

      const provider = createLibraryOfCongressProvider();
      const result = await provider.lookup(sampleISBNs.effectiveJava);

      expectNotFound(result);
    });
  });

  describe("Error Handling", () => {
    test("returns null when no results", async () => {
      const mockResponse = {
        results: [],
      };

      global.fetch = createMockFetch(
        new Map([["loc.gov", { ok: true, json: async () => mockResponse }]])
      );

      const provider = createLibraryOfCongressProvider();
      const result = await provider.lookup(sampleISBNs.effectiveJava);

      expectNotFound(result);
    });

    test("returns null when results array missing", async () => {
      const mockResponse = {};

      global.fetch = createMockFetch(
        new Map([["loc.gov", { ok: true, json: async () => mockResponse }]])
      );

      const provider = createLibraryOfCongressProvider();
      const result = await provider.lookup(sampleISBNs.effectiveJava);

      expectNotFound(result);
    });

    test("throws ServiceUnavailableError on HTTP 404", async () => {
      global.fetch = createMockFetch(
        new Map([["loc.gov", { ok: false, status: 404 }]])
      );

      const provider = createLibraryOfCongressProvider();
      await expectServiceUnavailableError(
        provider.lookup(sampleISBNs.effectiveJava),
        "library-of-congress"
      );
    });

    test("throws ServiceUnavailableError on HTTP 500", async () => {
      global.fetch = createMockFetch(
        new Map([["loc.gov", { ok: false, status: 500 }]])
      );

      const provider = createLibraryOfCongressProvider();
      await expectServiceUnavailableError(
        provider.lookup(sampleISBNs.effectiveJava),
        "library-of-congress"
      );
    });

    test("throws TimeoutError when request times out", async () => {
      global.fetch = createTimeoutFetch();

      const provider = createLibraryOfCongressProvider({ timeout: 5000 });
      await expectTimeoutError(
        provider.lookup(sampleISBNs.effectiveJava),
        "library-of-congress",
        5000
      );
    });

    test("throws ServiceUnavailableError on network error", async () => {
      global.fetch = createNetworkErrorFetch();

      const provider = createLibraryOfCongressProvider();
      await expectServiceUnavailableError(
        provider.lookup(sampleISBNs.effectiveJava),
        "library-of-congress"
      );
    });

    test("throws ServiceUnavailableError on malformed JSON", async () => {
      global.fetch = createMockFetch(
        new Map([
          [
            "loc.gov",
            {
              ok: true,
              json: async () => {
                throw new Error("Invalid JSON");
              },
            },
          ],
        ])
      );

      const provider = createLibraryOfCongressProvider();
      await expectServiceUnavailableError(
        provider.lookup(sampleISBNs.effectiveJava),
        "library-of-congress"
      );
    });
  });

  describe("Edge Cases", () => {
    test("respects custom timeout configuration", async () => {
      global.fetch = createTimeoutFetch();

      const customTimeout = 3000;
      const provider = createLibraryOfCongressProvider({ timeout: customTimeout });

      await expectTimeoutError(
        provider.lookup(sampleISBNs.effectiveJava),
        "library-of-congress",
        customTimeout
      );
    });

    test("provider property is set correctly", () => {
      const provider = createLibraryOfCongressProvider();
      expect(provider.provider).toBe("library-of-congress");
    });

    test("normalizes ISBN before lookup", async () => {
      let capturedUrl = "";

      const mockFn = async (url: string | URL | Request) => {
        capturedUrl = url.toString();
        return {
          ok: true,
          json: async () => ({ results: [] }),
        } as Response;
      };
      (mockFn as any).preconnect = () => {};
      global.fetch = mockFn as typeof fetch;

      const provider = createLibraryOfCongressProvider();
      await provider.lookup(sampleISBNs.withHyphens);

      // Should normalize to plain digits
      expect(capturedUrl).toContain("9780134685991");
      expect(capturedUrl).not.toContain("-");
    });
  });
});
