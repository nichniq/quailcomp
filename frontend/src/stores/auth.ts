import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/api/auth'
import type { User, LoginRequest, RegisterRequest } from '@/types/auth'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(localStorage.getItem('auth_token'))
  const loading = ref(false)
  const error = ref<string | null>(null)

  const isAuthenticated = computed(() => !!token.value && !!user.value)

  async function register(data: RegisterRequest): Promise<boolean> {
    loading.value = true
    error.value = null

    const result = await authApi.register(data)

    if (result.error) {
      error.value = result.error.message
      loading.value = false
      return false
    }

    if (result.data) {
      token.value = result.data.token
      user.value = result.data.user
      localStorage.setItem('auth_token', result.data.token)
    }

    loading.value = false
    return true
  }

  async function login(data: LoginRequest): Promise<boolean> {
    loading.value = true
    error.value = null

    const result = await authApi.login(data)

    if (result.error) {
      error.value = result.error.message
      loading.value = false
      return false
    }

    if (result.data) {
      token.value = result.data.token
      user.value = result.data.user
      localStorage.setItem('auth_token', result.data.token)
    }

    loading.value = false
    return true
  }

  async function fetchUser(): Promise<void> {
    if (!token.value) return

    const result = await authApi.getMe()

    if (result.data) {
      user.value = result.data.user
    } else {
      logout()
    }
  }

  function logout(): void {
    user.value = null
    token.value = null
    localStorage.removeItem('auth_token')
  }

  if (token.value) {
    fetchUser()
  }

  return {
    user,
    token,
    loading,
    error,
    isAuthenticated,
    register,
    login,
    fetchUser,
    logout
  }
})
