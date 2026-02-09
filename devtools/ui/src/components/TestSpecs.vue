<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { marked } from 'marked'

const specContent = ref<string>('')
const loading = ref(true)
const error = ref<string | null>(null)
const searchQuery = ref('')
const lastModified = ref<Date | null>(null)

// Filtered content based on search
const filteredContent = ref<string>('')

// Rendered HTML from markdown
const renderedHtml = computed(() => {
  if (!filteredContent.value) return ''
  return marked(filteredContent.value)
})

// Load the combined spec file
async function loadSpec() {
  try {
    loading.value = true
    error.value = null

    const response = await fetch('http://localhost:3001/api/specs/combined')
    if (!response.ok) {
      if (response.status === 404) {
        error.value = 'Spec file not found. Run the generator to create it.'
        return
      }
      throw new Error('Failed to load specification')
    }

    specContent.value = await response.text()
    filteredContent.value = specContent.value

    // Get last modified time from header
    const lastModifiedHeader = response.headers.get('X-Last-Modified')
    if (lastModifiedHeader) {
      lastModified.value = new Date(parseInt(lastModifiedHeader, 10))
    }
  } catch (err) {
    error.value = String(err)
  } finally {
    loading.value = false
  }
}

// Filter content based on search query
function filterContent() {
  if (!searchQuery.value.trim()) {
    filteredContent.value = specContent.value
    return
  }

  const query = searchQuery.value.toLowerCase()
  const lines = specContent.value.split('\n')
  const filtered: string[] = []
  let inRelevantSection = false
  let sectionBuffer: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lowerLine = line.toLowerCase()

    // Check if this line matches the search
    if (lowerLine.includes(query)) {
      // Include buffered section header if we have one
      if (sectionBuffer.length > 0) {
        filtered.push(...sectionBuffer)
        sectionBuffer = []
      }
      filtered.push(line)
      inRelevantSection = true
    } else if (line.startsWith('##')) {
      // New section - decide whether to include buffered content
      if (inRelevantSection && sectionBuffer.length > 0) {
        filtered.push(...sectionBuffer)
      }
      sectionBuffer = [line]
      inRelevantSection = false
    } else if (inRelevantSection) {
      filtered.push(line)
    } else {
      sectionBuffer.push(line)
    }
  }

  filteredContent.value = filtered.join('\n')
}

// Refresh spec file
async function refresh() {
  await loadSpec()
}

// Watch search query changes
function onSearchChange() {
  filterContent()
}

onMounted(() => {
  loadSpec()
})
</script>

<template>
  <div class="test-specs">
    <div class="test-specs__header">
      <div>
        <h2>Test Specifications</h2>
        <p v-if="lastModified" class="test-specs__subtitle">
          Last updated: {{ lastModified.toLocaleString() }}
        </p>
      </div>
      <div class="test-specs__actions">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search specs..."
          class="test-specs__search"
          @input="onSearchChange"
        />
        <button @click="refresh" class="test-specs__refresh">Refresh</button>
      </div>
    </div>

    <div v-if="loading" class="test-specs__loading">Loading specification...</div>

    <div v-else-if="error" class="test-specs__error">
      <p>{{ error }}</p>
      <button @click="loadSpec">Retry</button>
    </div>

    <div v-else class="test-specs__viewer">
      <div class="test-specs__viewer-content">
        <div class="test-specs__markdown" v-html="renderedHtml"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.test-specs {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 200px);
}

.test-specs__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
}

.test-specs__header h2 {
  margin: 0 0 0.25rem 0;
  font-size: 1.8rem;
  font-weight: 600;
}

.test-specs__subtitle {
  margin: 0;
  font-size: 0.85rem;
  color: #666;
}

.test-specs__actions {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.test-specs__search {
  padding: 0.5rem 1rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.9rem;
  width: 250px;
}

.test-specs__search:focus {
  outline: none;
  border-color: #4a90e2;
}

.test-specs__refresh {
  padding: 0.5rem 1rem;
  background: #4a90e2;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
}

.test-specs__refresh:hover {
  background: #357abd;
}

.test-specs__loading,
.test-specs__error,
.test-specs__empty {
  text-align: center;
  padding: 3rem 2rem;
  color: #666;
}

.test-specs__error {
  color: #d32f2f;
}

.test-specs__error button {
  margin-top: 1rem;
  padding: 0.5rem 1.5rem;
  background: #d32f2f;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.test-specs__hint {
  margin-top: 1rem;
  font-size: 0.9rem;
  color: #999;
}

.test-specs__hint code {
  background: #f5f5f5;
  padding: 0.2rem 0.4rem;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
}

.test-specs__viewer {
  flex: 1;
  background: white;
  border: 1px solid #ddd;
  border-radius: 6px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.test-specs__viewer-content {
  flex: 1;
  overflow-y: auto;
  padding: 2rem;
}

.test-specs__markdown {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
  font-size: 1rem;
  line-height: 1.6;
  color: #24292e;
  margin: 0;
}

.test-specs__markdown h1 {
  font-size: 2rem;
  font-weight: 600;
  margin: 0 0 1rem 0;
  padding-bottom: 0.3rem;
  border-bottom: 1px solid #eaecef;
}

.test-specs__markdown h2 {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 1.5rem 0 1rem 0;
  padding-bottom: 0.3rem;
  border-bottom: 1px solid #eaecef;
}

.test-specs__markdown h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 1.25rem 0 0.75rem 0;
}

.test-specs__markdown h4 {
  font-size: 1rem;
  font-weight: 600;
  margin: 1rem 0 0.5rem 0;
}

.test-specs__markdown p {
  margin: 0 0 1rem 0;
}

.test-specs__markdown ul,
.test-specs__markdown ol {
  margin: 0 0 1rem 0;
  padding-left: 2rem;
}

.test-specs__markdown li {
  margin: 0.25rem 0;
}

.test-specs__markdown code {
  background: #f6f8fa;
  padding: 0.2rem 0.4rem;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
  font-size: 0.85rem;
}

.test-specs__markdown pre {
  background: #f6f8fa;
  padding: 1rem;
  border-radius: 6px;
  overflow-x: auto;
  margin: 0 0 1rem 0;
}

.test-specs__markdown pre code {
  background: transparent;
  padding: 0;
  font-size: 0.85rem;
}

.test-specs__markdown hr {
  height: 0.25rem;
  padding: 0;
  margin: 1.5rem 0;
  background-color: #e1e4e8;
  border: 0;
}

.test-specs__markdown strong {
  font-weight: 600;
}

.test-specs__no-selection {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: #999;
  font-size: 1.1rem;
}
</style>
