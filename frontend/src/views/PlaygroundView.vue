<script setup lang="ts">
import { ref } from 'vue'

// Common components
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import ErrorMessage from '@/components/common/ErrorMessage.vue'
import AppHeader from '@/components/common/AppHeader.vue'

// Auth components
import LoginForm from '@/components/auth/LoginForm.vue'
import RegisterForm from '@/components/auth/RegisterForm.vue'

// Book components
import BookCard from '@/components/books/BookCard.vue'
import BookForm from '@/components/books/BookForm.vue'
import BookList from '@/components/books/BookList.vue'
import BookMetadataResult from '@/components/books/BookMetadataResult.vue'
import BookMetadataLookup from '@/components/books/BookMetadataLookup.vue'

const selectedComponent = ref('LoadingSpinner')
const showError = ref(true)

// Sample data
const sampleBook = {
  entryId: 1,
  enteredAt: '2024-01-01T00:00:00Z',
  type: 'book',
  entityId: 1,
  deletedAt: null,
  data: {
    title: 'Dune',
    subtitle: 'Book One of the Dune Chronicles',
    author: 'Frank Herbert',
    isbn10: '0441172717',
    isbn13: '9780441172719',
    note: 'Classic science fiction novel'
  }
}

const sampleBooks = [
  {
    entryId: 1,
    enteredAt: '2024-01-01T00:00:00Z',
    type: 'book',
    entityId: 1,
    deletedAt: null,
    data: {
      title: 'The Great Gatsby',
      author: 'F. Scott Fitzgerald'
    }
  },
  {
    entryId: 2,
    enteredAt: '2024-01-02T00:00:00Z',
    type: 'book',
    entityId: 2,
    deletedAt: null,
    data: {
      title: '1984',
      author: 'George Orwell'
    }
  },
  {
    entryId: 3,
    enteredAt: '2024-01-03T00:00:00Z',
    type: 'book',
    entityId: 3,
    deletedAt: null,
    data: {
      title: 'Dune',
      subtitle: 'Book One of the Dune Chronicles',
      author: 'Frank Herbert'
    }
  }
]

// Sample metadata results for playground
const sampleMetadataResultSuccess = {
  provider: 'google-books' as const,
  data: {
    isbn: '9780441172719',
    isbn10: '0441172717',
    isbn13: '9780441172719',
    title: 'Dune',
    subtitle: 'Book One of the Dune Chronicles',
    authors: ['Frank Herbert'],
    publisher: 'Ace Books',
    publishedDate: '1990',
    description: 'Set on the desert planet Arrakis, Dune is the story of the boy Paul Atreides, heir to a noble family tasked with ruling an inhospitable world where the only thing of value is the "spice" melange, a drug capable of extending life and enhancing consciousness.',
    pageCount: 688,
    language: 'en',
    subjects: ['Science Fiction', 'Fantasy', 'Adventure'],
    thumbnailUrl: 'https://books.google.com/books/content?id=B1hSG45JCX4C&printsec=frontcover&img=1&zoom=1',
    source: 'google-books' as const
  },
  error: null,
  responseTime: 234
}

const sampleMetadataResultMinimal = {
  provider: 'open-library' as const,
  data: {
    isbn: '9780441172719',
    isbn13: '9780441172719',
    title: 'Dune',
    authors: ['Frank Herbert'],
    source: 'open-library' as const
  },
  error: null,
  responseTime: 456
}

const sampleMetadataResultNotFound = {
  provider: 'library-of-congress' as const,
  data: null,
  error: null,
  responseTime: 123
}

const sampleMetadataResultError = {
  provider: 'google-books' as const,
  data: null,
  error: 'Service temporarily unavailable',
  responseTime: 789
}

const components = [
  { name: 'LoadingSpinner', category: 'Common' },
  { name: 'ErrorMessage', category: 'Common' },
  { name: 'AppHeader', category: 'Common' },
  { name: 'LoginForm', category: 'Auth' },
  { name: 'RegisterForm', category: 'Auth' },
  { name: 'BookCard', category: 'Books' },
  { name: 'BookForm', category: 'Books' },
  { name: 'BookList', category: 'Books' },
  { name: 'BookMetadataResult', category: 'Books' },
  { name: 'BookMetadataLookup', category: 'Books' }
]
</script>

<template>
  <div class="playground">
    <div class="playground__sidebar">
      <h2>Component Playground</h2>

      <div v-for="category in ['Common', 'Auth', 'Books']" :key="category" class="playground__category">
        <h3>{{ category }}</h3>
        <button
          v-for="comp in components.filter(c => c.category === category)"
          :key="comp.name"
          @click="selectedComponent = comp.name"
          :class="{ 'playground__button--active': selectedComponent === comp.name }"
          class="playground__button"
        >
          {{ comp.name }}
        </button>
      </div>
    </div>

    <div class="playground__content">
      <div class="playground__header">
        <h1>{{ selectedComponent }}</h1>
      </div>

      <div class="playground__demo">
        <!-- Common Components -->
        <div v-if="selectedComponent === 'LoadingSpinner'" class="demo-section">
          <h3>Small</h3>
          <LoadingSpinner size="small" />

          <h3>Medium (default)</h3>
          <LoadingSpinner size="medium" />

          <h3>Large</h3>
          <LoadingSpinner size="large" />
        </div>

        <div v-if="selectedComponent === 'ErrorMessage'" class="demo-section">
          <h3>Default</h3>
          <ErrorMessage message="An error occurred" @dismiss="showError = !showError" />

          <h3>Network Error</h3>
          <ErrorMessage message="Network error: Could not connect to server" @dismiss="() => {}" />

          <h3>Validation Error</h3>
          <ErrorMessage message="Please fill in all required fields" @dismiss="() => {}" />
        </div>

        <div v-if="selectedComponent === 'AppHeader'" class="demo-section">
          <h3>Component (check actual header above)</h3>
          <p>The AppHeader is always visible at the top of the page.</p>
        </div>

        <!-- Auth Components -->
        <div v-if="selectedComponent === 'LoginForm'" class="demo-section">
          <h3>Default State</h3>
          <LoginForm @submit="console.log" />

          <h3>With Error</h3>
          <LoginForm error="Invalid credentials" @submit="console.log" />

          <h3>Loading State</h3>
          <LoginForm :loading="true" @submit="console.log" />
        </div>

        <div v-if="selectedComponent === 'RegisterForm'" class="demo-section">
          <h3>Default State</h3>
          <RegisterForm @submit="console.log" />

          <h3>With Error</h3>
          <RegisterForm error="Email already exists" @submit="console.log" />

          <h3>Loading State</h3>
          <RegisterForm :loading="true" @submit="console.log" />
        </div>

        <!-- Book Components -->
        <div v-if="selectedComponent === 'BookCard'" class="demo-section">
          <h3>Basic Book</h3>
          <BookCard :book="{ ...sampleBook, data: { title: 'The Great Gatsby' } }" @click="() => {}" />

          <h3>With Subtitle</h3>
          <BookCard :book="{ ...sampleBook, data: { title: 'The Fellowship of the Ring', subtitle: 'Being the First Part of The Lord of the Rings' } }" @click="() => {}" />

          <h3>Full Details</h3>
          <BookCard :book="sampleBook" @click="() => {}" />
        </div>

        <div v-if="selectedComponent === 'BookForm'" class="demo-section">
          <h3>Create Mode</h3>
          <BookForm @submit="console.log" @cancel="() => {}" />

          <h3>Edit Mode</h3>
          <BookForm :book="sampleBook" @submit="console.log" @cancel="() => {}" />
        </div>

        <div v-if="selectedComponent === 'BookList'" class="demo-section">
          <h3>Empty State</h3>
          <BookList :books="[]" @book-click="console.log" @add-click="() => {}" />

          <h3>With Books</h3>
          <BookList :books="sampleBooks" @book-click="console.log" @add-click="() => {}" />

          <h3>Loading State</h3>
          <BookList :books="[]" :loading="true" @book-click="console.log" @add-click="() => {}" />
        </div>

        <div v-if="selectedComponent === 'BookMetadataResult'" class="demo-section">
          <h3>Success - Full Data (Google Books)</h3>
          <BookMetadataResult :result="sampleMetadataResultSuccess" @select="console.log" />

          <h3>Success - Minimal Data (OpenLibrary)</h3>
          <BookMetadataResult :result="sampleMetadataResultMinimal" @select="console.log" />

          <h3>Not Found</h3>
          <BookMetadataResult :result="sampleMetadataResultNotFound" @select="console.log" />

          <h3>Error State</h3>
          <BookMetadataResult :result="sampleMetadataResultError" @select="console.log" />
        </div>

        <div v-if="selectedComponent === 'BookMetadataLookup'" class="demo-section">
          <h3>Full Component (Try with ISBN: 9780441172719)</h3>
          <BookMetadataLookup />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.playground {
  display: flex;
  min-height: calc(100vh - 60px);
}

.playground__sidebar {
  width: 250px;
  background-color: #f5f5f5;
  padding: 2rem 1rem;
  border-right: 1px solid #ddd;
}

.playground__sidebar h2 {
  margin-top: 0;
  font-size: 1.25rem;
}

.playground__category {
  margin-bottom: 2rem;
}

.playground__category h3 {
  font-size: 0.875rem;
  text-transform: uppercase;
  color: #666;
  margin-bottom: 0.5rem;
}

.playground__button {
  display: block;
  width: 100%;
  padding: 0.5rem;
  margin-bottom: 0.25rem;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  text-align: left;
  cursor: pointer;
  font-size: 0.9rem;
}

.playground__button:hover {
  background-color: #f9f9f9;
}

.playground__button--active {
  background-color: #333;
  color: white;
  border-color: #333;
}

.playground__content {
  flex: 1;
  padding: 2rem;
  overflow-y: auto;
}

.playground__header {
  margin-bottom: 2rem;
}

.playground__header h1 {
  margin: 0;
  font-size: 2rem;
}

.playground__demo {
  max-width: 800px;
}

.demo-section {
  margin-bottom: 3rem;
}

.demo-section h3 {
  margin-top: 2rem;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #ddd;
  color: #666;
  font-size: 1rem;
}

.demo-section > *:not(h3) {
  margin-bottom: 2rem;
}
</style>
