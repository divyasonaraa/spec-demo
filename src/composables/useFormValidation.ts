// Form Validation Composable - Integrates Zod validation with form state
// Based on specs/001-form-config-generator/data-model.md

import { computed, type Ref } from 'vue'
import { z } from 'zod'
import type { FieldDefinition, FormState } from '@/types/formConfig'
import { buildZodSchema } from '@/services/validation.service'
import { formatZodErrors } from '@/utils/errorFormatter'
import { debounce } from '@/utils/debounce'

export function useFormValidation(fields: Ref<FieldDefinition[]>, formState: Ref<FormState>) {
  const schema = computed(() => buildZodSchema(fields.value))

  /**
   * Validates all form fields
   */
  const validateAll = async (): Promise<boolean> => {
    try {
      schema.value.parse(formState.value.values)
      formState.value.errors = {}
      return true
    } catch (error) {
      if (error instanceof z.ZodError) {
        formState.value.errors = formatZodErrors(error.errors)
      }
      return false
    }
  }

  /**
   * Validates a single field (immediate, for blur events)
   */
  const validateFieldImmediate = async (fieldName: string): Promise<boolean> => {
    const field = fields.value.find(f => f.name === fieldName)
    if (!field) return true

    try {
      // Build schema for just this field
      const fieldSchema = buildZodSchema([field])
      fieldSchema.parse({ [fieldName]: formState.value.values[fieldName] })
      
      // Clear errors for this field
      if (formState.value.errors[fieldName]) {
        delete formState.value.errors[fieldName]
      }
      
      return true
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = formatZodErrors(error.errors)
        formState.value.errors[fieldName] = errors[fieldName] || []
      }
      return false
    }
  }

  /**
   * Validates a single field (debounced 300ms for input events)
   */
  const validateField = debounce(validateFieldImmediate, 300)

  /**
   * Validates specific fields (for step validation)
   */
  const validateFields = async (fieldNames: string[]): Promise<boolean> => {
    const fieldsToValidate = fields.value.filter(f => fieldNames.includes(f.name))
    
    try {
      const stepSchema = buildZodSchema(fieldsToValidate)
      const stepValues = Object.fromEntries(
        fieldNames.map(name => [name, formState.value.values[name]])
      )
      
      stepSchema.parse(stepValues)
      
      // Clear errors for validated fields
      fieldNames.forEach(name => {
        if (formState.value.errors[name]) {
          delete formState.value.errors[name]
        }
      })
      
      return true
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = formatZodErrors(error.errors)
        // Only update errors for fields being validated
        fieldNames.forEach(name => {
          if (errors[name]) {
            formState.value.errors[name] = errors[name]
          } else {
            delete formState.value.errors[name]
          }
        })
      }
      return false
    }
  }

  /**
   * Clears all validation errors
   */
  const clearErrors = () => {
    formState.value.errors = {}
  }

  /**
   * Clears error for specific field
   */
  const clearFieldError = (fieldName: string) => {
    if (formState.value.errors[fieldName]) {
      delete formState.value.errors[fieldName]
    }
  }

  /**
   * Checks if form has any errors
   */
  const hasErrors = computed(() => {
    return Object.keys(formState.value.errors).length > 0
  })

  /**
   * Gets error message for a field
   */
  const getFieldError = (fieldName: string): string | undefined => {
    return formState.value.errors[fieldName]?.[0]
  }

  return {
    validateAll,
    validateField,
    validateFields,
    clearErrors,
    clearFieldError,
    hasErrors,
    getFieldError,
  }
}
