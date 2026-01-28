<script setup lang="ts">
import type { MetadataProviderResult } from '@/types/books'

defineProps<{
  result: MetadataProviderResult
}>()

defineEmits<{
  select: [data: any]
}>()

function getProviderName(provider: string): string {
  const names: Record<string, string> = {
    'google-books': 'Google Books',
    'open-library': 'OpenLibrary',
    'library-of-congress': 'Library of Congress',
    'hardcover': 'Hardcover',
    'worldcat-classify': 'WorldCat Classify'
  }
  return names[provider] || provider
}
</script>

<template>
  <div class="metadata-result">
    <div class="metadata-result__header">
      <h3 class="metadata-result__provider">{{ getProviderName(result.provider) }}</h3>
      <span class="metadata-result__time">{{ result.responseTime }}ms</span>
    </div>

    <div v-if="result.error" class="metadata-result__error">
      <p>Error: {{ result.error }}</p>
    </div>

    <div v-else-if="!result.data" class="metadata-result__not-found">
      <p>Not found</p>
    </div>

    <div v-else class="metadata-result__content">
      <div v-if="result.data.thumbnailUrl" class="metadata-result__thumbnail">
        <img :src="result.data.thumbnailUrl" :alt="result.data.title" />
      </div>

      <div class="metadata-result__details">
        <h4 class="metadata-result__title">{{ result.data.title }}</h4>
        <p v-if="result.data.subtitle" class="metadata-result__subtitle">{{ result.data.subtitle }}</p>

        <p v-if="result.data.authors.length > 0" class="metadata-result__authors">
          by {{ result.data.authors.join(', ') }}
        </p>

        <div class="metadata-result__meta">
          <div v-if="result.data.publisher || result.data.publishedDate" class="metadata-result__publication">
            <span v-if="result.data.publisher">{{ result.data.publisher }}</span>
            <span v-if="result.data.publishedDate">({{ result.data.publishedDate }})</span>
          </div>

          <div class="metadata-result__identifiers">
            <span v-if="result.data.isbn10" class="metadata-result__isbn">ISBN-10: {{ result.data.isbn10 }}</span>
            <span v-if="result.data.isbn13" class="metadata-result__isbn">ISBN-13: {{ result.data.isbn13 }}</span>
            <span v-if="result.data.lccn" class="metadata-result__lccn">LCCN: {{ result.data.lccn }}</span>
          </div>

          <div v-if="result.data.pageCount" class="metadata-result__pages">
            {{ result.data.pageCount }} pages
          </div>

          <div v-if="result.data.language" class="metadata-result__language">
            Language: {{ result.data.language }}
          </div>
        </div>

        <p v-if="result.data.description" class="metadata-result__description">
          {{ result.data.description }}
        </p>

        <div v-if="result.data.subjects && result.data.subjects.length > 0" class="metadata-result__subjects">
          <strong>Subjects:</strong>
          <span v-for="subject in result.data.subjects" :key="subject" class="metadata-result__subject">
            {{ subject }}
          </span>
        </div>

        <button class="metadata-result__select-button" @click="$emit('select', result.data)">
          Use This
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.metadata-result {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 1rem;
  background: white;
}

.metadata-result__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #eee;
}

.metadata-result__provider {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.metadata-result__time {
  font-size: 0.875rem;
  color: #666;
  background: #f5f5f5;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.metadata-result__error {
  padding: 1rem;
  background: #fee;
  border-left: 4px solid #c33;
  color: #c33;
}

.metadata-result__not-found {
  padding: 1rem;
  background: #f5f5f5;
  color: #666;
  text-align: center;
  font-style: italic;
}

.metadata-result__content {
  display: flex;
  gap: 1rem;
}

.metadata-result__thumbnail {
  flex-shrink: 0;
}

.metadata-result__thumbnail img {
  width: 120px;
  height: auto;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.metadata-result__details {
  flex: 1;
  min-width: 0;
}

.metadata-result__title {
  margin: 0 0 0.5rem 0;
  font-size: 1.125rem;
  font-weight: 600;
}

.metadata-result__subtitle {
  margin: 0 0 0.5rem 0;
  font-style: italic;
  color: #666;
}

.metadata-result__authors {
  margin: 0 0 1rem 0;
  color: #333;
}

.metadata-result__meta {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
  font-size: 0.875rem;
  color: #666;
}

.metadata-result__identifiers {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.metadata-result__isbn,
.metadata-result__lccn {
  font-family: monospace;
}

.metadata-result__description {
  margin: 1rem 0;
  font-size: 0.9rem;
  line-height: 1.5;
  color: #333;
}

.metadata-result__subjects {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1rem;
  font-size: 0.875rem;
}

.metadata-result__subject {
  background: #e3f2fd;
  color: #1565c0;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.metadata-result__select-button {
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  background: #333;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
}

.metadata-result__select-button:hover {
  background: #555;
}
</style>
