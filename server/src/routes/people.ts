/**
 * People routes
 *
 * GET /people - List all people
 * GET /people/:id - Get single person by entity_id
 * POST /people - Create new person
 * PUT /people/:id - Update existing person
 * DELETE /people/:id - Soft delete person
 * GET /people/:id/books - List books associated with this person
 */

import type { Sql } from "@quailcomp/data";
import { createEntitiesClient } from "@quailcomp/data";

import type { PersonEntitySnapshot } from "@domains/types/people";
import type { BookEntitySnapshot } from "@domains/types/books";

import type { Router } from "@/router";
import { requireAuth } from "@/auth/middleware";
import { requireRead, requireWrite, requireOwner } from "@/authz/middleware";
import { AuthorizationService } from "@/authz/service";
import {
  badRequest,
  notFound,
  unauthorized,
  getValidEntityId,
  parseJsonBody,
} from "@/utils/error-responses";
import { validate } from "@/utils/validation";

const PERSON_TYPE = "person";
const BOOK_TYPE = "book";

/**
 * Helper to extract entity ID from route params
 */
const getEntityIdFromParams = (ctx: { params: { id: string } }) =>
  parseInt(ctx.params.id, 10);

/**
 * Register people routes
 */
export function registerPeopleRoutes(router: Router, sql: Sql): void {
  const entities = createEntitiesClient(sql);
  const authzService = new AuthorizationService(sql);

  // GET /people - List people the user has access to
  router.get(
    "/people",
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

      // Get all people and filter by access
      const allPeople = await entities.getByType<PersonEntitySnapshot>(PERSON_TYPE);
      const people = allPeople.filter((person) => accessibleIds.has(person.entityId));

      ctx.log.info("People retrieved", { count: people.length });
      return Response.json({ people });
    },
    [requireAuth]
  );

  // GET /people/:id - Get single person
  router.get(
    "/people/:id",
    async (ctx) => {
      const entityId = getValidEntityId(ctx.params, "person");
      const person = await entities.getById<PersonEntitySnapshot>(entityId);

      if (!person) {
        notFound("Person not found", "NOT_FOUND");
      }

      ctx.log.info("Person retrieved", { entityId });
      return Response.json({ person });
    },
    [requireAuth, requireRead(getEntityIdFromParams)]
  );

  // POST /people - Create new person
  router.post(
    "/people",
    async (ctx, req) => {
      if (!ctx.user) {
        unauthorized();
      }

      const body = await parseJsonBody<PersonEntitySnapshot>(req);

      // Validate required fields
      validate()
        .required("name", body.name)
        .minLength("name", body.name, 1)
        .arrayNotEmpty("relationships", body.relationships)
        .validate("Invalid person data");

      const entry = await entities.create<PersonEntitySnapshot>({
        type: PERSON_TYPE,
        data: body,
      });

      // Grant owner access to the creator
      await authzService.grantOwnerOnCreate(entry.entityId, ctx.user.userId);

      ctx.log.info("Person created", { entityId: entry.entityId });
      return Response.json({ person: entry }, { status: 201 });
    },
    [requireAuth]
  );

  // PUT /people/:id - Update person
  router.put(
    "/people/:id",
    async (ctx, req) => {
      const entityId = parseInt(ctx.params.id, 10);

      if (isNaN(entityId)) {
        return Response.json(
          { error: "Invalid person ID", code: "INVALID_ID" },
          { status: 400 }
        );
      }

      // Check if person exists
      const existing = await entities.getById<PersonEntitySnapshot>(entityId);
      if (!existing) {
        return Response.json(
          { error: "Person not found", code: "NOT_FOUND" },
          { status: 404 }
        );
      }

      let body: Partial<PersonEntitySnapshot>;

      try {
        body = (await req.json()) as Partial<PersonEntitySnapshot>;
      } catch {
        return Response.json(
          { error: "Invalid JSON body", code: "INVALID_BODY" },
          { status: 400 }
        );
      }

      // Merge partial update with existing data
      const updatedData: PersonEntitySnapshot = {
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

      if (!updatedData.relationships || updatedData.relationships.length === 0) {
        return Response.json(
          { error: "At least one relationship is required", code: "INVALID_RELATIONSHIPS" },
          { status: 400 }
        );
      }

      const entry = await entities.update<PersonEntitySnapshot>({
        entityId,
        type: PERSON_TYPE,
        data: updatedData,
      });

      ctx.log.info("Person updated", { entityId });
      return Response.json({ person: entry });
    },
    [requireAuth, requireWrite(getEntityIdFromParams)]
  );

  // DELETE /people/:id - Soft delete person
  router.delete(
    "/people/:id",
    async (ctx) => {
      const entityId = parseInt(ctx.params.id, 10);

      if (isNaN(entityId)) {
        return Response.json(
          { error: "Invalid person ID", code: "INVALID_ID" },
          { status: 400 }
        );
      }

      const existing = await entities.getById<PersonEntitySnapshot>(entityId);

      if (!existing) {
        return Response.json(
          { error: "Person not found", code: "NOT_FOUND" },
          { status: 404 }
        );
      }

      const deleted = await entities.delete({
        entityId,
        type: PERSON_TYPE,
        data: existing.data,
      });

      ctx.log.info("Person deleted", { entityId });
      return Response.json({ person: deleted });
    },
    [requireAuth, requireOwner(getEntityIdFromParams)]
  );

  // GET /people/:id/books - List books associated with this person
  router.get(
    "/people/:id/books",
    async (ctx) => {
      const personId = parseInt(ctx.params.id, 10);

      if (isNaN(personId)) {
        return Response.json(
          { error: "Invalid person ID", code: "INVALID_ID" },
          { status: 400 }
        );
      }

      // Verify person exists
      const person = await entities.getById<PersonEntitySnapshot>(personId);
      if (!person) {
        return Response.json(
          { error: "Person not found", code: "NOT_FOUND" },
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

      // Filter books that reference this person (in acquisition events, lent events, etc.)
      const relatedBooks = allBooks.filter((book) => {
        // Check if user has access to this book
        if (!accessibleIds.has(book.entityId)) {
          return false;
        }

        // Check if book references this person in any way
        const bookData = book.data as any;

        // Check acquisition.person_id (for books given by this person)
        if (bookData.acquisition?.person_id === personId) {
          return true;
        }

        // Check lent.person_id (for books lent to this person)
        if (bookData.lent?.person_id === personId) {
          return true;
        }

        return false;
      });

      ctx.log.info("Person books retrieved", {
        personId,
        count: relatedBooks.length
      });
      return Response.json({ books: relatedBooks });
    },
    [requireAuth, requireRead(getEntityIdFromParams)]
  );
}
