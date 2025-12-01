<template>
  <div class="space-y-2">
    <div
      v-for="option in options"
      :key="option.value"
      class="flex items-center min-h-[44px]"
    >
      <input
        :id="`${id}-${option.value}`"
        type="radio"
        :name="name"
        :value="option.value"
        :checked="modelValue === option.value"
        :disabled="disabled"
        :required="required"
        :aria-invalid="ariaInvalid"
        :aria-describedby="ariaDescribedby"
        @change="onChange(option.value)"
        @blur="onBlur"
        class="h-5 w-5 min-w-[44px] min-h-[44px] text-primary-600 border-gray-300 focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
      />
      <label
        :for="`${id}-${option.value}`"
        class="ml-3 text-base text-gray-700 cursor-pointer select-none"
        :class="{ 'opacity-50': disabled }"
      >
        {{ option.label }}
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { BaseRadioProps } from '@/types/components'

withDefaults(defineProps<BaseRadioProps>(), {
  options: () => [],
  disabled: false,
  required: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
  blur: []
}>()

const onChange = (value: string | number) => {
  emit('update:modelValue', value)
}

const onBlur = () => {
  emit('blur')
}
</script>
