/**
 * Book routes
 *
 * GET /books - List all books
 * GET /books/:id - Get single book by entity_id
 * POST /books - Create new book
 * PUT /books/:id - Update existing book
 * DELETE /books/:id - Soft delete book
 * POST /books/metadata/lookup - Look up book metadata by ISBN/LCCN
 * POST /books/import - Bulk import books from CSV/JSON/XLSX
 * GET /books/export - Export books to CSV/JSON/XLSX
 * PUT /books/batch - Batch update multiple books
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
import type { RequestContext } from "@/context";
import { requireAuth } from "@/auth/middleware";
import { requireRead, requireWrite, requireOwner } from "@/authz/middleware";
import { AuthorizationService } from "@/authz/service";
import { parseCSV, parseJSON, parseXLSX } from "@/utils/import-parsers";
import { exportCSV, exportJSON, exportXLSX } from "@/utils/export-formatters";
import { broadcastUpdate } from "@/websocket/server";
import {
  badRequest,
  notFound,
  unauthorized,
  getValidEntityId,
  parseJsonBody,
} from "@/utils/error-responses";

const BOOK_TYPE = "book";

/**
 * Helper to extract entity ID from route params
 */
const getEntityIdFromParams = (ctx: RequestContext) =>
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

  // GET /books/export - Export books (must be before /books/:id to avoid matching "export" as an ID)
  router.get(
    "/books/export",
    async (ctx, req) => {
      if (!ctx.user) {
        return Response.json(
          { error: "Authentication required" },
          { status: 401 }
        );
      }

      const url = new URL(req.url);
      const format = (url.searchParams.get("format") ?? "json").toLowerCase();

      if (!["csv", "json", "xlsx"].includes(format)) {
        return Response.json(
          {
            error: "Invalid format. Must be: csv, json, or xlsx",
            code: "INVALID_FORMAT",
          },
          { status: 400 }
        );
      }

      // Get all books
      const allBooks = await entities.getByType<BookEntitySnapshot>(BOOK_TYPE);

      // Filter by authorization
      const accessibleEntities = await authzService.listAccessibleEntities(
        ctx.user.userId
      );
      const accessibleIds = new Set(accessibleEntities.map((e) => e.entityId));

      const accessibleBooks = allBooks.filter((book) =>
        accessibleIds.has(book.entityId)
      );

      let content: string | Blob | Uint8Array;
      let contentType: string;
      let filename: string;

      try {
        if (format === "csv") {
          content = exportCSV(accessibleBooks);
          contentType = "text/csv";
          filename = `books-${Date.now()}.csv`;
        } else if (format === "json") {
          content = exportJSON(accessibleBooks);
          contentType = "application/json";
          filename = `books-${Date.now()}.json`;
        } else {
          // xlsx - convert Buffer to Uint8Array for Response
          const buffer = await exportXLSX(accessibleBooks);
          content = new Uint8Array(buffer);
          contentType =
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
          filename = `books-${Date.now()}.xlsx`;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Export error";
        ctx.log.error("Failed to export books", { error: message });
        return Response.json(
          { error: `Failed to export: ${message}`, code: "EXPORT_ERROR" },
          { status: 500 }
        );
      }

      ctx.log.info("Books exported", {
        format,
        count: accessibleBooks.length,
      });

      return new Response(content, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    },
    [requireAuth]
  );

  // GET /books/:id - Get single book
  router.get(
    "/books/:id",
    async (ctx) => {
      const entityId = getValidEntityId(ctx.params, "book");
      const book = await entities.getById<BookEntitySnapshot>(entityId);

      if (!book) {
        notFound("Book not found", "NOT_FOUND");
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
        unauthorized();
      }

      const body = await parseJsonBody<BookEntitySnapshot>(req);

      const entry = await entities.create<BookEntitySnapshot>({
        type: BOOK_TYPE,
        data: body,
      });

      // Grant owner access to the creator
      await authzService.grantOwnerOnCreate(entry.entityId, ctx.user.userId);

      // Broadcast creation to subscribers
      broadcastUpdate({
        type: "entity.created",
        entityId: entry.entityId,
        entityType: BOOK_TYPE,
        data: entry,
        timestamp: new Date().toISOString(),
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

      // Broadcast update to subscribers
      broadcastUpdate({
        type: "entity.updated",
        entityId: entry.entityId,
        entityType: BOOK_TYPE,
        data: entry,
        timestamp: new Date().toISOString(),
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

      // Broadcast deletion to subscribers
      broadcastUpdate({
        type: "entity.deleted",
        entityId: deleted.entityId,
        entityType: BOOK_TYPE,
        timestamp: new Date().toISOString(),
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

  // POST /books/import - Bulk import books
  router.post(
    "/books/import",
    async (ctx, req) => {
      if (!ctx.user) {
        return Response.json(
          { error: "Authentication required" },
          { status: 401 }
        );
      }

      let formData: Awaited<ReturnType<Request["formData"]>>;

      try {
        formData = await req.formData();
      } catch {
        return Response.json(
          { error: "Invalid form data", code: "INVALID_FORM_DATA" },
          { status: 400 }
        );
      }

      const file = formData.get("file");
      const format = (formData.get("format") as string)?.toLowerCase();

      if (!file || !(file instanceof File)) {
        return Response.json(
          { error: "Missing file", code: "MISSING_FILE" },
          { status: 400 }
        );
      }

      if (!format || !["csv", "json", "xlsx"].includes(format)) {
        return Response.json(
          {
            error: "Invalid or missing format. Must be: csv, json, or xlsx",
            code: "INVALID_FORMAT",
          },
          { status: 400 }
        );
      }

      let books: BookEntitySnapshot[];

      try {
        if (format === "csv") {
          const content = await file.text();
          books = parseCSV(content);
        } else if (format === "json") {
          const content = await file.text();
          books = parseJSON(content);
        } else if (format === "xlsx") {
          const buffer = await file.arrayBuffer();
          books = await parseXLSX(buffer);
        } else {
          return Response.json(
            { error: "Unsupported format", code: "UNSUPPORTED_FORMAT" },
            { status: 400 }
          );
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Parse error";
        ctx.log.error("Failed to parse import file", { error: message });
        return Response.json(
          { error: `Failed to parse file: ${message}`, code: "PARSE_ERROR" },
          { status: 400 }
        );
      }

      if (books.length === 0) {
        return Response.json(
          { error: "No books found in file", code: "EMPTY_FILE" },
          { status: 400 }
        );
      }

      // Import books (create entities and grant access)
      const imported: Array<{
        entityId: number;
        data: BookEntitySnapshot;
      }> = [];
      const errors: Array<{ index: number; error: string }> = [];

      for (let i = 0; i < books.length; i++) {
        try {
          const entry = await entities.create<BookEntitySnapshot>({
            type: BOOK_TYPE,
            data: books[i],
          });

          // Grant owner access to the creator
          await authzService.grantOwnerOnCreate(
            entry.entityId,
            ctx.user.userId
          );

          imported.push(entry);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          errors.push({ index: i, error: message });
        }
      }

      ctx.log.info("Bulk import completed", {
        total: books.length,
        imported: imported.length,
        failed: errors.length,
      });

      return Response.json(
        {
          imported,
          count: imported.length,
          total: books.length,
          errors: errors.length > 0 ? errors : undefined,
        },
        { status: 201 }
      );
    },
    [requireAuth]
  );

  // PUT /books/batch - Batch update books
  router.put(
    "/books/batch",
    async (ctx, req) => {
      if (!ctx.user) {
        return Response.json(
          { error: "Authentication required" },
          { status: 401 }
        );
      }

      interface BatchUpdate {
        entity_id: number;
        data: Partial<BookEntitySnapshot>;
      }

      interface BatchRequest {
        updates: BatchUpdate[];
      }

      let body: BatchRequest;

      try {
        body = (await req.json()) as BatchRequest;
      } catch {
        return Response.json(
          { error: "Invalid JSON body", code: "INVALID_BODY" },
          { status: 400 }
        );
      }

      if (!Array.isArray(body.updates)) {
        return Response.json(
          {
            error: "Request body must contain 'updates' array",
            code: "INVALID_BODY",
          },
          { status: 400 }
        );
      }

      if (body.updates.length === 0) {
        return Response.json(
          { error: "No updates provided", code: "EMPTY_UPDATES" },
          { status: 400 }
        );
      }

      interface BatchResult {
        entity_id: number;
        success?: boolean;
        error?: string;
        data?: {
          entityId: number;
          data: BookEntitySnapshot;
        };
      }

      const results: BatchResult[] = [];

      for (const update of body.updates) {
        // Validate entity_id
        if (typeof update.entity_id !== "number" || isNaN(update.entity_id)) {
          results.push({
            entity_id: update.entity_id,
            error: "Invalid entity_id",
          });
          continue;
        }

        // Check write access
        const hasAccess = await authzService.checkAccess(
          ctx.user.userId,
          update.entity_id,
          "write"
        );

        if (!hasAccess) {
          results.push({
            entity_id: update.entity_id,
            error: "Forbidden - no write access",
          });
          continue;
        }

        // Check if book exists
        const existing = await entities.getById<BookEntitySnapshot>(
          update.entity_id
        );

        if (!existing) {
          results.push({
            entity_id: update.entity_id,
            error: "Not found",
          });
          continue;
        }

        // Merge partial update with existing data
        const updatedData: BookEntitySnapshot = {
          ...existing.data,
          ...update.data,
        };

        try {
          const entry = await entities.update<BookEntitySnapshot>({
            entityId: update.entity_id,
            type: BOOK_TYPE,
            data: updatedData,
          });

          results.push({
            entity_id: update.entity_id,
            success: true,
            data: entry,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Update failed";
          results.push({
            entity_id: update.entity_id,
            error: message,
          });
        }
      }

      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.filter((r) => r.error).length;

      ctx.log.info("Batch update completed", {
        total: body.updates.length,
        success: successCount,
        failed: failureCount,
      });

      return Response.json({ results, success: successCount, failed: failureCount });
    },
    [requireAuth]
  );
}
