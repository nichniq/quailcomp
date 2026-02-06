<script setup lang="ts">
import { ref } from 'vue'
import WatcherStatus from './components/WatcherStatus.vue'

const activeTab = ref('watcher')
const tabs = [
  { id: 'watcher', label: 'Watcher' },
  { id: 'metrics', label: 'Metrics' },
  { id: 'admin', label: 'Admin' },
  { id: 'git', label: 'Git' },
]
</script>

<template>
  <div class="devtools">
    <header class="devtools__header">
      <h1>Quailcomp DevTools</h1>
      <p class="devtools__subtitle">Development tooling and monitoring</p>
    </header>

    <nav class="devtools__tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="['devtools__tab', { 'devtools__tab--active': activeTab === tab.id }]"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </nav>

    <main class="devtools__content">
      <WatcherStatus v-if="activeTab === 'watcher'" />
      <div v-else class="devtools__coming-soon">
        <h2>{{ tabs.find((t) => t.id === activeTab)?.label }}</h2>
        <p>Coming soon...</p>
      </div>
    </main>
  </div>
</template>

<style scoped>
.devtools {
  min-height: 100vh;
  background: #f5f5f5;
  font-family: system-ui, -apple-system, sans-serif;
}

.devtools__header {
  background: #333;
  color: white;
  padding: 1.5rem 2rem;
  border-bottom: 3px solid #555;
}

.devtools__header h1 {
  margin: 0 0 0.5rem 0;
  font-size: 1.8rem;
  font-weight: 600;
}

.devtools__subtitle {
  margin: 0;
  color: #ccc;
  font-size: 0.9rem;
}

.devtools__tabs {
  display: flex;
  background: #fff;
  border-bottom: 1px solid #ddd;
  padding: 0 2rem;
}

.devtools__tab {
  background: transparent;
  border: none;
  padding: 1rem 1.5rem;
  cursor: pointer;
  font-size: 1rem;
  color: #666;
  border-bottom: 3px solid transparent;
  transition: all 0.2s;
}

.devtools__tab:hover {
  color: #333;
  background: #f9f9f9;
}

.devtools__tab--active {
  color: #333;
  border-bottom-color: #4a90e2;
  font-weight: 600;
}

.devtools__content {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
}

.devtools__coming-soon {
  text-align: center;
  padding: 4rem 2rem;
  color: #999;
}

.devtools__coming-soon h2 {
  font-size: 2rem;
  margin: 0 0 1rem 0;
}

.devtools__coming-soon p {
  font-size: 1.2rem;
}
</style>
