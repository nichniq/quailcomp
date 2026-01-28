# Quailcomp Frontend

Vue 3 frontend for Quailcomp personal data management system.

## Dependencies

Minimal dependency footprint:

- **vue** - Vue 3 framework
- **vue-router** - Routing
- **pinia** - State management
- **vite** - Build tool
- **typescript** - Type safety

Total: ~35 packages (including transitive dependencies)

## Development

```bash
# Install dependencies
bun install

# Start dev server (http://localhost:5173)
bun run dev

# Build for production
bun run build

# Preview production build
bun run preview

# Type check
bun run type-check
```

## Component Playground

Instead of Storybook, we have a lightweight component playground at `/playground` that lets you view and interact with all components in isolation.

Visit <http://localhost:5173/playground> during development to:

- Browse all components by category (Common, Auth, Books)
- See different states (default, loading, error, etc.)
- Test component interactions

The playground is available in all environments (no auth required).

## Project Structure

```
src/
├── api/           # API client and endpoint functions
├── components/    # Vue components
│   ├── auth/      # Authentication components
│   ├── books/     # Book management components
│   └── common/    # Shared components
├── router/        # Vue Router configuration
├── stores/        # Pinia stores
├── types/         # TypeScript type definitions
├── views/         # Page-level components
└── styles/        # Global styles
```

## Component Stories

Component `.stories.ts` files are kept for documentation purposes and can be used as reference for component APIs and usage examples. They are not executed (Storybook was removed to keep dependencies minimal).
