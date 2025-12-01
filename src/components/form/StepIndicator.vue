<template>
  <div class="mb-6">
    <div class="flex items-center justify-center gap-2">
      <div
        v-for="(step, index) in steps"
        :key="step.id"
        class="flex items-center"
      >
        <!-- Step circle -->
        <div
          class="flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300"
          :class="getStepClasses(index)"
        >
          <svg
            v-if="index < currentStep"
            class="w-5 h-5 text-white"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fill-rule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clip-rule="evenodd"
            />
          </svg>
          <span v-else class="text-sm font-semibold">
            {{ index + 1 }}
          </span>
        </div>
        
        <!-- Connector line -->
        <div
          v-if="index < steps.length - 1"
          class="w-16 h-0.5 mx-2 transition-colors duration-300"
          :class="index < currentStep ? 'bg-success-600' : 'bg-gray-300'"
        />
      </div>
    </div>
    
    <!-- Step labels -->
    <div class="flex items-center justify-center gap-2 mt-3">
      <div
        v-for="(step, index) in steps"
        :key="`label-${step.id}`"
        class="text-center transition-colors duration-300"
        :class="[
          index === currentStep ? 'text-primary-700 font-semibold' : 'text-gray-500',
          index < steps.length - 1 ? 'mr-14' : ''
        ]"
      >
        <p class="text-sm hidden sm:block">{{ step.title }}</p>
      </div>
    </div>
    
    <!-- Progress text -->
    <p class="text-center text-sm text-gray-600 mt-2">
      Step {{ currentStep + 1 }} of {{ steps.length }}
    </p>
  </div>
</template>

<script setup lang="ts">
import type { StepConfig } from '@/types/formConfig'

interface StepIndicatorProps {
  steps: StepConfig[]
  currentStep: number
}

const props = defineProps<StepIndicatorProps>()

function getStepClasses(index: number) {
  if (index < props.currentStep) {
    // Completed step
    return 'bg-success-600 border-success-600 text-white'
  } else if (index === props.currentStep) {
    // Current step
    return 'bg-primary-600 border-primary-600 text-white'
  } else {
    // Upcoming step
    return 'bg-white border-gray-300 text-gray-500'
  }
}
</script>
