# Vue Components

Reusable Vue 3 components for the frontend application.

## Structure

- [**auth/**](auth/) - Authentication UI components (login, register)
- [**books/**](books/) - Book management components (list, card, form, metadata)
- [**common/**](common/) - Shared UI components (header, loading, errors)

## Component Organization

### Authentication Components

- [`LoginForm.vue`](auth/LoginForm.vue) - User login form
- [`RegisterForm.vue`](auth/RegisterForm.vue) - User registration form

### Book Components

- [`BookList.vue`](books/BookList.vue) - Display list of books
- [`BookCard.vue`](books/BookCard.vue) - Individual book card display
- [`BookForm.vue`](books/BookForm.vue) - Create/edit book form
- [`BookMetadataLookup.vue`](books/BookMetadataLookup.vue) - Search external book metadata
- [`BookMetadataResult.vue`](books/BookMetadataResult.vue) - Display metadata search results

### Common Components

- [`AppHeader.vue`](common/AppHeader.vue) - Application header with navigation
- [`LoadingSpinner.vue`](common/LoadingSpinner.vue) - Loading state indicator
- [`ErrorMessage.vue`](common/ErrorMessage.vue) - Error display component

## Usage

```vue
<script setup lang="ts">
import BookList from '@/components/books/BookList.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
</script>

<template>
  <LoadingSpinner v-if="loading" />
  <BookList v-else :books="books" />
</template>
```

## Documentation

- [Frontend README](../../README.md)
- [Vue 3 Documentation](https://vuejs.org/)
