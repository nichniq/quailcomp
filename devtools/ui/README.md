# DevTools UI

Web-based user interface for monitoring and managing the QuailComp development tools system.

## Overview

This is a Vue 3 + Vite application that provides a visual interface for:

- **Watcher Status**: Real-time monitoring of file watchers and automated tasks
- **Test Specifications**: Browse and search auto-generated test specifications
- **Metrics** (planned): System performance and code metrics
- **Admin** (planned): Configuration and management tools
- **Git** (planned): Git operations and status

## Architecture

### Development Mode

- **Frontend**: Vite dev server on port 3002 (hot reload)
- **Backend**: Bun API server on port 3001 (server.ts)
- **Communication**: HTTP/REST + Server-Sent Events (SSE)

### Production Mode

- **Single Server**: Bun serves both API and static files on port 3001
- **Static Files**: Built by Vite, served from `dist/`

## Key Files

- **[server.ts](server.ts)** - Bun server providing API endpoints and SSE
- **[src/App.vue](src/App.vue)** - Main application component with tab navigation
- **[src/main.ts](src/main.ts)** - Vue app entry point
- **[src/types.ts](src/types.ts)** - TypeScript type definitions
- **[vite.config.ts](vite.config.ts)** - Vite build configuration

## Running the UI

### Development (with hot reload)

```bash
cd devtools/ui
bun run dev
```

Opens UI at <http://localhost:3002> with API server at <http://localhost:3001>

### Development (with watcher)

```bash
cd devtools/ui
bun run dev:watcher
```

Runs both UI dev server and file watcher system

### Production Build

```bash
cd devtools/ui
bun run build
bun run preview
```

## API Endpoints

### Watcher APIs

- `GET /api/watcher/status` - Current watcher state
- `GET /api/watcher/history` - Recent task executions (last 50)
- `POST /api/watcher/trigger/:ruleName` - Manually trigger a task
- `GET /api/watcher/events` - Server-Sent Events stream

### Specs APIs

- `GET /api/specs/combined` - Get combined test specification markdown

## Dependencies

### Core

- **vue** - Progressive JavaScript framework
- **marked** - Markdown to HTML converter

### Dev Dependencies

- **vite** - Frontend build tool
- **@vitejs/plugin-vue** - Vue 3 support for Vite
- **typescript** - TypeScript compiler
- **vue-tsc** - Vue TypeScript type checker

## Components

See [src/components/README.md](src/components/README.md) for component documentation.

## Adding New Tabs

1. Create a new component in `src/components/`
2. Import the component in `App.vue`
3. Add tab to the `tabs` array
4. Add conditional rendering in the template
5. Add API endpoints in `server.ts` if needed

Example:

```typescript
// App.vue
import MyNewTab from './components/MyNewTab.vue'

const tabs = [
  // ...
  { id: 'mytab', label: 'My Tab' },
]

// In template:
<MyNewTab v-else-if="activeTab === 'mytab'" />
```

## Server-Sent Events (SSE)

The UI uses SSE for real-time updates from the watcher system:

```typescript
const eventSource = new EventSource('http://localhost:3001/api/watcher/events')
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data)
  // Update UI with new watcher state
}
```

Keepalive messages are sent every 30 seconds to maintain connection.

## CORS Configuration

Development mode enables CORS for `http://localhost:3002` to allow the Vite dev server to communicate with the API server.

Production mode does not need CORS as everything is served from the same origin.
