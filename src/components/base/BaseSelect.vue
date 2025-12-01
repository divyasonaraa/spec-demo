<template>
  <div>
    <div class="relative">
      <select
        :id="id"
        :value="modelValue"
        :disabled="disabled || loading"
        :required="required"
        :aria-invalid="ariaInvalid"
        :aria-describedby="ariaDescribedby"
        @change="onChange"
        @blur="onBlur"
        class="w-full px-3 py-2.5 pr-10 min-h-[44px] text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors appearance-none bg-white"
        :class="{ 'border-error-500 focus:ring-error-500': ariaInvalid === 'true' || error }"
      >
        <option value="" disabled>{{ placeholder || 'Select an option' }}</option>
        <option
          v-for="option in options"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </option>
      </select>
      
      <!-- Dropdown arrow icon -->
      <div class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
        <svg
          v-if="!loading"
          class="h-5 w-5 text-gray-400"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fill-rule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clip-rule="evenodd"
          />
        </svg>
        
        <!-- Loading spinner -->
        <svg
          v-else
          class="animate-spin h-5 w-5 text-primary-600"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    </div>
    
    <!-- Data source error message -->
    <p v-if="error" class="mt-1.5 text-sm text-error-600">
      {{ error }}
      <button
        v-if="onRetry"
        @click="onRetry"
        class="ml-2 underline hover:no-underline"
      >
        Retry
      </button>
    </p>
  </div>
</template>

<script setup lang="ts">
import type { BaseSelectProps } from '@/types/components'

withDefaults(defineProps<BaseSelectProps>(), {
  options: () => [],
  disabled: false,
  required: false,
  loading: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
  blur: []
}>()

const onChange = (event: Event) => {
  const target = event.target as HTMLSelectElement
  emit('update:modelValue', target.value)
}

const onBlur = () => {
  emit('blur')
}
</script>
