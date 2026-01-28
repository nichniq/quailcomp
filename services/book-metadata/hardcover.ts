/**
 * Hardcover API Provider
 *
 * Fetches book metadata from the Hardcover GraphQL API.
 * https://docs.hardcover.app/api/getting-started/
 */

import type { BookMetadataService, BookMetadata, HardcoverConfig } from "./types";
import { ServiceUnavailableError, TimeoutError } from "./types";
import { normalizeISBN, createAbortController } from "./utils";

// =============================================================================
// Hardcover GraphQL Response Types (internal)
// =============================================================================

interface HardcoverAuthor {
  name: string;
}

interface HardcoverContribution {
  author: {
    name: string;
  };
}

interface HardcoverBook {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  pages?: number;
  release_year?: number;
  language?: string;
  isbn_10?: string;
  isbn_13?: string;
  image?: string;
  authors?: HardcoverAuthor[];
  contributions?: HardcoverContribution[];
}

interface HardcoverData {
  books: HardcoverBook[];
}

interface HardcoverResponse {
  data?: HardcoverData;
  errors?: Array<{
    message: string;
  }>;
}

// =============================================================================
// Provider Implementation
// =============================================================================

const BASE_URL = "https://api.hardcover.app/v1/graphql";
const DEFAULT_TIMEOUT = 10000;

const BOOK_QUERY = `
query BookByISBN($isbn: String!) {
  books(where: { isbn: $isbn }, limit: 1) {
    id
    title
    subtitle
    description
    pages
    release_year
    language
    isbn_10
    isbn_13
    image
    authors {
      name
    }
    contributions {
      author {
        name
      }
    }
  }
}
`;

/**
 * Create a Hardcover metadata provider.
 *
 * @param config - Configuration with API key (required)
 * @returns BookMetadataService implementation
 *
 * @example
 * const hardcover = createHardcoverProvider({
 *   apiKey: process.env.HARDCOVER_API_KEY!
 * });
 * const book = await hardcover.lookup('9780134685991');
 */
export function createHardcoverProvider(
  config: HardcoverConfig
): BookMetadataService {
  const timeout = config.timeout ?? DEFAULT_TIMEOUT;

  return {
    provider: "hardcover",

    async lookup(isbn: string): Promise<BookMetadata | null> {
      const normalizedISBN = normalizeISBN(isbn);

      const { signal, clear } = createAbortController(timeout);

      try {
        const response = await fetch(BASE_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            query: BOOK_QUERY,
            variables: { isbn: normalizedISBN },
          }),
          signal,
        });

        clear();

        if (!response.ok) {
          throw new ServiceUnavailableError(
            "hardcover",
            new Error(`HTTP ${response.status}`)
          );
        }

        const data: HardcoverResponse = await response.json();

        // Check for GraphQL errors
        if (data.errors && data.errors.length > 0) {
          throw new ServiceUnavailableError(
            "hardcover",
            new Error(`GraphQL error: ${data.errors[0].message}`)
          );
        }

        if (!data.data?.books || data.data.books.length === 0) {
          return null;
        }

        const book = data.data.books[0];
        return mapHardcoverToMetadata(normalizedISBN, book);
      } catch (error) {
        clear();

        if (error instanceof Error && error.name === "AbortError") {
          throw new TimeoutError("hardcover", timeout);
        }
        if (
          error instanceof ServiceUnavailableError ||
          error instanceof TimeoutError
        ) {
          throw error;
        }
        throw new ServiceUnavailableError("hardcover", error as Error);
      }
    },
  };
}

// =============================================================================
// Response Mapping
// =============================================================================

function mapHardcoverToMetadata(
  isbn: string,
  book: HardcoverBook
): BookMetadata {
  // Combine authors from both sources and deduplicate
  const authorNames = new Set<string>();

  // Add from authors array
  if (book.authors) {
    book.authors.forEach((author) => {
      if (author.name) {
        authorNames.add(author.name);
      }
    });
  }

  // Add from contributions array
  if (book.contributions) {
    book.contributions.forEach((contribution) => {
      if (contribution.author?.name) {
        authorNames.add(contribution.author.name);
      }
    });
  }

  return {
    isbn,
    isbn10: book.isbn_10,
    isbn13: book.isbn_13,
    title: book.title,
    subtitle: book.subtitle,
    authors: Array.from(authorNames),
    description: book.description,
    pageCount: book.pages,
    language: book.language,
    publishedDate: book.release_year?.toString(),
    thumbnailUrl: book.image,
    source: "hardcover",
  };
}
