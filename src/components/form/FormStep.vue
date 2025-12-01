<template>
  <Transition
    :name="transitionName"
    mode="out-in"
  >
    <div :key="stepId" class="step-content">
      <div v-if="title || description" class="mb-6">
        <h2 v-if="title" class="text-2xl font-bold text-gray-900 mb-2">
          {{ title }}
        </h2>
        <p v-if="description" class="text-gray-600">
          {{ description }}
        </p>
      </div>
      
      <slot />
    </div>
  </Transition>
</template>

<script setup lang="ts">
interface FormStepProps {
  stepId: string
  title?: string
  description?: string
  transitionName?: 'slide-left' | 'slide-right' | 'fade'
}

withDefaults(defineProps<FormStepProps>(), {
  transitionName: 'fade',
})
</script>

<style scoped>
/* Fade transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Slide left transition (forward) */
.slide-left-enter-active,
.slide-left-leave-active {
  transition: all 0.3s ease;
}

.slide-left-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.slide-left-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

/* Slide right transition (backward) */
.slide-right-enter-active,
.slide-right-leave-active {
  transition: all 0.3s ease;
}

.slide-right-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}

.slide-right-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

.step-content {
  min-height: 200px;
}
</style>
