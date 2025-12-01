<template>
    <div class="config-validator">
        <div v-if="!config" class="text-gray-500 text-sm">
            Load a configuration to validate
        </div>

        <div v-else-if="isValid" class="flex items-center gap-2 text-success-600 text-sm">
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clip-rule="evenodd" />
            </svg>
            <span class="font-medium">Configuration is valid</span>
        </div>

        <div v-else class="space-y-3">
            <div class="flex items-center gap-2 text-error-600 text-sm font-medium">
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clip-rule="evenodd" />
                </svg>
                <span>{{ errors.length }} validation {{ errors.length === 1 ? 'error' : 'errors' }}</span>
            </div>

            <div class="space-y-2">
                <div v-for="(error, index) in errors" :key="index"
                    class="p-3 bg-error-50 border border-error-200 rounded-lg text-sm">
                    <div class="font-medium text-error-800">{{ error.message }}</div>
                    <div v-if="error.path" class="text-error-600 text-xs mt-1">
                        Path: {{ error.path }}
                    </div>
                    <div v-if="error.suggestion" class="text-gray-700 text-xs mt-1">
                        💡 {{ error.suggestion }}
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { FormConfig } from '@/types/formConfig'
import { validateConfig } from '@/utils/configParser'

interface ConfigValidatorProps {
    config: FormConfig | null
}

const props = defineProps<ConfigValidatorProps>()

const validationResult = computed(() => {
    if (!props.config) {
        return { valid: false, errors: [] }
    }
    return validateConfig(props.config)
})

const isValid = computed(() => validationResult.value.valid)
const errors = computed(() => validationResult.value.errors || [])
</script>
