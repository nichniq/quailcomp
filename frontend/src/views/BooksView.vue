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
</style>
