<template>
  <div class="min-h-screen bg-gray-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Header -->
      <div class="mb-8">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-3xl font-bold text-gray-900 mb-2">
              Dynamic Form Generator Demo
            </h1>
            <p class="text-gray-600">
              Configure and preview your dynamic forms in real-time
            </p>
          </div>
          <div class="flex items-center gap-4">
            <router-link
              to="/docs"
              class="text-primary-600 hover:text-primary-700 font-medium"
            >
              📖 Documentation
            </router-link>
            <router-link
              to="/"
              class="text-primary-600 hover:text-primary-700 font-medium"
            >
              ← Back to Home
            </router-link>
          </div>
        </div>
      </div>
      
      <!-- Sample tabs -->
      <div class="mb-6 border-b border-gray-200">
        <nav class="-mb-px flex space-x-8">
          <button
            @click="activeTab = 'basic'"
            :class="[
              'py-4 px-1 border-b-2 font-medium text-sm',
              activeTab === 'basic'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            ]"
          >
            Basic Form
          </button>
          <button
            @click="activeTab = 'multi-step'"
            :class="[
              'py-4 px-1 border-b-2 font-medium text-sm',
              activeTab === 'multi-step'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            ]"
          >
            Multi-Step Form
          </button>
          <button
            @click="activeTab = 'conditional'"
            :class="[
              'py-4 px-1 border-b-2 font-medium text-sm',
              activeTab === 'conditional'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            ]"
          >
            Conditional Form
          </button>
          <button
            @click="activeTab = 'complex'"
            :class="[
              'py-4 px-1 border-b-2 font-medium text-sm',
              activeTab === 'complex'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            ]"
          >
            Complex Form
          </button>
          <button
            @click="activeTab = 'custom'"
            :class="[
              'py-4 px-1 border-b-2 font-medium text-sm',
              activeTab === 'custom'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            ]"
          >
            Custom Config
          </button>
        </nav>
      </div>
      
      <!-- Two-column layout -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <!-- Left: Config Editor -->
        <div class="space-y-6">
          <div class="bg-white rounded-lg shadow-sm p-6">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-xl font-semibold text-gray-900">
                Configuration Editor
              </h2>
              <button
                v-if="currentConfig"
                @click="downloadConfig"
                class="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                ⬇️ Download JSON
              </button>
            </div>
            <ConfigEditor v-model="currentConfig" />
          </div>
          
          <!-- Config Validator -->
          <div class="bg-white rounded-lg shadow-sm p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">
              Configuration Validation
            </h3>
            <ConfigValidator :config="currentConfig" />
          </div>
        </div>
        
        <!-- Right: Form Preview -->
        <div class="bg-white rounded-lg shadow-sm p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-xl font-semibold text-gray-900">
              Form Preview
            </h2>
            <button
              v-if="currentConfig && Object.keys(formValues).length > 0"
              @click="showCurrentPayload"
              class="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              View Payload
            </button>
          </div>
          
          <div v-if="!currentConfig" class="text-center py-12 text-gray-500">
            <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p class="mt-4">Load a configuration to preview the form</p>
          </div>
          
          <FormRenderer
            v-else
            :key="`form-${activeTab}`"
            :config="currentConfig"
            @submit="handleFormSubmit"
            @update:values="handleValuesUpdate"
          />
        </div>
      </div>
    </div>
    
    <!-- Payload Preview Modal -->
    <PayloadPreview
      :show="showPayloadPreview"
      :payload="submittedPayload"
      @close="showPayloadPreview = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { FormConfig } from '@/types/formConfig'
import ConfigEditor from '@/components/demo/ConfigEditor.vue'
import ConfigValidator from '@/components/demo/ConfigValidator.vue'
import FormRenderer from '@/components/form/FormRenderer.vue'
import PayloadPreview from '@/components/payload/PayloadPreview.vue'
import { buildPayload } from '@/utils/payloadBuilder'
import { basicFormConfig as basicForm } from '@/config/samples/basicForm'
import { multiStepForm } from '@/config/samples/multiStepForm'
import { conditionalForm } from '@/config/samples/conditionalForm'
import { complexForm } from '@/config/samples/complexForm'

const activeTab = ref<'basic' | 'multi-step' | 'conditional' | 'complex' | 'custom'>('basic')
const currentConfig = ref<FormConfig | null>(null)
const showPayloadPreview = ref(false)
const submittedPayload = ref<Record<string, any>>({})
const formValues = ref<Record<string, any>>({})

// Watch activeTab and load corresponding config
watch(activeTab, (tab) => {
  switch (tab) {
    case 'basic':
      currentConfig.value = basicForm
      break
    case 'multi-step':
      currentConfig.value = multiStepForm
      break
    case 'conditional':
      currentConfig.value = conditionalForm
      break
    case 'complex':
      currentConfig.value = complexForm
      break
    case 'custom':
      currentConfig.value = null
      break
  }
  // Reset form values when switching tabs
  formValues.value = {}
}, { immediate: true })

/**
 * Handles form submission
 */
function handleFormSubmit(response: any) {
  console.log('Form submitted:', response)
  showPayloadPreview.value = true
}

/**
 * Updates form values for live payload preview
 */
function handleValuesUpdate(values: Record<string, any>) {
  formValues.value = values
  
  // Build payload for preview
  if (currentConfig.value) {
    const allFields = currentConfig.value.steps.flatMap(step => step.fields)
    submittedPayload.value = buildPayload(values, allFields)
  }
}

/**
 * Shows current payload preview
 */
function showCurrentPayload() {
  if (currentConfig.value) {
    const allFields = currentConfig.value.steps.flatMap(step => step.fields)
    submittedPayload.value = buildPayload(formValues.value, allFields)
    showPayloadPreview.value = true
  }
}

/**
 * Downloads the current config as JSON
 */
function downloadConfig() {
  if (!currentConfig.value) return
  
  const dataStr = JSON.stringify(currentConfig.value, null, 2)
  const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr)
  
  const exportFileDefaultName = `${currentConfig.value.id || 'form-config'}.json`
  
  const linkElement = document.createElement('a')
  linkElement.setAttribute('href', dataUri)
  linkElement.setAttribute('download', exportFileDefaultName)
  linkElement.click()
}
</script>

