<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'
import RegisterForm from '@/components/auth/RegisterForm.vue'

const authStore = useAuthStore()
const router = useRouter()

async function handleSubmit(data: { email: string; username?: string; password: string }) {
  const success = await authStore.register(data)

  if (success) {
    router.push('/books')
  }
}
</script>

<template>
  <div class="view">
    <RegisterForm
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
