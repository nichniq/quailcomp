# DevTools UI Components

Vue 3 components for the DevTools user interface.

## Components

### WatcherStatus.vue

Real-time monitoring interface for the file watcher system.

**Features:**

- Live display of all watch rules and their status
- Execution history with success/failure indicators
- Currently running tasks
- Manual trigger buttons for each rule
- Server-Sent Events (SSE) for real-time updates

**Key State:**

- `rules` - Array of watch rules with patterns and descriptions
- `executions` - Recent task execution results
- `currentlyRunning` - Set of currently executing task names
- `connected` - SSE connection status

**User Actions:**

- Click "Run" button to manually trigger a task
- View real-time task output in execution history
- See which files triggered each execution

### TestSpecs.vue

Browse and search the combined test specification document.

**Features:**

- Loads `TEST_SPECIFICATIONS.md` from API
- Renders markdown as formatted HTML
- Search/filter functionality
- Shows last updated timestamp
- Refresh button to reload specs

**Key State:**

- `specContent` - Raw markdown content
- `filteredContent` - Search-filtered markdown
- `renderedHtml` - Computed HTML from marked library
- `searchQuery` - Current search filter
- `lastModified` - Timestamp from server

**Rendering:**

- Uses `marked` library to convert markdown to HTML
- GitHub-style CSS for headings, lists, code blocks
- Responsive layout with scrollable content area

**Search Algorithm:**

The search filter works by:

1. Splitting markdown into lines
2. Finding lines matching search query (case-insensitive)
3. Including relevant section headers
4. Buffering sections to maintain context
5. Rendering filtered markdown as HTML

### CoverageReport.vue

Display and generate HTML test coverage reports.

**Features:**

- Displays HTML coverage report in an isolated iframe
- "Generate Coverage" button to run tests with coverage
- "Refresh" button to reload existing coverage
- Loading and error states
- Shows last modified timestamp
- Handles missing coverage gracefully

**Key State:**

- `coverageHtml` - Raw HTML content from coverage report
- `loading` - Loading state for initial fetch
- `generating` - Loading state for coverage generation
- `error` - Error message if coverage fails to load
- `lastModified` - Timestamp of last coverage generation

**User Actions:**

- Click "Refresh" to reload existing coverage report
- Click "Generate Coverage" to run `bun test --coverage` and create new report
- View coverage details in embedded iframe

**Technical Details:**

- Coverage HTML is served from `coverage/lcov.info` parsed and rendered by the server
- Iframe uses `sandbox` attribute for security isolation
- POST request to `/api/coverage/generate` triggers test run
- Shows helpful error when coverage doesn't exist yet

### ServerLogs.vue

Live stream of server logs with filtering and search capabilities.

**Features:**

- Real-time log streaming via Server-Sent Events (SSE)
- Color-coded log levels (info, warn, error, debug)
- Terminal-like monospace interface
- Filter by log level and search text
- Auto-scroll toggle (pause/resume)
- Clear button to reset view
- Connection status indicator
- Circular buffer limited to 1000 entries

**Key State:**

- `logs` - Array of log entries
- `connectionStatus` - SSE connection state (connected/disconnected/reconnecting)
- `autoScroll` - Whether to auto-scroll to new logs
- `filterLevel` - Selected log level filter
- `filterText` - Search query string
- `filteredLogs` - Computed filtered log entries

**User Actions:**

- Type in search box to filter logs by content
- Select log level from dropdown to filter by severity
- Click auto-scroll button to pause/resume scrolling
- Click clear button to remove all logs from view

**Technical Details:**

- Connects to `/api/logs/stream` SSE endpoint
- Receives initial buffer of recent logs
- Streams new logs as they occur
- Auto-reconnects on connection loss
- Maintains 1000-entry limit client-side

### ServerEvents.vue

Debug interface for monitoring all Server-Sent Events activity.

**Features:**

- Live stream of SSE connection events
- Tracks connections, disconnections, messages, and errors
- Shows active client counts per endpoint
- Expandable event payloads with JSON formatting
- Filter by event type and endpoint
- Color-coded event types
- Connection status indicator

**Key State:**

- `events` - Array of server event entries
- `connectionStatus` - SSE connection state
- `autoScroll` - Auto-scroll toggle
- `filterType` - Event type filter (connection/disconnection/message/error)
- `filterEndpoint` - Endpoint filter string
- `expandedEvents` - Set of expanded event IDs

**User Actions:**

- Click event to expand/collapse payload
- Filter by event type or endpoint
- Toggle auto-scroll
- Clear events

**Technical Details:**

- Connects to `/api/debug/events` SSE endpoint
- Tracks all SSE activity across the server
- Shows metadata like client counts and timestamps
- Limited to 500 events client-side

### ApiKeys.vue

API key management interface for creating and managing access keys.

**Features:**

- Create new API keys with custom names and permissions
- View all keys with masked values (last 4 chars shown)
- Edit key names and permissions
- Revoke keys (soft delete - marks as inactive)
- Copy full key to clipboard (only shown once at creation)
- Security warning about saving keys
- Active/revoked status indicators
- Last used timestamp tracking

**Key State:**

- `keys` - Array of API key metadata
- `loading` - Loading state
- `error` - Error message
- `showCreateModal` - Create modal visibility
- `createdKey` - Newly created key (with full value)
- `editingKey` - Key being edited
- `newKeyName` / `newKeyPermissions` - Form state

**User Actions:**

- Click "Create New Key" to open creation modal
- Enter name and select permissions
- Click "Create Key" to generate
- Copy full key value immediately (shown only once)
- Click "Edit" to modify key name/permissions
- Click "Revoke" to disable a key

**Security Features:**

- Keys are SHA-256 hashed before storage
- Full key value only shown once at creation
- Keys stored in `.devtools/api-keys.json` (gitignored)
- Revoked keys cannot be used
- Last used tracking for auditing

**Available Permissions:**

- `read` - Read access
- `write` - Write access
- `admin` - Admin access
- `api` - API access

## Component Guidelines

### Style

All components use scoped styles with BEM-like naming:

```css
.component-name {
  /* Component root styles */
}

.component-name__element {
  /* Element styles */
}

.component-name__element--modifier {
  /* Modified element styles */
}
```

### State Management

Components use Vue 3 Composition API with:

- `ref()` for reactive primitive values
- `computed()` for derived state
- `onMounted()` for initialization

No global state management (Vuex/Pinia) is used - components manage their own state.

### API Communication

Components fetch data directly from the API server using the Fetch API:

```typescript
const response = await fetch('http://localhost:3001/api/...')
const data = await response.json()
```

Development mode uses absolute URLs to connect to API server on port 3001.

### Real-time Updates

For real-time updates, components use Server-Sent Events (SSE):

```typescript
const eventSource = new EventSource('http://localhost:3001/api/watcher/events')
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data)
  // Update component state
}
```

### Error Handling

Components should handle loading and error states:

```vue
<div v-if="loading">Loading...</div>
<div v-else-if="error">{{ error }}</div>
<div v-else>
  <!-- Content -->
</div>
```

## Adding New Components

1. Create new `.vue` file in this directory
2. Use `<script setup lang="ts">` for TypeScript support
3. Add scoped styles with BEM naming
4. Handle loading/error states
5. Import and use in `App.vue`
6. Update this README with component documentation

## TypeScript

All components use TypeScript with type inference from Vue 3 Composition API.

Common patterns:

```typescript
// Refs with explicit types
const items = ref<Item[]>([])
const selected = ref<Item | null>(null)

// Computed with inferred return type
const filteredItems = computed(() => {
  return items.value.filter(item => item.active)
})

// Props with types
defineProps<{
  title: string
  count?: number
}>()
```
