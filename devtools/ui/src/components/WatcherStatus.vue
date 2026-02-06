<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import type { WatchRule, TaskExecution, WatcherStateResponse } from '../types'

const rules = ref<WatchRule[]>([])
const executions = ref<TaskExecution[]>([])
const currentlyRunning = ref<Set<string>>(new Set())
const expandedRule = ref<string | null>(null)
const error = ref<string | null>(null)
const loading = ref(true)

let pollInterval: Timer | null = null
let eventSource: EventSource | null = null

// Get status for a rule
function getRuleStatus(rule: WatchRule): 'success' | 'error' | 'warning' | 'idle' | 'running' {
  if (currentlyRunning.value.has(rule.name)) {
    return 'running'
  }

  const lastExecution = getLastExecution(rule.name)
  if (!lastExecution) {
    return 'idle'
  }

  return lastExecution.status
}

// Get status icon
function getStatusIcon(status: string): string {
  switch (status) {
    case 'success':
      return '✓'
    case 'error':
      return '✗'
    case 'warning':
      return '⚠'
    case 'running':
      return '⏳'
    default:
      return '○'
  }
}

// Get last execution for a rule
function getLastExecution(ruleName: string): TaskExecution | null {
  const ruleExecutions = executions.value.filter((e) => e.ruleName === ruleName)
  return ruleExecutions.length > 0 ? ruleExecutions[ruleExecutions.length - 1] : null
}

// Get recent executions for a rule
function getRecentExecutions(ruleName: string): TaskExecution[] {
  return executions.value.filter((e) => e.ruleName === ruleName).slice(-5).reverse()
}

// Format timestamp as relative time
function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  if (seconds > 5) return `${seconds}s ago`
  return 'just now'
}

// Format duration
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

// Fetch status from API
async function fetchStatus() {
  try {
    const res = await fetch('/api/watcher/status')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const data: WatcherStateResponse = await res.json()

    rules.value = data.rules
    executions.value = data.executions
    currentlyRunning.value = new Set(data.currentlyRunning)
    error.value = null
    loading.value = false
  } catch (err) {
    error.value = `Failed to fetch status: ${err}`
    loading.value = false
  }
}

// Connect to SSE for real-time updates
function connectSSE() {
  try {
    eventSource = new EventSource('/api/watcher/events')

    eventSource.onmessage = (event) => {
      try {
        const data: WatcherStateResponse = JSON.parse(event.data)
        rules.value = data.rules
        executions.value = data.executions
        currentlyRunning.value = new Set(data.currentlyRunning)
      } catch (err) {
        console.error('Error parsing SSE data:', err)
      }
    }

    eventSource.onerror = () => {
      console.error('SSE connection error, will retry...')
      eventSource?.close()
      // Retry after 5 seconds
      setTimeout(connectSSE, 5000)
    }
  } catch (err) {
    console.error('Error connecting to SSE:', err)
  }
}

// Manually trigger a rule
async function triggerRule(ruleName: string) {
  try {
    const res = await fetch(`/api/watcher/trigger/${ruleName}`, {
      method: 'POST',
    })

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }
  } catch (err) {
    alert(`Failed to trigger rule: ${err}`)
  }
}

// Toggle expanded state
function toggleExpanded(ruleName: string) {
  expandedRule.value = expandedRule.value === ruleName ? null : ruleName
}

onMounted(() => {
  fetchStatus()
  connectSSE()

  // Poll every 5 seconds as backup
  pollInterval = setInterval(fetchStatus, 5000)
})

onUnmounted(() => {
  if (pollInterval) {
    clearInterval(pollInterval)
  }
  eventSource?.close()
})
</script>

<template>
  <div class="watcher-status">
    <div v-if="loading" class="watcher-status__loading">Loading...</div>

    <div v-else-if="error" class="watcher-status__error">
      {{ error }}
    </div>

    <div v-else class="watcher-status__rules">
      <div v-for="rule in rules" :key="rule.name" class="rule">
        <div class="rule__header" @click="toggleExpanded(rule.name)">
          <span :class="['rule__status', `rule__status--${getRuleStatus(rule)}`]">
            {{ getStatusIcon(getRuleStatus(rule)) }}
          </span>
          <div class="rule__info">
            <h3 class="rule__name">{{ rule.name }}</h3>
            <p class="rule__description">{{ rule.description }}</p>
          </div>
          <div class="rule__actions">
            <button class="rule__trigger" @click.stop="triggerRule(rule.name)">Run</button>
          </div>
        </div>

        <div class="rule__meta">
          <span v-if="getLastExecution(rule.name)">
            Last run: {{ formatRelativeTime(getLastExecution(rule.name)!.timestamp) }}
            ({{ formatDuration(getLastExecution(rule.name)!.duration) }})
          </span>
          <span v-else>Never run</span>
        </div>

        <div v-if="expandedRule === rule.name" class="rule__logs">
          <h4>Recent Executions</h4>
          <div v-if="getRecentExecutions(rule.name).length === 0" class="rule__logs-empty">
            No executions yet
          </div>
          <div
            v-for="(exec, index) in getRecentExecutions(rule.name)"
            :key="index"
            class="rule__execution"
          >
            <div class="rule__execution-header">
              <span :class="['rule__execution-status', `rule__execution-status--${exec.status}`]">
                {{ getStatusIcon(exec.status) }}
              </span>
              <span class="rule__execution-time">
                {{ formatRelativeTime(exec.timestamp) }}
                ({{ formatDuration(exec.duration) }})
              </span>
            </div>
            <pre v-if="exec.stdout" class="rule__execution-output">{{ exec.stdout }}</pre>
            <pre
              v-if="exec.stderr"
              :class="['rule__execution-output', 'rule__execution-output--error']"
              >{{ exec.stderr }}</pre
            >
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.watcher-status {
  max-width: 1200px;
  margin: 0 auto;
}

.watcher-status__loading,
.watcher-status__error {
  text-align: center;
  padding: 3rem;
  font-size: 1.1rem;
}

.watcher-status__error {
  color: #d32f2f;
  background: #ffebee;
  border-radius: 4px;
}

.watcher-status__rules {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.rule {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.rule__header {
  display: flex;
  align-items: center;
  padding: 1.5rem;
  cursor: pointer;
  transition: background 0.2s;
}

.rule__header:hover {
  background: #f9f9f9;
}

.rule__status {
  font-size: 1.5rem;
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  flex-shrink: 0;
}

.rule__status--success {
  background: #e8f5e9;
  color: #2e7d32;
}

.rule__status--error {
  background: #ffebee;
  color: #c62828;
}

.rule__status--warning {
  background: #fff3e0;
  color: #ef6c00;
}

.rule__status--running {
  background: #e3f2fd;
  color: #1976d2;
}

.rule__status--idle {
  background: #f5f5f5;
  color: #999;
}

.rule__info {
  flex: 1;
  margin-left: 1rem;
}

.rule__name {
  margin: 0 0 0.25rem 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #333;
}

.rule__description {
  margin: 0;
  color: #666;
  font-size: 0.9rem;
}

.rule__actions {
  display: flex;
  gap: 0.5rem;
}

.rule__trigger {
  background: #4a90e2;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.2s;
}

.rule__trigger:hover {
  background: #357abd;
}

.rule__meta {
  padding: 0 1.5rem 1rem 5rem;
  color: #999;
  font-size: 0.85rem;
}

.rule__logs {
  border-top: 1px solid #eee;
  padding: 1.5rem;
  background: #fafafa;
}

.rule__logs h4 {
  margin: 0 0 1rem 0;
  font-size: 0.9rem;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
}

.rule__logs-empty {
  color: #999;
  font-style: italic;
  padding: 1rem;
  text-align: center;
}

.rule__execution {
  background: white;
  border-radius: 4px;
  padding: 1rem;
  margin-bottom: 0.75rem;
}

.rule__execution:last-child {
  margin-bottom: 0;
}

.rule__execution-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  font-size: 0.85rem;
  color: #666;
}

.rule__execution-status {
  font-size: 1rem;
}

.rule__execution-status--success {
  color: #2e7d32;
}

.rule__execution-status--error {
  color: #c62828;
}

.rule__execution-status--warning {
  color: #ef6c00;
}

.rule__execution-output {
  margin: 0;
  padding: 0.75rem;
  background: #f5f5f5;
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.8rem;
  overflow-x: auto;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.rule__execution-output--error {
  background: #fff5f5;
  color: #c62828;
}
</style>
