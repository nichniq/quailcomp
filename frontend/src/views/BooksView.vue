<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useBooksStore } from '@/stores/books'
import BookList from '@/components/books/BookList.vue'
import BookForm from '@/components/books/BookForm.vue'
import type { BookEntry, CreateBookRequest } from '@/types/books'

const booksStore = useBooksStore()
const router = useRouter()

const showForm = ref(false)

onMounted(() => {
  booksStore.fetchBooks()
})

function handleBookClick(book: BookEntry) {
  router.push(`/books/${book.entityId}`)
}

function handleAddClick() {
  showForm.value = true
}

async function handleSubmit(data: CreateBookRequest) {
  const success = await booksStore.createBook(data)
  if (success) {
    showForm.value = false
  }
}

function handleCancel() {
  showForm.value = false
}
</script>

<template>
  <div class="view">
    <div v-if="!showForm" class="view__header">
      <router-link to="/books/lookup" class="view__lookup-link">
        Lookup Metadata
      </router-link>
    </div>

    <BookForm
      v-if="showForm"
      :loading="booksStore.loading"
      @submit="handleSubmit"
      @cancel="handleCancel"
    />
    <BookList
      v-else
      :books="booksStore.books"
      :loading="booksStore.loading"
      :error="booksStore.error"
      @book-click="handleBookClick"
      @add-click="handleAddClick"
    />
  </div>
</template>

<style scoped>
.view {
  padding: 2rem;
}

.view__header {
  margin-bottom: 1rem;
  display: flex;
  justify-content: flex-end;
}

.view__lookup-link {
  padding: 0.5rem 1rem;
  background: #333;
  color: white;
  text-decoration: none;
  border-radius: 4px;
  font-size: 0.9rem;
}

.view__lookup-link:hover {
  background: #555;
}
</style>
