import { computed, type Ref } from 'vue'
import type { FormConfig, FormState } from '@/types/formConfig'

export interface MultiStepState {
    currentStep: number
    totalSteps: number
    isFirstStep: boolean
    isLastStep: boolean
    canProceed: boolean
}

export function useMultiStep(
    config: Ref<FormConfig>,
    formState: Ref<FormState>,
    validateFields: (fieldIds: string[]) => Promise<boolean>
) {
    const currentStep = computed({
        get: () => formState.value.currentStep ?? 0,
        set: (value: number) => {
            formState.value.currentStep = value
        },
    })

    const totalSteps = computed(() => config.value.steps.length)

    const currentStepConfig = computed(() => {
        return config.value.steps[currentStep.value] || config.value.steps[0]
    })

    const isFirstStep = computed(() => currentStep.value === 0)

    const isLastStep = computed(() => currentStep.value === totalSteps.value - 1)

    const currentStepFieldIds = computed(() => {
        return currentStepConfig.value?.fields.map((field) => field.name) || []
    })

    const canProceed = computed(() => {
        // Check if current step fields are all valid
        const stepFieldIds = currentStepFieldIds.value
        const hasErrors = stepFieldIds.some((fieldId) => {
            const errors = formState.value.errors[fieldId]
            return errors && errors.length > 0
        })

        // Check if all required fields in current step are touched and filled
        const allRequiredFilled = currentStepConfig.value?.fields
            .filter((field) => field.validation?.required === true)
            .every((field) => {
                const value = formState.value.values[field.name]
                return value !== undefined && value !== null && value !== ''
            }) ?? true

        return !hasErrors && allRequiredFilled
    })

    const state = computed<MultiStepState>(() => ({
        currentStep: currentStep.value,
        totalSteps: totalSteps.value,
        isFirstStep: isFirstStep.value,
        isLastStep: isLastStep.value,
        canProceed: canProceed.value,
    }))

    async function validateStep(): Promise<boolean> {
        const fieldIds = currentStepFieldIds.value
        return await validateFields(fieldIds)
    }

    async function goToNext(): Promise<boolean> {
        if (isLastStep.value) {
            return false
        }

        // Validate current step before proceeding
        const isValid = await validateStep()
        if (!isValid) {
            return false
        }

        currentStep.value += 1
        return true
    }

    function goToPrevious(): boolean {
        if (isFirstStep.value) {
            return false
        }

        currentStep.value -= 1
        return true
    }

    function goToStep(stepIndex: number): boolean {
        if (stepIndex < 0 || stepIndex >= totalSteps.value) {
            return false
        }

        currentStep.value = stepIndex
        return true
    }

    function reset(): void {
        currentStep.value = 0
    }

    return {
        // State
        state,
        currentStep,
        currentStepConfig,
        totalSteps,
        isFirstStep,
        isLastStep,
        canProceed,

        // Actions
        goToNext,
        goToPrevious,
        goToStep,
        validateStep,
        reset,
    }
}
