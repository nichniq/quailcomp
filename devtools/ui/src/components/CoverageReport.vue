<script setup lang="ts">
import { ref, onMounted } from 'vue'

const loading = ref(true)
const generating = ref(false)
const error = ref<string | null>(null)
const coverageHtml = ref<string>('')
const lastModified = ref<Date | null>(null)

async function loadCoverage() {
  loading.value = true
  error.value = null

  try {
    const response = await fetch('/api/coverage')

    if (!response.ok) {
      if (response.status === 404) {
        const data = await response.json()
        error.value = data.error || 'Coverage report not found'
      } else {
        error.value = `Failed to load coverage: HTTP ${response.status}`
      }
      loading.value = false
      return
    }

    coverageHtml.value = await response.text()

    const lastModifiedHeader = response.headers.get('X-Last-Modified')
    if (lastModifiedHeader) {
      lastModified.value = new Date(parseInt(lastModifiedHeader, 10))
    }

    error.value = null
  } catch (err) {
    error.value = `Failed to load coverage: ${err}`
  } finally {
    loading.value = false
  }
}

async function generateCoverage() {
  generating.value = true
  error.value = null

  try {
    const response = await fetch('/api/coverage/generate', { method: 'POST' })
    const data = await response.json()

    if (!response.ok || !data.success) {
      error.value = data.error || 'Failed to generate coverage'
      generating.value = false
      return
    }

    // Reload coverage after generation
    await loadCoverage()
  } catch (err) {
    error.value = `Failed to generate coverage: ${err}`
  } finally {
    generating.value = false
  }
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

onMounted(() => {
  loadCoverage()
})
</script>

<template>
  <div class="coverage-report">
    <div class="coverage-report__header">
      <div class="coverage-report__title">
        <h2>Test Coverage Report</h2>
        <p v-if="lastModified" class="coverage-report__last-modified">
          Last generated: {{ formatDate(lastModified) }}
        </p>
      </div>

      <div class="coverage-report__actions">
        <button
          class="coverage-report__button coverage-report__button--refresh"
          :disabled="loading || generating"
          @click="loadCoverage"
        >
          {{ loading ? 'Loading...' : 'Refresh' }}
        </button>
        <button
          class="coverage-report__button coverage-report__button--generate"
          :disabled="loading || generating"
          @click="generateCoverage"
        >
          {{ generating ? 'Generating...' : 'Generate Coverage' }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="coverage-report__loading">
      Loading coverage report...
    </div>

    <div v-else-if="error" class="coverage-report__error">
      <p>{{ error }}</p>
      <button class="coverage-report__button" @click="generateCoverage" :disabled="generating">
        {{ generating ? 'Generating...' : 'Generate Now' }}
      </button>
    </div>

    <div v-else-if="coverageHtml" class="coverage-report__content">
      <iframe
        :srcdoc="coverageHtml"
        class="coverage-report__iframe"
        sandbox="allow-scripts allow-same-origin"
        title="Coverage Report"
      />
    </div>
  </div>
</template>

<style scoped>
.coverage-report {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 200px);
}

.coverage-report__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #ddd;
}

.coverage-report__title h2 {
  margin: 0 0 0.5rem 0;
  font-size: 1.5rem;
  color: #333;
}

.coverage-report__last-modified {
  margin: 0;
  font-size: 0.9rem;
  color: #666;
}

.coverage-report__actions {
  display: flex;
  gap: 0.5rem;
}

.coverage-report__button {
  padding: 0.5rem 1rem;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.coverage-report__button:hover:not(:disabled) {
  background: #f5f5f5;
  border-color: #999;
}

.coverage-report__button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.coverage-report__button--generate {
  background: #4a90e2;
  color: white;
  border-color: #4a90e2;
}

.coverage-report__button--generate:hover:not(:disabled) {
  background: #357abd;
  border-color: #357abd;
}

.coverage-report__button--refresh {
  background: white;
  color: #333;
}

.coverage-report__loading,
.coverage-report__error {
  text-align: center;
  padding: 3rem;
  color: #666;
}

.coverage-report__error {
  color: #d9534f;
}

.coverage-report__error p {
  margin-bottom: 1rem;
}

.coverage-report__content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.coverage-report__iframe {
  flex: 1;
  width: 100%;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
}
</style>
