/**
 * Library of Congress API Provider
 *
 * Fetches book metadata from the Library of Congress API.
 * https://www.loc.gov/apis/
 */

import type {
  BookMetadataService,
  BookMetadata,
  LibraryOfCongressConfig,
} from "./types";
import { ServiceUnavailableError, TimeoutError } from "./types";
import { normalizeISBN, createAbortController } from "./utils";

// =============================================================================
// Library of Congress API Response Types (internal)
// =============================================================================

interface LOCSearchResult {
  title?: string;
  contributor?: string[];
  date?: string;
  language?: string[];
  subject?: string[];
  description?: string[];
  number_lccn?: string[];
}

interface LOCSearchResponse {
  results?: LOCSearchResult[];
}

// =============================================================================
// Provider Implementation
// =============================================================================

const DEFAULT_TIMEOUT = 10000;

/**
 * Create a Library of Congress metadata provider.
 *
 * @param config - Optional configuration
 * @returns BookMetadataService implementation
 *
 * @example
 * const loc = createLibraryOfCongressProvider();
 * const book = await loc.lookup('9780134685991');
 */
export function createLibraryOfCongressProvider(
  config: LibraryOfCongressConfig = {}
): BookMetadataService {
  const timeout = config.timeout ?? DEFAULT_TIMEOUT;

  return {
    provider: "library-of-congress",

    async lookup(isbn: string): Promise<BookMetadata | null> {
      const normalizedISBN = normalizeISBN(isbn);
      const url = `https://www.loc.gov/books/?q=${normalizedISBN}&fo=json`;

      const { signal, clear } = createAbortController(timeout);

      try {
        const response = await fetch(url, { signal });
        clear();

        if (!response.ok) {
          throw new ServiceUnavailableError(
            "library-of-congress",
            new Error(`HTTP ${response.status}`)
          );
        }

        const data: LOCSearchResponse = await response.json();

        if (!data.results || data.results.length === 0) {
          return null;
        }

        return mapLOCToMetadata(normalizedISBN, data.results[0]);
      } catch (error) {
        clear();

        if (error instanceof Error && error.name === "AbortError") {
          throw new TimeoutError("library-of-congress", timeout);
        }
        if (
          error instanceof ServiceUnavailableError ||
          error instanceof TimeoutError
        ) {
          throw error;
        }
        throw new ServiceUnavailableError("library-of-congress", error as Error);
      }
    },
  };
}

// =============================================================================
// Response Mapping
// =============================================================================

function mapLOCToMetadata(
  isbn: string,
  result: LOCSearchResult
): BookMetadata | null {
  // LOC results must have at least a title to be useful
  if (!result.title) {
    return null;
  }

  return {
    isbn,
    lccn: result.number_lccn?.[0],
    title: result.title,
    authors: result.contributor ?? [],
    publishedDate: result.date,
    description: result.description?.[0],
    language: result.language?.[0],
    subjects: result.subject,
    source: "library-of-congress",
  };
}
