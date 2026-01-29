# Router

Vue Router configuration for application navigation.

## Files

- [`index.ts`](index.ts) - Route definitions and navigation guards

## Routes

The application defines the following routes:

```
/                    - Books list (home)
/login               - Login page
/register            - Registration page
/books/:id           - Book detail page
/books/metadata      - Metadata lookup page
/playground          - Component playground (development)
```

## Route Configuration

```typescript
import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'home',
    component: BooksView
  },
  {
    path: '/login',
    name: 'login',
    component: LoginView
  },
  // ... more routes
]
```

## Navigation Guards

The router includes guards for:

- **Authentication**: Redirect to login if not authenticated
- **Authorization**: Check permissions before accessing routes
- **Route transitions**: Loading states and animations

## Usage in Components

```vue
<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const goToBook = (bookId: string) => {
  router.push({ name: 'book-detail', params: { id: bookId } })
}
</script>

<template>
  <router-link to="/books">View Books</router-link>
  <button @click="goToBook('123')">Go to Book</button>
</template>
```

## Protected Routes

Routes requiring authentication:

```typescript
{
  path: '/books',
  component: BooksView,
  meta: { requiresAuth: true }
}
```

Navigation guard checks authentication:

```typescript
router.beforeEach((to, from, next) => {
  if (to.meta.requiresAuth && !isAuthenticated()) {
    next('/login')
  } else {
    next()
  }
})
```

## Documentation

- [Vue Router Documentation](https://router.vuejs.org/)
- [Views](../views/)
