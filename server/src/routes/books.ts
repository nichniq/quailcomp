/**
 * Book routes
 *
 * GET /books - List all books
 * GET /books/:id - Get single book by entity_id
 * POST /books - Create new book
 * PUT /books/:id - Update existing book
 * DELETE /books/:id - Soft delete book
 * POST /books/metadata/lookup - Look up book metadata by ISBN/LCCN
 */

import type { Sql } from "@quailcomp/data";
import { createEntitiesClient } from "@quailcomp/data";

import type { BookEntitySnapshot } from "@domains/types/books";
import {
  createGoogleBooksProvider,
  createOpenLibraryProvider,
  createLibraryOfCongressProvider,
  normalizeISBN,
  type BookMetadata,
} from "@quailcomp/book-metadata";

import type { Router } from "@/router";
import { requireAuth } from "@/auth/middleware";

const BOOK_TYPE = "book";

/**
 * Register book routes
 */
export function registerBookRoutes(router: Router, sql: Sql): void {
  const entities = createEntitiesClient(sql);

  // GET /books - List all books
  router.get(
    "/books",
    async (ctx) => {
      const books = await entities.getByType<BookEntitySnapshot>(BOOK_TYPE);
      ctx.log.info("Books retrieved", { count: books.length });
      return Response.json({ books });
    },
    [requireAuth]
  );

  // GET /books/:id - Get single book
  router.get(
    "/books/:id",
    async (ctx) => {
      const entityId = parseInt(ctx.params.id, 10);

      if (isNaN(entityId)) {
        return Response.json(
          { error: "Invalid book ID", code: "INVALID_ID" },
          { status: 400 }
        );
      }

      const book = await entities.getById<BookEntitySnapshot>(entityId);

      if (!book) {
        return Response.json(
          { error: "Book not found", code: "NOT_FOUND" },
          { status: 404 }
        );
      }

      ctx.log.info("Book retrieved", { entityId });
      return Response.json({ book });
    },
    [requireAuth]
  );

  // POST /books - Create new book
  router.post(
    "/books",
    async (ctx, req) => {
      let body: BookEntitySnapshot;

      try {
        body = (await req.json()) as BookEntitySnapshot;
      } catch {
        return Response.json(
          { error: "Invalid JSON body", code: "INVALID_BODY" },
          { status: 400 }
        );
      }

      const entry = await entities.create<BookEntitySnapshot>({
        type: BOOK_TYPE,
        data: body,
      });

      ctx.log.info("Book created", { entityId: entry.entityId });
      return Response.json({ book: entry }, { status: 201 });
    },
    [requireAuth]
  );

  // PUT /books/:id - Update book
  router.put(
    "/books/:id",
    async (ctx, req) => {
      const entityId = parseInt(ctx.params.id, 10);

      if (isNaN(entityId)) {
        return Response.json(
          { error: "Invalid book ID", code: "INVALID_ID" },
          { status: 400 }
        );
      }

      // Check if book exists
      const existing = await entities.getById<BookEntitySnapshot>(entityId);
      if (!existing) {
        return Response.json(
          { error: "Book not found", code: "NOT_FOUND" },
          { status: 404 }
        );
      }

      let body: BookEntitySnapshot;

      try {
        body = (await req.json()) as BookEntitySnapshot;
      } catch {
        return Response.json(
          { error: "Invalid JSON body", code: "INVALID_BODY" },
          { status: 400 }
        );
      }

      const entry = await entities.update<BookEntitySnapshot>({
        entityId,
        type: BOOK_TYPE,
        data: body,
      });

      ctx.log.info("Book updated", { entityId });
      return Response.json({ book: entry });
    },
    [requireAuth]
  );

  // DELETE /books/:id - Soft delete book
  router.delete(
    "/books/:id",
    async (ctx) => {
      const entityId = parseInt(ctx.params.id, 10);

      if (isNaN(entityId)) {
        return Response.json(
          { error: "Invalid book ID", code: "INVALID_ID" },
          { status: 400 }
        );
      }

      const existing = await entities.getById<BookEntitySnapshot>(entityId);

      if (!existing) {
        return Response.json(
          { error: "Book not found", code: "NOT_FOUND" },
          { status: 404 }
        );
      }

      await entities.delete({
        entityId,
        type: BOOK_TYPE,
        data: existing.data,
      });

      ctx.log.info("Book deleted", { entityId });
      return Response.json({ success: true });
    },
    [requireAuth]
  );

  // POST /books/metadata/lookup - Look up book metadata
  router.post(
    "/books/metadata/lookup",
    async (ctx, req) => {
      interface LookupRequest {
        identifier: string;
        identifierType: "isbn" | "lccn";
      }

      interface ProviderResult {
        provider: string;
        data: BookMetadata | null;
        error: string | null;
        responseTime: number;
      }

      let body: LookupRequest;

      try {
        body = (await req.json()) as LookupRequest;
      } catch {
        return Response.json(
          { error: "Invalid JSON body", code: "INVALID_BODY" },
          { status: 400 }
        );
      }

      const { identifier, identifierType } = body;

      if (!identifier || !identifierType) {
        return Response.json(
          {
            error: "Missing required fields: identifier, identifierType",
            code: "MISSING_FIELDS",
          },
          { status: 400 }
        );
      }

      // For ISBN, validate format
      if (identifierType === "isbn") {
        try {
          normalizeISBN(identifier);
        } catch {
          return Response.json(
            {
              error: "Invalid ISBN format",
              code: "INVALID_ISBN",
            },
            { status: 400 }
          );
        }
      }

      // Create all three providers
      const googleBooks = createGoogleBooksProvider({
        apiKey: process.env.GOOGLE_BOOKS_API_KEY,
        timeout: 5000,
      });

      const openLibrary = createOpenLibraryProvider({
        timeout: 5000,
      });

      const libraryOfCongress = createLibraryOfCongressProvider({
        timeout: 5000,
      });

      const providers = [googleBooks, openLibrary, libraryOfCongress];

      // Call all providers in parallel
      const providerPromises = providers.map(async (provider) => {
        const startTime = Date.now();
        const result: ProviderResult = {
          provider: provider.provider,
          data: null,
          error: null,
          responseTime: 0,
        };

        try {
          // Only ISBN is supported by all providers currently
          if (identifierType === "isbn") {
            result.data = await provider.lookup(identifier);
          } else {
            result.error = "LCCN lookup not yet implemented for this provider";
          }
        } catch (err) {
          result.error =
            err instanceof Error ? err.message : "Unknown error occurred";
        } finally {
          result.responseTime = Date.now() - startTime;
        }

        return result;
      });

      const results = await Promise.all(providerPromises);

      ctx.log.info("Metadata lookup completed", {
        identifier,
        identifierType,
        results: results.map((r) => ({
          provider: r.provider,
          found: r.data !== null,
          error: r.error !== null,
          responseTime: r.responseTime,
        })),
      });

      return Response.json({ results });
    },
    [requireAuth]
  );
}
