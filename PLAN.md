# Quailcomp Implementation Plan

**Based on**: [REVIEW.md](REVIEW.md) comprehensive codebase review
**Created**: 2026-01-31
**Status**: Ready for multi-session implementation
**Estimated Total Effort**: 3-4 months (can be done incrementally)

---

## Table of Contents

1. [Phase 1: Critical Security & Code Quality (Week 1)](#phase-1-critical-security--code-quality-week-1)
2. [Phase 2: Infrastructure & Configuration (Week 2-3)](#phase-2-infrastructure--configuration-week-2-3)
3. [Phase 3: Testing & Quality Assurance (Week 4-6)](#phase-3-testing--quality-assurance-week-4-6)
4. [Phase 4: Production Readiness (Week 7-10)](#phase-4-production-readiness-week-7-10)
5. [Phase 5: Advanced Features (Week 11-16)](#phase-5-advanced-features-week-11-16)
6. [Implementation Details & Code Specifications](#implementation-details--code-specifications)

---

## Overview

This plan implements all recommendations from REVIEW.md in a systematic, tested, and well-documented manner. Each phase builds on the previous, with clear verification steps to ensure quality.

**Key Principles:**
- Run `bun test` after every code modification
- Update READMEs when directory structure changes
- Follow existing patterns and conventions
- Maintain 90% test coverage threshold
- Document all security decisions

---

## Phase 1: Critical Security & Code Quality (Week 1)

**Goal**: Address high-priority security issues and eliminate major code duplication

**Estimated Effort**: 12-17 hours (1.5-2 days)

### 1.1: Refactor Query Duplication in Data Clients 🔴 HIGH

**Files to Modify:**
- `data/client/src/db/entities.ts` (527 lines → ~350 lines)
- `data/client/src/db/events.ts` (725 lines → ~500 lines)
- `data/client/tests/entities.test.ts` (verify refactor doesn't break tests)
- `data/client/tests/events.test.ts` (verify refactor doesn't break tests)

**Current State:**
- 8 methods with if/else pyramids (3 in entities, 5 in events)
- ~655 lines of duplicated query code
- Each method has 6-8 query variants for limit/offset/includeDeleted combinations

**Implementation Steps:**

1. **Create query builder helper in entities.ts** (30 min)
   ```typescript
   // Add after mapRow method, before getHistory

   /**
    * Build dynamic SQL fragments for filtering and pagination.
    * Uses Bun SQL template literals for safe composition.
    */
   private buildQueryFragments(options: QueryOptions) {
     const { includeDeleted = false, limit, offset } = options;

     return {
       whereClause: includeDeleted
         ? this.sql``
         : this.sql`AND deleted_at IS NULL`,
       limitClause: limit
         ? this.sql`LIMIT ${limit}`
         : this.sql``,
       offsetClause: offset
         ? this.sql`OFFSET ${offset}`
         : this.sql``,
     };
   }
   ```

2. **Refactor getHistory method** (15 min)
   ```typescript
   // BEFORE: 73 lines with 8 query variants (lines 189-261)
   // AFTER: ~15 lines with 1 dynamic query

   async getHistory<T>(entityId: number, options: QueryOptions = {}): Promise<Entry<T>[]> {
     const fragments = this.buildQueryFragments(options);

     const rows = await this.sql`
       SELECT * FROM entities
       WHERE entity_id = ${entityId}
       ${fragments.whereClause}
       ORDER BY entered_at ASC
       ${fragments.limitClause}
       ${fragments.offsetClause}
     `;

     return rows.map(row => this.mapRow<T>(row));
   }
   ```

3. **Refactor getByType method** (20 min)
   ```typescript
   // BEFORE: 76 lines with 7 query variants (lines 266-341)
   // AFTER: ~20 lines with 1 dynamic query

   async getByType<T>(type: string, options: QueryOptions = {}): Promise<Entry<T>[]> {
     const fragments = this.buildQueryFragments(options);

     const rows = await this.sql`
       SELECT * FROM (
         SELECT DISTINCT ON (entity_id) *
         FROM entities
         WHERE type = ${type}
         ${fragments.whereClause}
         ORDER BY entity_id, entered_at DESC
       ) latest
       ORDER BY entered_at DESC
       ${fragments.limitClause}
       ${fragments.offsetClause}
     `;

     return rows.map(row => this.mapRow<T>(row));
   }
   ```

4. **Refactor findByData method** (20 min)
   ```typescript
   // BEFORE: 85 lines with 7 query variants (lines 396-480)
   // AFTER: ~25 lines with 1 dynamic query

   async findByData<T>(
     type: string,
     dataQuery: Record<string, any>,
     options: QueryOptions = {}
   ): Promise<Entry<T>[]> {
     const fragments = this.buildQueryFragments(options);

     const rows = await this.sql`
       SELECT * FROM (
         SELECT DISTINCT ON (entity_id) *
         FROM entities
         WHERE type = ${type}
           AND data @> ${JSON.stringify(dataQuery)}
         ${fragments.whereClause}
         ORDER BY entity_id, entered_at DESC
       ) latest
       ORDER BY entered_at DESC
       ${fragments.limitClause}
       ${fragments.offsetClause}
     `;

     return rows.map(row => this.mapRow<T>(row));
   }
   ```

5. **Create query builder helper in events.ts** (30 min)
   ```typescript
   // Add after mapRow method, before getHistory

   /**
    * Build dynamic SQL fragments for filtering and pagination.
    * Uses Bun SQL template literals for safe composition.
    */
   private buildQueryFragments(options: EventQueryOptions) {
     const { includeVoided = false, limit, offset } = options;

     return {
       whereClause: includeVoided
         ? this.sql``
         : this.sql`AND voided_at IS NULL`,
       limitClause: limit
         ? this.sql`LIMIT ${limit}`
         : this.sql``,
       offsetClause: offset
         ? this.sql`OFFSET ${offset}`
         : this.sql``,
     };
   }
   ```

6. **Refactor all 5 methods in events.ts** (60 min)
   - `getHistory` (lines 198-270, 73 lines → ~15 lines)
   - `getByType` (lines 276-357, 82 lines → ~20 lines)
   - `getByTimeRange` (lines 363-445, 83 lines → ~25 lines)
   - `findByData` (lines 499-587, 89 lines → ~25 lines)
   - `findForEntity` (lines 594-677, 84 lines → ~25 lines)

7. **Run tests to verify no regressions** (15 min)
   ```bash
   cd data/client
   bun test
   # All existing tests should pass without modification
   ```

8. **Update data/client/README.md** (10 min)
   - Document the query builder pattern
   - Note the refactoring and reduction in code duplication

**Success Criteria:**
- ✅ All existing tests pass
- ✅ Code reduced by ~500 lines
- ✅ No new query patterns introduced
- ✅ Dynamic SQL composition uses Bun tagged templates (safe from injection)

**Estimated Time**: 3 hours

---

### 1.2: Enable Authorization Checks on Routes 🔴 HIGH

**Files to Modify:**
- `server/src/routes/books.ts` (add middleware, auto-grant owner)
- `server/src/authz/routes.ts` (NEW FILE - access management endpoints)
- `server/tests/authz.test.ts` (add integration tests)
- `server/src/routes/README.md` (document authorization patterns)

**Current State:**
- Authorization middleware FULLY IMPLEMENTED but not used
- All infrastructure exists: `requireRead`, `requireWrite`, `requireOwner`
- Book routes only use `requireAuth` (no entity-level checks)
- No owner grant on entity creation

**Implementation Steps:**

1. **Update book routes to use authorization middleware** (45 min)

   File: `server/src/routes/books.ts`

   ```typescript
   // At top of file, add imports:
   import { requireRead, requireWrite, requireOwner } from '@/authz/middleware';
   import { grantOwnerOnCreate } from '@/authz/service';

   // Helper to extract book ID from context
   const getBookId = (ctx: Context) => {
     const id = ctx.params.id || ctx.params.bookId;
     if (!id) throw new Error('Book ID required');
     return Number(id);
   };

   // Update routes array:
   export const routes: Route[] = [
     {
       method: 'GET',
       path: '/books',
       handler: listBooks,
       middleware: [requireAuth], // No entity ID yet, filter in handler
     },
     {
       method: 'GET',
       path: '/books/:id',
       handler: getBook,
       middleware: [requireAuth, requireRead(getBookId)],
     },
     {
       method: 'POST',
       path: '/books',
       handler: createBook,
       middleware: [requireAuth], // No entity ID yet, grant in handler
     },
     {
       method: 'PUT',
       path: '/books/:id',
       handler: updateBook,
       middleware: [requireAuth, requireWrite(getBookId)],
     },
     {
       method: 'DELETE',
       path: '/books/:id',
       handler: deleteBook,
       middleware: [requireAuth, requireOwner(getBookId)],
     },
     {
       method: 'POST',
       path: '/books/metadata/lookup',
       handler: lookupMetadata,
       middleware: [requireAuth], // Metadata lookup doesn't need entity access
     },
   ];
   ```

2. **Update createBook handler to grant owner access** (15 min)
   ```typescript
   // In createBook handler, after entity creation:

   export async function createBook(ctx: Context): Promise<Response> {
     const body = await ctx.request.json();
     const user = ctx.user!; // requireAuth ensures this exists

     // Validate book data
     // ... existing validation ...

     // Create book entity
     const book = await ctx.db.entities.create({
       type: 'book',
       data: body,
     });

     // 🆕 Grant creator as owner
     await grantOwnerOnCreate(ctx.db, book.entityId, user.userId);

     return Response.json(book, { status: 201 });
   }
   ```

3. **Update listBooks handler to filter by access** (30 min)
   ```typescript
   // In listBooks handler:
   import { listAccessibleEntities } from '@/authz/service';

   export async function listBooks(ctx: Context): Promise<Response> {
     const user = ctx.user!;

     // Get all entities user can access (any level)
     const accessible = await listAccessibleEntities(ctx.db, user.userId, {
       entityType: 'book',
       minAccessLevel: 'read', // read or higher
     });

     // Extract entity IDs
     const bookIds = accessible.map(a => a.entityId);

     if (bookIds.length === 0) {
       return Response.json([]);
     }

     // Fetch book details (latest state only)
     const books = await ctx.db.entities.sql`
       SELECT DISTINCT ON (entity_id) *
       FROM entities
       WHERE entity_id = ANY(${bookIds})
         AND type = 'book'
         AND deleted_at IS NULL
       ORDER BY entity_id, entered_at DESC
     `;

     return Response.json(books);
   }
   ```

4. **Create access management routes** (60 min)

   File: `server/src/authz/routes.ts` (NEW)

   ```typescript
   import { Route } from '@/router';
   import { requireAuth } from '@/auth/middleware';
   import { requireOwner } from '@/authz/middleware';
   import { Context } from '@/types';
   import {
     grantAccess,
     revokeAccess,
     listEntityAccessors,
     transferOwnership
   } from './service';

   const getEntityId = (ctx: Context) => Number(ctx.params.entityId);

   /**
    * Grant access to an entity.
    * Only owners can grant access.
    */
   async function grantAccessHandler(ctx: Context): Promise<Response> {
     const entityId = getEntityId(ctx);
     const user = ctx.user!;
     const { userId, accessLevel } = await ctx.request.json();

     // Validate
     if (!userId || !accessLevel) {
       return Response.json(
         { error: 'userId and accessLevel required' },
         { status: 400 }
       );
     }

     if (!['read', 'write', 'owner'].includes(accessLevel)) {
       return Response.json(
         { error: 'accessLevel must be read, write, or owner' },
         { status: 400 }
       );
     }

     await grantAccess(ctx.db, entityId, userId, accessLevel, user.userId);

     return Response.json({ success: true }, { status: 201 });
   }

   /**
    * Revoke access to an entity.
    * Only owners can revoke access.
    */
   async function revokeAccessHandler(ctx: Context): Promise<Response> {
     const entityId = getEntityId(ctx);
     const user = ctx.user!;
     const targetUserId = Number(ctx.params.userId);

     await revokeAccess(ctx.db, entityId, targetUserId, user.userId);

     return Response.json({ success: true });
   }

   /**
    * List all users with access to an entity.
    * Only accessible to users who already have access.
    */
   async function listAccessorsHandler(ctx: Context): Promise<Response> {
     const entityId = getEntityId(ctx);
     const user = ctx.user!;

     const accessors = await listEntityAccessors(ctx.db, entityId, user.userId);

     return Response.json(accessors);
   }

   /**
    * Transfer ownership to another user.
    * Only current owner can transfer.
    */
   async function transferOwnershipHandler(ctx: Context): Promise<Response> {
     const entityId = getEntityId(ctx);
     const user = ctx.user!;
     const { newOwnerId } = await ctx.request.json();

     if (!newOwnerId) {
       return Response.json(
         { error: 'newOwnerId required' },
         { status: 400 }
       );
     }

     await transferOwnership(ctx.db, entityId, newOwnerId, user.userId);

     return Response.json({ success: true });
   }

   export const routes: Route[] = [
     {
       method: 'POST',
       path: '/entities/:entityId/access',
       handler: grantAccessHandler,
       middleware: [requireAuth, requireOwner(getEntityId)],
     },
     {
       method: 'DELETE',
       path: '/entities/:entityId/access/:userId',
       handler: revokeAccessHandler,
       middleware: [requireAuth, requireOwner(getEntityId)],
     },
     {
       method: 'GET',
       path: '/entities/:entityId/access',
       handler: listAccessorsHandler,
       middleware: [requireAuth, requireRead(getEntityId)],
     },
     {
       method: 'POST',
       path: '/entities/:entityId/transfer',
       handler: transferOwnershipHandler,
       middleware: [requireAuth, requireOwner(getEntityId)],
     },
   ];
   ```

5. **Register authz routes in server** (10 min)

   File: `server/src/server.ts`

   ```typescript
   // Add import:
   import { routes as authzRoutes } from '@/authz/routes';

   // Register routes (add after book routes):
   authzRoutes.forEach(route => router.add(route));
   ```

6. **Add authorization integration tests** (90 min)

   File: `server/tests/authz.test.ts` (ADD TO EXISTING)

   ```typescript
   // Add tests for:
   // 1. User can only see their own books
   // 2. User cannot read book without access
   // 3. User cannot update book without write access
   // 4. User cannot delete book without owner access
   // 5. Owner can grant read access
   // 6. Owner can grant write access
   // 7. Owner can revoke access
   // 8. Owner can transfer ownership
   // 9. Non-owner cannot grant/revoke access
   // 10. Cannot revoke own owner access

   describe('Book Authorization', () => {
     test('user can only see their own books', async () => {
       const { token: user1Token } = await register({
         email: 'user1@test.com',
         password: 'password'
       });

       const { token: user2Token } = await register({
         email: 'user2@test.com',
         password: 'password'
       });

       // User 1 creates a book
       const book1 = await createBook(user1Token, {
         title: 'User 1 Book',
         isbn: '1234567890123'
       });

       // User 2 creates a book
       const book2 = await createBook(user2Token, {
         title: 'User 2 Book',
         isbn: '9876543210987'
       });

       // User 1 lists books - should only see their own
       const user1Books = await listBooks(user1Token);
       expect(user1Books).toHaveLength(1);
       expect(user1Books[0].entityId).toBe(book1.entityId);

       // User 2 lists books - should only see their own
       const user2Books = await listBooks(user2Token);
       expect(user2Books).toHaveLength(1);
       expect(user2Books[0].entityId).toBe(book2.entityId);
     });

     test('user cannot update book without write access', async () => {
       const { token: ownerToken } = await register({
         email: 'owner@test.com',
         password: 'password'
       });

       const { token: otherToken } = await register({
         email: 'other@test.com',
         password: 'password'
       });

       const book = await createBook(ownerToken, {
         title: 'Original',
         isbn: '1234567890123'
       });

       const response = await fetch(`http://localhost:3000/api/books/${book.entityId}`, {
         method: 'PUT',
         headers: {
           'Authorization': `Bearer ${otherToken}`,
           'Content-Type': 'application/json',
         },
         body: JSON.stringify({ title: 'Hacked!' }),
       });

       expect(response.status).toBe(403);

       // Verify book unchanged
       const bookData = await getBook(ownerToken, book.entityId);
       expect(bookData.data.title).toBe('Original');
     });

     test('owner can grant read access', async () => {
       const { token: ownerToken, userId: ownerId } = await register({
         email: 'owner@test.com',
         password: 'password'
       });

       const { token: readerToken, userId: readerId } = await register({
         email: 'reader@test.com',
         password: 'password'
       });

       const book = await createBook(ownerToken, {
         title: 'Shared Book',
         isbn: '1234567890123'
       });

       // Reader cannot see book initially
       let readerBooks = await listBooks(readerToken);
       expect(readerBooks).toHaveLength(0);

       // Owner grants read access
       await grantAccess(ownerToken, book.entityId, {
         userId: readerId,
         accessLevel: 'read',
       });

       // Reader can now see book
       readerBooks = await listBooks(readerToken);
       expect(readerBooks).toHaveLength(1);
       expect(readerBooks[0].entityId).toBe(book.entityId);

       // But reader still cannot update
       const updateResponse = await updateBook(readerToken, book.entityId, {
         title: 'Modified',
       });
       expect(updateResponse.status).toBe(403);
     });

     // ... 7 more tests following this pattern
   });
   ```

7. **Update server/src/routes/README.md** (15 min)
   - Document authorization patterns
   - Show examples of requireRead/requireWrite/requireOwner usage
   - Document access management API endpoints

8. **Run all tests** (5 min)
   ```bash
   cd server
   bun test
   # All tests should pass, including new authz integration tests
   ```

**Success Criteria:**
- ✅ Book routes enforce entity-level authorization
- ✅ Owner automatically granted on book creation
- ✅ Users can only see books they have access to
- ✅ Access management API works (grant/revoke/list/transfer)
- ✅ All integration tests pass
- ✅ 90% coverage maintained

**Estimated Time**: 4-6 hours

---

### 1.3: Add Rate Limiting to Auth Endpoints 🔴 HIGH

**Files to Create:**
- `server/src/middleware/rate-limit.ts` (NEW)
- `server/tests/rate-limit.test.ts` (NEW)

**Files to Modify:**
- `server/src/auth/routes.ts` (add rate limiting middleware)
- `server/src/middleware/README.md` (document rate limiting)

**Implementation Steps:**

1. **Create rate limiting middleware** (60 min)

   File: `server/src/middleware/rate-limit.ts` (NEW)

   ```typescript
   import { Context } from '@/types';

   interface RateLimitRecord {
     count: number;
     resetAt: number;
   }

   /**
    * In-memory rate limit store.
    * In production, use Redis for distributed rate limiting.
    */
   const rateLimitStore = new Map<string, RateLimitRecord>();

   /**
    * Cleanup expired records every 5 minutes.
    */
   setInterval(() => {
     const now = Date.now();
     for (const [key, record] of rateLimitStore.entries()) {
       if (record.resetAt < now) {
         rateLimitStore.delete(key);
       }
     }
   }, 5 * 60 * 1000);

   /**
    * Rate limit middleware factory.
    *
    * @param maxAttempts - Maximum requests allowed in window
    * @param windowMs - Time window in milliseconds
    * @param keyFn - Optional custom key function (defaults to IP-based)
    *
    * @example
    * // 5 requests per minute per IP
    * rateLimit(5, 60000)
    *
    * @example
    * // 3 login attempts per minute per email
    * rateLimit(3, 60000, async (ctx) => {
    *   const body = await ctx.request.json();
    *   return `email:${body.email}`;
    * })
    */
   export function rateLimit(
     maxAttempts: number,
     windowMs: number,
     keyFn?: (ctx: Context) => Promise<string> | string
   ) {
     return async (ctx: Context): Promise<Response | void> => {
       // Generate rate limit key
       const key = keyFn
         ? await keyFn(ctx)
         : `ip:${ctx.request.headers.get('x-forwarded-for') ||
                 ctx.request.headers.get('x-real-ip') ||
                 'unknown'}`;

       const now = Date.now();
       const record = rateLimitStore.get(key);

       // Clean up expired record
       if (record && record.resetAt < now) {
         rateLimitStore.delete(key);
       }

       // Get or create record
       const current = rateLimitStore.get(key);

       if (!current) {
         // First request in window
         rateLimitStore.set(key, {
           count: 1,
           resetAt: now + windowMs,
         });
         return; // Allow
       }

       // Check if limit exceeded
       if (current.count >= maxAttempts) {
         const retryAfter = Math.ceil((current.resetAt - now) / 1000);

         return Response.json(
           {
             error: 'Too many requests. Please try again later.',
             retryAfter,
           },
           {
             status: 429,
             headers: {
               'Retry-After': String(retryAfter),
               'X-RateLimit-Limit': String(maxAttempts),
               'X-RateLimit-Remaining': '0',
               'X-RateLimit-Reset': String(Math.floor(current.resetAt / 1000)),
             },
           }
         );
       }

       // Increment counter
       current.count++;
       rateLimitStore.set(key, current);

       // Add rate limit headers to response (will be merged by framework)
       ctx.rateLimitHeaders = {
         'X-RateLimit-Limit': String(maxAttempts),
         'X-RateLimit-Remaining': String(maxAttempts - current.count),
         'X-RateLimit-Reset': String(Math.floor(current.resetAt / 1000)),
       };
     };
   }

   /**
    * Clear all rate limit records.
    * Useful for testing.
    */
   export function clearRateLimits() {
     rateLimitStore.clear();
   }
   ```

2. **Apply rate limiting to auth routes** (15 min)

   File: `server/src/auth/routes.ts`

   ```typescript
   import { rateLimit } from '@/middleware/rate-limit';

   export const routes: Route[] = [
     {
       method: 'POST',
       path: '/auth/register',
       handler: register,
       middleware: [
         // 3 registration attempts per 15 minutes per IP
         rateLimit(3, 15 * 60 * 1000),
       ],
     },
     {
       method: 'POST',
       path: '/auth/login',
       handler: login,
       middleware: [
         // 5 login attempts per minute per IP
         rateLimit(5, 60 * 1000),
         // Additional per-email rate limit (stricter)
         rateLimit(3, 60 * 1000, async (ctx) => {
           const body = await ctx.request.json();
           return `login:${body.email}`;
         }),
       ],
     },
     {
       method: 'GET',
       path: '/auth/me',
       handler: me,
       middleware: [requireAuth],
     },
   ];
   ```

3. **Add rate limit tests** (45 min)

   File: `server/tests/rate-limit.test.ts` (NEW)

   ```typescript
   import { describe, test, expect, beforeEach } from 'bun:test';
   import { clearRateLimits } from '@/middleware/rate-limit';

   describe('Rate Limiting', () => {
     beforeEach(() => {
       clearRateLimits();
     });

     test('allows requests under limit', async () => {
       // First 5 requests should succeed
       for (let i = 0; i < 5; i++) {
         const response = await fetch('http://localhost:3000/auth/login', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
             email: 'test@example.com',
             password: 'wrong'
           }),
         });

         // May be 401 (wrong password) but not 429 (rate limited)
         expect(response.status).not.toBe(429);
       }
     });

     test('blocks requests over limit', async () => {
       // Exhaust rate limit (5 attempts per minute)
       for (let i = 0; i < 5; i++) {
         await fetch('http://localhost:3000/auth/login', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
             email: 'test@example.com',
             password: 'wrong'
           }),
         });
       }

       // 6th request should be rate limited
       const response = await fetch('http://localhost:3000/auth/login', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           email: 'test@example.com',
           password: 'wrong'
         }),
       });

       expect(response.status).toBe(429);

       const body = await response.json();
       expect(body.error).toContain('Too many requests');
       expect(body.retryAfter).toBeGreaterThan(0);

       // Check headers
       expect(response.headers.get('Retry-After')).toBeTruthy();
       expect(response.headers.get('X-RateLimit-Limit')).toBe('5');
       expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
     });

     test('separate limits per email', async () => {
       // User 1 exhausts their limit
       for (let i = 0; i < 3; i++) {
         await fetch('http://localhost:3000/auth/login', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
             email: 'user1@example.com',
             password: 'wrong'
           }),
         });
       }

       // User 1 is rate limited
       const user1Response = await fetch('http://localhost:3000/auth/login', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           email: 'user1@example.com',
           password: 'wrong'
         }),
       });
       expect(user1Response.status).toBe(429);

       // User 2 can still login
       const user2Response = await fetch('http://localhost:3000/auth/login', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           email: 'user2@example.com',
           password: 'wrong'
         }),
       });
       expect(user2Response.status).not.toBe(429);
     });

     test('rate limit resets after window', async () => {
       // Exhaust rate limit
       for (let i = 0; i < 5; i++) {
         await fetch('http://localhost:3000/auth/login', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
             email: 'test@example.com',
             password: 'wrong'
           }),
         });
       }

       // Verify rate limited
       let response = await fetch('http://localhost:3000/auth/login', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           email: 'test@example.com',
           password: 'wrong'
         }),
       });
       expect(response.status).toBe(429);

       // Wait for window to expire (61 seconds for 60 second window)
       await new Promise(resolve => setTimeout(resolve, 61000));

       // Should be allowed again
       response = await fetch('http://localhost:3000/auth/login', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           email: 'test@example.com',
           password: 'wrong'
         }),
       });
       expect(response.status).not.toBe(429);
     });
   });
   ```

4. **Add account lockout on repeated failures** (Optional - 30 min)

   File: `server/src/auth/login.ts`

   ```typescript
   // Track failed login attempts per email
   const failedAttempts = new Map<string, { count: number; lockUntil: number }>();

   export async function login(ctx: Context): Promise<Response> {
     const { email, password } = await ctx.request.json();

     // Check if account is locked
     const lockRecord = failedAttempts.get(email);
     if (lockRecord && lockRecord.lockUntil > Date.now()) {
       const retryAfter = Math.ceil((lockRecord.lockUntil - Date.now()) / 1000);
       return Response.json(
         {
           error: 'Account temporarily locked due to too many failed attempts. Please try again later.',
           retryAfter,
         },
         {
           status: 423, // Locked
           headers: { 'Retry-After': String(retryAfter) },
         }
       );
     }

     // Attempt authentication
     const user = await findUserByEmail(ctx.db, email);

     if (!user || !await verifyPassword(password, user.passwordHash)) {
       // Increment failed attempts
       const current = failedAttempts.get(email) || { count: 0, lockUntil: 0 };
       current.count++;

       // Lock account after 5 failed attempts for 15 minutes
       if (current.count >= 5) {
         current.lockUntil = Date.now() + 15 * 60 * 1000;
         failedAttempts.set(email, current);

         return Response.json(
           { error: 'Account locked due to too many failed attempts. Try again in 15 minutes.' },
           { status: 423 }
         );
       }

       failedAttempts.set(email, current);

       return Response.json(
         { error: 'Invalid credentials' },
         { status: 401 }
       );
     }

     // Success - reset failed attempts
     failedAttempts.delete(email);

     // Generate token and return
     // ... existing code ...
   }
   ```

5. **Update middleware README** (10 min)

   File: `server/src/middleware/README.md`

   - Document rateLimit middleware factory
   - Show usage examples
   - Explain key generation strategies
   - Note production considerations (use Redis)

6. **Run tests** (5 min)
   ```bash
   cd server
   bun test
   ```

**Success Criteria:**
- ✅ Login endpoint limited to 5 attempts/min per IP
- ✅ Login endpoint limited to 3 attempts/min per email
- ✅ Registration limited to 3 attempts/15min per IP
- ✅ Rate limit headers returned (X-RateLimit-*)
- ✅ Tests verify rate limiting behavior
- ✅ Optional: Account lockout after 5 failed attempts

**Estimated Time**: 2-3 hours

---

### 1.4: Add Frontend Error Handling 🟡 MEDIUM

**Files to Modify:**
- `frontend/src/api/client.ts` (add error handling, timeout, retries)
- `frontend/src/api/errors.ts` (NEW - typed error classes)
- `frontend/src/composables/useAsync.ts` (NEW - loading/error state helper)
- `frontend/src/router/index.ts` (add route guards)
- `frontend/src/stores/auth.ts` (handle auth errors)

**Implementation Steps:**

1. **Create typed API error classes** (15 min)

   File: `frontend/src/api/errors.ts` (NEW)

   ```typescript
   /**
    * Base API error class.
    */
   export class ApiError extends Error {
     constructor(
       public readonly status: number,
       message: string,
       public readonly details?: any
     ) {
       super(message);
       this.name = 'ApiError';
     }
   }

   /**
    * Network error (no response received).
    */
   export class NetworkError extends ApiError {
     constructor(message = 'Network error') {
       super(0, message);
       this.name = 'NetworkError';
     }
   }

   /**
    * Request timeout error.
    */
   export class TimeoutError extends ApiError {
     constructor(message = 'Request timeout') {
       super(408, message);
       this.name = 'TimeoutError';
     }
   }

   /**
    * Unauthorized error (401).
    */
   export class UnauthorizedError extends ApiError {
     constructor(message = 'Unauthorized') {
       super(401, message);
       this.name = 'UnauthorizedError';
     }
   }

   /**
    * Forbidden error (403).
    */
   export class ForbiddenError extends ApiError {
     constructor(message = 'Forbidden') {
       super(403, message);
       this.name = 'ForbiddenError';
     }
   }

   /**
    * Not found error (404).
    */
   export class NotFoundError extends ApiError {
     constructor(message = 'Not found') {
       super(404, message);
       this.name = 'NotFoundError';
     }
   }

   /**
    * Rate limit error (429).
    */
   export class RateLimitError extends ApiError {
     constructor(
       message = 'Too many requests',
       public readonly retryAfter?: number
     ) {
       super(429, message);
       this.name = 'RateLimitError';
     }
   }

   /**
    * Server error (5xx).
    */
   export class ServerError extends ApiError {
     constructor(status: number, message = 'Server error') {
       super(status, message);
       this.name = 'ServerError';
     }
   }
   ```

2. **Enhance API client with error handling** (45 min)

   File: `frontend/src/api/client.ts`

   ```typescript
   import {
     ApiError,
     NetworkError,
     TimeoutError,
     UnauthorizedError,
     ForbiddenError,
     NotFoundError,
     RateLimitError,
     ServerError,
   } from './errors';

   const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
   const DEFAULT_TIMEOUT = 10000; // 10 seconds

   /**
    * Enhanced API request with error handling, timeout, and retries.
    */
   export async function apiRequest<T>(
     endpoint: string,
     options: RequestInit & { timeout?: number; retries?: number } = {}
   ): Promise<T> {
     const { timeout = DEFAULT_TIMEOUT, retries = 0, ...fetchOptions } = options;

     let lastError: Error | null = null;

     // Retry loop
     for (let attempt = 0; attempt <= retries; attempt++) {
       try {
         const controller = new AbortController();
         const timeoutId = setTimeout(() => controller.abort(), timeout);

         const response = await fetch(`${BASE_URL}${endpoint}`, {
           ...fetchOptions,
           headers: {
             'Content-Type': 'application/json',
             ...fetchOptions.headers,
           },
           signal: controller.signal,
         });

         clearTimeout(timeoutId);

         // Handle error responses
         if (!response.ok) {
           const errorData = await response.json().catch(() => ({
             message: response.statusText
           }));

           switch (response.status) {
             case 401:
               throw new UnauthorizedError(errorData.message);
             case 403:
               throw new ForbiddenError(errorData.message);
             case 404:
               throw new NotFoundError(errorData.message);
             case 429:
               throw new RateLimitError(
                 errorData.message,
                 errorData.retryAfter
               );
             default:
               if (response.status >= 500) {
                 throw new ServerError(response.status, errorData.message);
               }
               throw new ApiError(response.status, errorData.message, errorData);
           }
         }

         // Success - return data
         return response.json();

       } catch (error) {
         // Handle abort/timeout
         if (error instanceof Error && error.name === 'AbortError') {
           lastError = new TimeoutError();
         } else if (error instanceof ApiError) {
           // API error - don't retry
           throw error;
         } else {
           // Network error - may retry
           lastError = new NetworkError(
             error instanceof Error ? error.message : 'Unknown error'
           );
         }

         // If not last attempt, wait before retrying
         if (attempt < retries) {
           await new Promise(resolve =>
             setTimeout(resolve, Math.pow(2, attempt) * 1000)
           ); // Exponential backoff: 1s, 2s, 4s...
         }
       }
     }

     // All retries exhausted
     throw lastError || new NetworkError();
   }

   /**
    * Authenticated API request.
    * Automatically adds Authorization header from store.
    */
   export async function authenticatedRequest<T>(
     endpoint: string,
     options: RequestInit & { timeout?: number; retries?: number } = {}
   ): Promise<T> {
     const authStore = useAuthStore();

     if (!authStore.token) {
       throw new UnauthorizedError('No authentication token');
     }

     return apiRequest<T>(endpoint, {
       ...options,
       headers: {
         ...options.headers,
         Authorization: `Bearer ${authStore.token}`,
       },
     });
   }
   ```

3. **Create useAsync composable** (30 min)

   File: `frontend/src/composables/useAsync.ts` (NEW)

   ```typescript
   import { ref, Ref } from 'vue';
   import { ApiError, UnauthorizedError } from '@/api/errors';
   import { useAuthStore } from '@/stores/auth';
   import { useRouter } from 'vue-router';

   export interface AsyncState<T> {
     loading: Ref<boolean>;
     error: Ref<ApiError | null>;
     data: Ref<T | null>;
     execute: () => Promise<void>;
     reset: () => void;
   }

   /**
    * Composable for async operations with loading/error states.
    *
    * @example
    * const { loading, error, data, execute } = useAsync(async () => {
    *   return await fetchBooks();
    * });
    *
    * // In component setup
    * onMounted(() => execute());
    *
    * // In template
    * <div v-if="loading">Loading...</div>
    * <div v-else-if="error">Error: {{ error.message }}</div>
    * <div v-else>{{ data }}</div>
    */
   export function useAsync<T>(
     fn: () => Promise<T>,
     options: {
       onSuccess?: (data: T) => void;
       onError?: (error: ApiError) => void;
       redirectOnUnauth?: boolean;
     } = {}
   ): AsyncState<T> {
     const loading = ref(false);
     const error = ref<ApiError | null>(null);
     const data = ref<T | null>(null);

     const authStore = useAuthStore();
     const router = useRouter();

     const execute = async () => {
       loading.value = true;
       error.value = null;

       try {
         const result = await fn();
         data.value = result;

         if (options.onSuccess) {
           options.onSuccess(result);
         }
       } catch (e) {
         const apiError = e instanceof ApiError
           ? e
           : new ApiError(0, e instanceof Error ? e.message : 'Unknown error');

         error.value = apiError;

         // Handle unauthorized errors
         if (apiError instanceof UnauthorizedError) {
           authStore.logout();
           if (options.redirectOnUnauth !== false) {
             router.push({
               name: 'Login',
               query: { redirect: router.currentRoute.value.fullPath }
             });
           }
         }

         if (options.onError) {
           options.onError(apiError);
         }
       } finally {
         loading.value = false;
       }
     };

     const reset = () => {
       loading.value = false;
       error.value = null;
       data.value = null;
     };

     return { loading, error, data, execute, reset };
   }
   ```

4. **Add route guards** (15 min)

   File: `frontend/src/router/index.ts`

   ```typescript
   import { useAuthStore } from '@/stores/auth';

   // Add before route definitions:
   router.beforeEach((to, from, next) => {
     const authStore = useAuthStore();

     // Check if route requires authentication
     if (to.meta.requiresAuth && !authStore.isAuthenticated) {
       next({
         name: 'Login',
         query: { redirect: to.fullPath }
       });
       return;
     }

     // Redirect authenticated users away from auth pages
     if (to.name === 'Login' && authStore.isAuthenticated) {
       next({ name: 'Home' });
       return;
     }

     next();
   });

   // Update route definitions to include meta:
   const routes = [
     {
       path: '/books',
       name: 'Books',
       component: () => import('@/views/Books.vue'),
       meta: { requiresAuth: true },
     },
     // ... other routes
   ];
   ```

5. **Update auth store with error handling** (15 min)

   File: `frontend/src/stores/auth.ts`

   ```typescript
   import { ApiError } from '@/api/errors';

   export const useAuthStore = defineStore('auth', () => {
     const user = ref<User | null>(null);
     const token = ref<string | null>(null);
     const error = ref<ApiError | null>(null);
     const loading = ref(false);

     const isAuthenticated = computed(() => !!user.value && !!token.value);

     async function login(credentials: LoginCredentials) {
       loading.value = true;
       error.value = null;

       try {
         const response = await apiRequest<LoginResponse>('/auth/login', {
           method: 'POST',
           body: JSON.stringify(credentials),
         });

         user.value = response.user;
         token.value = response.token;

         // Store in localStorage for persistence
         localStorage.setItem('auth_token', response.token);
         localStorage.setItem('auth_user', JSON.stringify(response.user));
       } catch (e) {
         error.value = e instanceof ApiError
           ? e
           : new ApiError(0, 'Login failed');
         throw error.value;
       } finally {
         loading.value = false;
       }
     }

     function logout() {
       user.value = null;
       token.value = null;
       error.value = null;
       localStorage.removeItem('auth_token');
       localStorage.removeItem('auth_user');
     }

     // Restore session from localStorage
     function restore() {
       const storedToken = localStorage.getItem('auth_token');
       const storedUser = localStorage.getItem('auth_user');

       if (storedToken && storedUser) {
         token.value = storedToken;
         user.value = JSON.parse(storedUser);
       }
     }

     return {
       user,
       token,
       error,
       loading,
       isAuthenticated,
       login,
       logout,
       restore,
     };
   });
   ```

6. **Run frontend** (5 min)
   ```bash
   cd frontend
   bun run dev
   # Manually test error scenarios
   ```

**Success Criteria:**
- ✅ API errors are properly typed and handled
- ✅ Requests have 10s timeout by default
- ✅ Network failures show user-friendly errors
- ✅ 401 errors trigger logout and redirect to login
- ✅ Route guards protect authenticated routes
- ✅ useAsync composable simplifies loading/error states

**Estimated Time**: 2 hours

---

### 1.5: Document Incomplete Features (ROADMAP.md) 🟡 MEDIUM

**Files to Create:**
- `ROADMAP.md` (NEW - feature roadmap and status)

**Files to Modify:**
- `README.md` (add link to ROADMAP.md, note experimental features)

**Implementation Steps:**

1. **Create ROADMAP.md** (45 min)

   File: `ROADMAP.md` (NEW)

   ```markdown
   # Quailcomp Roadmap

   ## Current Status (v0.2.0)

   ### ✅ Production Ready

   - Event sourcing infrastructure
   - Database schema and migrations
   - Authentication (password + JWT)
   - **Authorization (entity-level access control)** - NEW in v0.2.0
   - **Rate limiting** - NEW in v0.2.0
   - Book metadata service (5 providers)
   - Data client libraries (entities + events)
   - Server API (REST endpoints)

   ### ⚠️ Experimental (Not Production Ready)

   - **Frontend (Vue app)** - Minimal implementation, 17 components
     - Status: Basic structure exists
     - Missing: Comprehensive UI, component tests, accessibility
     - Recommendation: Use API directly or build custom frontend

   - **CLI** - Basic commands only
     - Status: Scaffolding exists
     - Missing: Most commands not implemented
     - Recommendation: Use server API directly

   ### 📅 Planned Features

   #### Q1 2026 (Weeks 2-4)
   - Environment variable validation (Zod schema)
   - Production deployment documentation
   - Database migration rollback scripts
   - E2E test suite
   - OpenAPI specification

   #### Q2 2026 (Weeks 5-10)
   - Docker support (Dockerfile + docker-compose)
   - Observability (structured logging, metrics, tracing)
   - Frontend component tests (Vitest + Vue Test Utils)
   - Frontend expansion (forms, validation, error boundaries)
   - Book metadata rate limiting + caching

   #### Q3 2026 (Weeks 11-16)
   - People domain (authors, contributors)
   - Series domain (book series tracking)
   - Locations domain (where books are stored)
   - Advanced search (full-text, filters)
   - Bulk operations

   #### Q4 2026 (Future)
   - Mobile app (React Native or similar)
   - Public API + API keys
   - Webhooks for events
   - Real-time updates (WebSockets)
   - Import/export (CSV, XLSX, JSON)

   ## Feature Requests

   See [GitHub Issues](https://github.com/yourusername/quailcomp/issues) for:
   - Feature requests
   - Bug reports
   - Discussion topics

   ---

   ## Experimental Feature Details

   ### Frontend

   **What Works:**
   - Vue 3 + Pinia setup
   - Basic component library (17 components)
   - Storybook stories
   - Authentication flow
   - Book list/detail views

   **What's Missing:**
   - Component tests
   - Form validation
   - Error boundaries
   - Loading states
   - Accessibility (ARIA)
   - Responsive design
   - Comprehensive UI coverage

   **When Will It Be Production Ready?**
   Q2 2026 (estimated) - After component tests, error handling, and UI expansion

   ### CLI

   **What Works:**
   - Project scaffolding
   - Database connection
   - Basic command structure

   **What's Missing:**
   - Most CRUD commands
   - Interactive prompts
   - Output formatting
   - Error handling
   - Documentation

   **When Will It Be Production Ready?**
   TBD - Low priority, API is primary interface

   ---

   ## Version History

   ### v0.2.0 (2026-01-31) - Security Hardening
   - ✅ Authorization enforcement on all entity routes
   - ✅ Rate limiting on authentication endpoints
   - ✅ Frontend error handling
   - ✅ Query duplication refactored (-500 lines)

   ### v0.1.0 (2026-01-15) - Initial Release
   - Event sourcing foundation
   - Authentication system
   - Book management API
   - Metadata providers

   ---

   ## Contributing

   See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

   For questions about roadmap priorities or feature requests, open a [GitHub Discussion](https://github.com/yourusername/quailcomp/discussions).
   ```

2. **Update README.md** (15 min)
   - Add "Status & Roadmap" section near top
   - Link to ROADMAP.md
   - Mark experimental features clearly
   - Set expectations for production use

3. **Commit changes** (5 min)
   ```bash
   git add ROADMAP.md README.md
   git commit -m "Add ROADMAP.md and clarify feature status"
   ```

**Success Criteria:**
- ✅ ROADMAP.md clearly documents feature status
- ✅ Experimental features clearly marked
- ✅ Timeline set for production features
- ✅ README.md links to roadmap

**Estimated Time**: 1 hour

---

## Phase 1 Summary

**Total Estimated Time**: 12-17 hours (1.5-2 days)

**Deliverables:**
1. ✅ Data clients refactored (-500 lines of code)
2. ✅ Authorization enforced on all book routes
3. ✅ Rate limiting on auth endpoints
4. ✅ Frontend error handling improved
5. ✅ ROADMAP.md documents feature status

**Verification:**
```bash
# Run all tests
bun test

# Verify coverage threshold
bun run test:coverage:report
# Should show ≥90% coverage

# Verify no linting errors
bun run lint

# Commit Phase 1
git add .
git commit -m "Phase 1: Critical security & code quality improvements"
```

---

## Phase 2: Infrastructure & Configuration (Week 2-3)

**Goal**: Add production-ready configuration and build infrastructure

**Estimated Effort**: 5-7 days

### 2.1: Environment Variable Validation 🟡 MEDIUM

**Files to Create:**
- `server/src/config.ts` (NEW - centralized config with validation)
- `.env.example` (NEW - example environment file)

**Files to Modify:**
- `server/src/server.ts` (use validated config)
- `docs/reference/environment-variables.md` (update with validation info)

**Implementation Steps:**

1. **Install Zod** (2 min)
   ```bash
   cd server
   bun add zod
   ```

2. **Create validated config module** (45 min)

   File: `server/src/config.ts` (NEW)

   ```typescript
   import { z } from 'zod';

   /**
    * Environment variable schema with validation.
    */
   const envSchema = z.object({
     // Node environment
     NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

     // Server configuration
     PORT: z.coerce.number().int().positive().default(3000),
     HOST: z.string().default('0.0.0.0'),

     // Database
     DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL URL'),

     // Authentication
     JWT_SECRET: z.string().min(32, {
       message: 'JWT_SECRET must be at least 32 characters for security'
     }),
     JWT_EXPIRES_IN: z.string().default('7d'),

     // Optional JWT secret for rotation grace period
     JWT_SECRET_OLD: z.string().min(32).optional(),

     // CORS
     CORS_ORIGINS: z.string().transform(val => val.split(',')).default('http://localhost:5173'),

     // Rate limiting
     RATE_LIMIT_ENABLED: z.coerce.boolean().default(true),

     // Logging
     LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

     // Book metadata providers (all optional)
     GOOGLE_BOOKS_API_KEY: z.string().optional(),
     OPEN_LIBRARY_API_KEY: z.string().optional(),

     // Analytics
     ANALYTICS_ENABLED: z.coerce.boolean().default(true),
     ANALYTICS_RETENTION_DAYS: z.coerce.number().int().positive().default(90),
   });

   /**
    * Validated environment configuration.
    * Throws on startup if validation fails.
    */
   export const env = envSchema.parse(process.env);

   /**
    * Type-safe environment variables.
    */
   export type Env = z.infer<typeof envSchema>;

   /**
    * Check if running in production.
    */
   export const isProduction = env.NODE_ENV === 'production';

   /**
    * Check if running in development.
    */
   export const isDevelopment = env.NODE_ENV === 'development';

   /**
    * Check if running in test.
    */
   export const isTest = env.NODE_ENV === 'test';
   ```

3. **Create .env.example** (15 min)

   File: `.env.example` (NEW)

   ```bash
   # Quailcomp Environment Variables
   # Copy this file to .env and fill in your values

   # Environment
   NODE_ENV=development

   # Server
   PORT=3000
   HOST=0.0.0.0

   # Database
   # Format: postgres://user:password@host:port/database
   DATABASE_URL=postgres://quailcomp_app:your-password-here@localhost:5432/quailcomp

   # Authentication
   # Generate with: openssl rand -base64 32
   JWT_SECRET=your-secret-key-min-32-characters-long-change-in-production
   JWT_EXPIRES_IN=7d

   # Optional: For JWT secret rotation (grace period)
   # JWT_SECRET_OLD=previous-secret-key-if-rotating

   # CORS (comma-separated origins)
   CORS_ORIGINS=http://localhost:5173,http://localhost:3000

   # Rate Limiting
   RATE_LIMIT_ENABLED=true

   # Logging
   LOG_LEVEL=info

   # Book Metadata Providers (optional)
   # GOOGLE_BOOKS_API_KEY=your-google-books-api-key
   # OPEN_LIBRARY_API_KEY=your-open-library-api-key

   # Analytics
   ANALYTICS_ENABLED=true
   ANALYTICS_RETENTION_DAYS=90
   ```

4. **Update server.ts to use config** (20 min)
   ```typescript
   import { env, isProduction } from './config';

   // Use validated config
   const server = Bun.serve({
     port: env.PORT,
     hostname: env.HOST,
     fetch: router.fetch.bind(router),
   });

   console.log(`Server running on ${env.HOST}:${env.PORT}`);
   console.log(`Environment: ${env.NODE_ENV}`);
   ```

5. **Update CORS middleware** (15 min)
   ```typescript
   // server/src/middleware/cors.ts
   import { env } from '@/config';

   const allowedOrigins = env.CORS_ORIGINS;

   export function cors(request: Request): Response | undefined {
     const origin = request.headers.get('Origin');

     if (origin && !allowedOrigins.includes(origin)) {
       return new Response('CORS policy violation', { status: 403 });
     }

     // ... rest of CORS logic
   }
   ```

6. **Update docs** (10 min)

   File: `docs/reference/environment-variables.md`

   - Note Zod validation
   - Document all variables
   - Show .env.example usage

7. **Test validation** (15 min)
   ```bash
   # Test missing required var
   unset JWT_SECRET
   bun run server/src/server.ts
   # Should fail with validation error

   # Test invalid var
   export JWT_SECRET=tooshort
   bun run server/src/server.ts
   # Should fail with validation error

   # Test with .env.example
   cp .env.example .env
   # Edit .env with real values
   bun run server/src/server.ts
   # Should start successfully
   ```

**Success Criteria:**
- ✅ Config validated on startup
- ✅ Fails fast with clear errors if invalid
- ✅ Type-safe access to all env vars
- ✅ .env.example documents all variables
- ✅ Documentation updated

**Estimated Time**: 2 hours

---

### 2.2: Production Build Scripts 🟡 MEDIUM

**Files to Modify:**
- `package.json` (root - add orchestration scripts)
- `.github/workflows/ci.yml` (use new build scripts)

**Implementation Steps:**

1. **Add build orchestration scripts** (15 min)

   File: `package.json` (root)

   ```json
   {
     "scripts": {
       "build": "bun run build:data && bun run build:server && bun run build:frontend && bun run build:cli",
       "build:data": "cd data/client && bun run build",
       "build:server": "cd server && bun run build",
       "build:frontend": "cd frontend && bun run build",
       "build:cli": "cd cli && bun run build",

       "clean": "bun run clean:data && bun run clean:server && bun run clean:frontend && bun run clean:cli",
       "clean:data": "rm -rf data/client/dist",
       "clean:server": "rm -rf server/dist",
       "clean:frontend": "rm -rf frontend/dist",
       "clean:cli": "rm -rf cli/dist",

       "typecheck": "bun run typecheck:data && bun run typecheck:server && bun run typecheck:frontend && bun run typecheck:cli",
       "typecheck:data": "cd data/client && tsc --noEmit",
       "typecheck:server": "cd server && tsc --noEmit",
       "typecheck:frontend": "cd frontend && vue-tsc --noEmit",
       "typecheck:cli": "cd cli && tsc --noEmit",

       "test:all": "bun run test:data && bun run test:server",
       "test:data": "cd data/client && bun test",
       "test:server": "cd server && bun test",

       "dev:server": "cd server && bun run dev",
       "dev:frontend": "cd frontend && bun run dev"
     }
   }
   ```

2. **Update CI workflow** (10 min)

   File: `.github/workflows/ci.yml`

   ```yaml
   name: CI

   on: [push, pull_request]

   jobs:
     test:
       runs-on: ubuntu-latest

       steps:
         - uses: actions/checkout@v3

         - uses: oven-sh/setup-bun@v1
           with:
             bun-version-file: .bun-version

         - name: Install dependencies
           run: bun install --frozen-lockfile

         - name: Typecheck
           run: bun run typecheck

         - name: Lint
           run: bun run lint

         - name: Test
           run: bun run test:all

         - name: Build
           run: bun run build
   ```

3. **Create .bun-version file** (2 min)

   File: `.bun-version` (NEW)

   ```
   1.3.6
   ```

4. **Test build pipeline** (10 min)
   ```bash
   # Clean everything
   bun run clean

   # Type check
   bun run typecheck

   # Build everything
   bun run build

   # Verify dist directories created
   ls -la data/client/dist
   ls -la server/dist
   ls -la frontend/dist
   ls -la cli/dist
   ```

**Success Criteria:**
- ✅ Single command builds all workspaces
- ✅ CI uses consistent Bun version
- ✅ Type checking covers all workspaces
- ✅ Build artifacts created in dist/

**Estimated Time**: 30 min

---

### 2.3: Database Migration Rollback 🟡 MEDIUM

**Files to Create:**
- `data/migrations/001_initial_schema_down.sql` (NEW)
- `data/migrations/002_auth_tables_down.sql` (NEW)
- `data/migrations/003_analytics_down.sql` (NEW)
- `scripts/rollback-migration.ts` (NEW)

**Files to Modify:**
- `docs/how-to/run-migrations.md` (add rollback instructions)

**Implementation Steps:**

1. **Create down migration for 001** (30 min)

   File: `data/migrations/001_initial_schema_down.sql` (NEW)

   ```sql
   -- Rollback migration 001: Initial Schema

   -- Drop triggers
   DROP TRIGGER IF EXISTS validate_entity_id_trigger ON events;
   DROP FUNCTION IF EXISTS validate_entity_id();

   -- Drop indexes on events
   DROP INDEX IF EXISTS idx_events_entity_id;
   DROP INDEX IF EXISTS idx_events_type_occurred;
   DROP INDEX IF EXISTS idx_events_data_gin;

   -- Drop indexes on entities
   DROP INDEX IF EXISTS idx_entities_type_active;
   DROP INDEX IF EXISTS idx_entities_data_gin;

   -- Drop tables (CASCADE to remove dependent objects)
   DROP TABLE IF EXISTS events CASCADE;
   DROP TABLE IF EXISTS entities CASCADE;

   -- Revoke permissions from app role
   REVOKE ALL ON ALL TABLES IN SCHEMA public FROM quailcomp_app;
   REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM quailcomp_app;

   -- Note: Does not drop roles or database
   -- Those must be dropped manually if needed:
   -- DROP ROLE IF EXISTS quailcomp_app;
   -- DROP ROLE IF EXISTS quailcomp_owner;
   ```

2. **Create down migration for 002** (20 min)

   File: `data/migrations/002_auth_tables_down.sql` (NEW)

   ```sql
   -- Rollback migration 002: Auth Tables

   -- Drop indexes
   DROP INDEX IF EXISTS idx_entity_access_by_user;
   DROP INDEX IF EXISTS idx_entity_access_by_entity;
   DROP INDEX IF EXISTS idx_users_email_unique;
   DROP INDEX IF EXISTS idx_credentials_user;
   DROP INDEX IF EXISTS idx_sessions_user;
   DROP INDEX IF EXISTS idx_sessions_token;

   -- Drop tables (CASCADE for foreign keys)
   DROP TABLE IF EXISTS sessions CASCADE;
   DROP TABLE IF EXISTS credentials CASCADE;
   DROP TABLE IF EXISTS entity_access CASCADE;
   DROP TABLE IF EXISTS users CASCADE;

   -- Revoke permissions
   REVOKE ALL ON sessions FROM quailcomp_app;
   REVOKE ALL ON credentials FROM quailcomp_app;
   REVOKE ALL ON entity_access FROM quailcomp_app;
   REVOKE ALL ON users FROM quailcomp_app;
   REVOKE ALL ON SEQUENCE users_user_id_seq FROM quailcomp_app;
   ```

3. **Create down migration for 003** (15 min)

   File: `data/migrations/003_analytics_down.sql` (NEW)

   ```sql
   -- Rollback migration 003: Analytics

   -- Drop indexes
   DROP INDEX IF EXISTS idx_analytics_events_user;
   DROP INDEX IF EXISTS idx_analytics_events_occurred;
   DROP INDEX IF EXISTS idx_analytics_events_type;

   -- Note: Analytics events are stored in the events table
   -- This migration only added indexes, so we just drop those
   -- The events themselves remain (they're just regular events)

   -- If you want to delete all analytics events:
   -- DELETE FROM events WHERE type = 'analytics_event';
   ```

4. **Create rollback script** (45 min)

   File: `scripts/rollback-migration.ts` (NEW)

   ```typescript
   import { readFileSync, existsSync, readdirSync } from 'fs';
   import { getConnection } from '@quailcomp/data-client';

   /**
    * Rollback a database migration.
    *
    * Usage:
    *   bun run scripts/rollback-migration.ts 003
    *   bun run scripts/rollback-migration.ts all
    */

   async function rollbackMigration(migrationNumber: string) {
     const db = getConnection();

     try {
       // Find down migration file
       const migrationsDir = 'data/migrations';
       const files = readdirSync(migrationsDir);

       const downFile = files.find(f =>
         f.startsWith(`${migrationNumber}_`) && f.endsWith('_down.sql')
       );

       if (!downFile) {
         console.error(`❌ No down migration found for ${migrationNumber}`);
         console.log(`   Looking for: ${migrationNumber}_*_down.sql`);
         process.exit(1);
       }

       const downPath = `${migrationsDir}/${downFile}`;

       console.log(`📦 Rolling back migration ${migrationNumber}: ${downFile}`);

       // Read and execute down migration
       const sql = readFileSync(downPath, 'utf-8');

       await db.query(sql);

       console.log(`✅ Successfully rolled back migration ${migrationNumber}`);

     } catch (error) {
       console.error(`❌ Failed to rollback migration ${migrationNumber}:`, error);
       process.exit(1);
     } finally {
       await db.end();
     }
   }

   async function rollbackAll() {
     const db = getConnection();

     try {
       // Get all down migrations in reverse order
       const migrationsDir = 'data/migrations';
       const files = readdirSync(migrationsDir)
         .filter(f => f.endsWith('_down.sql'))
         .sort()
         .reverse(); // Rollback in reverse order

       console.log(`📦 Rolling back ${files.length} migrations...`);

       for (const file of files) {
         console.log(`   - ${file}`);
         const sql = readFileSync(`${migrationsDir}/${file}`, 'utf-8');
         await db.query(sql);
       }

       console.log(`✅ Successfully rolled back all migrations`);

     } catch (error) {
       console.error(`❌ Failed to rollback migrations:`, error);
       process.exit(1);
     } finally {
       await db.end();
     }
   }

   // Main
   const migrationNumber = process.argv[2];

   if (!migrationNumber) {
     console.error('Usage: bun run scripts/rollback-migration.ts <number|all>');
     console.error('');
     console.error('Examples:');
     console.error('  bun run scripts/rollback-migration.ts 003');
     console.error('  bun run scripts/rollback-migration.ts all');
     process.exit(1);
   }

   if (migrationNumber === 'all') {
     await rollbackAll();
   } else {
     await rollbackMigration(migrationNumber.padStart(3, '0'));
   }
   ```

5. **Test rollback** (20 min)
   ```bash
   # Create test database
   createdb quailcomp_rollback_test

   # Run migrations
   DATABASE_URL=postgres://localhost/quailcomp_rollback_test bun run db:migrate

   # Verify tables exist
   psql quailcomp_rollback_test -c "\dt"

   # Rollback migration 003
   DATABASE_URL=postgres://localhost/quailcomp_rollback_test \
     bun run scripts/rollback-migration.ts 003

   # Rollback migration 002
   DATABASE_URL=postgres://localhost/quailcomp_rollback_test \
     bun run scripts/rollback-migration.ts 002

   # Rollback migration 001
   DATABASE_URL=postgres://localhost/quailcomp_rollback_test \
     bun run scripts/rollback-migration.ts 001

   # Verify no tables remain
   psql quailcomp_rollback_test -c "\dt"

   # Clean up
   dropdb quailcomp_rollback_test
   ```

6. **Update documentation** (15 min)

   File: `docs/how-to/run-migrations.md`

   - Add "Rolling Back Migrations" section
   - Document rollback script usage
   - Warn about data loss
   - Show how to rollback specific migration

**Success Criteria:**
- ✅ Down migrations for all existing migrations
- ✅ Rollback script works correctly
- ✅ Can rollback individual or all migrations
- ✅ Documentation updated

**Estimated Time**: 2 hours

---

### 2.4: Analytics Cleanup Job 🟡 MEDIUM

**Files to Create:**
- `scripts/cleanup-analytics.ts` (NEW)
- `data/migrations/004_analytics_cleanup_function.sql` (NEW - optional)

**Files to Modify:**
- `docs/explanation/analytics.md` (document retention policy)

**Implementation Steps:**

1. **Create cleanup script** (30 min)

   File: `scripts/cleanup-analytics.ts` (NEW)

   ```typescript
   import { getConnection } from '@quailcomp/data-client';
   import { env } from '@/server/src/config';

   /**
    * Clean up old analytics events based on retention policy.
    *
    * Default: Delete analytics events older than 90 days.
    *
    * Usage:
    *   bun run scripts/cleanup-analytics.ts
    *   bun run scripts/cleanup-analytics.ts --days 30
    *   bun run scripts/cleanup-analytics.ts --dry-run
    */

   async function cleanupAnalytics(options: {
     retentionDays: number;
     dryRun: boolean;
   }) {
     const db = getConnection();

     try {
       const cutoffDate = new Date();
       cutoffDate.setDate(cutoffDate.getDate() - options.retentionDays);

       console.log(`🗑️  Cleaning up analytics events older than ${options.retentionDays} days`);
       console.log(`   Cutoff date: ${cutoffDate.toISOString()}`);

       if (options.dryRun) {
         // Dry run - just count
         const result = await db.query(`
           SELECT COUNT(*) as count
           FROM events
           WHERE type = 'analytics_event'
             AND entered_at < $1
         `, [cutoffDate]);

         console.log(`   Would delete ${result.rows[0].count} events (DRY RUN)`);
       } else {
         // Actually delete
         const result = await db.query(`
           DELETE FROM events
           WHERE type = 'analytics_event'
             AND entered_at < $1
           RETURNING event_id
         `, [cutoffDate]);

         console.log(`✅ Deleted ${result.rowCount} old analytics events`);
       }

     } catch (error) {
       console.error(`❌ Failed to cleanup analytics:`, error);
       process.exit(1);
     } finally {
       await db.end();
     }
   }

   // Parse command line arguments
   const args = process.argv.slice(2);
   const daysArg = args.find(arg => arg.startsWith('--days='));
   const retentionDays = daysArg
     ? parseInt(daysArg.split('=')[1])
     : env.ANALYTICS_RETENTION_DAYS;
   const dryRun = args.includes('--dry-run');

   await cleanupAnalytics({ retentionDays, dryRun });
   ```

2. **Add cleanup function to database** (Optional - 20 min)

   File: `data/migrations/004_analytics_cleanup_function.sql` (NEW)

   ```sql
   -- Migration 004: Analytics Cleanup Function
   -- Adds a database function for cleaning up old analytics events

   CREATE OR REPLACE FUNCTION cleanup_old_analytics(retention_days INTEGER DEFAULT 90)
   RETURNS TABLE(deleted_count BIGINT) AS $$
   DECLARE
     cutoff_date TIMESTAMPTZ;
     result BIGINT;
   BEGIN
     -- Calculate cutoff date
     cutoff_date := NOW() - (retention_days || ' days')::INTERVAL;

     -- Delete old analytics events
     DELETE FROM events
     WHERE type = 'analytics_event'
       AND entered_at < cutoff_date;

     GET DIAGNOSTICS result = ROW_COUNT;

     RETURN QUERY SELECT result;
   END;
   $$ LANGUAGE plpgsql;

   -- Grant execute to app role
   GRANT EXECUTE ON FUNCTION cleanup_old_analytics(INTEGER) TO quailcomp_app;

   -- Create down migration
   -- File: 004_analytics_cleanup_function_down.sql
   -- DROP FUNCTION IF EXISTS cleanup_old_analytics(INTEGER);
   ```

3. **Add to crontab** (Documentation only - 10 min)

   Create `docs/how-to/schedule-analytics-cleanup.md`:

   ```markdown
   # Schedule Analytics Cleanup

   ## Option 1: Cron Job (Linux/Mac)

   Add to crontab:

   ```bash
   # Edit crontab
   crontab -e

   # Add this line (runs daily at 2 AM)
   0 2 * * * cd /path/to/quailcomp && bun run scripts/cleanup-analytics.ts >> /var/log/quailcomp-cleanup.log 2>&1
   ```

   ## Option 2: Systemd Timer (Linux)

   Create `/etc/systemd/system/quailcomp-cleanup.service`:

   ```ini
   [Unit]
   Description=Quailcomp Analytics Cleanup

   [Service]
   Type=oneshot
   User=quailcomp
   WorkingDirectory=/path/to/quailcomp
   ExecStart=/usr/bin/bun run scripts/cleanup-analytics.ts
   ```

   Create `/etc/systemd/system/quailcomp-cleanup.timer`:

   ```ini
   [Unit]
   Description=Run Quailcomp Analytics Cleanup Daily

   [Timer]
   OnCalendar=daily
   Persistent=true

   [Install]
   WantedBy=timers.target
   ```

   Enable and start:

   ```bash
   sudo systemctl enable quailcomp-cleanup.timer
   sudo systemctl start quailcomp-cleanup.timer
   ```

   ## Option 3: Database pg_cron Extension

   If you have pg_cron installed:

   ```sql
   SELECT cron.schedule(
     'cleanup-analytics',
     '0 2 * * *',  -- Daily at 2 AM
     $$SELECT cleanup_old_analytics(90)$$
   );
   ```

   ## Verify Cleanup

   Check how many events would be deleted (dry run):

   ```bash
   bun run scripts/cleanup-analytics.ts --dry-run
   ```

   Manually run cleanup:

   ```bash
   bun run scripts/cleanup-analytics.ts
   ```
   ```

4. **Update analytics documentation** (10 min)

   File: `docs/explanation/analytics.md`

   - Document 90-day retention policy
   - Link to cleanup schedule guide
   - Explain why cleanup is necessary

5. **Test cleanup** (10 min)
   ```bash
   # Dry run
   bun run scripts/cleanup-analytics.ts --dry-run

   # Custom retention
   bun run scripts/cleanup-analytics.ts --days=30 --dry-run

   # Actual cleanup (if test data exists)
   bun run scripts/cleanup-analytics.ts
   ```

**Success Criteria:**
- ✅ Cleanup script works correctly
- ✅ Dry-run mode prevents accidental deletion
- ✅ Documentation for scheduling provided
- ✅ Retention policy documented

**Estimated Time**: 1 hour

---

## Phase 2 Summary

**Total Estimated Time**: 5-7 hours

**Deliverables:**
1. ✅ Environment variable validation with Zod
2. ✅ Production build scripts
3. ✅ Database migration rollback support
4. ✅ Analytics cleanup automation

**Verification:**
```bash
# Test config validation
bun run server/src/config.ts

# Test build pipeline
bun run clean && bun run build

# Test migration rollback
DATABASE_URL=postgres://localhost/test_db bun run scripts/rollback-migration.ts 001

# Test analytics cleanup
bun run scripts/cleanup-analytics.ts --dry-run

# Commit Phase 2
git add .
git commit -m "Phase 2: Infrastructure & configuration improvements"
```

---

## Phase 3: Testing & Quality Assurance (Week 4-6)

**Goal**: Add comprehensive test coverage (E2E, frontend, integration)

**Estimated Effort**: 2-3 weeks

### 3.1: E2E Test Suite 🟡 MEDIUM

**Files to Create:**
- `server/tests/e2e/book-workflow.test.ts` (NEW)
- `server/tests/e2e/auth-workflow.test.ts` (NEW)
- `server/tests/e2e/authz-workflow.test.ts` (NEW)

**Implementation:** (See REVIEW.md Section 2.3 for detailed examples)

**Success Criteria:**
- ✅ Complete user workflows tested end-to-end
- ✅ Auth + Authz integration verified
- ✅ Book CRUD lifecycle tested
- ✅ Metadata lookup integration tested

**Estimated Time**: 2-3 days

---

### 3.2: Frontend Testing 🟡 MEDIUM

**Files to Create:**
- `frontend/vitest.config.ts` (NEW)
- `frontend/tests/stores/auth.test.ts` (NEW)
- `frontend/tests/stores/books.test.ts` (NEW)
- `frontend/tests/components/*.test.ts` (NEW - for key components)

**Installation:**
```bash
cd frontend
bun add -d vitest @vue/test-utils jsdom
```

**Implementation:** (See REVIEW.md Section 2.2 for detailed examples)

**Success Criteria:**
- ✅ Pinia stores tested
- ✅ Key components tested
- ✅ API client tested
- ✅ Router guards tested

**Estimated Time**: 1-2 days

---

### 3.3: Property-Based Testing 🟡 MEDIUM

**Files to Create:**
- `data/client/tests/properties.test.ts` (NEW)

**Installation:**
```bash
cd data/client
bun add -d fast-check
```

**Implementation:** (See REVIEW.md Section 10.2 for detailed examples)

**Success Criteria:**
- ✅ Entity update invariants tested
- ✅ JSONB query correctness verified
- ✅ Edge cases discovered and handled

**Estimated Time**: 1-2 days

---

## Phase 3 Summary

**Total Estimated Time**: 2-3 weeks

**Deliverables:**
1. ✅ E2E test suite covering critical workflows
2. ✅ Frontend component and store tests
3. ✅ Property-based tests for data clients

**Verification:**
```bash
# Run all tests including new E2E
bun run test:all

# Check coverage
bun run test:coverage:report

# Commit Phase 3
git add .
git commit -m "Phase 3: Comprehensive test coverage"
```

---

## Phase 4: Production Readiness (Week 7-10)

**Goal**: Add deployment, observability, and production infrastructure

**Estimated Effort**: 3-4 weeks

### 4.1: Docker Support 🟡 MEDIUM

**Files to Create:**
- `Dockerfile` (NEW)
- `docker-compose.yml` (NEW)
- `.dockerignore` (NEW)
- `docs/how-to/deploy-docker.md` (NEW)

**Implementation:** (See REVIEW.md Section 12.1 for detailed Dockerfile)

**Success Criteria:**
- ✅ Multi-stage production Dockerfile
- ✅ docker-compose for development
- ✅ Health checks configured
- ✅ Documentation complete

**Estimated Time**: 2-3 hours

---

### 4.2: Observability Stack 🟡 MEDIUM

**Files to Create:**
- `server/src/utils/logger.ts` (NEW - structured logging)
- `server/src/utils/metrics.ts` (NEW - Prometheus metrics)
- `server/src/utils/sentry.ts` (NEW - error tracking)
- `docs/how-to/deploy-production.md` (NEW)

**Installation:**
```bash
cd server
bun add pino @sentry/bun
```

**Implementation:** (See REVIEW.md Section 12.3 for detailed examples)

**Success Criteria:**
- ✅ Structured JSON logging (pino)
- ✅ Metrics endpoint (Prometheus format)
- ✅ Error tracking (Sentry)
- ✅ Request/response logging

**Estimated Time**: 3-4 hours

---

### 4.3: Deployment Documentation 🟡 MEDIUM

**Files to Create:**
- `docs/how-to/deploy-production.md` (NEW - comprehensive guide)
- `.env.production.example` (NEW)

**Implementation:** (See REVIEW.md Section 3.3 for template)

**Content:**
- Production prerequisites
- Environment variables
- Database setup
- Migration process
- Backup procedures
- Monitoring setup
- Security checklist

**Success Criteria:**
- ✅ Complete deployment guide
- ✅ Production environment example
- ✅ Backup/restore procedures
- ✅ Rollback procedures

**Estimated Time**: 2-3 hours

---

### 4.4: OpenAPI Specification 🟡 MEDIUM

**Files to Create:**
- `server/src/openapi.ts` (NEW)
- `server/src/routes/docs.ts` (NEW - serve Swagger UI)

**Installation:**
```bash
cd server
bun add @asteasolutions/zod-to-openapi swagger-ui-express
```

**Implementation:** (See REVIEW.md Section 3.1 for detailed examples)

**Success Criteria:**
- ✅ OpenAPI 3.0 spec generated
- ✅ Swagger UI served at /api/docs
- ✅ All endpoints documented
- ✅ Request/response schemas

**Estimated Time**: 1-2 days

---

### 4.5: Security Hardening 🟡 MEDIUM

**Files to Modify:**
- `server/src/middleware/security-headers.ts` (NEW)
- `server/src/middleware/https-redirect.ts` (NEW)
- `server/src/auth/password.ts` (enhance validation)

**Implementation:** (See REVIEW.md Section 7 for all security recommendations)

**Tasks:**
- HTTPS enforcement
- HSTS headers
- Secure cookie flags
- Enhanced password validation
- CORS configuration per environment

**Success Criteria:**
- ✅ HTTPS enforced in production
- ✅ Security headers set
- ✅ Password complexity requirements
- ✅ CORS properly configured

**Estimated Time**: 2-3 hours

---

## Phase 4 Summary

**Total Estimated Time**: 3-4 weeks

**Deliverables:**
1. ✅ Docker support (Dockerfile + docker-compose)
2. ✅ Observability (logging, metrics, error tracking)
3. ✅ Production deployment documentation
4. ✅ OpenAPI specification + Swagger UI
5. ✅ Security hardening

**Verification:**
```bash
# Test Docker build
docker build -t quailcomp .

# Test docker-compose
docker-compose up -d

# Verify health check
curl http://localhost:3000/health

# Check metrics endpoint
curl http://localhost:3000/metrics

# View API docs
open http://localhost:3000/api/docs

# Commit Phase 4
git add .
git commit -m "Phase 4: Production readiness & deployment"
```

---

## Phase 5: Advanced Features (Week 11-16)

**Goal**: Implement remaining domains and advanced capabilities

**Estimated Effort**: 5-6 weeks (optional/future)

### 5.1: Additional Domains

**Domains to Implement:**
- People (authors, contributors)
- Series (book series tracking)
- Locations (where books are stored physically)

**Per Domain:**
- Domain documentation (markdown)
- Database schema (migration)
- API endpoints
- Authorization integration
- Tests

**Estimated Time**: 1-2 weeks per domain

---

### 5.2: Book Metadata Enhancements

**Tasks:**
- Rate limiting per provider
- Response caching (Redis)
- Circuit breaker pattern
- Timeout configuration

**See:** REVIEW.md Section 6 for detailed implementation

**Estimated Time**: 1 week

---

### 5.3: Advanced Search

**Features:**
- Full-text search (PostgreSQL FTS)
- Advanced filters (genre, publication date, rating)
- Saved searches
- Search history

**Estimated Time**: 1-2 weeks

---

### 5.4: Bulk Operations

**Features:**
- Bulk import (CSV, XLSX, JSON)
- Bulk export
- Batch updates
- Bulk delete with confirmation

**Estimated Time**: 1 week

---

### 5.5: Real-time Features (Optional)

**Features:**
- WebSocket support
- Real-time updates
- Collaborative features
- Live notifications

**Estimated Time**: 2-3 weeks

---

## Phase 5 Summary

**Total Estimated Time**: 5-6 weeks

**Note:** Phase 5 is optional and can be prioritized based on user needs. The application is production-ready after Phase 4.

---

## Implementation Details & Code Specifications

### Data Client Query Pattern

**Current Pattern (BAD):**
```typescript
// 8 query variations per method
if (includeDeleted) {
  if (limit && offset) { /* query 1 */ }
  else if (limit) { /* query 2 */ }
  else if (offset) { /* query 3 */ }
  else { /* query 4 */ }
} else {
  if (limit && offset) { /* query 5 */ }
  else if (limit) { /* query 6 */ }
  else if (offset) { /* query 7 */ }
  else { /* query 8 */ }
}
```

**New Pattern (GOOD):**
```typescript
// 1 dynamic query using Bun SQL template composition
private buildQueryFragments(options: QueryOptions) {
  return {
    whereClause: options.includeDeleted
      ? this.sql``
      : this.sql`AND deleted_at IS NULL`,
    limitClause: options.limit
      ? this.sql`LIMIT ${options.limit}`
      : this.sql``,
    offsetClause: options.offset
      ? this.sql`OFFSET ${options.offset}`
      : this.sql``,
  };
}

async getHistory<T>(entityId: number, options: QueryOptions = {}): Promise<Entry<T>[]> {
  const fragments = this.buildQueryFragments(options);

  const rows = await this.sql`
    SELECT * FROM entities
    WHERE entity_id = ${entityId}
    ${fragments.whereClause}
    ORDER BY entered_at ASC
    ${fragments.limitClause}
    ${fragments.offsetClause}
  `;

  return rows.map(row => this.mapRow<T>(row));
}
```

**Why This Works:**
- Bun SQL tagged templates support dynamic composition
- Empty SQL fragments (`this.sql```) are safely ignored
- Type-safe and injection-proof
- Single code path instead of 8 branches

---

### Authorization Middleware Pattern

**Middleware Composition:**
```typescript
// Helper to extract entity ID from route params
const getBookId = (ctx: Context) => Number(ctx.params.id);

// Route definition with stacked middleware
{
  method: 'PUT',
  path: '/books/:id',
  middleware: [
    requireAuth,                    // First: Verify user is authenticated
    requireWrite(getBookId),        // Second: Verify user has write access
  ],
  handler: updateBook,              // Finally: Execute handler
}
```

**Execution Order:**
1. Global middleware (error handler, logging, CORS)
2. Route middleware (auth, authz)
3. Handler

**Error Handling:**
- Middleware can return Response to short-circuit
- 401 if not authenticated
- 403 if authenticated but not authorized

---

### Rate Limiting Algorithm

**Token Bucket Implementation:**
```typescript
interface RateLimitRecord {
  count: number;      // Current token count
  resetAt: number;    // When bucket refills (Unix timestamp)
}

// On each request:
1. Get/create bucket for key (IP or email)
2. If resetAt < now, delete old bucket
3. If count >= maxAttempts, return 429
4. Increment count
5. Allow request
```

**Key Strategies:**
- IP-based: `ip:${request.headers.get('x-forwarded-for')}`
- Email-based: `email:${email}` (for login attempts)
- User-based: `user:${userId}` (for authenticated endpoints)

**Production Considerations:**
- Current: In-memory Map (single server)
- Production: Use Redis for distributed rate limiting

---

### Environment Variable Validation

**Fail Fast Philosophy:**
```typescript
// Server startup:
import { env } from './config';  // Throws if invalid

// Config validates on module load
export const env = envSchema.parse(process.env);

// Server never starts with invalid config
const server = Bun.serve({ port: env.PORT });
```

**Benefits:**
- No runtime surprises
- Type-safe config access
- Clear error messages
- Self-documenting via Zod schema

---

## Testing Strategy

### Unit Tests
- Test individual functions/methods
- Mock external dependencies
- Fast execution (<1s per suite)

### Integration Tests
- Test multiple components together
- Real database (test schema)
- Slower but more realistic

### E2E Tests (Phase 3)
- Full request/response cycle
- Real server running
- Verify entire workflows

### Coverage Requirements
- 90% line coverage (enforced)
- Critical paths: 100% coverage
- UI components: Optional (Phase 3)

---

## Verification Checklist

After each phase:

```bash
# 1. Type check
bun run typecheck

# 2. Lint
bun run lint

# 3. Test
bun run test:all

# 4. Coverage
bun run test:coverage:report

# 5. Build
bun run clean && bun run build

# 6. Manual testing
# - Start server
# - Test critical workflows
# - Verify error handling

# 7. Update READMEs
# - Document new features
# - Update examples
# - Add migration notes

# 8. Commit
git add .
git commit -m "Descriptive commit message"
git push
```

---

## Session Management

**For Multi-Session Implementation:**

1. **Phase Boundaries**
   - Each phase is a natural stopping point
   - Commit at end of each phase
   - Tag releases: `v0.2.0`, `v0.3.0`, etc.

2. **Within Phases**
   - Each numbered section is ~1-3 hours
   - Commit after each section
   - Run tests before committing

3. **Context Preservation**
   - This PLAN.md file provides all context
   - Reference specific line numbers and file paths
   - Code examples show exact implementation

4. **Progress Tracking**
   - Check off completed sections in PLAN.md
   - Update ROADMAP.md with completed features
   - Note any deviations or issues encountered

---

## Notes for Claude Code

**When Implementing:**

1. **Always read files before editing**
   - Understand current structure
   - Preserve existing patterns
   - Match code style

2. **Run tests frequently**
   - After every code change
   - Before committing
   - Verify coverage maintained

3. **Update documentation**
   - READMEs when structure changes
   - API docs when endpoints change
   - Migration notes for breaking changes

4. **Follow existing patterns**
   - Use same import style
   - Match error handling patterns
   - Maintain consistent naming

5. **Ask when unclear**
   - Ambiguous requirements
   - Architecture decisions
   - Breaking changes

---

**This plan provides everything needed to implement all REVIEW.md recommendations over multiple sessions without repetitive codebase searches.**
