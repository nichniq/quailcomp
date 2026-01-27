<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  loading?: boolean
  error?: string | null
}>()

const emit = defineEmits<{
  submit: [{ identifier: string; password: string }]
}>()

const identifier = ref('')
const password = ref('')

function handleSubmit() {
  emit('submit', {
    identifier: identifier.value,
    password: password.value
  })
}
</script>

<template>
  <form @submit.prevent="handleSubmit" class="form">
    <h2>Login</h2>

    <div v-if="error" class="form__error">
      {{ error }}
    </div>

    <div class="form__group">
      <label for="identifier" class="form__label">Email or Username</label>
      <input
        id="identifier"
        v-model="identifier"
        type="text"
        class="form__input"
        required
        autocomplete="username"
      />
    </div>

    <div class="form__group">
      <label for="password" class="form__label">Password</label>
      <input
        id="password"
        v-model="password"
        type="password"
        class="form__input"
        required
        autocomplete="current-password"
      />
    </div>

    <button type="submit" class="form__button" :disabled="loading">
      {{ loading ? 'Logging in...' : 'Login' }}
    </button>

    <p class="form__link">
      Don't have an account?
      <RouterLink to="/register">Register</RouterLink>
    </p>
  </form>
</template>

<style scoped>
.form {
  max-width: 400px;
  margin: 0 auto;
  padding: 2rem;
  border: 1px solid #ddd;
  border-radius: 8px;
}

.form h2 {
  margin-top: 0;
  text-align: center;
}

.form__error {
  padding: 12px;
  background-color: #fee;
  border: 1px solid #fcc;
  border-radius: 4px;
  color: #c00;
  margin-bottom: 1rem;
}

.form__group {
  margin-bottom: 1rem;
}

.form__label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.form__input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

.form__button {
  width: 100%;
  padding: 0.75rem;
  background-color: #333;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
}

.form__button:hover:not(:disabled) {
  background-color: #555;
}

.form__button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.form__link {
  text-align: center;
  margin-top: 1rem;
}
</style>
