<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

const authStore = useAuthStore()
const router = useRouter()

function handleLogout() {
  authStore.logout()
  router.push('/login')
}
</script>

<template>
  <header class="header">
    <div class="header__content">
      <h1 class="header__title">Quailcomp</h1>
      <nav class="header__nav" v-if="authStore.isAuthenticated">
        <span class="header__user">{{ authStore.user?.email }}</span>
        <button class="header__logout" @click="handleLogout">Logout</button>
      </nav>
    </div>
  </header>
</template>

<style scoped>
.header {
  background-color: #333;
  color: white;
  padding: 1rem 0;
}

.header__content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header__title {
  margin: 0;
  font-size: 1.5rem;
}

.header__nav {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.header__user {
  font-size: 0.9rem;
}

.header__logout {
  background-color: #555;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
}

.header__logout:hover {
  background-color: #666;
}
</style>
