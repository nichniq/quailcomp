/**
 * Tests for OpenLibrary API Provider
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { createOpenLibraryProvider } from "@/providers/open-library";
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

describe("OpenLibrary Provider", () => {
  afterEach(() => {
    // Restore original fetch after each test
    global.fetch = originalFetch;
  });

  describe("Happy Path", () => {
    test("returns metadata for valid ISBN", async () => {
      const mockEdition = {
        title: "Effective Java",
        subtitle: "Best Practices",
        authors: [{ key: "/authors/OL1234A" }],
        publishers: ["Addison-Wesley"],
        publish_date: "2017",
        description: "The definitive guide",
        number_of_pages: 416,
        languages: [{ key: "/languages/eng" }],
        subjects: ["Programming", "Java"],
        covers: [123456],
        isbn_10: ["0134685997"],
        isbn_13: ["9780134685991"],
        lccn: ["2017001234"],
      };

      const mockAuthor = {
        name: "Joshua Bloch",
      };

      const mockFn = async (url: string | URL | Request) => {
        const urlString = url.toString();

        if (urlString.includes("/isbn/")) {
          return {
            ok: true,
            status: 200,
            json: async () => mockEdition,
          } as Response;
        }

        if (urlString.includes("/authors/")) {
          return {
            ok: true,
            json: async () => mockAuthor,
          } as Response;
        }

        return { ok: false, status: 404 } as Response;
      };
      (mockFn as any).preconnect = () => {};
      global.fetch = mockFn as typeof fetch;

      const provider = createOpenLibraryProvider();
      const result = await provider.lookup(sampleISBNs.effectiveJava);

      expectValidMetadata(result, "open-library");
      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.title).toBe("Effective Java");
      expect(result.subtitle).toBe("Best Practices");
      expect(result.authors).toEqual(["Joshua Bloch"]);
      expect(result.publisher).toBe("Addison-Wesley");
      expect(result.publishedDate).toBe("2017");
      expect(result.description).toBe("The definitive guide");
      expect(result.pageCount).toBe(416);
      expect(result.language).toBe("eng");
      expect(result.subjects).toEqual(["Programming", "Java"]);
      expect(result.isbn10).toBe("0134685997");
      expect(result.isbn13).toBe("9780134685991");
      expect(result.lccn).toBe("2017001234");
      expect(result.thumbnailUrl).toBe("https://covers.openlibrary.org/b/id/123456-M.jpg");
    });

    test("fetches author names from separate endpoints", async () => {
      const mockEdition = {
        title: "Test Book",
        authors: [
          { key: "/authors/OL1A" },
          { key: "/authors/OL2A" },
        ],
      };

      const fetchedUrls: string[] = [];

      const mockFn = async (url: string | URL | Request) => {
        const urlString = url.toString();
        fetchedUrls.push(urlString);

        if (urlString.includes("/isbn/")) {
          return { ok: true, json: async () => mockEdition } as Response;
        }

        if (urlString.includes("/authors/OL1A")) {
          return { ok: true, json: async () => ({ name: "Author One" }) } as Response;
        }

        if (urlString.includes("/authors/OL2A")) {
          return { ok: true, json: async () => ({ name: "Author Two" }) } as Response;
        }

        return { ok: false, status: 404 } as Response;
      };
      (mockFn as any).preconnect = () => {};
      global.fetch = mockFn as typeof fetch;

      const provider = createOpenLibraryProvider();
      const result = await provider.lookup(sampleISBNs.effectiveJava);

      expect(result).not.toBeNull();
      if (!result) return;

      // Should have fetched edition + 2 authors
      expect(fetchedUrls).toHaveLength(3);
      expect(fetchedUrls[0]).toContain("/isbn/");
      expect(fetchedUrls[1]).toContain("/authors/OL1A");
      expect(fetchedUrls[2]).toContain("/authors/OL2A");

      expect(result.authors).toEqual(["Author One", "Author Two"]);
    });

    test("limits author fetches to 5 maximum", async () => {
      const mockEdition = {
        title: "Test Book",
        authors: [
          { key: "/authors/OL1A" },
          { key: "/authors/OL2A" },
          { key: "/authors/OL3A" },
          { key: "/authors/OL4A" },
          { key: "/authors/OL5A" },
          { key: "/authors/OL6A" }, // Should not be fetched
          { key: "/authors/OL7A" }, // Should not be fetched
        ],
      };

      const fetchedUrls: string[] = [];

      const mockFn = async (url: string | URL | Request) => {
        const urlString = url.toString();
        fetchedUrls.push(urlString);

        if (urlString.includes("/isbn/")) {
          return { ok: true, json: async () => mockEdition } as Response;
        }

        if (urlString.includes("/authors/")) {
          const match = urlString.match(/OL(\d+)A/);
          const num = match ? match[1] : "0";
          return { ok: true, json: async () => ({ name: `Author ${num}` }) } as Response;
        }

        return { ok: false, status: 404 } as Response;
      };
      (mockFn as any).preconnect = () => {};
      global.fetch = mockFn as typeof fetch;

      const provider = createOpenLibraryProvider();
      const result = await provider.lookup(sampleISBNs.effectiveJava);

      expect(result).not.toBeNull();
      if (!result) return;

      // Should have fetched edition + 5 authors (not 7)
      expect(fetchedUrls).toHaveLength(6);
      expect(result.authors).toHaveLength(5);
      expect(result.authors).toEqual(["Author 1", "Author 2", "Author 3", "Author 4", "Author 5"]);
    });
  });

  describe("Response Mapping", () => {
    test("handles description as string", async () => {
      const mockEdition = {
        title: "Test Book",
        description: "A plain string description",
      };

      global.fetch = createMockFetch(
        new Map([["openlibrary.org", { ok: true, json: async () => mockEdition }]])
      );

      const provider = createOpenLibraryProvider();
      const result = await provider.lookup(sampleISBNs.effectiveJava);

      expect(result).not.toBeNull();
      if (!result) return;
      expect(result.description).toBe("A plain string description");
    });

    test("handles description as object with value", async () => {
      const mockEdition = {
        title: "Test Book",
        description: { value: "An object description" },
      };

      global.fetch = createMockFetch(
        new Map([["openlibrary.org", { ok: true, json: async () => mockEdition }]])
      );

      const provider = createOpenLibraryProvider();
      const result = await provider.lookup(sampleISBNs.effectiveJava);

      expect(result).not.toBeNull();
      if (!result) return;
      expect(result.description).toBe("An object description");
    });

    test("extracts language code from key format", async () => {
      const mockEdition = {
        title: "Test Book",
        languages: [{ key: "/languages/spa" }],
      };

      global.fetch = createMockFetch(
        new Map([["openlibrary.org", { ok: true, json: async () => mockEdition }]])
      );

      const provider = createOpenLibraryProvider();
      const result = await provider.lookup(sampleISBNs.effectiveJava);

      expect(result).not.toBeNull();
      if (!result) return;
      expect(result.language).toBe("spa");
    });

    test("builds cover URL from cover ID", async () => {
      const mockEdition = {
        title: "Test Book",
        covers: [987654],
      };

      global.fetch = createMockFetch(
        new Map([["openlibrary.org", { ok: true, json: async () => mockEdition }]])
      );

      const provider = createOpenLibraryProvider();
      const result = await provider.lookup(sampleISBNs.effectiveJava);

      expect(result).not.toBeNull();
      if (!result) return;
      expect(result.thumbnailUrl).toBe("https://covers.openlibrary.org/b/id/987654-M.jpg");
    });

    test("handles missing cover array", async () => {
      const mockEdition = {
        title: "Test Book",
        // No covers
      };

      global.fetch = createMockFetch(
        new Map([["openlibrary.org", { ok: true, json: async () => mockEdition }]])
      );

      const provider = createOpenLibraryProvider();
      const result = await provider.lookup(sampleISBNs.effectiveJava);

      expect(result).not.toBeNull();
      if (!result) return;
      expect(result.thumbnailUrl).toBeUndefined();
    });

    test("handles empty cover array", async () => {
      const mockEdition = {
        title: "Test Book",
        covers: [],
      };

      global.fetch = createMockFetch(
        new Map([["openlibrary.org", { ok: true, json: async () => mockEdition }]])
      );

      const provider = createOpenLibraryProvider();
      const result = await provider.lookup(sampleISBNs.effectiveJava);

      expect(result).not.toBeNull();
      if (!result) return;
      expect(result.thumbnailUrl).toBeUndefined();
    });

    test("handles edition with no authors", async () => {
      const mockEdition = {
        title: "Anonymous Book",
        // No authors array
      };

      global.fetch = createMockFetch(
        new Map([["openlibrary.org", { ok: true, json: async () => mockEdition }]])
      );

      const provider = createOpenLibraryProvider();
      const result = await provider.lookup(sampleISBNs.effectiveJava);

      expect(result).not.toBeNull();
      if (!result) return;
      expect(result.authors).toEqual([]);
    });

    test("handles missing publishers array", async () => {
      const mockEdition = {
        title: "Test Book",
        // No publishers
      };

      global.fetch = createMockFetch(
        new Map([["openlibrary.org", { ok: true, json: async () => mockEdition }]])
      );

      const provider = createOpenLibraryProvider();
      const result = await provider.lookup(sampleISBNs.effectiveJava);

      expect(result).not.toBeNull();
      if (!result) return;
      expect(result.publisher).toBeUndefined();
    });

    test("handles missing ISBN arrays", async () => {
      const mockEdition = {
        title: "Test Book",
        // No ISBN arrays
      };

      global.fetch = createMockFetch(
        new Map([["openlibrary.org", { ok: true, json: async () => mockEdition }]])
      );

      const provider = createOpenLibraryProvider();
      const result = await provider.lookup(sampleISBNs.effectiveJava);

      expect(result).not.toBeNull();
      if (!result) return;
      expect(result.isbn10).toBeUndefined();
      expect(result.isbn13).toBeUndefined();
    });
  });

  describe("Error Handling", () => {
    test("returns null on 404", async () => {
      global.fetch = createMockFetch(
        new Map([["openlibrary.org", { ok: false, status: 404 }]])
      );

      const provider = createOpenLibraryProvider();
      const result = await provider.lookup(sampleISBNs.effectiveJava);

      expectNotFound(result);
    });

    test("throws on HTTP 500", async () => {
      global.fetch = createMockFetch(
        new Map([["openlibrary.org", { ok: false, status: 500 }]])
      );

      const provider = createOpenLibraryProvider();
      await expectServiceUnavailableError(
        provider.lookup(sampleISBNs.effectiveJava),
        "open-library"
      );
    });

    test("throws on timeout", async () => {
      global.fetch = createTimeoutFetch();

      const provider = createOpenLibraryProvider({ timeout: 5000 });
      await expectTimeoutError(
        provider.lookup(sampleISBNs.effectiveJava),
        "open-library",
        5000
      );
    });

    test("handles failed author lookups gracefully", async () => {
      const mockEdition = {
        title: "Test Book",
        authors: [{ key: "/authors/OL1A" }],
      };

      const mockFn = async (url: string | URL | Request) => {
        const urlString = url.toString();

        if (urlString.includes("/isbn/")) {
          return { ok: true, json: async () => mockEdition } as Response;
        }

        // Author fetch fails
        if (urlString.includes("/authors/")) {
          return { ok: false, status: 404 } as Response;
        }

        return { ok: false, status: 404 } as Response;
      };
      (mockFn as any).preconnect = () => {};
      global.fetch = mockFn as typeof fetch;

      const provider = createOpenLibraryProvider();
      const result = await provider.lookup(sampleISBNs.effectiveJava);

      // Should still return book metadata, just without authors
      expect(result).not.toBeNull();
      if (!result) return;
      expect(result.title).toBe("Test Book");
      expect(result.authors).toEqual([]);
    });

    test("continues when some author fetches fail", async () => {
      const mockEdition = {
        title: "Test Book",
        authors: [
          { key: "/authors/OL1A" },
          { key: "/authors/OL2A" }, // This one will fail
          { key: "/authors/OL3A" },
        ],
      };

      const mockFn = async (url: string | URL | Request) => {
        const urlString = url.toString();

        if (urlString.includes("/isbn/")) {
          return { ok: true, json: async () => mockEdition } as Response;
        }

        if (urlString.includes("/authors/OL1A")) {
          return { ok: true, json: async () => ({ name: "Author One" }) } as Response;
        }

        if (urlString.includes("/authors/OL2A")) {
          // Fail this one
          throw new Error("Network error");
        }

        if (urlString.includes("/authors/OL3A")) {
          return { ok: true, json: async () => ({ name: "Author Three" }) } as Response;
        }

        return { ok: false, status: 404 } as Response;
      };
      (mockFn as any).preconnect = () => {};
      global.fetch = mockFn as typeof fetch;

      const provider = createOpenLibraryProvider();
      const result = await provider.lookup(sampleISBNs.effectiveJava);

      expect(result).not.toBeNull();
      if (!result) return;
      // Should have partial author data
      expect(result.authors).toEqual(["Author One", "Author Three"]);
    });

    test("throws on network error", async () => {
      global.fetch = createNetworkErrorFetch();

      const provider = createOpenLibraryProvider();
      await expectServiceUnavailableError(
        provider.lookup(sampleISBNs.effectiveJava),
        "open-library"
      );
    });

    test("throws on malformed JSON", async () => {
      global.fetch = createMockFetch(
        new Map([
          [
            "openlibrary.org",
            {
              ok: true,
              json: async () => {
                throw new Error("Invalid JSON");
              },
            },
          ],
        ])
      );

      const provider = createOpenLibraryProvider();
      await expectServiceUnavailableError(
        provider.lookup(sampleISBNs.effectiveJava),
        "open-library"
      );
    });
  });

  describe("Edge Cases", () => {
    test("handles author without name field", async () => {
      const mockEdition = {
        title: "Test Book",
        authors: [{ key: "/authors/OL1A" }],
      };

      const mockFn = async (url: string | URL | Request) => {
        const urlString = url.toString();

        if (urlString.includes("/isbn/")) {
          return { ok: true, json: async () => mockEdition } as Response;
        }

        if (urlString.includes("/authors/")) {
          // Author object without name field
          return { ok: true, json: async () => ({}) } as Response;
        }

        return { ok: false, status: 404 } as Response;
      };
      (mockFn as any).preconnect = () => {};
      global.fetch = mockFn as typeof fetch;

      const provider = createOpenLibraryProvider();
      const result = await provider.lookup(sampleISBNs.effectiveJava);

      expect(result).not.toBeNull();
      if (!result) return;
      // Should skip author without name
      expect(result.authors).toEqual([]);
    });

    test("respects custom timeout configuration", async () => {
      global.fetch = createTimeoutFetch();

      const customTimeout = 3000;
      const provider = createOpenLibraryProvider({ timeout: customTimeout });

      await expectTimeoutError(
        provider.lookup(sampleISBNs.effectiveJava),
        "open-library",
        customTimeout
      );
    });

    test("provider property is set correctly", () => {
      const provider = createOpenLibraryProvider();
      expect(provider.provider).toBe("open-library");
    });
  });
});
