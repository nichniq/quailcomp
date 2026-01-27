<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBooksStore } from '@/stores/books'
import BookForm from '@/components/books/BookForm.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import type { CreateBookRequest } from '@/types/books'

const route = useRoute()
const router = useRouter()
const booksStore = useBooksStore()

const isEditing = ref(false)

onMounted(() => {
  const id = parseInt(route.params.id as string, 10)
  if (!isNaN(id)) {
    booksStore.fetchBook(id)
  }
})

async function handleSubmit(data: CreateBookRequest) {
  const id = parseInt(route.params.id as string, 10)
  const success = await booksStore.updateBook(id, data)
  if (success) {
    isEditing.value = false
  }
}

function handleCancel() {
  isEditing.value = false
}

async function handleDelete() {
  if (!confirm('Are you sure you want to delete this book?')) return

  const id = parseInt(route.params.id as string, 10)
  const success = await booksStore.deleteBook(id)
  if (success) {
    router.push('/books')
  }
}
</script>

<template>
  <div class="view">
    <div class="view__header">
      <button class="view__back" @click="router.push('/books')">← Back to Books</button>
    </div>

    <LoadingSpinner v-if="booksStore.loading && !booksStore.currentBook" size="large" />

    <div v-else-if="booksStore.currentBook" class="view__content">
      <BookForm
        v-if="isEditing"
        :book="booksStore.currentBook"
        :loading="booksStore.loading"
        @submit="handleSubmit"
        @cancel="handleCancel"
      />
      <div v-else class="detail">
        <div class="detail__header">
          <h2 class="detail__title">{{ booksStore.currentBook.data.title || 'Untitled' }}</h2>
          <div class="detail__actions">
            <button class="detail__button" @click="isEditing = true">Edit</button>
            <button class="detail__button detail__button--danger" @click="handleDelete">Delete</button>
          </div>
        </div>

        <p v-if="booksStore.currentBook.data.subtitle" class="detail__subtitle">
          {{ booksStore.currentBook.data.subtitle }}
        </p>

        <div class="detail__section">
          <h3>Details</h3>
          <dl class="detail__list">
            <dt v-if="booksStore.currentBook.data.author">Author</dt>
            <dd v-if="booksStore.currentBook.data.author">{{ booksStore.currentBook.data.author }}</dd>

            <dt v-if="booksStore.currentBook.data.isbn10">ISBN-10</dt>
            <dd v-if="booksStore.currentBook.data.isbn10">{{ booksStore.currentBook.data.isbn10 }}</dd>

            <dt v-if="booksStore.currentBook.data.isbn13">ISBN-13</dt>
            <dd v-if="booksStore.currentBook.data.isbn13">{{ booksStore.currentBook.data.isbn13 }}</dd>

            <dt v-if="booksStore.currentBook.data.lccn">LCCN</dt>
            <dd v-if="booksStore.currentBook.data.lccn">{{ booksStore.currentBook.data.lccn }}</dd>
          </dl>
        </div>

        <div v-if="booksStore.currentBook.data.note" class="detail__section">
          <h3>Notes</h3>
          <p>{{ booksStore.currentBook.data.note }}</p>
        </div>
      </div>
    </div>

    <div v-else class="view__error">
      Book not found
    </div>
  </div>
</template>

<style scoped>
.view {
  padding: 2rem;
}

.view__header {
  margin-bottom: 2rem;
}

.view__back {
  background: none;
  border: none;
  color: #333;
  cursor: pointer;
  font-size: 1rem;
  padding: 0.5rem 0;
}

.view__back:hover {
  text-decoration: underline;
}

.view__error {
  padding: 2rem;
  text-align: center;
  color: #c00;
}

.detail__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.detail__title {
  margin: 0;
}

.detail__actions {
  display: flex;
  gap: 0.5rem;
}

.detail__button {
  padding: 0.5rem 1rem;
  background-color: #333;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.detail__button:hover {
  background-color: #555;
}

.detail__button--danger {
  background-color: #c00;
}

.detail__button--danger:hover {
  background-color: #900;
}

.detail__subtitle {
  font-style: italic;
  color: #666;
  margin-bottom: 2rem;
}

.detail__section {
  margin-bottom: 2rem;
}

.detail__section h3 {
  margin-top: 0;
  margin-bottom: 1rem;
}

.detail__list {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 0.5rem 1rem;
}

.detail__list dt {
  font-weight: 500;
}

.detail__list dd {
  margin: 0;
}
</style>
