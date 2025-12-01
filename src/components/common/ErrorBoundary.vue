<template>
    <div v-if="hasError" class="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div class="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            <div class="flex items-center gap-3 mb-4">
                <svg class="w-12 h-12 text-error-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                    <h2 class="text-xl font-bold text-gray-900">Something went wrong</h2>
                    <p class="text-sm text-gray-600 mt-1">An unexpected error occurred</p>
                </div>
            </div>

            <div v-if="error" class="mb-4 p-3 bg-gray-100 rounded border border-gray-300">
                <p class="text-sm font-mono text-gray-800">{{ error.message }}</p>
                <details v-if="error.stack" class="mt-2">
                    <summary class="text-xs text-gray-600 cursor-pointer hover:text-gray-800">
                        View stack trace
                    </summary>
                    <pre class="mt-2 text-xs text-gray-700 overflow-x-auto">{{ error.stack }}</pre>
                </details>
            </div>

            <div class="flex gap-3">
                <button @click="reset"
                    class="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium">
                    Try Again
                </button>
                <button @click="reload"
                    class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium">
                    Reload Page
                </button>
            </div>
        </div>
    </div>
    <slot v-else />
</template>

<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue'

const hasError = ref(false)
const error = ref<Error | null>(null)

onErrorCaptured((err: Error) => {
    hasError.value = true
    error.value = err
    console.error('Error caught by boundary:', err)
    return false // Prevent error from propagating
})

function reset() {
    hasError.value = false
    error.value = null
}

function reload() {
    window.location.reload()
}
</script>
