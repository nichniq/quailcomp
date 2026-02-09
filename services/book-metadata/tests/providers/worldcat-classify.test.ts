/**
 * Tests for WorldCat Classify API Provider
 */

import { describe, test, expect, afterEach } from "bun:test";
import { createWorldCatClassifyProvider } from "@/providers/worldcat-classify";
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

describe("WorldCat Classify Provider", () => {
  afterEach(() => {
    // Restore original fetch after each test
    global.fetch = originalFetch;
  });

  describe("Happy Path", () => {
    test("returns metadata for single work (response code 0)", async () => {
      const mockXML = `<?xml version="1.0"?>
<classify>
  <response code="0"/>
  <work title="Effective Java" author="Joshua Bloch"/>
</classify>`;

      global.fetch = createMockFetch(
        new Map([["oclc.org", { ok: true, text: async () => mockXML }]])
      );

      const provider = createWorldCatClassifyProvider();
      const result = await provider.lookup(sampleISBNs.effectiveJava);

      expectValidMetadata(result, "worldcat-classify");
      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.title).toBe("Effective Java");
      expect(result.authors).toEqual(["Joshua Bloch"]);
    });

    test("returns metadata for multiple works (response code 4)", async () => {
      const mockXML = `<?xml version="1.0"?>
<classify>
  <response code="4"/>
  <work title="Test Book" author="Test Author"/>
</classify>`;

      global.fetch = createMockFetch(
        new Map([["oclc.org", { ok: true, text: async () => mockXML }]])
      );

      const provider = createWorldCatClassifyProvider();
      const result = await provider.lookup(sampleISBNs.effectiveJava);

      expectValidMetadata(result, "worldcat-classify");
      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.title).toBe("Test Book");
      expect(result.authors).toEqual(["Test Author"]);
    });

    test("extracts authors from author elements", async () => {
      const mockXML = `<?xml version="1.0"?>
<classify>
  <response code="0"/>
  <work title="Multi Author Book">
    <author name="Author One"/>
    <author name="Author Two"/>
  </work>
</classify>`;

      global.fetch = createMockFetch(
        new Map([["oclc.org", { ok: true, text: async () => mockXML }]])
      );

      const provider = createWorldCatClassifyProvider();
      const result = await provider.lookup(sampleISBNs.effectiveJava);

      expect(result).not.toBeNull();
      if (!result) return;
      expect(result.authors).toEqual(["Author One", "Author Two"]);
    });

    test("combines work author attribute and author elements", async () => {
      const mockXML = `<?xml version="1.0"?>
<classify>
  <response code="0"/>
  <work title="Test Book" author="Primary Author">
    <author name="Co-Author"/>
  </work>
</classify>`;

      global.fetch = createMockFetch(
        new Map([["oclc.org", { ok: true, text: async () => mockXML }]])
      );

      const provider = createWorldCatClassifyProvider();
      const result = await provider.lookup(sampleISBNs.effectiveJava);

      expect(result).not.toBeNull();
      if (!result) return;
      expect(result.authors).toEqual(["Primary Author", "Co-Author"]);
    });
  });

  describe("Response Mapping", () => {
    test("handles missing author attribute", async () => {
      const mockXML = `<?xml version="1.0"?>
<classify>
  <response code="0"/>
  <work title="No Author Book"/>
</classify>`;

      global.fetch = createMockFetch(
        new Map([["oclc.org", { ok: true, text: async () => mockXML }]])
      );

      const provider = createWorldCatClassifyProvider();
      const result = await provider.lookup(sampleISBNs.effectiveJava);

      expect(result).not.toBeNull();
      if (!result) return;
      expect(result.authors).toEqual([]);
    });

    test("handles single author element", async () => {
      const mockXML = `<?xml version="1.0"?>
<classify>
  <response code="0"/>
  <work title="Single Author">
    <author name="Solo Author"/>
  </work>
</classify>`;

      global.fetch = createMockFetch(
        new Map([["oclc.org", { ok: true, text: async () => mockXML }]])
      );

      const provider = createWorldCatClassifyProvider();
      const result = await provider.lookup(sampleISBNs.effectiveJava);

      expect(result).not.toBeNull();
      if (!result) return;
      expect(result.authors).toEqual(["Solo Author"]);
    });

    test("deduplicates author names", async () => {
      const mockXML = `<?xml version="1.0"?>
<classify>
  <response code="0"/>
  <work title="Test Book" author="Duplicate Author">
    <author name="Duplicate Author"/>
    <author name="Other Author"/>
  </work>
</classify>`;

      global.fetch = createMockFetch(
        new Map([["oclc.org", { ok: true, text: async () => mockXML }]])
      );

      const provider = createWorldCatClassifyProvider();
      const result = await provider.lookup(sampleISBNs.effectiveJava);

      expect(result).not.toBeNull();
      if (!result) return;
      // Should not have duplicate "Duplicate Author"
      expect(result.authors).toEqual(["Duplicate Author", "Other Author"]);
    });

    test("uses 'Unknown Title' when title missing", async () => {
      const mockXML = `<?xml version="1.0"?>
<classify>
  <response code="0"/>
  <work author="Test Author"/>
</classify>`;

      global.fetch = createMockFetch(
        new Map([["oclc.org", { ok: true, text: async () => mockXML }]])
      );

      const provider = createWorldCatClassifyProvider();
      const result = await provider.lookup(sampleISBNs.effectiveJava);

      expect(result).not.toBeNull();
      if (!result) return;
      expect(result.title).toBe("Unknown Title");
    });
  });

  describe("Error Handling", () => {
    test("returns null on not found (response code 102)", async () => {
      const mockXML = `<?xml version="1.0"?>
<classify>
  <response code="102"/>
</classify>`;

      global.fetch = createMockFetch(
        new Map([["oclc.org", { ok: true, text: async () => mockXML }]])
      );

      const provider = createWorldCatClassifyProvider();
      const result = await provider.lookup(sampleISBNs.effectiveJava);

      expectNotFound(result);
    });

    test("throws on error response code", async () => {
      const mockXML = `<?xml version="1.0"?>
<classify>
  <response code="100"/>
</classify>`;

      global.fetch = createMockFetch(
        new Map([["oclc.org", { ok: true, text: async () => mockXML }]])
      );

      const provider = createWorldCatClassifyProvider();
      await expectServiceUnavailableError(
        provider.lookup(sampleISBNs.effectiveJava),
        "worldcat-classify"
      );
    });

    test("returns null when work element missing", async () => {
      const mockXML = `<?xml version="1.0"?>
<classify>
  <response code="0"/>
</classify>`;

      global.fetch = createMockFetch(
        new Map([["oclc.org", { ok: true, text: async () => mockXML }]])
      );

      const provider = createWorldCatClassifyProvider();
      const result = await provider.lookup(sampleISBNs.effectiveJava);

      expectNotFound(result);
    });

    test("throws ServiceUnavailableError on HTTP 500", async () => {
      global.fetch = createMockFetch(
        new Map([["oclc.org", { ok: false, status: 500 }]])
      );

      const provider = createWorldCatClassifyProvider();
      await expectServiceUnavailableError(
        provider.lookup(sampleISBNs.effectiveJava),
        "worldcat-classify"
      );
    });

    test("throws TimeoutError when request times out", async () => {
      global.fetch = createTimeoutFetch();

      const provider = createWorldCatClassifyProvider({ timeout: 5000 });
      await expectTimeoutError(
        provider.lookup(sampleISBNs.effectiveJava),
        "worldcat-classify",
        5000
      );
    });

    test("throws ServiceUnavailableError on network error", async () => {
      global.fetch = createNetworkErrorFetch();

      const provider = createWorldCatClassifyProvider();
      await expectServiceUnavailableError(
        provider.lookup(sampleISBNs.effectiveJava),
        "worldcat-classify"
      );
    });

    test("throws ServiceUnavailableError on invalid XML", async () => {
      global.fetch = createMockFetch(
        new Map([["oclc.org", { ok: true, text: async () => "not xml" }]])
      );

      const provider = createWorldCatClassifyProvider();
      await expectServiceUnavailableError(
        provider.lookup(sampleISBNs.effectiveJava),
        "worldcat-classify"
      );
    });
  });

  describe("Edge Cases", () => {
    test("respects custom timeout configuration", async () => {
      global.fetch = createTimeoutFetch();

      const customTimeout = 3000;
      const provider = createWorldCatClassifyProvider({ timeout: customTimeout });

      await expectTimeoutError(
        provider.lookup(sampleISBNs.effectiveJava),
        "worldcat-classify",
        customTimeout
      );
    });

    test("provider property is set correctly", () => {
      const provider = createWorldCatClassifyProvider();
      expect(provider.provider).toBe("worldcat-classify");
    });

    test("normalizes ISBN before lookup", async () => {
      let capturedUrl = "";

      global.fetch = async (url: string | URL | Request) => {
        capturedUrl = url.toString();
        return {
          ok: true,
          text: async () => `<?xml version="1.0"?><classify><response code="102"/></classify>`,
        } as Response;
      };

      const provider = createWorldCatClassifyProvider();
      await provider.lookup(sampleISBNs.withHyphens);

      // Should normalize to plain digits
      expect(capturedUrl).toContain("9780134685991");
      expect(capturedUrl).not.toContain("-");
    });
  });
});
