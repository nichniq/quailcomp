import { describe, test, expect, beforeEach } from "bun:test";
import { RateLimiter } from "@/rate-limiter";

describe("RateLimiter", () => {
  describe("Token Acquisition", () => {
    test("allows immediate acquisition when tokens are available", async () => {
      const limiter = new RateLimiter({ maxTokens: 10, refillRate: 10 });

      const start = Date.now();
      await limiter.acquire();
      const elapsed = Date.now() - start;

      // Should be nearly instantaneous
      expect(elapsed).toBeLessThan(10);
    });

    test("allows burst of requests up to maxTokens", async () => {
      const limiter = new RateLimiter({ maxTokens: 5, refillRate: 10 });

      const start = Date.now();

      // Acquire 5 tokens (should be instant)
      for (let i = 0; i < 5; i++) {
        await limiter.acquire();
      }

      const elapsed = Date.now() - start;

      // Should be nearly instantaneous
      expect(elapsed).toBeLessThan(10);
    });

    test("waits when tokens are exhausted", async () => {
      const limiter = new RateLimiter({ maxTokens: 2, refillRate: 10 });

      // Exhaust tokens
      await limiter.acquire();
      await limiter.acquire();

      // This should wait for ~100ms (1 token at 10 tokens/sec)
      const start = Date.now();
      await limiter.acquire();
      const elapsed = Date.now() - start;

      // Should wait approximately 100ms
      expect(elapsed).toBeGreaterThanOrEqual(90);
      expect(elapsed).toBeLessThan(150);
    });

    test("handles concurrent acquisitions correctly", async () => {
      const limiter = new RateLimiter({ maxTokens: 3, refillRate: 10 });

      const start = Date.now();

      // Acquire 5 tokens sequentially (simulating concurrent requests)
      // This is more reliable than Promise.all for testing timing
      for (let i = 0; i < 5; i++) {
        await limiter.acquire();
      }

      const elapsed = Date.now() - start;

      // First 3 should be instant, last 2 should wait
      // Should take approximately 200ms for 2 tokens at 10 tokens/sec
      expect(elapsed).toBeGreaterThanOrEqual(180);
      expect(elapsed).toBeLessThan(250);
    });
  });

  describe("Token Refilling", () => {
    test("refills tokens over time", async () => {
      const limiter = new RateLimiter({ maxTokens: 10, refillRate: 10 });

      // Exhaust all tokens
      for (let i = 0; i < 10; i++) {
        await limiter.acquire();
      }

      expect(limiter.canAcquire()).toBe(false);

      // Wait for tokens to refill (200ms = 2 tokens at 10 tokens/sec)
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Should have refilled approximately 2 tokens
      expect(limiter.canAcquire()).toBe(true);
      await limiter.acquire();
      expect(limiter.canAcquire()).toBe(true);
      await limiter.acquire();
      expect(limiter.canAcquire()).toBe(false);
    });

    test("does not exceed maxTokens when refilling", async () => {
      const limiter = new RateLimiter({ maxTokens: 5, refillRate: 100 });

      // Don't use any tokens
      // Wait for a long time (should refill but cap at maxTokens)
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Should still have exactly 5 tokens
      expect(limiter.getTokenCount()).toBeLessThanOrEqual(5);

      // Verify we can acquire exactly 5 tokens instantly
      const start = Date.now();
      for (let i = 0; i < 5; i++) {
        await limiter.acquire();
      }
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(10);
    });

    test("calculates refill rate correctly", async () => {
      const limiter = new RateLimiter({ maxTokens: 100, refillRate: 5 });

      // Exhaust tokens
      for (let i = 0; i < 100; i++) {
        await limiter.acquire();
      }

      // Wait 400ms (should refill 2 tokens at 5 tokens/sec)
      await new Promise((resolve) => setTimeout(resolve, 400));

      const tokenCount = limiter.getTokenCount();

      // Should have approximately 2 tokens
      expect(tokenCount).toBeGreaterThanOrEqual(1.9);
      expect(tokenCount).toBeLessThanOrEqual(2.5);
    });
  });

  describe("canAcquire()", () => {
    test("returns true when tokens are available", () => {
      const limiter = new RateLimiter({ maxTokens: 10, refillRate: 10 });

      expect(limiter.canAcquire()).toBe(true);
    });

    test("returns false when tokens are exhausted", async () => {
      const limiter = new RateLimiter({ maxTokens: 2, refillRate: 10 });

      await limiter.acquire();
      await limiter.acquire();

      expect(limiter.canAcquire()).toBe(false);
    });

    test("does not consume tokens", () => {
      const limiter = new RateLimiter({ maxTokens: 5, refillRate: 10 });

      // Check multiple times without consuming
      expect(limiter.canAcquire()).toBe(true);
      expect(limiter.canAcquire()).toBe(true);
      expect(limiter.canAcquire()).toBe(true);

      // Should still have tokens available
      expect(limiter.getTokenCount()).toBeGreaterThanOrEqual(4.9);
    });
  });

  describe("reset()", () => {
    test("resets tokens to maxTokens", async () => {
      const limiter = new RateLimiter({ maxTokens: 10, refillRate: 10 });

      // Exhaust tokens
      for (let i = 0; i < 10; i++) {
        await limiter.acquire();
      }

      expect(limiter.canAcquire()).toBe(false);

      // Reset
      limiter.reset();

      expect(limiter.canAcquire()).toBe(true);
      expect(limiter.getTokenCount()).toBe(10);
    });

    test("resets refill timing", async () => {
      const limiter = new RateLimiter({ maxTokens: 5, refillRate: 10 });

      // Exhaust tokens
      for (let i = 0; i < 5; i++) {
        await limiter.acquire();
      }

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Reset (should clear any accumulated refill time)
      limiter.reset();

      expect(limiter.getTokenCount()).toBe(5);
    });
  });

  describe("getTokenCount()", () => {
    test("returns current token count", () => {
      const limiter = new RateLimiter({ maxTokens: 10, refillRate: 10 });

      expect(limiter.getTokenCount()).toBe(10);
    });

    test("returns fractional tokens during refill", async () => {
      const limiter = new RateLimiter({ maxTokens: 10, refillRate: 10 });

      // Exhaust tokens
      for (let i = 0; i < 10; i++) {
        await limiter.acquire();
      }

      // Wait 50ms (should refill 0.5 tokens at 10 tokens/sec)
      await new Promise((resolve) => setTimeout(resolve, 50));

      const tokenCount = limiter.getTokenCount();

      // Should be approximately 0.5 tokens
      expect(tokenCount).toBeGreaterThanOrEqual(0.4);
      expect(tokenCount).toBeLessThan(1.0);
    });

    test("updates with refill over time", async () => {
      const limiter = new RateLimiter({ maxTokens: 10, refillRate: 10 });

      await limiter.acquire();

      const count1 = limiter.getTokenCount();

      await new Promise((resolve) => setTimeout(resolve, 100));

      const count2 = limiter.getTokenCount();

      // Should have more tokens after waiting
      expect(count2).toBeGreaterThan(count1);
    });
  });

  describe("Configuration", () => {
    test("handles high rate limits", async () => {
      const limiter = new RateLimiter({ maxTokens: 1000, refillRate: 1000 });

      const start = Date.now();

      // Should be able to burst 1000 requests
      for (let i = 0; i < 1000; i++) {
        await limiter.acquire();
      }

      const elapsed = Date.now() - start;

      // Should be nearly instantaneous
      expect(elapsed).toBeLessThan(50);
    });

    test("handles low rate limits", async () => {
      const limiter = new RateLimiter({ maxTokens: 1, refillRate: 1 });

      await limiter.acquire();

      const start = Date.now();
      await limiter.acquire();
      const elapsed = Date.now() - start;

      // Should wait approximately 1 second
      expect(elapsed).toBeGreaterThanOrEqual(900);
      expect(elapsed).toBeLessThan(1100);
    });

    test("handles fractional refill rates", async () => {
      const limiter = new RateLimiter({ maxTokens: 10, refillRate: 2.5 });

      // Exhaust tokens
      for (let i = 0; i < 10; i++) {
        await limiter.acquire();
      }

      // Wait 400ms (should refill 1 token at 2.5 tokens/sec)
      await new Promise((resolve) => setTimeout(resolve, 400));

      expect(limiter.canAcquire()).toBe(true);
      await limiter.acquire();
      expect(limiter.canAcquire()).toBe(false);
    });
  });

  describe("Concurrent Token Requests", () => {
    test("maintains fair ordering for concurrent requests", async () => {
      const limiter = new RateLimiter({ maxTokens: 2, refillRate: 10 });

      const acquisitionOrder: number[] = [];

      // Launch 5 concurrent acquisitions that track order
      const promises = Array.from({ length: 5 }, (_, index) =>
        limiter.acquire().then(() => acquisitionOrder.push(index))
      );

      await Promise.all(promises);

      // All should complete
      expect(acquisitionOrder.length).toBe(5);
      // Order should be preserved (FIFO)
      expect(acquisitionOrder).toEqual([0, 1, 2, 3, 4]);
    });
  });

  describe("Refill Timing Precision", () => {
    test("refills accurately after partial consumption", async () => {
      const limiter = new RateLimiter({ maxTokens: 10, refillRate: 10 });

      // Use 3 tokens
      await limiter.acquire();
      await limiter.acquire();
      await limiter.acquire();

      // Wait 300ms (should refill 3 tokens at 10 tokens/sec)
      await new Promise((resolve) => setTimeout(resolve, 300));

      const tokenCount = limiter.getTokenCount();

      // Should be back to 10 tokens (7 remaining + 3 refilled)
      expect(tokenCount).toBeGreaterThanOrEqual(9.5);
      expect(tokenCount).toBeLessThanOrEqual(10);
    });

    test("accumulates refill across multiple periods", async () => {
      const limiter = new RateLimiter({ maxTokens: 10, refillRate: 10 });

      // Exhaust tokens
      for (let i = 0; i < 10; i++) {
        await limiter.acquire();
      }

      // Wait 100ms, check, wait another 100ms
      await new Promise((resolve) => setTimeout(resolve, 100));
      const count1 = limiter.getTokenCount();

      await new Promise((resolve) => setTimeout(resolve, 100));
      const count2 = limiter.getTokenCount();

      // Both periods should accumulate refill
      expect(count1).toBeGreaterThanOrEqual(0.9);
      expect(count1).toBeLessThan(1.5);
      expect(count2).toBeGreaterThanOrEqual(1.9);
      expect(count2).toBeLessThan(2.5);
    });
  });
});
