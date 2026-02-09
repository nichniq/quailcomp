<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import type { LogEntry } from '../types'

const logs = ref<LogEntry[]>([])
const connectionStatus = ref<'connected' | 'disconnected' | 'reconnecting'>('disconnected')
const autoScroll = ref(true)
const filterLevel = ref<'all' | 'info' | 'warn' | 'error' | 'debug'>('all')
const filterText = ref('')
const logsContainer = ref<HTMLElement | null>(null)
let eventSource: EventSource | null = null

const filteredLogs = computed(() => {
  return logs.value.filter((log) => {
    const levelMatch = filterLevel.value === 'all' || log.level === filterLevel.value
    const textMatch =
      !filterText.value ||
      log.message.toLowerCase().includes(filterText.value.toLowerCase()) ||
      log.source.toLowerCase().includes(filterText.value.toLowerCase())
    return levelMatch && textMatch
  })
})

function connectToLogs() {
  if (eventSource) {
    eventSource.close()
  }

  connectionStatus.value = 'reconnecting'

  eventSource = new EventSource('/api/logs/stream')

  eventSource.addEventListener('log', (event) => {
    const logEntry: LogEntry = JSON.parse(event.data)
    logs.value.push(logEntry)

    // Keep buffer limited to 1000 entries
    if (logs.value.length > 1000) {
      logs.value.shift()
    }

    // Auto-scroll to bottom if enabled
    if (autoScroll.value) {
      nextTick(() => {
        if (logsContainer.value) {
          logsContainer.value.scrollTop = logsContainer.value.scrollHeight
        }
      })
    }
  })

  eventSource.addEventListener('buffer', (event) => {
    const buffer: LogEntry[] = JSON.parse(event.data)
    logs.value = buffer
    connectionStatus.value = 'connected'

    if (autoScroll.value) {
      nextTick(() => {
        if (logsContainer.value) {
          logsContainer.value.scrollTop = logsContainer.value.scrollHeight
        }
      })
    }
  })

  eventSource.addEventListener('open', () => {
    connectionStatus.value = 'connected'
  })

  eventSource.addEventListener('error', () => {
    connectionStatus.value = 'disconnected'
    // EventSource will auto-reconnect
    setTimeout(() => {
      if (eventSource && eventSource.readyState === EventSource.CONNECTING) {
        connectionStatus.value = 'reconnecting'
      }
    }, 100)
  })
}

function clearLogs() {
  logs.value = []
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('en-US', { hour12: false })
}

function getLevelClass(level: LogEntry['level']): string {
  return `log-entry--${level}`
}

function toggleAutoScroll() {
  autoScroll.value = !autoScroll.value
  if (autoScroll.value && logsContainer.value) {
    logsContainer.value.scrollTop = logsContainer.value.scrollHeight
  }
}

onMounted(() => {
  connectToLogs()
})

onUnmounted(() => {
  if (eventSource) {
    eventSource.close()
    eventSource = null
  }
})
</script>

<script lang="ts">
import { computed } from 'vue'
export default {
  name: 'ServerLogs',
}
</script>

<template>
  <div class="server-logs">
    <div class="server-logs__header">
      <div class="server-logs__title">
        <h2>Server Logs</h2>
        <span
          class="server-logs__status"
          :class="{
            'server-logs__status--connected': connectionStatus === 'connected',
            'server-logs__status--disconnected': connectionStatus === 'disconnected',
            'server-logs__status--reconnecting': connectionStatus === 'reconnecting',
          }"
        >
          {{ connectionStatus }}
        </span>
      </div>

      <div class="server-logs__controls">
        <input
          v-model="filterText"
          type="text"
          class="server-logs__search"
          placeholder="Filter logs..."
        />

        <select v-model="filterLevel" class="server-logs__select">
          <option value="all">All Levels</option>
          <option value="debug">Debug</option>
          <option value="info">Info</option>
          <option value="warn">Warn</option>
          <option value="error">Error</option>
        </select>

        <button
          class="server-logs__button"
          :class="{ 'server-logs__button--active': autoScroll }"
          @click="toggleAutoScroll"
          title="Toggle auto-scroll"
        >
          {{ autoScroll ? '⬇ Auto-scroll' : '⏸ Paused' }}
        </button>

        <button class="server-logs__button" @click="clearLogs" title="Clear logs">Clear</button>
      </div>
    </div>

    <div ref="logsContainer" class="server-logs__container">
      <div
        v-for="log in filteredLogs"
        :key="log.id"
        class="log-entry"
        :class="getLevelClass(log.level)"
      >
        <span class="log-entry__timestamp">{{ formatTimestamp(log.timestamp) }}</span>
        <span class="log-entry__level">{{ log.level.toUpperCase() }}</span>
        <span class="log-entry__source">{{ log.source }}</span>
        <span class="log-entry__message">{{ log.message }}</span>
        <pre v-if="log.data" class="log-entry__data">{{ JSON.stringify(log.data, null, 2) }}</pre>
      </div>

      <div v-if="filteredLogs.length === 0" class="server-logs__empty">
        {{ logs.length === 0 ? 'No logs yet...' : 'No logs match filters' }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.server-logs {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 200px);
  background: #1e1e1e;
  border-radius: 4px;
  overflow: hidden;
}

.server-logs__header {
  background: #2d2d2d;
  padding: 1rem;
  border-bottom: 1px solid #3d3d3d;
}

.server-logs__title {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.server-logs__title h2 {
  margin: 0;
  font-size: 1.5rem;
  color: #fff;
}

.server-logs__status {
  padding: 0.25rem 0.5rem;
  border-radius: 3px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.server-logs__status--connected {
  background: #28a745;
  color: white;
}

.server-logs__status--disconnected {
  background: #dc3545;
  color: white;
}

.server-logs__status--reconnecting {
  background: #ffc107;
  color: #333;
}

.server-logs__controls {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.server-logs__search {
  flex: 1;
  min-width: 200px;
  padding: 0.5rem;
  border: 1px solid #3d3d3d;
  background: #1e1e1e;
  color: #fff;
  border-radius: 3px;
  font-size: 0.9rem;
}

.server-logs__search:focus {
  outline: none;
  border-color: #4a90e2;
}

.server-logs__select {
  padding: 0.5rem;
  border: 1px solid #3d3d3d;
  background: #1e1e1e;
  color: #fff;
  border-radius: 3px;
  font-size: 0.9rem;
  cursor: pointer;
}

.server-logs__button {
  padding: 0.5rem 1rem;
  border: 1px solid #3d3d3d;
  background: #2d2d2d;
  color: #fff;
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.server-logs__button:hover {
  background: #3d3d3d;
}

.server-logs__button--active {
  background: #4a90e2;
  border-color: #4a90e2;
}

.server-logs__container {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.85rem;
  line-height: 1.5;
}

.log-entry {
  display: flex;
  gap: 0.5rem;
  padding: 0.25rem 0;
  border-bottom: 1px solid #2d2d2d;
}

.log-entry__timestamp {
  color: #888;
  flex-shrink: 0;
}

.log-entry__level {
  font-weight: 600;
  flex-shrink: 0;
  width: 50px;
}

.log-entry--info .log-entry__level {
  color: #17a2b8;
}

.log-entry--warn .log-entry__level {
  color: #ffc107;
}

.log-entry--error .log-entry__level {
  color: #dc3545;
}

.log-entry--debug .log-entry__level {
  color: #6c757d;
}

.log-entry__source {
  color: #6c757d;
  flex-shrink: 0;
}

.log-entry__message {
  color: #fff;
  flex: 1;
}

.log-entry__data {
  flex-basis: 100%;
  margin: 0.5rem 0 0 0;
  padding: 0.5rem;
  background: #0d0d0d;
  border-radius: 3px;
  color: #888;
  font-size: 0.8rem;
  overflow-x: auto;
}

.server-logs__empty {
  text-align: center;
  padding: 3rem;
  color: #666;
}
</style>
