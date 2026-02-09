/**
 * Integration tests for resilience wrappers
 *
 * Tests rate-limited and resilient provider wrappers with mock providers.
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { createRateLimitedProvider } from "@/providers/rate-limited";
import { createResilientProvider } from "@/providers/resilient";
import {
  createMockProvider,
  createFailingMockProvider,
} from "@/providers/mock";
import { ServiceUnavailableError } from "@/types";

describe("Rate-Limited Provider", () => {
  test("allows requests within rate limit", async () => {
    const mockProvider = createMockProvider({
      responses: new Map([
        [
          "9780134685991",
          {
            isbn: "9780134685991",
            title: "Effective Java",
            authors: ["Joshua Bloch"],
            source: "google-books",
          },
        ],
      ]),
    });

    const rateLimited = createRateLimitedProvider(mockProvider, {
      maxTokens: 10,
      refillRate: 100,
    });

    // Should allow 10 requests immediately
    const start = Date.now();
    for (let i = 0; i < 10; i++) {
      await rateLimited.lookup("9780134685991");
    }
    const elapsed = Date.now() - start;

    // Should be nearly instantaneous
    expect(elapsed).toBeLessThan(50);
  });

  test("delays requests when rate limit is exceeded", async () => {
    const mockProvider = createMockProvider({
      responses: new Map([
        [
          "9780134685991",
          {
            isbn: "9780134685991",
            title: "Effective Java",
            authors: ["Joshua Bloch"],
            source: "google-books",
          },
        ],
      ]),
    });

    const rateLimited = createRateLimitedProvider(mockProvider, {
      maxTokens: 2,
      refillRate: 10, // 10 requests per second
    });

    // Exhaust tokens
    await rateLimited.lookup("9780134685991");
    await rateLimited.lookup("9780134685991");

    // Next request should be delayed
    const start = Date.now();
    await rateLimited.lookup("9780134685991");
    const elapsed = Date.now() - start;

    // Should wait approximately 100ms (1 token at 10 tokens/sec)
    expect(elapsed).toBeGreaterThanOrEqual(90);
    expect(elapsed).toBeLessThan(150);
  });

  test("preserves provider name", () => {
    const mockProvider = createMockProvider({
      responses: new Map([
        [
          "9780134685991",
          {
            isbn: "9780134685991",
            title: "Test",
            authors: [],
            source: "google-books",
          },
        ],
      ]),
    });

    const rateLimited = createRateLimitedProvider(mockProvider, {
      maxTokens: 10,
      refillRate: 10,
    });

    expect(rateLimited.provider).toBe("google-books");
  });

  test("propagates errors from underlying provider", async () => {
    const failingProvider = createFailingMockProvider();

    const rateLimited = createRateLimitedProvider(failingProvider, {
      maxTokens: 10,
      refillRate: 10,
    });

    await expect(rateLimited.lookup("9780134685991")).rejects.toThrow(
      ServiceUnavailableError
    );
  });
});

describe("Resilient Provider", () => {
  test("allows requests when circuit is closed", async () => {
    const mockProvider = createMockProvider({
      responses: new Map([
        [
          "9780134685991",
          {
            isbn: "9780134685991",
            title: "Effective Java",
            authors: ["Joshua Bloch"],
            source: "google-books",
          },
        ],
      ]),
    });

    const resilient = createResilientProvider(mockProvider, {
      failureThreshold: 5,
      recoveryTimeout: 60000,
    });

    const result = await resilient.lookup("9780134685991");

    expect(result).not.toBeNull();
    expect(result?.title).toBe("Effective Java");
  });

  test("opens circuit after failure threshold", async () => {
    const failingProvider = createFailingMockProvider();

    const resilient = createResilientProvider(failingProvider, {
      failureThreshold: 3,
      recoveryTimeout: 60000,
    });

    // Fail 3 times to open circuit
    for (let i = 0; i < 3; i++) {
      try {
        await resilient.lookup("9780134685991");
      } catch {
        // Expected
      }
    }

    // Next request should fail immediately
    await expect(resilient.lookup("9780134685991")).rejects.toThrow(
      ServiceUnavailableError
    );
  });

  test("attempts recovery after timeout", async () => {
    let callCount = 0;
    const recoveryProvider = {
      provider: "google-books" as const,
      async lookup() {
        callCount++;
        if (callCount <= 3) {
          throw new Error("Still down");
        }
        return {
          isbn: "9780134685991",
          title: "Recovered",
          authors: [],
          source: "google-books" as const,
        };
      },
    };

    const resilient = createResilientProvider(recoveryProvider, {
      failureThreshold: 3,
      recoveryTimeout: 100, // Short timeout for testing
      successThreshold: 1,
    });

    // Open the circuit
    for (let i = 0; i < 3; i++) {
      try {
        await resilient.lookup("9780134685991");
      } catch {
        // Expected
      }
    }

    // Wait for recovery timeout
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Should attempt recovery and succeed
    const result = await resilient.lookup("9780134685991");
    expect(result?.title).toBe("Recovered");
  });

  test("preserves provider name", () => {
    const mockProvider = createMockProvider({
      responses: new Map([
        [
          "9780134685991",
          {
            isbn: "9780134685991",
            title: "Test",
            authors: [],
            source: "google-books",
          },
        ],
      ]),
    });

    const resilient = createResilientProvider(mockProvider);

    expect(resilient.provider).toBe("google-books");
  });

  test("converts CircuitOpenError to ServiceUnavailableError", async () => {
    const failingProvider = createFailingMockProvider();

    const resilient = createResilientProvider(failingProvider, {
      failureThreshold: 1,
      recoveryTimeout: 60000,
    });

    // Open circuit
    try {
      await resilient.lookup("9780134685991");
    } catch {
      // Expected
    }

    // Should throw ServiceUnavailableError
    await expect(resilient.lookup("9780134685991")).rejects.toThrow(
      ServiceUnavailableError
    );
  });
});

describe("Combined Wrappers", () => {
  test("rate limiting and circuit breaker work together", async () => {
    const mockProvider = createMockProvider({
      responses: new Map([
        [
          "9780134685991",
          {
            isbn: "9780134685991",
            title: "Effective Java",
            authors: ["Joshua Bloch"],
            source: "google-books",
          },
        ],
      ]),
    });

    // Wrap with both rate limiting and circuit breaker
    const rateLimited = createRateLimitedProvider(mockProvider, {
      maxTokens: 5,
      refillRate: 10,
    });

    const resilient = createResilientProvider(rateLimited, {
      failureThreshold: 3,
      recoveryTimeout: 60000,
    });

    // Should successfully make requests
    for (let i = 0; i < 5; i++) {
      const result = await resilient.lookup("9780134685991");
      expect(result?.title).toBe("Effective Java");
    }
  });

  test("circuit breaker protects rate limiter from excessive waits", async () => {
    const failingProvider = createFailingMockProvider();

    // Rate limit is very restrictive
    const rateLimited = createRateLimitedProvider(failingProvider, {
      maxTokens: 1,
      refillRate: 1, // Only 1 request per second
    });

    // Circuit breaker opens quickly
    const resilient = createResilientProvider(rateLimited, {
      failureThreshold: 2,
      recoveryTimeout: 60000,
    });

    // Fail twice to open circuit
    try {
      await resilient.lookup("9780134685991");
    } catch {
      // Expected
    }

    // Wait for rate limit to refill
    await new Promise((resolve) => setTimeout(resolve, 1100));

    try {
      await resilient.lookup("9780134685991");
    } catch {
      // Expected
    }

    // Circuit should be open, so next request fails immediately
    // without waiting for rate limiter
    const start = Date.now();
    try {
      await resilient.lookup("9780134685991");
    } catch {
      // Expected
    }
    const elapsed = Date.now() - start;

    // Should fail immediately (not wait for rate limiter)
    expect(elapsed).toBeLessThan(50);
  });

  test("circuit breaker inside rate limiter fails fast", async () => {
    const failingProvider = createFailingMockProvider();

    // Rate limiter wraps circuit breaker (rate limit applied first)
    const resilient = createResilientProvider(failingProvider, {
      failureThreshold: 1,
      recoveryTimeout: 1000, // Long timeout
    });

    const rateLimited = createRateLimitedProvider(resilient, {
      maxTokens: 2,
      refillRate: 10,
    });

    // Open circuit (uses 1 token)
    try {
      await rateLimited.lookup("9780134685991");
    } catch {
      // Expected
    }

    // Try to make another request (uses another token, but fails fast)
    const start = Date.now();
    try {
      await rateLimited.lookup("9780134685991");
    } catch {
      // Expected
    }
    const elapsed = Date.now() - start;

    // Should be fast (circuit is open, request fails immediately)
    // But token is still consumed by rate limiter
    expect(elapsed).toBeLessThan(50);
  });
});
