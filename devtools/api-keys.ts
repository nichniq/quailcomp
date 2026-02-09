/**
 * API Key Management
 * Handles creation, storage, and validation of API keys
 */

import { join } from 'path'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { randomBytes, createHash } from 'crypto'

const STORAGE_DIR = join(import.meta.dir, '../.devtools')
const KEYS_FILE = join(STORAGE_DIR, 'api-keys.json')

interface StoredApiKey {
  id: string
  name: string
  keyHash: string // Hashed key for security
  keyPreview: string // Last 4 characters for display
  createdAt: number
  lastUsedAt?: number
  permissions: string[]
  isActive: boolean
}

interface ApiKeysStorage {
  keys: StoredApiKey[]
}

/**
 * Hash an API key for storage
 */
function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

/**
 * Generate a secure random API key
 */
function generateKey(): string {
  return `qc_${randomBytes(32).toString('hex')}`
}

/**
 * Load API keys from storage
 */
async function loadKeys(): Promise<ApiKeysStorage> {
  try {
    const data = await readFile(KEYS_FILE, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    // File doesn't exist yet, return empty storage
    return { keys: [] }
  }
}

/**
 * Save API keys to storage
 */
async function saveKeys(storage: ApiKeysStorage): Promise<void> {
  // Ensure directory exists
  await mkdir(STORAGE_DIR, { recursive: true })

  await writeFile(KEYS_FILE, JSON.stringify(storage, null, 2), 'utf-8')
}

/**
 * List all API keys (without full key values)
 */
export async function listKeys(): Promise<
  Array<{
    id: string
    name: string
    keyPreview: string
    createdAt: number
    lastUsedAt?: number
    permissions: string[]
    isActive: boolean
  }>
  > {
  const storage = await loadKeys()
  return storage.keys.map(({ keyHash, ...key }) => key)
}

/**
 * Create a new API key
 */
export async function createKey(
  name: string,
  permissions: string[]
): Promise<{ id: string; key: string; name: string; createdAt: number; permissions: string[] }> {
  const storage = await loadKeys()

  const key = generateKey()
  const id = randomBytes(16).toString('hex')
  const keyPreview = key.slice(-4)
  const createdAt = Date.now()

  const storedKey: StoredApiKey = {
    id,
    name,
    keyHash: hashKey(key),
    keyPreview,
    createdAt,
    permissions,
    isActive: true,
  }

  storage.keys.push(storedKey)
  await saveKeys(storage)

  // Return the full key only once
  return {
    id,
    key,
    name,
    createdAt,
    permissions,
  }
}

/**
 * Update an API key's metadata (name, permissions)
 */
export async function updateKey(
  id: string,
  updates: { name?: string; permissions?: string[] }
): Promise<void> {
  const storage = await loadKeys()
  const key = storage.keys.find((k) => k.id === id)

  if (!key) {
    throw new Error('API key not found')
  }

  if (updates.name !== undefined) {
    key.name = updates.name
  }

  if (updates.permissions !== undefined) {
    key.permissions = updates.permissions
  }

  await saveKeys(storage)
}

/**
 * Revoke an API key
 */
export async function revokeKey(id: string): Promise<void> {
  const storage = await loadKeys()
  const key = storage.keys.find((k) => k.id === id)

  if (!key) {
    throw new Error('API key not found')
  }

  key.isActive = false
  await saveKeys(storage)
}

/**
 * Delete an API key permanently
 */
export async function deleteKey(id: string): Promise<void> {
  const storage = await loadKeys()
  storage.keys = storage.keys.filter((k) => k.id !== id)
  await saveKeys(storage)
}

/**
 * Validate an API key
 */
export async function validateKey(key: string): Promise<boolean> {
  const storage = await loadKeys()
  const keyHash = hashKey(key)

  const storedKey = storage.keys.find((k) => k.keyHash === keyHash && k.isActive)

  if (!storedKey) {
    return false
  }

  // Update last used timestamp
  storedKey.lastUsedAt = Date.now()
  await saveKeys(storage)

  return true
}

/**
 * Get key permissions by key value
 */
export async function getKeyPermissions(key: string): Promise<string[] | null> {
  const storage = await loadKeys()
  const keyHash = hashKey(key)

  const storedKey = storage.keys.find((k) => k.keyHash === keyHash && k.isActive)

  return storedKey ? storedKey.permissions : null
}
