import { describe, it, expect } from "bun:test";
import {
  createCompositeProvider,
  createMockProvider,
  createFailingMockProvider,
  createEmptyMockProvider,
  ServiceUnavailableError,
  type BookMetadata,
} from "@/index";

describe("createCompositeProvider", () => {
  const testBook: BookMetadata = {
    isbn: "9780134685991",
    title: "Effective Java",
    authors: ["Joshua Bloch"],
    source: "google-books",
  };

  const alternateBook: BookMetadata = {
    isbn: "9780134685991",
    title: "Effective Java",
    authors: ["Joshua Bloch"],
    source: "open-library",
  };

  it("should throw if no providers given", () => {
    expect(() => createCompositeProvider({ providers: [] })).toThrow();
  });

  it("should return result from first successful provider", async () => {
    const composite = createCompositeProvider({
      providers: [
        createMockProvider({
          responses: new Map([["9780134685991", testBook]]),
        }),
        createMockProvider({
          responses: new Map([["9780134685991", alternateBook]]),
          provider: "open-library",
        }),
      ],
    });

    const result = await composite.lookup("9780134685991");
    expect(result).toEqual(testBook);
    expect(result?.source).toBe("google-books");
  });

  it("should fallback to second provider when first fails", async () => {
    const composite = createCompositeProvider({
      providers: [
        createFailingMockProvider("google-books"),
        createMockProvider({
          responses: new Map([["9780134685991", alternateBook]]),
          provider: "open-library",
        }),
      ],
    });

    const result = await composite.lookup("9780134685991");
    expect(result).not.toBeNull();
    expect(result?.source).toBe("open-library");
  });

  it("should fallback to second provider when first returns null", async () => {
    const composite = createCompositeProvider({
      providers: [
        createEmptyMockProvider("google-books"),
        createMockProvider({
          responses: new Map([["9780134685991", alternateBook]]),
          provider: "open-library",
        }),
      ],
    });

    const result = await composite.lookup("9780134685991");
    expect(result).not.toBeNull();
    expect(result?.source).toBe("open-library");
  });

  it("should return null when all providers return null", async () => {
    const composite = createCompositeProvider({
      providers: [
        createEmptyMockProvider("google-books"),
        createEmptyMockProvider("open-library"),
      ],
    });

    const result = await composite.lookup("9999999999999");
    expect(result).toBeNull();
  });

  it("should throw when all providers fail with errors", async () => {
    const composite = createCompositeProvider({
      providers: [
        createFailingMockProvider("google-books"),
        createFailingMockProvider("open-library"),
      ],
    });

    expect(composite.lookup("9780134685991")).rejects.toThrow(
      ServiceUnavailableError
    );
  });

  it("should not throw when some providers fail but one succeeds", async () => {
    const composite = createCompositeProvider({
      providers: [
        createFailingMockProvider("google-books"),
        createFailingMockProvider("open-library"),
        createMockProvider({
          responses: new Map([["9780134685991", testBook]]),
          provider: "library-of-congress",
        }),
      ],
    });

    const result = await composite.lookup("9780134685991");
    expect(result).not.toBeNull();
  });

  it("should return null when some providers fail and rest return null", async () => {
    const composite = createCompositeProvider({
      providers: [
        createFailingMockProvider("google-books"),
        createEmptyMockProvider("open-library"),
      ],
    });

    // First provider fails, second returns null
    // Since not ALL providers failed with errors, return null instead of throwing
    const result = await composite.lookup("9780134685991");
    expect(result).toBeNull();
  });

  it("should report first provider as its provider", () => {
    const composite = createCompositeProvider({
      providers: [
        createMockProvider({ provider: "open-library" }),
        createMockProvider({ provider: "google-books" }),
      ],
    });

    expect(composite.provider).toBe("open-library");
  });
});
