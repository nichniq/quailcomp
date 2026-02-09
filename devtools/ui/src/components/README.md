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
