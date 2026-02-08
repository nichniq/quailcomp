/**
 * Series routes
 *
 * GET /series - List all series
 * GET /series/:id - Get single series by entity_id
 * POST /series - Create new series
 * PUT /series/:id - Update existing series
 * DELETE /series/:id - Soft delete series
 * GET /series/:id/books - List books in this series
 */

import type { Sql } from "@quailcomp/data";
import { createEntitiesClient } from "@quailcomp/data";

import type { SeriesEntitySnapshot } from "@domains/types/series";
import type { BookEntitySnapshot } from "@domains/types/books";

import type { Router } from "@/router";
import type { RequestContext } from "@/context";
import { requireAuth } from "@/auth/middleware";
import { requireRead, requireWrite, requireOwner } from "@/authz/middleware";
import { AuthorizationService } from "@/authz/service";
import {
  notFound,
  unauthorized,
  getValidEntityId,
  parseJsonBody,
} from "@/utils/error-responses";

const SERIES_TYPE = "series";
const BOOK_TYPE = "book";

/**
 * Helper to extract entity ID from route params
 */
const getEntityIdFromParams = (ctx: RequestContext) =>
  parseInt(ctx.params.id, 10);

/**
 * Register series routes
 */
export function registerSeriesRoutes(router: Router, sql: Sql): void {
  const entities = createEntitiesClient(sql);
  const authzService = new AuthorizationService(sql);

  // GET /series - List series the user has access to
  router.get(
    "/series",
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

      // Get all series and filter by access
      const allSeries = await entities.getByType<SeriesEntitySnapshot>(SERIES_TYPE);
      const series = allSeries.filter((s) => accessibleIds.has(s.entityId));

      ctx.log.info("Series retrieved", { count: series.length });
      return Response.json({ series });
    },
    [requireAuth]
  );

  // GET /series/:id - Get single series
  router.get(
    "/series/:id",
    async (ctx) => {
      const entityId = getValidEntityId(ctx.params, "series");
      const series = await entities.getById<SeriesEntitySnapshot>(entityId);

      if (!series) {
        notFound("Series not found", "NOT_FOUND");
      }

      ctx.log.info("Series retrieved", { entityId });
      return Response.json({ series });
    },
    [requireAuth, requireRead(getEntityIdFromParams)]
  );

  // POST /series - Create new series
  router.post(
    "/series",
    async (ctx, req) => {
      if (!ctx.user) {
        return Response.json(
          { error: "Authentication required" },
          { status: 401 }
        );
      }

      let body: SeriesEntitySnapshot;

      try {
        body = (await req.json()) as SeriesEntitySnapshot;
      } catch {
        return Response.json(
          { error: "Invalid JSON body", code: "INVALID_BODY" },
          { status: 400 }
        );
      }

      // Validate required fields
      if (!body.name || body.name.trim().length === 0) {
        return Response.json(
          { error: "Name is required", code: "MISSING_NAME" },
          { status: 400 }
        );
      }

      // Validate total_volumes if provided
      if (body.total_volumes !== undefined && body.total_volumes !== null) {
        if (!Number.isInteger(body.total_volumes) || body.total_volumes < 1) {
          return Response.json(
            { error: "Total volumes must be a positive integer", code: "INVALID_TOTAL_VOLUMES" },
            { status: 400 }
          );
        }
      }

      const entry = await entities.create<SeriesEntitySnapshot>({
        type: SERIES_TYPE,
        data: body,
      });

      // Grant owner access to the creator
      await authzService.grantOwnerOnCreate(entry.entityId, ctx.user.userId);

      ctx.log.info("Series created", { entityId: entry.entityId });
      return Response.json({ series: entry }, { status: 201 });
    },
    [requireAuth]
  );

  // PUT /series/:id - Update series
  router.put(
    "/series/:id",
    async (ctx, req) => {
      const entityId = parseInt(ctx.params.id, 10);

      if (isNaN(entityId)) {
        return Response.json(
          { error: "Invalid series ID", code: "INVALID_ID" },
          { status: 400 }
        );
      }

      // Check if series exists
      const existing = await entities.getById<SeriesEntitySnapshot>(entityId);
      if (!existing) {
        return Response.json(
          { error: "Series not found", code: "NOT_FOUND" },
          { status: 404 }
        );
      }

      let body: Partial<SeriesEntitySnapshot>;

      try {
        body = (await req.json()) as Partial<SeriesEntitySnapshot>;
      } catch {
        return Response.json(
          { error: "Invalid JSON body", code: "INVALID_BODY" },
          { status: 400 }
        );
      }

      // Merge partial update with existing data
      const updatedData: SeriesEntitySnapshot = {
        ...existing.data,
        ...body,
      };

      // Validate required fields after merge
      if (!updatedData.name || updatedData.name.trim().length === 0) {
        return Response.json(
          { error: "Name cannot be empty", code: "INVALID_NAME" },
          { status: 400 }
        );
      }

      // Validate total_volumes if provided
      if (updatedData.total_volumes !== undefined && updatedData.total_volumes !== null) {
        if (!Number.isInteger(updatedData.total_volumes) || updatedData.total_volumes < 1) {
          return Response.json(
            { error: "Total volumes must be a positive integer", code: "INVALID_TOTAL_VOLUMES" },
            { status: 400 }
          );
        }
      }

      const entry = await entities.update<SeriesEntitySnapshot>({
        entityId,
        type: SERIES_TYPE,
        data: updatedData,
      });

      ctx.log.info("Series updated", { entityId });
      return Response.json({ series: entry });
    },
    [requireAuth, requireWrite(getEntityIdFromParams)]
  );

  // DELETE /series/:id - Soft delete series
  router.delete(
    "/series/:id",
    async (ctx) => {
      const entityId = parseInt(ctx.params.id, 10);

      if (isNaN(entityId)) {
        return Response.json(
          { error: "Invalid series ID", code: "INVALID_ID" },
          { status: 400 }
        );
      }

      const existing = await entities.getById<SeriesEntitySnapshot>(entityId);

      if (!existing) {
        return Response.json(
          { error: "Series not found", code: "NOT_FOUND" },
          { status: 404 }
        );
      }

      const deleted = await entities.delete({
        entityId,
        type: SERIES_TYPE,
        data: existing.data,
      });

      ctx.log.info("Series deleted", { entityId });
      return Response.json({ series: deleted });
    },
    [requireAuth, requireOwner(getEntityIdFromParams)]
  );

  // GET /series/:id/books - List books in this series (ordered by volume number)
  router.get(
    "/series/:id/books",
    async (ctx) => {
      const seriesId = parseInt(ctx.params.id, 10);

      if (isNaN(seriesId)) {
        return Response.json(
          { error: "Invalid series ID", code: "INVALID_ID" },
          { status: 400 }
        );
      }

      // Verify series exists
      const series = await entities.getById<SeriesEntitySnapshot>(seriesId);
      if (!series) {
        return Response.json(
          { error: "Series not found", code: "NOT_FOUND" },
          { status: 404 }
        );
      }

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

      // Get all books
      const allBooks = await entities.getByType<BookEntitySnapshot>(BOOK_TYPE);

      // Filter books that belong to this series
      const seriesBooks = allBooks
        .filter((book) => {
          // Check if user has access to this book
          if (!accessibleIds.has(book.entityId)) {
            return false;
          }

          // Check if book belongs to this series
          // Handle both string and number series_id
          const bookData = book.data as any;
          const bookSeriesId = bookData.series_id;
          return bookSeriesId === seriesId || bookSeriesId === seriesId.toString();
        })
        .map((book) => {
          // Extract volume information
          const bookData = book.data as any;
          return {
            ...book,
            volume_number: bookData.volume_number,
            volume_name: bookData.volume_name,
          };
        })
        // Sort by volume number (undefined values go to the end)
        .sort((a, b) => {
          if (a.volume_number === undefined && b.volume_number === undefined) return 0;
          if (a.volume_number === undefined) return 1;
          if (b.volume_number === undefined) return -1;
          return a.volume_number - b.volume_number;
        });

      ctx.log.info("Series books retrieved", {
        seriesId,
        count: seriesBooks.length
      });
      return Response.json({ books: seriesBooks });
    },
    [requireAuth, requireRead(getEntityIdFromParams)]
  );
}
