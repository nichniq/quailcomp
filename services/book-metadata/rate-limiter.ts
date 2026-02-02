/**
 * Token Bucket Rate Limiter
 *
 * Implements the token bucket algorithm for smooth rate limiting.
 * Tokens refill continuously at a specified rate.
 *
 * This is useful for controlling API request rates to external services.
 */

/**
 * Configuration for rate limiting behavior
 */
export interface RateLimiterConfig {
  /** Maximum number of tokens the bucket can hold (burst capacity) */
  maxTokens: number;
  /** Number of tokens added per second */
  refillRate: number;
}

/**
 * Token bucket rate limiter.
 *
 * The token bucket algorithm allows for bursts of requests up to maxTokens,
 * then enforces a steady rate of refillRate tokens per second.
 *
 * @example
 * // Allow 100 requests per second with burst capacity of 100
 * const limiter = new RateLimiter({ maxTokens: 100, refillRate: 100 });
 *
 * // Acquire a token before making a request
 * await limiter.acquire();
 * await fetch('https://api.example.com/data');
 *
 * @example
 * // Allow 10 requests per second with burst capacity of 20
 * const limiter = new RateLimiter({ maxTokens: 20, refillRate: 10 });
 *
 * // Check if a token is available without waiting
 * if (limiter.canAcquire()) {
 *   await limiter.acquire();
 *   // Make request
 * } else {
 *   // Handle rate limit
 * }
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number;

  /**
   * Create a new rate limiter.
   *
   * @param config - Rate limiter configuration
   */
  constructor(config: RateLimiterConfig) {
    this.maxTokens = config.maxTokens;
    this.refillRate = config.refillRate;
    this.tokens = config.maxTokens;
    this.lastRefill = Date.now();
  }

  /**
   * Acquire a token, waiting if necessary.
   *
   * This method will block until a token is available.
   *
   * @returns Promise that resolves when a token has been acquired
   */
  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens < 1) {
      const waitTime = ((1 - this.tokens) / this.refillRate) * 1000;
      await new Promise<void>((resolve) => setTimeout(resolve, waitTime));
      this.refill();
    }

    this.tokens -= 1;
  }

  /**
   * Check if a token is available without acquiring.
   *
   * This is useful for testing or implementing custom rate limit handling.
   *
   * @returns true if a token is available, false otherwise
   */
  canAcquire(): boolean {
    this.refill();
    return this.tokens >= 1;
  }

  /**
   * Reset the rate limiter to its initial state.
   *
   * This is useful for testing or when reconfiguring rate limits.
   */
  reset(): void {
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
  }

  /**
   * Get the current number of available tokens.
   *
   * This is useful for monitoring or debugging rate limiter behavior.
   *
   * @returns Current token count (may be fractional)
   */
  getTokenCount(): number {
    this.refill();
    return this.tokens;
  }

  /**
   * Refill tokens based on elapsed time since last refill.
   *
   * This is called automatically by acquire() and canAcquire().
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(
      this.maxTokens,
      this.tokens + elapsed * this.refillRate
    );
    this.lastRefill = now;
  }
}
