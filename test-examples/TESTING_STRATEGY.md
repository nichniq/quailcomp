# Testing Strategy & Philosophy

## Vision

Our testing strategy aims to provide **confidence in correctness** while **enabling rapid iteration**. Tests should serve as living documentation, regression protection, and design feedback—not just coverage metrics.

## Core Principles

### 1. Test Behavior, Not Implementation

```typescript
// ❌ Bad: Testing implementation details
test('should call validateEmail internally', () => {
  const spy = jest.spyOn(utils, 'validateEmail');
  registerUser({ email: 'test@example.com' });
  expect(spy).toHaveBeenCalled();
});

// ✅ Good: Testing observable behavior
test('should reject invalid email addresses', () => {
  const result = registerUser({ email: 'invalid' });
  expect(result.success).toBe(false);
  expect(result.error).toContain('email');
});
```

### 2. Optimize for Readability

Tests are read more often than written. Prioritize clarity over DRY principles.

```typescript
// ✅ Good: Self-documenting test
test('should calculate total with tax and discount', () => {
  const order = {
    subtotal: 100,
    taxRate: 0.1,
    discount: 10
  };

  const total = calculateTotal(order);

  expect(total).toBe(99); // (100 - 10) * 1.1 = 99
});
```

### 3. Fast Feedback Loops

- Unit tests should run in < 1 second per suite
- Integration tests should run in < 10 seconds per suite
- E2E tests should complete in < 5 minutes for the full suite

### 4. Isolation & Independence

Each test should:

- Run in any order
- Not depend on other tests
- Clean up its own state
- Use fresh test data

## Testing Pyramid

```
        /\
       /E2E\      <- Few (5-10% of tests)
      /------\
     /  Int   \   <- Some (20-30% of tests)
    /----------\
   /   Unit     \ <- Many (60-75% of tests)
  /--------------\
```

### Unit Tests (60-75%)

**Purpose**: Verify individual functions, classes, and modules in isolation

**Characteristics**:

- Fast (milliseconds)
- Isolated (no I/O, network, database)
- Focused (single responsibility)
- Deterministic

**What to test**:

- Business logic
- Data transformations
- Validation rules
- Edge cases and error handling
- Utility functions

### Integration Tests (20-30%)

**Purpose**: Verify components work together correctly

**Characteristics**:

- Moderate speed (seconds)
- Tests real interactions
- May use test database/services
- Focus on interfaces between modules

**What to test**:

- Database queries and transactions
- API endpoint contracts
- Service integrations
- File system operations
- External service mocks

### E2E Tests (5-10%)

**Purpose**: Verify critical user workflows work end-to-end

**Characteristics**:

- Slower (seconds to minutes)
- High-value scenarios only
- Tests the full stack
- May use staging environment

**What to test**:

- Critical user journeys
- Authentication flows
- Payment processing
- Data consistency across layers

## Test Organization

### Directory Structure

```
src/
  components/
    Button/
      Button.tsx
      Button.test.tsx         # Unit tests
      Button.integration.test.tsx  # Integration tests

tests/
  unit/                       # Additional unit tests
  integration/                # Integration test suites
  e2e/                        # End-to-end tests
  fixtures/                   # Test data
  factories/                  # Data builders
  utils/                      # Test utilities
  setup/                      # Test configuration
```

### Naming Conventions

```typescript
// Pattern: describe('[Component/Function]', () => { ... })
describe('calculateDiscount', () => {
  // Pattern: test/it('should [expected behavior] when [condition]')
  test('should apply percentage discount when valid', () => {});
  test('should reject discount when exceeds maximum', () => {});
  test('should handle zero discount gracefully', () => {});
});
```

## What to Test

### ✅ Always Test

- Public APIs and interfaces
- Business rules and validation
- Edge cases (null, undefined, empty, max/min values)
- Error conditions
- Security-critical code
- Complex algorithms
- Bug fixes (regression tests)

### ⚠️ Consider Testing

- Simple getters/setters with logic
- Configuration parsing
- Format conversions
- Derived state

### ❌ Don't Test

- Third-party library internals
- Trivial code (simple getters)
- Framework magic
- Generated code

## Code Coverage

**Target**: 80% coverage minimum, but focus on **meaningful coverage**

Coverage alone doesn't guarantee quality:

```typescript
// ❌ 100% coverage, 0% value
test('should create instance', () => {
  const obj = new MyClass();
  expect(obj).toBeDefined(); // Useless assertion
});

// ✅ Lower coverage, high value
test('should handle concurrent requests safely', async () => {
  const results = await Promise.all([
    processRequest(1),
    processRequest(2),
    processRequest(3)
  ]);

  expect(results).toHaveLength(3);
  expect(new Set(results.map(r => r.id))).toHaveLength(3);
});
```

## Mocking Strategy

### Prefer Real Implementations

Use real objects when possible. Mock only when necessary:

- External services (APIs, databases in unit tests)
- Slow operations (file I/O, network)
- Non-deterministic behavior (dates, random)
- Side effects you want to avoid (sending emails)

### Mock Levels

```typescript
// Level 1: No mocks (ideal for unit tests)
test('should calculate total', () => {
  const result = calculateTotal([1, 2, 3]);
  expect(result).toBe(6);
});

// Level 2: Stub dependencies
test('should process order', () => {
  const mockInventory = { hasStock: () => true };
  const result = processOrder(mockInventory, order);
  expect(result.success).toBe(true);
});

// Level 3: Full mocks with assertions
test('should notify user on order', () => {
  const mockNotifier = { send: jest.fn() };
  processOrder(order, mockNotifier);
  expect(mockNotifier.send).toHaveBeenCalledWith(
    expect.objectContaining({ orderId: order.id })
  );
});
```

## Testing Asynchronous Code

```typescript
// ✅ Use async/await
test('should fetch user data', async () => {
  const user = await fetchUser(123);
  expect(user.name).toBe('John Doe');
});

// ✅ Test error handling
test('should handle network errors', async () => {
  await expect(fetchUser(999)).rejects.toThrow('Not found');
});

// ✅ Test timing and concurrency
test('should debounce search requests', async () => {
  const search = debounce(mockSearch, 100);

  search('a');
  search('ab');
  search('abc');

  await jest.advanceTimersByTime(100);
  expect(mockSearch).toHaveBeenCalledTimes(1);
  expect(mockSearch).toHaveBeenCalledWith('abc');
});
```

## Continuous Improvement

### Test Metrics to Track

- **Coverage**: Line, branch, and function coverage
- **Speed**: Test suite execution time
- **Reliability**: Flaky test rate
- **Maintainability**: Test code duplication

### Regular Reviews

- Review failing tests immediately
- Refactor brittle tests
- Update tests when requirements change
- Delete obsolete tests

### Anti-Patterns to Avoid

- **Test interdependence**: Tests that must run in order
- **Mystery guests**: Hidden test dependencies
- **Test fixtures that lie**: Outdated or unrealistic data
- **Excessive mocking**: Mocking everything makes tests meaningless
- **Testing implementation**: Tests that break on refactoring

## Resources

- [Testing Library Guiding Principles](https://testing-library.com/docs/guiding-principles/)
- [Test Desiderata](https://kentbeck.github.io/TestDesiderata/)
- [GOOS Book](http://www.growing-object-oriented-software.com/)
