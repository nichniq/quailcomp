/**
 * Composite Book Metadata Provider
 *
 * Combines multiple providers with fallback behavior.
 * Tries each provider in order until one succeeds.
 */

import type {
  BookMetadataService,
  BookMetadata,
  CompositeConfig,
  BookMetadataProvider,
} from "./types";
import { ServiceUnavailableError } from "./types";
import { createGoogleBooksProvider } from "./google-books";
import { createOpenLibraryProvider } from "./open-library";
import { createLibraryOfCongressProvider } from "./library-of-congress";

/**
 * Create a composite metadata service that tries multiple providers in order.
 *
 * @param config - Configuration with array of providers
 * @returns BookMetadataService that tries providers in sequence
 *
 * @example
 * const lookup = createCompositeProvider({
 *   providers: [
 *     createGoogleBooksProvider({ apiKey: 'key' }),
 *     createOpenLibraryProvider(),
 *     createLibraryOfCongressProvider(),
 *   ],
 * });
 */
export function createCompositeProvider(
  config: CompositeConfig
): BookMetadataService {
  const { providers } = config;

  if (providers.length === 0) {
    throw new Error("At least one provider is required");
  }

  return {
    // Report the first provider as the "primary"
    provider: providers[0].provider,

    async lookup(isbn: string): Promise<BookMetadata | null> {
      const errors: Array<{ provider: BookMetadataProvider; error: Error }> = [];

      for (const service of providers) {
        try {
          const result = await service.lookup(isbn);

          if (result !== null) {
            return result;
          }
          // Provider returned null (not found), try next
        } catch (error) {
          errors.push({
            provider: service.provider,
            error: error as Error,
          });
          // Continue to next provider
        }
      }

      // All providers failed or returned null
      if (errors.length === providers.length) {
        // All providers threw errors - aggregate them
        throw new ServiceUnavailableError(
          "composite",
          new AggregateError(
            errors.map((e) => e.error),
            `All ${providers.length} providers failed`
          )
        );
      }

      // Some providers worked but returned null (not found)
      return null;
    },
  };
}

// =============================================================================
// Convenience Factory
// =============================================================================

/**
 * Create a book metadata service with all providers configured.
 *
 * This is the recommended way to create a service for most use cases.
 * It tries Google Books first, then OpenLibrary, then Library of Congress.
 *
 * @param config - Optional configuration
 * @returns BookMetadataService with fallback across all providers
 *
 * @example
 * const service = createBookMetadataService({
 *   googleBooksApiKey: process.env.GOOGLE_BOOKS_API_KEY,
 *   timeout: 5000,
 * });
 *
 * const book = await service.lookup('978-0134685991');
 */
export function createBookMetadataService(config?: {
  googleBooksApiKey?: string;
  timeout?: number;
}): BookMetadataService {
  const timeout = config?.timeout;

  return createCompositeProvider({
    providers: [
      createGoogleBooksProvider({
        apiKey: config?.googleBooksApiKey,
        timeout,
      }),
      createOpenLibraryProvider({ timeout }),
      createLibraryOfCongressProvider({ timeout }),
    ],
  });
}
