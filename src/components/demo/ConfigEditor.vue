<template>
  <div class="space-y-4">
    <div>
      <label for="config-editor" class="block text-sm font-medium text-gray-700 mb-2">
        Form Configuration (JSON)
      </label>
      <textarea
        id="config-editor"
        v-model="configText"
        @input="handleInput"
        class="w-full h-96 px-3 py-2 font-mono text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        :class="{ 'border-error-500': hasError }"
        placeholder="Paste your JSON configuration here..."
      />
      
      <div v-if="hasError" class="mt-2">
        <ValidationError :message="errorMessage" />
      </div>
      
      <div v-else-if="validationResult" class="mt-2">
        <div v-if="validationResult.valid" class="flex items-center text-success-600">
          <svg class="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
          </svg>
          <span class="text-sm font-medium">Valid configuration</span>
        </div>
        
        <div v-else class="space-y-2">
          <div class="flex items-center text-error-600">
            <svg class="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
            </svg>
            <span class="text-sm font-medium">Configuration errors found</span>
          </div>
          
          <ul class="list-disc list-inside text-sm text-error-700 space-y-1 ml-7">
            <li v-for="error in validationResult.errors" :key="error.field">
              <strong>{{ error.field }}:</strong> {{ error.message }}
            </li>
          </ul>
          
          <ul v-if="validationResult.warnings && validationResult.warnings.length > 0" class="list-disc list-inside text-sm text-yellow-700 space-y-1 ml-7 mt-2">
            <li v-for="warning in validationResult.warnings" :key="warning.field">
              <strong>{{ warning.field }}:</strong> {{ warning.message }}
            </li>
          </ul>
        </div>
      </div>
    </div>
    
    <div class="flex gap-3">
      <BaseButton
        @click="loadSampleConfig"
        variant="secondary"
        size="sm"
      >
        Load Sample
      </BaseButton>
      
      <BaseButton
        @click="formatJson"
        variant="ghost"
        size="sm"
      >
        Format JSON
      </BaseButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { FormConfig } from '@/types/formConfig'
import { validateConfig, type ConfigValidationResult } from '@/utils/configParser'
import ValidationError from '@/components/form/ValidationError.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import { basicFormConfig } from '@/config/samples/basicForm'

interface ConfigEditorProps {
  modelValue?: FormConfig | null
}

const props = defineProps<ConfigEditorProps>()
const emit = defineEmits<{
  'update:modelValue': [config: FormConfig | null]
  'validation-change': [result: ConfigValidationResult]
}>()

const configText = ref('')
const hasError = ref(false)
const errorMessage = ref('')
const validationResult = ref<ConfigValidationResult | null>(null)

// Initialize with provided config
if (props.modelValue) {
  configText.value = JSON.stringify(props.modelValue, null, 2)
}

/**
 * Handles input changes and validates JSON
 */
function handleInput() {
  hasError.value = false
  errorMessage.value = ''
  validationResult.value = null
  
  try {
    const parsed = JSON.parse(configText.value)
    const result = validateConfig(parsed)
    
    validationResult.value = result
    emit('validation-change', result)
    
    if (result.valid) {
      emit('update:modelValue', parsed as FormConfig)
    } else {
      emit('update:modelValue', null)
    }
  } catch (error: any) {
    if (configText.value.trim()) {
      hasError.value = true
      errorMessage.value = `Invalid JSON: ${error.message}`
      emit('update:modelValue', null)
    }
  }
}

/**
 * Loads sample configuration
 */
function loadSampleConfig() {
  configText.value = JSON.stringify(basicFormConfig, null, 2)
  handleInput()
}

/**
 * Formats JSON with proper indentation
 */
function formatJson() {
  try {
    const parsed = JSON.parse(configText.value)
    configText.value = JSON.stringify(parsed, null, 2)
  } catch (error) {
    // Ignore formatting errors
  }
}

// Watch for external config changes
watch(() => props.modelValue, (newConfig) => {
  if (newConfig) {
    configText.value = JSON.stringify(newConfig, null, 2)
  }
})
</script>
