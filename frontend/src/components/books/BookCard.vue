<script setup lang="ts">
import type { BookEntry } from '@/types/books'

defineProps<{
  book: BookEntry
}>()

defineEmits<{
  click: []
}>()
</script>

<template>
  <div class="card" @click="$emit('click')">
    <h3 class="card__title">{{ book.data.title || 'Untitled' }}</h3>
    <p v-if="book.data.subtitle" class="card__subtitle">{{ book.data.subtitle }}</p>
    <p v-if="book.data.author" class="card__author">by {{ book.data.author }}</p>
    <div class="card__meta">
      <span v-if="book.data.isbn10" class="card__isbn">ISBN-10: {{ book.data.isbn10 }}</span>
      <span v-if="book.data.isbn13" class="card__isbn">ISBN-13: {{ book.data.isbn13 }}</span>
    </div>
  </div>
</template>

<style scoped>
.card {
  padding: 1.5rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  cursor: pointer;
  transition: box-shadow 0.2s;
}

.card:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.card__title {
  margin: 0 0 0.5rem 0;
  font-size: 1.25rem;
}

.card__subtitle {
  margin: 0 0 0.5rem 0;
  color: #666;
  font-style: italic;
}

.card__author {
  margin: 0 0 1rem 0;
  color: #333;
}

.card__meta {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.875rem;
  color: #666;
}

.card__isbn {
  font-family: monospace;
}
</style>
