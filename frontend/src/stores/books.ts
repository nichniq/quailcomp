import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { booksApi } from '@/api/books'
import type { BookEntry, CreateBookRequest } from '@/types/books'

export const useBooksStore = defineStore('books', () => {
  const books = ref<BookEntry[]>([])
  const currentBook = ref<BookEntry | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const bookCount = computed(() => books.value.length)

  async function fetchBooks(): Promise<void> {
    loading.value = true
    error.value = null

    const result = await booksApi.list()

    if (result.error) {
      error.value = result.error.message
    } else if (result.data) {
      books.value = result.data.books
    }

    loading.value = false
  }

  async function fetchBook(id: number): Promise<void> {
    loading.value = true
    error.value = null

    const result = await booksApi.getById(id)

    if (result.error) {
      error.value = result.error.message
    } else if (result.data) {
      currentBook.value = result.data.book
    }

    loading.value = false
  }

  async function createBook(data: CreateBookRequest): Promise<boolean> {
    loading.value = true
    error.value = null

    const result = await booksApi.create(data)

    if (result.error) {
      error.value = result.error.message
      loading.value = false
      return false
    }

    if (result.data) {
      books.value.push(result.data.book)
    }

    loading.value = false
    return true
  }

  async function updateBook(id: number, data: CreateBookRequest): Promise<boolean> {
    loading.value = true
    error.value = null

    const result = await booksApi.update(id, data)

    if (result.error) {
      error.value = result.error.message
      loading.value = false
      return false
    }

    if (result.data) {
      const index = books.value.findIndex(b => b.entityId === id)
      if (index !== -1) {
        books.value[index] = result.data.book
      }
      if (currentBook.value?.entityId === id) {
        currentBook.value = result.data.book
      }
    }

    loading.value = false
    return true
  }

  async function deleteBook(id: number): Promise<boolean> {
    loading.value = true
    error.value = null

    const result = await booksApi.delete(id)

    if (result.error) {
      error.value = result.error.message
      loading.value = false
      return false
    }

    books.value = books.value.filter(b => b.entityId !== id)
    if (currentBook.value?.entityId === id) {
      currentBook.value = null
    }

    loading.value = false
    return true
  }

  return {
    books,
    currentBook,
    loading,
    error,
    bookCount,
    fetchBooks,
    fetchBook,
    createBook,
    updateBook,
    deleteBook
  }
})
