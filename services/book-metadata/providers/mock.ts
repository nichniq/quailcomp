/**
 * Mock Book Metadata Provider
 *
 * Provides mock implementations for testing.
 */

import type {
  BookMetadataService,
  BookMetadata,
  BookMetadataProvider,
} from "@/types";
import { ServiceUnavailableError } from "@/types";
import { normalizeISBN } from "@/utils";

interface MockProviderConfig {
  /** Predefined responses by ISBN */
  responses?: Map<string, BookMetadata | null>;

  /** Provider name to report */
  provider?: BookMetadataProvider;

  /** Simulate latency in ms */
  latency?: number;

  /** Force errors for specific ISBNs */
  errorISBNs?: Set<string>;
}

/**
 * Create a mock provider for testing.
 *
 * @param config - Mock configuration
 * @returns BookMetadataService that returns predefined responses
 *
 * @example
 * const mock = createMockProvider({
 *   responses: new Map([
 *     ['9780134685991', {
 *       isbn: '9780134685991',
 *       title: 'Effective Java',
 *       authors: ['Joshua Bloch'],
 *       source: 'google-books',
 *     }],
 *   ]),
 * });
 *
 * const book = await mock.lookup('9780134685991');
 */
export function createMockProvider(
  config: MockProviderConfig = {}
): BookMetadataService {
  const {
    responses = new Map(),
    provider = "google-books",
    latency = 0,
    errorISBNs = new Set(),
  } = config;

  return {
    provider,

    async lookup(isbn: string): Promise<BookMetadata | null> {
      const normalized = normalizeISBN(isbn);

      // Simulate latency
      if (latency > 0) {
        await new Promise((resolve) => setTimeout(resolve, latency));
      }

      // Simulate errors for specific ISBNs
      if (errorISBNs.has(normalized)) {
        throw new ServiceUnavailableError(provider);
      }

      return responses.get(normalized) ?? null;
    },
  };
}

/**
 * Create a mock that always fails.
 * Useful for testing fallback behavior.
 *
 * @param provider - Provider name to report
 * @returns BookMetadataService that always throws
 *
 * @example
 * const composite = createCompositeProvider({
 *   providers: [
 *     createFailingMockProvider('google-books'),
 *     createMockProvider({ responses: myResponses }),
 *   ],
 * });
 */
export function createFailingMockProvider(
  provider: BookMetadataProvider = "google-books"
): BookMetadataService {
  return {
    provider,
    async lookup(): Promise<never> {
      throw new ServiceUnavailableError(provider);
    },
  };
}

/**
 * Create a mock that always returns null (not found).
 * Useful for testing fallback when a provider has no data.
 *
 * @param provider - Provider name to report
 * @returns BookMetadataService that always returns null
 */
export function createEmptyMockProvider(
  provider: BookMetadataProvider = "google-books"
): BookMetadataService {
  return {
    provider,
    async lookup(): Promise<null> {
      return null;
    },
  };
}
