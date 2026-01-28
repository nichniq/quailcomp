<script setup lang="ts">
import BookMetadataLookup from '@/components/books/BookMetadataLookup.vue'
</script>

<template>
  <div class="book-metadata-lookup-view">
    <div class="book-metadata-lookup-view__header">
      <h1>Book Metadata Lookup</h1>
      <p class="book-metadata-lookup-view__description">
        Search for book information across multiple providers using ISBN or LCCN.
      </p>
    </div>

    <BookMetadataLookup />
  </div>
</template>

<style scoped>
.book-metadata-lookup-view {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
}

.book-metadata-lookup-view__header {
  margin-bottom: 2rem;
}

.book-metadata-lookup-view__header h1 {
  margin: 0 0 0.5rem 0;
  font-size: 2rem;
}

.book-metadata-lookup-view__description {
  margin: 0;
  color: #666;
  font-size: 1rem;
}
</style>
