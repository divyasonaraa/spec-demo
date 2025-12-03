<template>
    <Teleport to="body">
        <Transition name="toast">
            <div v-if="show" :class="[
                'fixed z-50 px-6 py-4 rounded-lg shadow-lg max-w-md',
                'flex items-start gap-3',
                positionClass,
                variantClass
            ]" role="alert" aria-live="polite">
                <div class="flex-shrink-0">
                    <svg v-if="variant === 'success'" class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                            clip-rule="evenodd" />
                    </svg>
                    <svg v-else-if="variant === 'error'" class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                            clip-rule="evenodd" />
                    </svg>
                    <svg v-else-if="variant === 'warning'" class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd"
                            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                            clip-rule="evenodd" />
                    </svg>
                    <svg v-else class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                            clip-rule="evenodd" />
                    </svg>
                </div>

                <div class="flex-1 min-w-0">
                    <p v-if="title" class="font-semibold">{{ title }}</p>
                    <p class="text-sm" :class="{ 'mt-1': title }">{{ message }}</p>
                </div>

                <button v-if="dismissible" @click="close" class="flex-shrink-0 ml-2 hover:opacity-70 transition-opacity"
                    aria-label="Close notification">
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd"
                            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                            clip-rule="evenodd" />
                    </svg>
                </button>
            </div>
        </Transition>
    </Teleport>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'

interface ToastProps {
    show: boolean
    message: string
    title?: string
    variant?: 'success' | 'error' | 'warning' | 'info'
    position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center'
    duration?: number
    dismissible?: boolean
}

const props = withDefaults(defineProps<ToastProps>(), {
    variant: 'info',
    position: 'top-right',
    duration: 5000,
    dismissible: true,
})

const emit = defineEmits<{
    close: []
}>()

const variantClass = computed(() => {
    switch (props.variant) {
        case 'success':
            return 'bg-success-50 text-success-800 border border-success-200'
        case 'error':
            return 'bg-error-50 text-error-800 border border-error-200'
        case 'warning':
            return 'bg-warning-50 text-warning-800 border border-warning-200'
        default:
            return 'bg-primary-50 text-primary-800 border border-primary-200'
    }
})

const positionClass = computed(() => {
    switch (props.position) {
        case 'top-left':
            return 'top-4 left-4'
        case 'top-right':
            return 'top-4 right-4'
        case 'bottom-left':
            return 'bottom-4 left-4'
        case 'bottom-right':
            return 'bottom-4 right-4'
        case 'top-center':
            return 'top-4 left-1/2 -translate-x-1/2'
        case 'bottom-center':
            return 'bottom-4 left-1/2 -translate-x-1/2'
        default:
            return 'top-4 right-4'
    }
})

function close() {
    emit('close')
}

// Auto-dismiss after duration
watch(() => props.show, (isShown) => {
    if (isShown && props.duration > 0) {
        setTimeout(() => {
            close()
        }, props.duration)
    }
})
</script>

<style scoped>
.toast-enter-active,
.toast-leave-active {
    transition: all 0.3s ease;
}

.toast-enter-from {
    opacity: 0;
    transform: translateY(-1rem);
}

.toast-leave-to {
    opacity: 0;
    transform: translateY(-1rem);
}
</style>
