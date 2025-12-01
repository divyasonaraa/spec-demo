<template>
  <ErrorBoundary>
    <RouterView />
  </ErrorBoundary>
</template>

<script setup lang="ts">
import { RouterView } from 'vue-router'
import ErrorBoundary from '@/components/common/ErrorBoundary.vue'
</script>
