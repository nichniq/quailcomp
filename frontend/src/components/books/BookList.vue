<script setup lang="ts">
import type { BookEntry } from '@/types/books'
import BookCard from './BookCard.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'

defineProps<{
  books: BookEntry[]
  loading?: boolean
  error?: string | null
}>()

defineEmits<{
  bookClick: [book: BookEntry]
  addClick: []
}>()
</script>

<template>
  <div class="list">
    <div class="list__header">
      <h2>Books</h2>
      <button class="list__add-button" @click="$emit('addClick')">Add Book</button>
    </div>

    <LoadingSpinner v-if="loading" size="large" />

    <div v-else-if="error" class="list__error">
      {{ error }}
    </div>

    <div v-else-if="books.length === 0" class="list__empty">
      <p>No books in your collection yet.</p>
      <button class="list__add-button" @click="$emit('addClick')">Add Your First Book</button>
    </div>

    <div v-else class="list__grid">
      <BookCard
        v-for="book in books"
        :key="book.entityId"
        :book="book"
        @click="$emit('bookClick', book)"
      />
    </div>
  </div>
</template>

<style scoped>
.list__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.list__header h2 {
  margin: 0;
}

.list__add-button {
  padding: 0.75rem 1.5rem;
  background-color: #333;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
}

.list__add-button:hover {
  background-color: #555;
}

.list__error {
  padding: 1rem;
  background-color: #fee;
  border: 1px solid #fcc;
  border-radius: 4px;
  color: #c00;
}

.list__empty {
  text-align: center;
  padding: 3rem;
}

.list__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
}
</style>
