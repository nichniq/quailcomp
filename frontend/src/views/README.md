# Views

Page-level Vue components for application routes.

## Files

- [`LoginView.vue`](LoginView.vue) - Login page
- [`RegisterView.vue`](RegisterView.vue) - User registration page
- [`BooksView.vue`](BooksView.vue) - Book collection list page
- [`BookDetailView.vue`](BookDetailView.vue) - Individual book detail page
- [`BookMetadataLookupView.vue`](BookMetadataLookupView.vue) - Metadata search page
- [`PlaygroundView.vue`](PlaygroundView.vue) - Development playground for testing components

## Purpose

Views are route-level components that:

1. Map to application URLs via [Vue Router](../router/)
2. Compose multiple components from [components/](../components/)
3. Manage page-level state and data fetching
4. Connect to [Pinia stores](../stores/) for global state

## Structure

Each view typically:

- Fetches data on mount
- Handles loading and error states
- Composes smaller components
- Manages page-specific interactions

## Usage Example

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useBooksStore } from '@/stores/books'
import BookList from '@/components/books/BookList.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'

const booksStore = useBooksStore()
const loading = ref(true)

onMounted(async () => {
  await booksStore.fetchBooks()
  loading.value = false
})
</script>

<template>
  <LoadingSpinner v-if="loading" />
  <BookList v-else :books="booksStore.books" />
</template>
```

## Documentation

- [Vue Router Configuration](../router/)
- [Component Library](../components/)
- [State Management](../stores/)
