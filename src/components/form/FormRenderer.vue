<template>
    <form @submit.prevent="handleSubmit" class="space-y-6">
        <!-- Step indicator for multi-step forms -->
        <StepIndicator v-if="isMultiStep" :steps="formConfig.steps" :current-step="formState.currentStep || 0" />

        <!-- Form step wrapper with transitions -->
        <FormStep v-if="currentStepConfig" :step-id="currentStepConfig.id"
            :title="isMultiStep ? currentStepConfig.title : undefined" :description="currentStepConfig.description"
            :transition-name="transitionDirection">
            <div v-for="field in currentStepFields" :key="field.name" class="mb-6">
                <FieldWrapper :field-id="`field-${field.name}`" :label="field.label" :help-text="field.helpText"
                    :required="field.validation?.required" :error="getFieldError(field.name)"
                    :visible="visibility[field.name] !== false">
                    <component :is="getFieldComponent(field.type)" :id="`field-${field.name}`"
                        :model-value="formState.values[field.name]" :placeholder="field.placeholder"
                        :disabled="field.disabled || formState.fieldLoading?.[field.name]"
                        :required="field.validation?.required"
                        :aria-invalid="hasFieldError(field.name) ? 'true' : 'false'"
                        :aria-describedby="getAriaDescribedby(field.name, field.helpText)" v-bind="getFieldProps(field)"
                        @update:model-value="updateFieldValue(field.name, $event)"
                        @blur="handleFieldBlur(field.name)" />
                </FieldWrapper>
            </div>
        </FormStep>

        <!-- Navigation buttons -->
        <div class="flex justify-between pt-4 border-t border-gray-200">
            <!-- Previous button - always enabled to allow editing previous steps -->
            <BaseButton v-if="isMultiStep && !multiStep?.isFirstStep" type="button" variant="secondary"
                @click="handlePrevious">
                Previous
            </BaseButton>
            <div v-else />

            <div class="flex gap-3">
                <!-- Next button - disabled only if required fields are empty, allows proceeding even with API errors -->
                <BaseButton v-if="isMultiStep && !multiStep?.isLastStep" type="button"
                    :disabled="!canProceedToNext" @click="handleNext">
                    Next
                </BaseButton>
                <BaseButton v-else type="submit" :loading="formState.submitState === 'submitting'"
                    :disabled="formState.submitState === 'submitting'">
                    Submit
                </BaseButton>
            </div>
        </div>
    </form>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { FormConfig, FormState, FieldDefinition } from '@/types/formConfig'
import FieldWrapper from '@/components/form/FieldWrapper.vue'
import StepIndicator from '@/components/form/StepIndicator.vue'
import FormStep from '@/components/form/FormStep.vue'
import BaseInput from '@/components/base/BaseInput.vue'
import BaseTextarea from '@/components/base/BaseTextarea.vue'
import BaseSelect from '@/components/base/BaseSelect.vue'
import BaseCheckbox from '@/components/base/BaseCheckbox.vue'
import BaseRadio from '@/components/base/BaseRadio.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import { useFormValidation } from '@/composables/useFormValidation'
import { useFormSubmission } from '@/composables/useFormSubmission'
import { useMultiStep } from '@/composables/useMultiStep'
import { useConditionalFields } from '@/composables/useConditionalFields'
import { useFieldDependency } from '@/composables/useFieldDependency'
import { useDataSource } from '@/composables/useDataSource'

interface FormRendererProps {
    config: FormConfig
}

const props = defineProps<FormRendererProps>()
const emit = defineEmits<{
    submit: [payload: Record<string, any>]
    'update:values': [values: Record<string, any>]
}>()

// Form state
const formConfig = ref(props.config)
const formState = ref<FormState>({
    values: {},
    errors: {},
    touched: {},
    submitState: 'idle',
    currentStep: 0,
    visibility: {},
    fieldLoading: {},
})

// Check if form has multiple steps
const isMultiStep = computed(() => formConfig.value.steps.length > 1)

// Get current step configuration
const currentStepConfig = computed(() => {
    const step = formConfig.value.steps[formState.value.currentStep || 0]
    return step || formConfig.value.steps[0]
})

// Get all fields from current step
const currentStepFields = computed(() => {
    return currentStepConfig.value?.fields || []
})

// Conditional fields composable
const { visibility } = useConditionalFields(currentStepFields, formState)

// Field dependency composable
const { setupDependencies, isFieldDisabled } = useFieldDependency(currentStepFields, formState)

// Data source composable
const dataSource = useDataSource(formState)

// Initialize form with default values
onMounted(() => {
    // Initialize all fields from all steps
    formConfig.value.steps.forEach(step => {
        step.fields.forEach(field => {
            if (field.defaultValue !== undefined) {
                formState.value.values[field.name] = field.defaultValue
            }
        })
    })

    // Setup field dependencies
    setupDependencies()

    // Load data sources for fields with dataSource config
    currentStepFields.value.forEach(field => {
        if (field.dataSource) {
            dataSource.fetchOptions(field.name, field.dataSource)
        }
    })
})

// Validation composable
const { validateAll, validateField, validateFields, getFieldError } = useFormValidation(
    currentStepFields,
    formState
)

// Submission composable
const { submitForm, submitResponse } = useFormSubmission(
    formConfig,
    formState
)

// Multi-step composable (only for multi-step forms)
const multiStep = isMultiStep.value ? useMultiStep(formConfig, formState, validateFields) : null

// Check if user can proceed to next step (less strict - allows proceeding even with API errors)
const canProceedToNext = computed(() => {
    if (!isMultiStep.value) return true
    
    // Check if all required fields in current step are filled
    const allRequiredFilled = currentStepFields.value
        .filter((field) => field.validation?.required === true)
        .every((field) => {
            const value = formState.value.values[field.name]
            return value !== undefined && value !== null && value !== ''
        })
    
    return allRequiredFilled
})

// Track transition direction for animations
const transitionDirection = ref<'slide-left' | 'slide-right' | 'fade'>('fade')

/**
 * Maps field type to component
 */
function getFieldComponent(type: string) {
    switch (type) {
        case 'textarea':
            return BaseTextarea
        case 'select':
        case 'multi-select':
            return BaseSelect
        case 'checkbox':
        case 'toggle':
            return BaseCheckbox
        case 'radio':
            return BaseRadio
        default:
            return BaseInput
    }
}

/**
 * Gets additional props for field component
 */
function getFieldProps(field: FieldDefinition) {
    const props: Record<string, any> = {}

    // Type for input fields
    if (['text', 'email', 'password', 'number', 'tel', 'url'].includes(field.type)) {
        props.type = field.type
    }

    // Options for select/radio - use dataSource options if available
    if (field.dataSource && dataSource.options.value[field.name]) {
        props.options = dataSource.options.value[field.name]
        props.loading = dataSource.loading.value[field.name] || false
        props.error = dataSource.errors.value[field.name]
        props.onRetry = () => {
            dataSource.retryFetch(field.name, field.dataSource!)
        }
    } else if (field.props?.options) {
        props.options = field.props.options
    }

    // Name for radio groups
    if (field.type === 'radio') {
        props.name = field.name
    }

    // Label for checkbox
    if (field.type === 'checkbox' || field.type === 'toggle') {
        props.label = field.label
    }

    // Disabled state (check dependency)
    if (field.dependency) {
        props.disabled = isFieldDisabled(field) || formState.value.fieldLoading?.[field.name]
    }

    return props
}

/**
 * Updates field value and emits change
 */
function updateFieldValue(fieldName: string, value: any) {
    formState.value.values[fieldName] = value
    formState.value.touched[fieldName] = true
    emit('update:values', formState.value.values)
}

/**
 * Handles field blur event - triggers validation
 */
async function handleFieldBlur(fieldName: string) {
    formState.value.touched[fieldName] = true
    await validateField(fieldName)
}

/**
 * Checks if field has error
 */
function hasFieldError(fieldName: string): boolean {
    return Boolean(formState.value.errors[fieldName]?.length)
}

/**
 * Gets ARIA describedby attribute
 */
function getAriaDescribedby(fieldName: string, helpText?: string): string | undefined {
    const parts: string[] = []

    if (helpText) {
        parts.push(`field-${fieldName}-help`)
    }

    if (hasFieldError(fieldName)) {
        parts.push(`field-${fieldName}-error`)
    }

    return parts.length > 0 ? parts.join(' ') : undefined
}

/**
 * Handles next button click
 */
async function handleNext() {
    if (!multiStep) return

    transitionDirection.value = 'slide-left'
    const success = await multiStep.goToNext()

    if (!success) {
        // Validation failed, errors are already displayed
        console.warn('Cannot proceed to next step: validation failed')
    }
}

/**
 * Handles previous button click
 */
function handlePrevious() {
    if (!multiStep) return

    transitionDirection.value = 'slide-right'
    multiStep.goToPrevious()
}

/**
 * Handles form submission
 */
async function handleSubmit() {
    // For multi-step forms, pressing Enter should go to next step, not submit
    if (isMultiStep.value && multiStep && !multiStep.isLastStep.value) {
        await handleNext()
        return
    }

    // Final step or single-step form: validate and submit
    const isValid = await validateAll()

    if (!isValid) {
        return
    }

    const success = await submitForm()

    if (success && submitResponse.value) {
        emit('submit', submitResponse.value)
    }
}

// Expose form state for parent components
defineExpose({
    formState,
    validateAll,
    submitForm,
    multiStep,
})
</script>
