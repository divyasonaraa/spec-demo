// Conditional Fields Composable
// Evaluates conditional visibility rules and manages field visibility state
// Based on specs/001-form-config-generator/data-model.md

import { computed, type Ref } from 'vue'
import type { FieldDefinition, FormState } from '@/types/formConfig'
import type { ConditionalRule } from '@/types/conditional'

export function useConditionalFields(
  fields: Ref<FieldDefinition[]>,
  formState: Ref<FormState>
) {
  /**
   * Computed map of field visibility
   * Key: field name, Value: boolean (visible or not)
   */
  const visibility = computed<Record<string, boolean>>(() => {
    const visibilityMap: Record<string, boolean> = {}

    fields.value.forEach((field) => {
      // If field has showIf rule, evaluate it
      if (field.showIf) {
        visibilityMap[field.name] = evaluateCondition(field.showIf, formState.value)
      } else {
        // Field is visible by default
        visibilityMap[field.name] = true
      }
    })

    return visibilityMap
  })

  /**
   * Evaluates a conditional rule against current form state
   */
  function evaluateCondition(rule: ConditionalRule, state: FormState): boolean {
    const fieldValue = state.values[rule.field]

    // Evaluate base condition
    let result = evaluateOperator(rule.operator, fieldValue, rule.value)

    // Handle AND conditions
    if (rule.and && rule.and.length > 0) {
      const andResults = rule.and.map((subRule) => evaluateCondition(subRule, state))
      result = result && andResults.every((r) => r === true)
    }

    // Handle OR conditions
    if (rule.or && rule.or.length > 0) {
      const orResults = rule.or.map((subRule) => evaluateCondition(subRule, state))
      result = result || orResults.some((r) => r === true)
    }

    return result
  }

  /**
   * Evaluates a single operator
   */
  function evaluateOperator(
    operator: string,
    fieldValue: any,
    compareValue: any
  ): boolean {
    switch (operator) {
      case 'equals':
        return fieldValue === compareValue

      case 'notEquals':
        return fieldValue !== compareValue

      case 'contains':
        if (typeof fieldValue === 'string') {
          return fieldValue.includes(compareValue)
        }
        if (Array.isArray(fieldValue)) {
          return fieldValue.includes(compareValue)
        }
        return false

      case 'notContains':
        if (typeof fieldValue === 'string') {
          return !fieldValue.includes(compareValue)
        }
        if (Array.isArray(fieldValue)) {
          return !fieldValue.includes(compareValue)
        }
        return true

      case 'greaterThan':
        return Number(fieldValue) > Number(compareValue)

      case 'lessThan':
        return Number(fieldValue) < Number(compareValue)

      case 'greaterThanOrEqual':
        return Number(fieldValue) >= Number(compareValue)

      case 'lessThanOrEqual':
        return Number(fieldValue) <= Number(compareValue)

      case 'isEmpty':
        return (
          fieldValue === undefined ||
          fieldValue === null ||
          fieldValue === '' ||
          (Array.isArray(fieldValue) && fieldValue.length === 0)
        )

      case 'isNotEmpty':
        return !(
          fieldValue === undefined ||
          fieldValue === null ||
          fieldValue === '' ||
          (Array.isArray(fieldValue) && fieldValue.length === 0)
        )

      case 'in':
        if (Array.isArray(compareValue)) {
          return compareValue.includes(fieldValue)
        }
        return false

      case 'notIn':
        if (Array.isArray(compareValue)) {
          return !compareValue.includes(fieldValue)
        }
        return true

      default:
        console.warn(`Unknown operator: ${operator}`)
        return false
    }
  }

  return {
    visibility,
    evaluateCondition,
  }
}
