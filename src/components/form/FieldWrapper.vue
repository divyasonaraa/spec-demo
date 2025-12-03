<template>
    <Transition name="fade" mode="out-in">
        <div v-if="visible" class="mb-4">
            <BaseLabel v-if="label" :text="label" :for="fieldId" :required="required" class="mb-1.5" />

            <slot />

            <p v-if="helpText && !error" :id="`${fieldId}-help`" class="mt-1.5 text-sm text-gray-600">
                {{ helpText }}
            </p>

            <!-- FIX: Show validation error when error is present -->
            <ValidationError v-if="error" :message="error" :aria-live="'polite'" />
        </div>
    </Transition>
</template>

<script setup lang="ts">
import BaseLabel from '@/components/base/BaseLabel.vue'
import ValidationError from '@/components/form/ValidationError.vue'

interface FieldWrapperProps {
    fieldId: string
    label?: string
    helpText?: string
    required?: boolean
    error?: string
    visible?: boolean
}

withDefaults(defineProps<FieldWrapperProps>(), {
    visible: true,
})
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s ease, max-height 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
    max-height: 0;
    overflow: hidden;
}

.fade-enter-to,
.fade-leave-from {
    opacity: 1;
    max-height: 500px;
}
</style>
