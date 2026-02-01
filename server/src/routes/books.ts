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
import { analytics } from "@/analytics/service";
import {
  createGoogleBooksProvider,
  createOpenLibraryProvider,
  createLibraryOfCongressProvider,
  createHardcoverProvider,
  createWorldCatClassifyProvider,
  normalizeISBN,
  type BookMetadata,
} from "@quailcomp/book-metadata";

import type { Router } from "@/router";
import { requireAuth } from "@/auth/middleware";
import { requireRead, requireWrite, requireOwner } from "@/authz/middleware";
import { AuthorizationService } from "@/authz/service";

const BOOK_TYPE = "book";

/**
 * Helper to extract entity ID from route params
 */
const getEntityIdFromParams = (ctx: { params: { id: string } }) =>
  parseInt(ctx.params.id, 10);

/**
 * Register book routes
 */
export function registerBookRoutes(router: Router, sql: Sql): void {
  const entities = createEntitiesClient(sql);
  const authzService = new AuthorizationService(sql);

  // GET /books - List books the user has access to
  router.get(
    "/books",
    async (ctx) => {
      if (!ctx.user) {
        return Response.json(
          { error: "Authentication required" },
          { status: 401 }
        );
      }

      // Get all entity IDs the user has access to
      const accessibleEntities = await authzService.listAccessibleEntities(
        ctx.user.userId
      );
      const accessibleIds = new Set(accessibleEntities.map((e) => e.entityId));

      // Get all books and filter by access
      const allBooks = await entities.getByType<BookEntitySnapshot>(BOOK_TYPE);
      const books = allBooks.filter((book) => accessibleIds.has(book.entityId));

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
    [requireAuth, requireRead(getEntityIdFromParams)]
  );

  // POST /books - Create new book
  router.post(
    "/books",
    async (ctx, req) => {
      if (!ctx.user) {
        return Response.json(
          { error: "Authentication required" },
          { status: 401 }
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

      const entry = await entities.create<BookEntitySnapshot>({
        type: BOOK_TYPE,
        data: body,
      });

      // Grant owner access to the creator
      await authzService.grantOwnerOnCreate(entry.entityId, ctx.user.userId);

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

      let body: Partial<BookEntitySnapshot>;

      try {
        body = (await req.json()) as Partial<BookEntitySnapshot>;
      } catch {
        return Response.json(
          { error: "Invalid JSON body", code: "INVALID_BODY" },
          { status: 400 }
        );
      }

      // Merge partial update with existing data
      const updatedData: BookEntitySnapshot = {
        ...existing.data,
        ...body,
      };

      const entry = await entities.update<BookEntitySnapshot>({
        entityId,
        type: BOOK_TYPE,
        data: updatedData,
      });

      ctx.log.info("Book updated", { entityId });
      return Response.json({ book: entry });
    },
    [requireAuth, requireWrite(getEntityIdFromParams)]
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

      const deleted = await entities.delete({
        entityId,
        type: BOOK_TYPE,
        data: existing.data,
      });

      ctx.log.info("Book deleted", { entityId });
      return Response.json({ book: deleted });
    },
    [requireAuth, requireOwner(getEntityIdFromParams)]
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

      // Create all providers
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

      // Add Hardcover if API key is available
      if (process.env.HARDCOVER_API_KEY) {
        const hardcover = createHardcoverProvider({
          apiKey: process.env.HARDCOVER_API_KEY,
          timeout: 5000,
        });
        providers.push(hardcover);
      }

      // Add WorldCat Classify
      const worldcat = createWorldCatClassifyProvider({
        timeout: 5000,
      });
      providers.push(worldcat);

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

      // Record metadata lookup analytics
      await analytics.recordMetadataLookup({
        request_id: ctx.requestId,
        identifier,
        identifier_type: identifierType,
        providers: results.map((r) => ({
          name: r.provider,
          success: r.data !== null,
          duration_ms: r.responseTime,
          error_message: r.error ?? undefined,
        })),
        results_count: results.filter((r) => r.data !== null).length,
        user_id: ctx.user?.userId ?? null,
      });

      return Response.json({ results });
    },
    [requireAuth]
  );
}
