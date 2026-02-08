# Integration Tests

Integration tests that verify how different domains work together in the Quailcomp system.

## Test Files

### cross-domain.test.ts

Tests interactions between People, Series, and Books domains to ensure they work together correctly.

**Test Coverage:**

- **People + Books Integration**
  - Creating persons and associating them with books as gift-givers
  - Querying books associated with a person
  - Multiple books per person relationships

- **Series + Books Integration**
  - Creating series and adding books to them
  - Querying books in a series
  - Books with and without volume numbers
  - Series metadata and relationships

- **Export with Related Entities**
  - JSON export includes correct series references
  - Data format consistency across exports

- **Complex Multi-Domain Scenarios**
  - Full workflows involving multiple domains (person gives series books)
  - Verifying data consistency across domain boundaries

## Test Patterns

### Cross-Domain Requests

Tests use the router to execute requests across multiple domains:

```typescript
async function executeRequest(
  router: Router,
  sql: Sql,
  method: string,
  req: Request
): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  const match = router.match(method, path);

  const ctx = createContext(req, sql);
  ctx.params = match.params;

  const middlewares = match.route.middleware || [];
  const middleware = compose(...middlewares);
  const handler = middleware(match.route.handler);
  return handler(ctx, req);
}
```

### Domain Relationships

Tests verify relationships between entities:

- Books reference Series via `series_id`
- Books reference People via acquisition `person_id`
- Queries return related entities correctly

### Data Consistency

Tests ensure:

- Entity IDs are properly typed (numbers vs strings)
- Related entity queries filter by user permissions
- Cross-domain operations maintain referential integrity

## Running Tests

```bash
# Run all integration tests
cd server && bun test tests/integration

# Run specific test file
bun test tests/integration/cross-domain.test.ts
```

## Notes

- All tests use unique timestamps for test data to avoid collisions
- Tests verify authorization across domain boundaries
- Tests use the same authentication/authorization flow as production code
