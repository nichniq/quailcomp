# Frontend Tests

Test suite for the Vue frontend application using Vitest and Vue Test Utils.

## Files

- [`setup.ts`](setup.ts) - Test environment setup and mocks
- [`localstorage-setup.ts`](localstorage-setup.ts) - localStorage mock using vi.stubGlobal
- [`stores/auth.test.ts`](stores/auth.test.ts) - Tests for authentication Pinia store
- [`stores/books.test.ts`](stores/books.test.ts) - Tests for books Pinia store

## Running Tests

```bash
# From project root
bun run test:frontend

# From frontend directory
bun test

# Watch mode
bun test --watch

# Coverage
bun test --coverage
```

## Test Configuration

Tests use Vitest with happy-dom environment. See [vitest.config.ts](../../vitest.config.ts) for configuration.

**Important**: When running tests with Bun, use `bunx vitest` instead of `bun test` to ensure Vitest (not Bun's native test runner) is used. The package.json scripts handle this automatically.

## Writing Tests

### Pinia Store Tests

```typescript
import { setActivePinia, createPinia } from 'pinia';
import { useAuthStore } from '@/stores/auth';

beforeEach(() => {
  setActivePinia(createPinia());
  localStorage.clear(); // localStorage is mocked automatically
});

test('example test', () => {
  const store = useAuthStore();
  expect(store.isAuthenticated).toBe(false);
});
```

### Component Tests

```typescript
import { mount } from '@vue/test-utils';
import MyComponent from '@/components/MyComponent.vue';

test('renders correctly', () => {
  const wrapper = mount(MyComponent);
  expect(wrapper.text()).toContain('Expected text');
});
```

## Test Mocks

- **localStorage**: Automatically mocked via `vi.stubGlobal` in setup files
- **matchMedia**: Mocked in setup.ts (jsdom doesn't implement it)
- **API calls**: Mock API modules using `vi.mock()`

See [Running Tests](../../../docs/how-to/run-tests.md) for more guidelines.
