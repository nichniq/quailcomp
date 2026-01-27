<script setup lang="ts">
defineProps<{
  message: string
}>()

defineEmits<{
  dismiss: []
}>()
</script>

<template>
  <div class="error">
    <span class="error__message">{{ message }}</span>
    <button class="error__dismiss" @click="$emit('dismiss')">×</button>
  </div>
</template>

<style scoped>
.error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background-color: #fee;
  border: 1px solid #fcc;
  border-radius: 4px;
  color: #c00;
}

.error__message {
  flex: 1;
}

.error__dismiss {
  background: none;
  border: none;
  font-size: 24px;
  color: #c00;
  cursor: pointer;
  padding: 0 8px;
  line-height: 1;
}

.error__dismiss:hover {
  color: #900;
}
</style>
