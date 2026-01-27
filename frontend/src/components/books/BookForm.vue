<script setup lang="ts">
import { ref, watch } from 'vue'
import type { BookEntry, CreateBookRequest } from '@/types/books'

const props = defineProps<{
  book?: BookEntry
  loading?: boolean
}>()

const emit = defineEmits<{
  submit: [data: CreateBookRequest]
  cancel: []
}>()

const form = ref<CreateBookRequest>({
  title: '',
  subtitle: '',
  author: '',
  isbn10: '',
  isbn13: '',
  note: ''
})

watch(() => props.book, (newBook) => {
  if (newBook) {
    form.value = { ...newBook.data }
  }
}, { immediate: true })

function handleSubmit() {
  emit('submit', form.value)
}
</script>

<template>
  <form @submit.prevent="handleSubmit" class="form">
    <div class="form__group">
      <label for="title" class="form__label">Title</label>
      <input id="title" v-model="form.title" type="text" class="form__input" />
    </div>

    <div class="form__group">
      <label for="subtitle" class="form__label">Subtitle</label>
      <input id="subtitle" v-model="form.subtitle" type="text" class="form__input" />
    </div>

    <div class="form__group">
      <label for="author" class="form__label">Author</label>
      <input id="author" v-model="form.author" type="text" class="form__input" />
    </div>

    <div class="form__row">
      <div class="form__group">
        <label for="isbn10" class="form__label">ISBN-10</label>
        <input id="isbn10" v-model="form.isbn10" type="text" class="form__input" maxlength="10" />
      </div>

      <div class="form__group">
        <label for="isbn13" class="form__label">ISBN-13</label>
        <input id="isbn13" v-model="form.isbn13" type="text" class="form__input" maxlength="13" />
      </div>
    </div>

    <div class="form__group">
      <label for="note" class="form__label">Notes</label>
      <textarea id="note" v-model="form.note" rows="3" class="form__input"></textarea>
    </div>

    <div class="form__actions">
      <button type="button" class="form__button form__button--secondary" @click="emit('cancel')">
        Cancel
      </button>
      <button type="submit" class="form__button" :disabled="loading">
        {{ loading ? 'Saving...' : (book ? 'Update Book' : 'Add Book') }}
      </button>
    </div>
  </form>
</template>

<style scoped>
.form {
  max-width: 600px;
  margin: 0 auto;
}

.form__group {
  margin-bottom: 1rem;
}

.form__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form__label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.form__input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

.form__actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 1.5rem;
}

.form__button {
  padding: 0.75rem 1.5rem;
  background-color: #333;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
}

.form__button:hover:not(:disabled) {
  background-color: #555;
}

.form__button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.form__button--secondary {
  background-color: #ddd;
  color: #333;
}

.form__button--secondary:hover {
  background-color: #ccc;
}
</style>
