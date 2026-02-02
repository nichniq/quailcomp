/**
 * Rate-Limited Provider Wrapper
 *
 * Wraps any BookMetadataService to add rate limiting using the token bucket algorithm.
 * This prevents exceeding API rate limits and ensures smooth request distribution.
 */

import type { BookMetadataService, BookMetadata } from "@/types";
import { RateLimiter } from "@/rate-limiter";
import type { RateLimiterConfig } from "@/rate-limiter";

/**
 * Wrap a provider with rate limiting.
 *
 * This wrapper applies rate limiting to any BookMetadataService, ensuring
 * requests don't exceed the configured rate limit.
 *
 * @example
 * const googleBooks = createGoogleBooksProvider({ apiKey: 'key' });
 * const rateLimited = createRateLimitedProvider(googleBooks, {
 *   maxTokens: 100,
 *   refillRate: 10  // 10 requests per second
 * });
 *
 * // Requests will automatically be rate-limited
 * await rateLimited.lookup('9780134685991');
 */
export function createRateLimitedProvider(
  baseProvider: BookMetadataService,
  config: RateLimiterConfig
): BookMetadataService {
  const rateLimiter = new RateLimiter(config);

  return {
    provider: baseProvider.provider,

    async lookup(isbn: string): Promise<BookMetadata | null> {
      // Acquire a token before making the request
      await rateLimiter.acquire();

      // Make the actual request
      return baseProvider.lookup(isbn);
    },
  };
}
