# Stores

Pinia stores for global state management.

## Files

- [`auth.ts`](auth.ts) - Authentication state (user, token, login/logout)
- [`books.ts`](books.ts) - Books collection state (list, current book, CRUD operations)

## Purpose

Stores manage application-wide state using [Pinia](https://pinia.vuejs.org/), Vue's official state management library.

## Usage

```typescript
import { useAuthStore } from '@/stores/auth'
import { useBooksStore } from '@/stores/books'

// In components
const authStore = useAuthStore()
const booksStore = useBooksStore()

// Access state
console.log(authStore.user)
console.log(booksStore.books)

// Call actions
await authStore.login(email, password)
await booksStore.fetchBooks()
```

## Store Structure

### Auth Store

Manages user authentication:

```typescript
{
  // State
  user: User | null
  token: string | null
  isAuthenticated: boolean

  // Actions
  login(email, password)
  register(email, password, name)
  logout()
  verifyToken()
}
```

### Books Store

Manages book collection:

```typescript
{
  // State
  books: Book[]
  currentBook: Book | null
  loading: boolean
  error: string | null

  // Actions
  fetchBooks()
  getBook(id)
  createBook(book)
  updateBook(id, book)
  deleteBook(id)
}
```

## Persistence

Stores can persist state to localStorage:

```typescript
import { defineStore } from 'pinia'
import { useLocalStorage } from '@vueuse/core'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: useLocalStorage('auth-token', null)
  })
})
```

## Composables

Use stores in composition API:

```vue
<script setup lang="ts">
import { useBooksStore } from '@/stores/books'
import { storeToRefs } from 'pinia'

const booksStore = useBooksStore()
const { books, loading } = storeToRefs(booksStore)

await booksStore.fetchBooks()
</script>
```

## Documentation

- [Pinia Documentation](https://pinia.vuejs.org/)
- [API Client](../api/)
- [Authentication Domain](../../../domains/authentication.md)
- [Books Domain](../../../domains/books.md)
