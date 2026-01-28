import { describe, it, expect } from "bun:test";
import {
  normalizeISBN,
  isbn10ToIsbn13,
  isbn13ToIsbn10,
  InvalidISBNError,
} from "@/index";

describe("normalizeISBN", () => {
  it("should remove hyphens from ISBN-13", () => {
    expect(normalizeISBN("978-0-13-468599-1")).toBe("9780134685991");
  });

  it("should remove hyphens from ISBN-10", () => {
    expect(normalizeISBN("0-13-468599-7")).toBe("0134685997");
  });

  it("should remove spaces", () => {
    expect(normalizeISBN("978 0 13 468599 1")).toBe("9780134685991");
  });

  it("should handle ISBN-10 ending with X", () => {
    expect(normalizeISBN("155860832X")).toBe("155860832X");
  });

  it("should uppercase ISBN-10 ending with lowercase x", () => {
    expect(normalizeISBN("155860832x")).toBe("155860832X");
  });

  it("should accept valid ISBN-13 without hyphens", () => {
    expect(normalizeISBN("9780134685991")).toBe("9780134685991");
  });

  it("should throw InvalidISBNError for wrong length", () => {
    expect(() => normalizeISBN("12345")).toThrow(InvalidISBNError);
  });

  it("should throw InvalidISBNError for letters in ISBN-13", () => {
    expect(() => normalizeISBN("978013468599A")).toThrow(InvalidISBNError);
  });

  it("should throw InvalidISBNError for letters in middle of ISBN-10", () => {
    expect(() => normalizeISBN("01346A5997")).toThrow(InvalidISBNError);
  });

  it("should throw InvalidISBNError for empty string", () => {
    expect(() => normalizeISBN("")).toThrow(InvalidISBNError);
  });
});

describe("isbn10ToIsbn13", () => {
  it("should convert ISBN-10 to ISBN-13", () => {
    expect(isbn10ToIsbn13("0134685997")).toBe("9780134685991");
  });

  it("should handle ISBN-10 with hyphens", () => {
    expect(isbn10ToIsbn13("0-13-468599-7")).toBe("9780134685991");
  });

  it("should handle ISBN-10 ending with X", () => {
    // ISBN-10: 155860832X -> ISBN-13: 9781558608320
    expect(isbn10ToIsbn13("155860832X")).toBe("9781558608320");
  });

  it("should throw for ISBN-13 input", () => {
    expect(() => isbn10ToIsbn13("9780134685991")).toThrow(InvalidISBNError);
  });
});

describe("isbn13ToIsbn10", () => {
  it("should convert ISBN-13 to ISBN-10", () => {
    expect(isbn13ToIsbn10("9780134685991")).toBe("0134685997");
  });

  it("should handle ISBN-13 with hyphens", () => {
    expect(isbn13ToIsbn10("978-0-13-468599-1")).toBe("0134685997");
  });

  it("should return null for 979 prefix (cannot convert)", () => {
    expect(isbn13ToIsbn10("9791234567896")).toBeNull();
  });

  it("should return null for ISBN-10 input", () => {
    expect(isbn13ToIsbn10("0134685997")).toBeNull();
  });

  it("should produce ISBN-10 ending with X when needed", () => {
    // 9781558608320 -> 155860832X
    expect(isbn13ToIsbn10("9781558608320")).toBe("155860832X");
  });
});
