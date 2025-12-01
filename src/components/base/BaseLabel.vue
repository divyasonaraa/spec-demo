<template>
  <label
    :for="for"
    class="block text-sm font-medium text-gray-700 mb-1"
  >
    {{ text }}
    <span v-if="required" class="text-error-500" aria-label="required">*</span>
  </label>
</template>

<script setup lang="ts">
import type { BaseLabelProps } from '@/types/components'

defineProps<BaseLabelProps>()
</script>
