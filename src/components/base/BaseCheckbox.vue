<template>
  <div class="flex items-center min-h-[44px]">
    <input
      :id="id"
      type="checkbox"
      :checked="modelValue"
      :disabled="disabled"
      :required="required"
      :aria-invalid="ariaInvalid"
      :aria-describedby="ariaDescribedby"
      @change="onChange"
      @blur="onBlur"
      class="h-5 w-5 min-w-[44px] min-h-[44px] text-primary-600 border-gray-300 rounded focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
    />
    <label
      v-if="label"
      :for="id"
      class="ml-3 text-base text-gray-700 cursor-pointer select-none"
      :class="{ 'opacity-50': disabled }"
    >
      {{ label }}
    </label>
  </div>
</template>

<script setup lang="ts">
import type { BaseCheckboxProps } from '@/types/components'

withDefaults(defineProps<BaseCheckboxProps>(), {
  modelValue: false,
  disabled: false,
  required: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  blur: []
}>()

const onChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.checked)
}

const onBlur = () => {
  emit('blur')
}
</script>
