/**
 * Resilient Provider Wrapper
 *
 * Wraps any BookMetadataService to add circuit breaker protection.
 * This prevents cascading failures by failing fast when a provider is down.
 */

import type { BookMetadataService, BookMetadata } from "@/types";
import { ServiceUnavailableError } from "@/types";
import { CircuitBreaker, CircuitOpenError } from "@/circuit-breaker";
import type { CircuitBreakerConfig } from "@/circuit-breaker";

/**
 * Wrap a provider with circuit breaker protection.
 *
 * This wrapper applies the circuit breaker pattern to any BookMetadataService,
 * failing fast when the provider is experiencing issues.
 *
 * @example
 * const googleBooks = createGoogleBooksProvider({ apiKey: 'key' });
 * const resilient = createResilientProvider(googleBooks, {
 *   failureThreshold: 5,
 *   recoveryTimeout: 60000,  // 60 seconds
 *   successThreshold: 2
 * });
 *
 * // Circuit will open after 5 consecutive failures
 * // While open, requests fail immediately with ServiceUnavailableError
 * try {
 *   await resilient.lookup('9780134685991');
 * } catch (error) {
 *   if (error instanceof ServiceUnavailableError) {
 *     // Circuit is open, provider is temporarily unavailable
 *   }
 * }
 */
export function createResilientProvider(
  baseProvider: BookMetadataService,
  config?: CircuitBreakerConfig
): BookMetadataService {
  const circuitBreaker = new CircuitBreaker(config);

  return {
    provider: baseProvider.provider,

    async lookup(isbn: string): Promise<BookMetadata | null> {
      try {
        // Execute with circuit breaker protection
        return await circuitBreaker.execute(() => baseProvider.lookup(isbn));
      } catch (error) {
        // Convert CircuitOpenError to ServiceUnavailableError
        if (error instanceof CircuitOpenError) {
          throw new ServiceUnavailableError(
            baseProvider.provider,
            new Error("Circuit breaker is open")
          );
        }
        // Propagate other errors
        throw error;
      }
    },
  };
}
