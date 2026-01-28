<script setup lang="ts">
import { ref } from 'vue'
import { booksApi } from '@/api/books'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import ErrorMessage from '@/components/common/ErrorMessage.vue'
import BookMetadataResult from './BookMetadataResult.vue'
import type { MetadataLookupResponse } from '@/types/books'

const identifier = ref('')
const identifierType = ref<'isbn' | 'lccn'>('isbn')
const loading = ref(false)
const error = ref<string | null>(null)
const results = ref<MetadataLookupResponse | null>(null)

async function handleLookup() {
  if (!identifier.value.trim()) {
    error.value = 'Please enter an ISBN or LCCN'
    return
  }

  loading.value = true
  error.value = null
  results.value = null

  const response = await booksApi.lookupMetadata(identifier.value.trim(), identifierType.value)

  loading.value = false

  if (response.error) {
    error.value = response.error.message
  } else if (response.data) {
    results.value = response.data
  }
}

function handleSelect(metadata: any) {
  console.log('Selected metadata:', metadata)
  // Future: emit event to parent component for integration with BookForm
}

function clearError() {
  error.value = null
}
</script>

<template>
  <div class="metadata-lookup">
    <div class="metadata-lookup__form">
      <div class="metadata-lookup__input-group">
        <select v-model="identifierType" class="metadata-lookup__select">
          <option value="isbn">ISBN</option>
          <option value="lccn">LCCN</option>
        </select>

        <input
          v-model="identifier"
          type="text"
          placeholder="Enter ISBN or LCCN"
          class="metadata-lookup__input"
          @keyup.enter="handleLookup"
        />

        <button
          class="metadata-lookup__button"
          @click="handleLookup"
          :disabled="loading"
        >
          {{ loading ? 'Looking up...' : 'Lookup' }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="metadata-lookup__loading">
      <LoadingSpinner size="medium" />
      <p>Searching across all providers...</p>
    </div>

    <ErrorMessage v-if="error" :message="error" @dismiss="clearError" />

    <div v-if="results" class="metadata-lookup__results">
      <h2 class="metadata-lookup__results-title">Results</h2>
      <div class="metadata-lookup__results-grid">
        <BookMetadataResult
          v-for="result in results.results"
          :key="result.provider"
          :result="result"
          @select="handleSelect"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.metadata-lookup {
  max-width: 1200px;
  margin: 0 auto;
}

.metadata-lookup__form {
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: #f9f9f9;
  border-radius: 8px;
}

.metadata-lookup__input-group {
  display: flex;
  gap: 0.5rem;
}

.metadata-lookup__select {
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  background: white;
  cursor: pointer;
}

.metadata-lookup__input {
  flex: 1;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

.metadata-lookup__input:focus {
  outline: none;
  border-color: #333;
}

.metadata-lookup__button {
  padding: 0.75rem 1.5rem;
  background: #333;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  white-space: nowrap;
}

.metadata-lookup__button:hover:not(:disabled) {
  background: #555;
}

.metadata-lookup__button:disabled {
  background: #999;
  cursor: not-allowed;
}

.metadata-lookup__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem;
}

.metadata-lookup__loading p {
  color: #666;
  font-style: italic;
}

.metadata-lookup__results-title {
  margin: 0 0 1rem 0;
  font-size: 1.5rem;
}

.metadata-lookup__results-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 1rem;
}

@media (max-width: 768px) {
  .metadata-lookup__input-group {
    flex-direction: column;
  }

  .metadata-lookup__results-grid {
    grid-template-columns: 1fr;
  }
}
</style>
