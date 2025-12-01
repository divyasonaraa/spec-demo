// Form Submission Composable - Handles API submission and state transitions
// Based on specs/001-form-config-generator/data-model.md

import { ref, type Ref } from 'vue'
import type { FormConfig, FormState } from '@/types/formConfig'
import type { SubmitConfig } from '@/types/submission'
import { apiClient } from '@/services/api.service'
import { buildPayload } from '@/utils/payloadBuilder'

export function useFormSubmission(
    config: Ref<FormConfig>,
    formState: Ref<FormState>
) {
    const submitError = ref<string | null>(null)
    const submitResponse = ref<any>(null)

    /**
     * Submits the form to configured endpoint
     */
    const submitForm = async (visibleFields?: Set<string>): Promise<boolean> => {
        if (!config.value.submitConfig) {
            console.warn('No submit configuration provided')
            return false
        }

        submitError.value = null
        submitResponse.value = null
        formState.value.submitState = 'submitting'

        try {
            // Build submission payload
            const allFields = config.value.steps.flatMap(step => step.fields)
            const payload = buildPayload(formState.value.values, allFields, visibleFields)

            // Transform payload if function provided
            const finalPayload = config.value.submitConfig.transformPayload
                ? transformPayloadWithFunction(payload, config.value.submitConfig.transformPayload)
                : payload

            // Resolve headers with tokens
            const headers = resolveHeaders(
                config.value.submitConfig.headers || {},
                formState.value.values
            )

            // Make API request
            const response = await apiClient.request({
                method: config.value.submitConfig.method || 'POST',
                url: config.value.submitConfig.endpoint,
                data: finalPayload,
                headers,
            })

            submitResponse.value = response.data
            formState.value.submitState = 'success'

            // Handle state transitions
            await handleStateTransitions(config.value.submitConfig, response.data)

            return true
        } catch (error: any) {
            submitError.value = error.message || 'Form submission failed'
            formState.value.submitState = 'error'
            console.error('Form submission error:', error)
            return false
        }
    }

    /**
     * Resolves header tokens (form:*, store:*, response:*)
     */
    function resolveHeaders(
        headers: Record<string, string>,
        formValues: Record<string, any>
    ): Record<string, string> {
        const resolved: Record<string, string> = {}

        for (const [key, value] of Object.entries(headers)) {
            if (value.startsWith('form:')) {
                // Resolve from form values
                const fieldName = value.slice(5)
                resolved[key] = formValues[fieldName] || ''
            } else {
                resolved[key] = value
            }
        }

        return resolved
    }

    /**
     * Transforms payload using custom function string
     */
    function transformPayloadWithFunction(payload: any, fnString: string): any {
        try {
            const fn = new Function('payload', `return ${fnString}`)
            return fn(payload)
        } catch (error) {
            console.error('Payload transformation error:', error)
            return payload
        }
    }

    /**
     * Handles state transitions after successful submission
     */
    async function handleStateTransitions(
        submitConfig: SubmitConfig,
        _response: any
    ): Promise<void> {
        if (!submitConfig.stateTransitions) return

        const transitions = submitConfig.stateTransitions

        // Handle success transition
        if (transitions.onSuccess) {
            const transition = transitions.onSuccess

            // Apply delay if specified
            if (transition.delay) {
                await new Promise(resolve => setTimeout(resolve, transition.delay))
            }

            switch (transition.action) {
                case 'navigate':
                    if (transition.target) {
                        window.location.href = transition.target
                    }
                    break

                case 'showMessage':
                    if (transition.message) {
                        alert(transition.message) // TODO: Replace with toast notification
                    }
                    break

                case 'callApi':
                    if (transition.target) {
                        try {
                            await apiClient.get(transition.target)
                        } catch (error) {
                            console.error('State transition API call failed:', error)
                        }
                    }
                    break

                case 'nextStep':
                    // Handled by multi-step composable
                    break
            }
        }
    }

    /**
     * Resets submission state
     */
    const resetSubmission = () => {
        submitError.value = null
        submitResponse.value = null
        formState.value.submitState = 'idle'
    }

    return {
        submitForm,
        submitError,
        submitResponse,
        resetSubmission,
    }
}
