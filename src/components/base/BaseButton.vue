<template>
    <button :type="type" :disabled="disabled || loading" :class="buttonClasses"
        class="inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed">
        <svg v-if="loading" class="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none"
            viewBox="0 0 24 24" aria-hidden="true">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <slot />
    </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { BaseButtonProps } from '@/types/components'

const props = withDefaults(defineProps<BaseButtonProps>(), {
    type: 'button',
    variant: 'primary',
    size: 'md',
    loading: false,
    disabled: false,
})

const buttonClasses = computed(() => {
    const classes = []

    // Size classes
    switch (props.size) {
        case 'sm':
            classes.push('px-3 py-2 text-sm min-h-[44px]')
            break
        case 'lg':
            classes.push('px-6 py-3 text-lg min-h-[44px]')
            break
        default: // md
            classes.push('px-4 py-2.5 text-base min-h-[44px]')
    }

    // Variant classes
    switch (props.variant) {
        case 'primary':
            classes.push('bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500')
            break
        case 'secondary':
            classes.push('bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500')
            break
        case 'danger':
            classes.push('bg-error-600 text-white hover:bg-error-700 focus:ring-error-500')
            break
        case 'ghost':
            classes.push('bg-transparent text-gray-300 hover:bg-gray-100 focus:ring-gray-500')
            break
    }

    return classes.join(' ')
})
</script>
