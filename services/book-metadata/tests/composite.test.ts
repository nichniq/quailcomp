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

  it("should stop trying providers after first success", async () => {
    let secondProviderCalled = false;

    const firstProvider = createMockProvider({
      responses: new Map([["9780134685991", testBook]]),
      provider: "google-books",
    });

    const secondProvider = {
      provider: "open-library" as const,
      async lookup() {
        secondProviderCalled = true;
        return alternateBook;
      },
    };

    const composite = createCompositeProvider({
      providers: [firstProvider, secondProvider],
    });

    const result = await composite.lookup("9780134685991");
    expect(result?.source).toBe("google-books");
    expect(secondProviderCalled).toBe(false);
  });

  it("should try all providers when all return null", async () => {
    const callOrder: string[] = [];

    const provider1 = {
      provider: "google-books" as const,
      async lookup() {
        callOrder.push("google-books");
        return null;
      },
    };

    const provider2 = {
      provider: "open-library" as const,
      async lookup() {
        callOrder.push("open-library");
        return null;
      },
    };

    const provider3 = {
      provider: "library-of-congress" as const,
      async lookup() {
        callOrder.push("library-of-congress");
        return null;
      },
    };

    const composite = createCompositeProvider({
      providers: [provider1, provider2, provider3],
    });

    const result = await composite.lookup("9999999999999");
    expect(result).toBeNull();
    expect(callOrder).toEqual(["google-books", "open-library", "library-of-congress"]);
  });

  it("should respect priority order", async () => {
    // Create providers that will all succeed, but in different order
    const lowPriority = createMockProvider({
      responses: new Map([["9780134685991", { ...testBook, source: "google-books" as const }]]),
      provider: "google-books",
    });

    const highPriority = createMockProvider({
      responses: new Map([["9780134685991", { ...alternateBook, source: "open-library" as const }]]),
      provider: "open-library",
    });

    // High priority provider is first in array
    const composite = createCompositeProvider({
      providers: [highPriority, lowPriority],
    });

    const result = await composite.lookup("9780134685991");
    expect(result?.source).toBe("open-library");
  });

  it("should handle errors from middle providers", async () => {
    const composite = createCompositeProvider({
      providers: [
        createEmptyMockProvider("google-books"), // Returns null
        createFailingMockProvider("open-library"), // Throws error
        createMockProvider({
          // Succeeds
          responses: new Map([["9780134685991", testBook]]),
          provider: "library-of-congress",
        }),
      ],
    });

    const result = await composite.lookup("9780134685991");
    expect(result).not.toBeNull();
    expect(result?.source).toBe("google-books");
  });

  it("should aggregate errors from all failed providers", async () => {
    const composite = createCompositeProvider({
      providers: [
        createFailingMockProvider("google-books"),
        createFailingMockProvider("open-library"),
        createFailingMockProvider("library-of-congress"),
      ],
    });

    try {
      await composite.lookup("9780134685991");
      expect.unreachable("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceUnavailableError);
      const serviceError = error as ServiceUnavailableError;
      expect(serviceError.message).toContain("unavailable");
      expect(serviceError.cause).toBeInstanceOf(AggregateError);
      const aggregateError = serviceError.cause as AggregateError;
      expect(aggregateError.message).toContain("All 3 providers failed");
    }
  });
});
