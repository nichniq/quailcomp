<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import { useRouter, useRoute } from 'vue-router'
import LoginForm from '@/components/auth/LoginForm.vue'

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()

async function handleSubmit(data: { identifier: string; password: string }) {
  const success = await authStore.login(data)

  if (success) {
    const redirect = route.query.redirect as string
    router.push(redirect || '/books')
  }
}
</script>

<template>
  <div class="view">
    <LoginForm
      :loading="authStore.loading"
      :error="authStore.error"
      @submit="handleSubmit"
    />
  </div>
</template>

<style scoped>
.view {
  padding: 2rem;
}
</style>
