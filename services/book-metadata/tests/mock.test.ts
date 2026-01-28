import { describe, it, expect } from "bun:test";
import {
  createMockProvider,
  createFailingMockProvider,
  createEmptyMockProvider,
  ServiceUnavailableError,
  type BookMetadata,
} from "@/index";

describe("createMockProvider", () => {
  const testBook: BookMetadata = {
    isbn: "9780134685991",
    title: "Effective Java",
    authors: ["Joshua Bloch"],
    source: "google-books",
  };

  it("should return predefined response for known ISBN", async () => {
    const mock = createMockProvider({
      responses: new Map([["9780134685991", testBook]]),
    });

    const result = await mock.lookup("9780134685991");
    expect(result).toEqual(testBook);
  });

  it("should return null for unknown ISBN", async () => {
    const mock = createMockProvider({
      responses: new Map([["9780134685991", testBook]]),
    });

    const result = await mock.lookup("9999999999999");
    expect(result).toBeNull();
  });

  it("should normalize ISBN before lookup", async () => {
    const mock = createMockProvider({
      responses: new Map([["9780134685991", testBook]]),
    });

    // Lookup with hyphens should still find it
    const result = await mock.lookup("978-0-13-468599-1");
    expect(result).toEqual(testBook);
  });

  it("should throw for ISBNs in errorISBNs set", async () => {
    const mock = createMockProvider({
      responses: new Map([["9780134685991", testBook]]),
      errorISBNs: new Set(["9780134685991"]),
    });

    expect(mock.lookup("9780134685991")).rejects.toThrow(ServiceUnavailableError);
  });

  it("should simulate latency", async () => {
    const mock = createMockProvider({
      responses: new Map([["9780134685991", testBook]]),
      latency: 50,
    });

    const start = Date.now();
    await mock.lookup("9780134685991");
    const elapsed = Date.now() - start;

    expect(elapsed).toBeGreaterThanOrEqual(50);
  });

  it("should use custom provider name", () => {
    const mock = createMockProvider({
      provider: "open-library",
    });

    expect(mock.provider).toBe("open-library");
  });
});

describe("createFailingMockProvider", () => {
  it("should always throw ServiceUnavailableError", async () => {
    const mock = createFailingMockProvider();

    expect(mock.lookup("9780134685991")).rejects.toThrow(ServiceUnavailableError);
  });

  it("should use specified provider name", () => {
    const mock = createFailingMockProvider("open-library");

    expect(mock.provider).toBe("open-library");
  });
});

describe("createEmptyMockProvider", () => {
  it("should always return null", async () => {
    const mock = createEmptyMockProvider();

    const result = await mock.lookup("9780134685991");
    expect(result).toBeNull();
  });

  it("should use specified provider name", () => {
    const mock = createEmptyMockProvider("library-of-congress");

    expect(mock.provider).toBe("library-of-congress");
  });
});
