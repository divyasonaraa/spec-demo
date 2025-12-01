<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="show"
        class="fixed inset-0 z-50 overflow-y-auto"
        @click.self="closeModal"
      >
        <div class="flex min-h-screen items-center justify-center p-4">
          <!-- Backdrop -->
          <div
            class="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            @click="closeModal"
          />
          
          <!-- Modal content -->
          <div
            ref="modalRef"
            class="relative bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <!-- Header -->
            <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 id="modal-title" class="text-xl font-semibold text-gray-900">
                {{ title }}
              </h2>
              <button
                type="button"
                @click="closeModal"
                class="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close modal"
              >
                <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <!-- Body -->
            <div class="px-6 py-4 overflow-y-auto max-h-[calc(80vh-8rem)]">
              <p v-if="description" class="text-sm text-gray-600 mb-4">
                {{ description }}
              </p>
              
              <JsonDisplay :data="payload" />
            </div>
            
            <!-- Footer -->
            <div class="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
              <BaseButton
                variant="secondary"
                @click="closeModal"
              >
                Close
              </BaseButton>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import JsonDisplay from '@/components/payload/JsonDisplay.vue'
import BaseButton from '@/components/base/BaseButton.vue'

interface PayloadPreviewProps {
  show: boolean
  payload: Record<string, any>
  title?: string
  description?: string
}

const props = withDefaults(defineProps<PayloadPreviewProps>(), {
  title: 'Form Payload Preview',
  description: 'This is the JSON payload that will be submitted to the API endpoint.',
})

const emit = defineEmits<{
  close: []
}>()

const modalRef = ref<HTMLElement | null>(null)
const firstFocusableElement = ref<HTMLElement | null>(null)
const lastFocusableElement = ref<HTMLElement | null>(null)

function closeModal() {
  emit('close')
}

// Keyboard shortcut: Escape to close
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.show) {
    closeModal()
  }
  
  // Focus trap
  if (event.key === 'Tab' && props.show) {
    const focusableElements = modalRef.value?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    
    if (!focusableElements || focusableElements.length === 0) return
    
    const firstElement = focusableElements[0] as HTMLElement
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement
    
    if (event.shiftKey) {
      // Shift + Tab: moving backwards
      if (document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      }
    } else {
      // Tab: moving forwards
      if (document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }
  }
}

// Set initial focus when modal opens
watch(() => props.show, (isShown) => {
  if (isShown) {
    // Focus the close button when modal opens
    setTimeout(() => {
      const closeButton = modalRef.value?.querySelector('button[aria-label="Close modal"]') as HTMLElement
      closeButton?.focus()
    }, 100)
  }
})

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .relative,
.modal-leave-active .relative {
  transition: transform 0.3s ease;
}

.modal-enter-from .relative,
.modal-leave-to .relative {
  transform: scale(0.95);
}
</style>
