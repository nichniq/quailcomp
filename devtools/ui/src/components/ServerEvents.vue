<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import type { ServerEvent } from '../types'

const events = ref<ServerEvent[]>([])
const connectionStatus = ref<'connected' | 'disconnected' | 'reconnecting'>('disconnected')
const autoScroll = ref(true)
const filterType = ref<'all' | 'connection' | 'disconnection' | 'message' | 'error'>('all')
const filterEndpoint = ref('')
const eventsContainer = ref<HTMLElement | null>(null)
const expandedEvents = ref<Set<string>>(new Set())
let eventSource: EventSource | null = null

const filteredEvents = computed(() => {
  return events.value.filter((event) => {
    const typeMatch = filterType.value === 'all' || event.type === filterType.value
    const endpointMatch =
      !filterEndpoint.value || event.endpoint.includes(filterEndpoint.value)
    return typeMatch && endpointMatch
  })
})

function connectToEvents() {
  if (eventSource) {
    eventSource.close()
  }

  connectionStatus.value = 'reconnecting'

  eventSource = new EventSource('/api/debug/events')

  eventSource.addEventListener('event', (e) => {
    const serverEvent: ServerEvent = JSON.parse(e.data)
    events.value.push(serverEvent)

    // Keep buffer limited to 500 entries
    if (events.value.length > 500) {
      events.value.shift()
    }

    // Auto-scroll to bottom if enabled
    if (autoScroll.value) {
      nextTick(() => {
        if (eventsContainer.value) {
          eventsContainer.value.scrollTop = eventsContainer.value.scrollHeight
        }
      })
    }
  })

  eventSource.addEventListener('buffer', (e) => {
    const buffer: ServerEvent[] = JSON.parse(e.data)
    events.value = buffer
    connectionStatus.value = 'connected'

    if (autoScroll.value) {
      nextTick(() => {
        if (eventsContainer.value) {
          eventsContainer.value.scrollTop = eventsContainer.value.scrollHeight
        }
      })
    }
  })

  eventSource.addEventListener('open', () => {
    connectionStatus.value = 'connected'
  })

  eventSource.addEventListener('error', () => {
    connectionStatus.value = 'disconnected'
    setTimeout(() => {
      if (eventSource && eventSource.readyState === EventSource.CONNECTING) {
        connectionStatus.value = 'reconnecting'
      }
    }, 100)
  })
}

function clearEvents() {
  events.value = []
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('en-US', { hour12: false })
}

function getTypeClass(type: ServerEvent['type']): string {
  return `event-entry--${type}`
}

function toggleEventExpansion(eventId: string) {
  if (expandedEvents.value.has(eventId)) {
    expandedEvents.value.delete(eventId)
  } else {
    expandedEvents.value.add(eventId)
  }
}

function isExpanded(eventId: string): boolean {
  return expandedEvents.value.has(eventId)
}

function toggleAutoScroll() {
  autoScroll.value = !autoScroll.value
  if (autoScroll.value && eventsContainer.value) {
    eventsContainer.value.scrollTop = eventsContainer.value.scrollHeight
  }
}

onMounted(() => {
  connectToEvents()
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
  name: 'ServerEvents',
}
</script>

<template>
  <div class="server-events">
    <div class="server-events__header">
      <div class="server-events__title">
        <h2>Server Events Monitor</h2>
        <span
          class="server-events__status"
          :class="{
            'server-events__status--connected': connectionStatus === 'connected',
            'server-events__status--disconnected': connectionStatus === 'disconnected',
            'server-events__status--reconnecting': connectionStatus === 'reconnecting',
          }"
        >
          {{ connectionStatus }}
        </span>
      </div>

      <div class="server-events__controls">
        <input
          v-model="filterEndpoint"
          type="text"
          class="server-events__search"
          placeholder="Filter by endpoint..."
        />

        <select v-model="filterType" class="server-events__select">
          <option value="all">All Types</option>
          <option value="connection">Connections</option>
          <option value="disconnection">Disconnections</option>
          <option value="message">Messages</option>
          <option value="error">Errors</option>
        </select>

        <button
          class="server-events__button"
          :class="{ 'server-events__button--active': autoScroll }"
          @click="toggleAutoScroll"
          title="Toggle auto-scroll"
        >
          {{ autoScroll ? '⬇ Auto-scroll' : '⏸ Paused' }}
        </button>

        <button class="server-events__button" @click="clearEvents" title="Clear events">
          Clear
        </button>
      </div>
    </div>

    <div ref="eventsContainer" class="server-events__container">
      <div
        v-for="event in filteredEvents"
        :key="event.id"
        class="event-entry"
        :class="getTypeClass(event.type)"
      >
        <div class="event-entry__header" @click="toggleEventExpansion(event.id)">
          <span class="event-entry__timestamp">{{ formatTimestamp(event.timestamp) }}</span>
          <span class="event-entry__type">{{ event.type.toUpperCase() }}</span>
          <span class="event-entry__endpoint">{{ event.endpoint }}</span>
          <span v-if="event.clientCount !== undefined" class="event-entry__clients">
            {{ event.clientCount }} client{{ event.clientCount !== 1 ? 's' : '' }}
          </span>
          <span v-if="event.message" class="event-entry__message">{{ event.message }}</span>
          <span class="event-entry__expand">
            {{ isExpanded(event.id) ? '▼' : '▶' }}
          </span>
        </div>

        <pre v-if="isExpanded(event.id) && event.payload" class="event-entry__payload">{{
          JSON.stringify(event.payload, null, 2)
        }}</pre>
      </div>

      <div v-if="filteredEvents.length === 0" class="server-events__empty">
        {{ events.length === 0 ? 'No events yet...' : 'No events match filters' }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.server-events {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 200px);
  background: #1e1e1e;
  border-radius: 4px;
  overflow: hidden;
}

.server-events__header {
  background: #2d2d2d;
  padding: 1rem;
  border-bottom: 1px solid #3d3d3d;
}

.server-events__title {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.server-events__title h2 {
  margin: 0;
  font-size: 1.5rem;
  color: #fff;
}

.server-events__status {
  padding: 0.25rem 0.5rem;
  border-radius: 3px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.server-events__status--connected {
  background: #28a745;
  color: white;
}

.server-events__status--disconnected {
  background: #dc3545;
  color: white;
}

.server-events__status--reconnecting {
  background: #ffc107;
  color: #333;
}

.server-events__controls {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.server-events__search {
  flex: 1;
  min-width: 200px;
  padding: 0.5rem;
  border: 1px solid #3d3d3d;
  background: #1e1e1e;
  color: #fff;
  border-radius: 3px;
  font-size: 0.9rem;
}

.server-events__search:focus {
  outline: none;
  border-color: #4a90e2;
}

.server-events__select {
  padding: 0.5rem;
  border: 1px solid #3d3d3d;
  background: #1e1e1e;
  color: #fff;
  border-radius: 3px;
  font-size: 0.9rem;
  cursor: pointer;
}

.server-events__button {
  padding: 0.5rem 1rem;
  border: 1px solid #3d3d3d;
  background: #2d2d2d;
  color: #fff;
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.server-events__button:hover {
  background: #3d3d3d;
}

.server-events__button--active {
  background: #4a90e2;
  border-color: #4a90e2;
}

.server-events__container {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.85rem;
  line-height: 1.5;
}

.event-entry {
  margin-bottom: 0.5rem;
  border: 1px solid #3d3d3d;
  border-radius: 3px;
  overflow: hidden;
}

.event-entry__header {
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem;
  background: #2d2d2d;
  cursor: pointer;
  transition: background 0.2s;
}

.event-entry__header:hover {
  background: #3d3d3d;
}

.event-entry__timestamp {
  color: #888;
  flex-shrink: 0;
}

.event-entry__type {
  font-weight: 600;
  flex-shrink: 0;
  width: 100px;
}

.event-entry--connection .event-entry__type {
  color: #28a745;
}

.event-entry--disconnection .event-entry__type {
  color: #ffc107;
}

.event-entry--message .event-entry__type {
  color: #17a2b8;
}

.event-entry--error .event-entry__type {
  color: #dc3545;
}

.event-entry__endpoint {
  color: #6c757d;
  flex-shrink: 0;
}

.event-entry__clients {
  color: #888;
  flex-shrink: 0;
}

.event-entry__message {
  color: #fff;
  flex: 1;
}

.event-entry__expand {
  color: #888;
  flex-shrink: 0;
  margin-left: auto;
}

.event-entry__payload {
  margin: 0;
  padding: 0.5rem;
  background: #0d0d0d;
  color: #888;
  font-size: 0.8rem;
  overflow-x: auto;
  border-top: 1px solid #3d3d3d;
}

.server-events__empty {
  text-align: center;
  padding: 3rem;
  color: #666;
}
</style>
