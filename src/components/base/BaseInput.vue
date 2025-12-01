<template>
    <input :id="id" :type="type" :value="modelValue" :placeholder="placeholder" :disabled="disabled"
        :required="required" :aria-invalid="ariaInvalid" :aria-describedby="ariaDescribedby" @input="onInput"
        @blur="onBlur"
        class="w-full px-3 py-2.5 min-h-[44px] text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
        :class="{ 'border-error-500 focus:ring-error-500': ariaInvalid === 'true' }" />
</template>

<script setup lang="ts">
import type { BaseInputProps } from '@/types/components'

withDefaults(defineProps<BaseInputProps>(), {
    type: 'text',
    disabled: false,
    required: false,
})

const emit = defineEmits<{
    'update:modelValue': [value: string]
    blur: []
}>()

const onInput = (event: Event) => {
    const target = event.target as HTMLInputElement
    emit('update:modelValue', target.value)
}

const onBlur = () => {
    emit('blur')
}
</script>
