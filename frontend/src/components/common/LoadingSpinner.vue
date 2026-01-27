<script setup lang="ts">
defineProps<{
  size?: 'small' | 'medium' | 'large'
}>()
</script>

<template>
  <div class="spinner" :class="`spinner--${size || 'medium'}`">
    <div class="spinner__circle"></div>
  </div>
</template>

<style scoped>
.spinner {
  display: inline-block;
}

.spinner--small {
  width: 20px;
  height: 20px;
}

.spinner--medium {
  width: 40px;
  height: 40px;
}

.spinner--large {
  width: 60px;
  height: 60px;
}

.spinner__circle {
  width: 100%;
  height: 100%;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #333;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
