<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { ApiKey, ApiKeyCreateRequest, ApiKeyCreateResponse } from '../types'

const keys = ref<ApiKey[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const showCreateModal = ref(false)
const newKeyName = ref('')
const newKeyPermissions = ref<string[]>([])
const createdKey = ref<ApiKeyCreateResponse | null>(null)
const editingKey = ref<ApiKey | null>(null)

const availablePermissions = [
  { value: 'read', label: 'Read' },
  { value: 'write', label: 'Write' },
  { value: 'admin', label: 'Admin' },
  { value: 'api', label: 'API Access' },
]

async function loadKeys() {
  loading.value = true
  error.value = null

  try {
    const response = await fetch('/api/keys')
    if (!response.ok) {
      throw new Error(`Failed to load keys: HTTP ${response.status}`)
    }

    keys.value = await response.json()
  } catch (err) {
    error.value = String(err)
  } finally {
    loading.value = false
  }
}

function openCreateModal() {
  showCreateModal.value = true
  newKeyName.value = ''
  newKeyPermissions.value = []
  createdKey.value = null
  error.value = null
}

function closeCreateModal() {
  showCreateModal.value = false
  newKeyName.value = ''
  newKeyPermissions.value = []
  createdKey.value = null
}

async function createKey() {
  if (!newKeyName.value.trim()) {
    error.value = 'Key name is required'
    return
  }

  try {
    const payload: ApiKeyCreateRequest = {
      name: newKeyName.value.trim(),
      permissions: newKeyPermissions.value,
    }

    const response = await fetch('/api/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || `Failed to create key: HTTP ${response.status}`)
    }

    createdKey.value = await response.json()
    await loadKeys()
  } catch (err) {
    error.value = String(err)
  }
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch (err) {
    error.value = 'Failed to copy to clipboard'
  }
}

async function revokeKey(id: string) {
  if (!confirm('Are you sure you want to revoke this key? It will no longer work.')) {
    return
  }

  try {
    const response = await fetch(`/api/keys/${id}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || `Failed to revoke key: HTTP ${response.status}`)
    }

    await loadKeys()
  } catch (err) {
    error.value = String(err)
  }
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp))
}

function togglePermission(permission: string) {
  const index = newKeyPermissions.value.indexOf(permission)
  if (index > -1) {
    newKeyPermissions.value.splice(index, 1)
  } else {
    newKeyPermissions.value.push(permission)
  }
}

function openEditModal(key: ApiKey) {
  editingKey.value = { ...key }
  error.value = null
}

function closeEditModal() {
  editingKey.value = null
}

async function saveKeyEdit() {
  if (!editingKey.value) return

  if (!editingKey.value.name.trim()) {
    error.value = 'Key name is required'
    return
  }

  try {
    const response = await fetch(`/api/keys/${editingKey.value.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editingKey.value.name.trim(),
        permissions: editingKey.value.permissions,
      }),
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || `Failed to update key: HTTP ${response.status}`)
    }

    await loadKeys()
    closeEditModal()
  } catch (err) {
    error.value = String(err)
  }
}

function toggleEditPermission(permission: string) {
  if (!editingKey.value) return

  const index = editingKey.value.permissions.indexOf(permission)
  if (index > -1) {
    editingKey.value.permissions.splice(index, 1)
  } else {
    editingKey.value.permissions.push(permission)
  }
}

onMounted(() => {
  loadKeys()
})
</script>

<template>
  <div class="api-keys">
    <div class="api-keys__header">
      <div class="api-keys__title">
        <h2>API Key Management</h2>
        <p class="api-keys__subtitle">Create and manage API keys for external access</p>
      </div>

      <button class="api-keys__button api-keys__button--primary" @click="openCreateModal">
        + Create New Key
      </button>
    </div>

    <div v-if="loading" class="api-keys__loading">Loading API keys...</div>

    <div v-else-if="error && keys.length === 0" class="api-keys__error">
      <p>{{ error }}</p>
      <button class="api-keys__button" @click="loadKeys">Retry</button>
    </div>

    <div v-else class="api-keys__content">
      <table v-if="keys.length > 0" class="api-keys__table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Key Preview</th>
            <th>Created</th>
            <th>Last Used</th>
            <th>Permissions</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="key in keys" :key="key.id" :class="{ 'api-keys__row--revoked': !key.isActive }">
            <td class="api-keys__name">{{ key.name }}</td>
            <td class="api-keys__preview">***{{ key.keyPreview }}</td>
            <td>{{ formatDate(key.createdAt) }}</td>
            <td>{{ key.lastUsedAt ? formatDate(key.lastUsedAt) : 'Never' }}</td>
            <td>
              <span v-if="key.permissions.length === 0" class="api-keys__permissions--empty">
                None
              </span>
              <span v-else class="api-keys__permissions">
                {{ key.permissions.join(', ') }}
              </span>
            </td>
            <td>
              <span
                class="api-keys__status"
                :class="{
                  'api-keys__status--active': key.isActive,
                  'api-keys__status--revoked': !key.isActive,
                }"
              >
                {{ key.isActive ? 'Active' : 'Revoked' }}
              </span>
            </td>
            <td class="api-keys__actions">
              <button
                v-if="key.isActive"
                class="api-keys__action-button"
                @click="openEditModal(key)"
                title="Edit key"
              >
                Edit
              </button>
              <button
                v-if="key.isActive"
                class="api-keys__action-button api-keys__action-button--danger"
                @click="revokeKey(key.id)"
                title="Revoke key"
              >
                Revoke
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-else class="api-keys__empty">
        <p>No API keys created yet</p>
        <button class="api-keys__button api-keys__button--primary" @click="openCreateModal">
          Create Your First Key
        </button>
      </div>
    </div>

    <!-- Create Modal -->
    <div v-if="showCreateModal" class="api-keys__modal" @click.self="closeCreateModal">
      <div class="api-keys__modal-content">
        <div class="api-keys__modal-header">
          <h3>{{ createdKey ? 'API Key Created' : 'Create New API Key' }}</h3>
          <button class="api-keys__modal-close" @click="closeCreateModal">&times;</button>
        </div>

        <div v-if="createdKey" class="api-keys__modal-body">
          <div class="api-keys__success">
            <p class="api-keys__success-title">✓ API Key Created Successfully</p>
            <p class="api-keys__warning">
              ⚠️ <strong>Save this key now!</strong> You won't be able to see it again.
            </p>

            <div class="api-keys__key-display">
              <code>{{ createdKey.key }}</code>
              <button class="api-keys__copy-button" @click="copyToClipboard(createdKey.key)">
                Copy
              </button>
            </div>

            <div class="api-keys__key-info">
              <p><strong>Name:</strong> {{ createdKey.name }}</p>
              <p><strong>Permissions:</strong> {{ createdKey.permissions.join(', ') || 'None' }}</p>
            </div>
          </div>

          <button class="api-keys__button api-keys__button--primary" @click="closeCreateModal">
            Done
          </button>
        </div>

        <div v-else class="api-keys__modal-body">
          <div v-if="error" class="api-keys__error-banner">{{ error }}</div>

          <div class="api-keys__form-group">
            <label>Key Name *</label>
            <input
              v-model="newKeyName"
              type="text"
              class="api-keys__input"
              placeholder="e.g., Production API Key"
              @keyup.enter="createKey"
            />
          </div>

          <div class="api-keys__form-group">
            <label>Permissions</label>
            <div class="api-keys__checkboxes">
              <label
                v-for="perm in availablePermissions"
                :key="perm.value"
                class="api-keys__checkbox"
              >
                <input
                  type="checkbox"
                  :value="perm.value"
                  :checked="newKeyPermissions.includes(perm.value)"
                  @change="togglePermission(perm.value)"
                />
                {{ perm.label }}
              </label>
            </div>
          </div>

          <div class="api-keys__modal-actions">
            <button class="api-keys__button" @click="closeCreateModal">Cancel</button>
            <button class="api-keys__button api-keys__button--primary" @click="createKey">
              Create Key
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Modal -->
    <div v-if="editingKey" class="api-keys__modal" @click.self="closeEditModal">
      <div class="api-keys__modal-content">
        <div class="api-keys__modal-header">
          <h3>Edit API Key</h3>
          <button class="api-keys__modal-close" @click="closeEditModal">&times;</button>
        </div>

        <div class="api-keys__modal-body">
          <div v-if="error" class="api-keys__error-banner">{{ error }}</div>

          <div class="api-keys__form-group">
            <label>Key Name *</label>
            <input
              v-model="editingKey.name"
              type="text"
              class="api-keys__input"
              placeholder="e.g., Production API Key"
            />
          </div>

          <div class="api-keys__form-group">
            <label>Permissions</label>
            <div class="api-keys__checkboxes">
              <label
                v-for="perm in availablePermissions"
                :key="perm.value"
                class="api-keys__checkbox"
              >
                <input
                  type="checkbox"
                  :value="perm.value"
                  :checked="editingKey.permissions.includes(perm.value)"
                  @change="toggleEditPermission(perm.value)"
                />
                {{ perm.label }}
              </label>
            </div>
          </div>

          <div class="api-keys__modal-actions">
            <button class="api-keys__button" @click="closeEditModal">Cancel</button>
            <button class="api-keys__button api-keys__button--primary" @click="saveKeyEdit">
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.api-keys {
  max-width: 1200px;
}

.api-keys__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #ddd;
}

.api-keys__title h2 {
  margin: 0 0 0.5rem 0;
  font-size: 1.5rem;
  color: #333;
}

.api-keys__subtitle {
  margin: 0;
  font-size: 0.9rem;
  color: #666;
}

.api-keys__button {
  padding: 0.5rem 1rem;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.api-keys__button:hover {
  background: #f5f5f5;
  border-color: #999;
}

.api-keys__button--primary {
  background: #4a90e2;
  color: white;
  border-color: #4a90e2;
}

.api-keys__button--primary:hover {
  background: #357abd;
  border-color: #357abd;
}

.api-keys__loading,
.api-keys__error {
  text-align: center;
  padding: 3rem;
  color: #666;
}

.api-keys__error {
  color: #d9534f;
}

.api-keys__table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  border-radius: 4px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.api-keys__table th {
  background: #f5f5f5;
  padding: 1rem;
  text-align: left;
  font-weight: 600;
  color: #333;
  border-bottom: 2px solid #ddd;
}

.api-keys__table td {
  padding: 1rem;
  border-bottom: 1px solid #eee;
}

.api-keys__row--revoked {
  opacity: 0.6;
}

.api-keys__name {
  font-weight: 500;
}

.api-keys__preview {
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.9rem;
  color: #666;
}

.api-keys__permissions {
  font-size: 0.85rem;
  color: #666;
}

.api-keys__permissions--empty {
  font-size: 0.85rem;
  color: #999;
  font-style: italic;
}

.api-keys__status {
  padding: 0.25rem 0.5rem;
  border-radius: 3px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.api-keys__status--active {
  background: #28a745;
  color: white;
}

.api-keys__status--revoked {
  background: #6c757d;
  color: white;
}

.api-keys__actions {
  display: flex;
  gap: 0.5rem;
}

.api-keys__action-button {
  padding: 0.25rem 0.75rem;
  border: 1px solid #ddd;
  background: white;
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.2s;
}

.api-keys__action-button:hover {
  background: #f5f5f5;
}

.api-keys__action-button--danger {
  color: #d9534f;
  border-color: #d9534f;
}

.api-keys__action-button--danger:hover {
  background: #d9534f;
  color: white;
}

.api-keys__empty {
  text-align: center;
  padding: 4rem 2rem;
  background: white;
  border-radius: 4px;
  color: #666;
}

.api-keys__empty p {
  margin-bottom: 1rem;
}

.api-keys__modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.api-keys__modal-content {
  background: white;
  border-radius: 8px;
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.api-keys__modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #ddd;
}

.api-keys__modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
}

.api-keys__modal-close {
  background: none;
  border: none;
  font-size: 2rem;
  cursor: pointer;
  color: #999;
  line-height: 1;
  padding: 0;
  width: 2rem;
  height: 2rem;
}

.api-keys__modal-close:hover {
  color: #333;
}

.api-keys__modal-body {
  padding: 1.5rem;
}

.api-keys__form-group {
  margin-bottom: 1.5rem;
}

.api-keys__form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #333;
}

.api-keys__input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

.api-keys__input:focus {
  outline: none;
  border-color: #4a90e2;
}

.api-keys__checkboxes {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.api-keys__checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.api-keys__checkbox input {
  cursor: pointer;
}

.api-keys__modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1.5rem;
}

.api-keys__success {
  margin-bottom: 1.5rem;
}

.api-keys__success-title {
  color: #28a745;
  font-weight: 600;
  font-size: 1.1rem;
  margin-bottom: 1rem;
}

.api-keys__warning {
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 4px;
  padding: 1rem;
  margin-bottom: 1rem;
  color: #856404;
}

.api-keys__key-display {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.api-keys__key-display code {
  flex: 1;
  padding: 0.75rem;
  background: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.9rem;
  word-break: break-all;
}

.api-keys__copy-button {
  padding: 0.75rem 1rem;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.api-keys__copy-button:hover {
  background: #f5f5f5;
}

.api-keys__key-info {
  background: #f9f9f9;
  padding: 1rem;
  border-radius: 4px;
  font-size: 0.9rem;
}

.api-keys__key-info p {
  margin: 0.5rem 0;
}

.api-keys__error-banner {
  background: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
  padding: 1rem;
  margin-bottom: 1rem;
  color: #721c24;
}
</style>
