// Token Resolution Service
// Resolves tokens in form configurations like form:*, store:*, response:*
// Based on specs/001-form-config-generator/data-model.md

import type { FormState } from '@/types/formConfig'

/**
 * Resolves tokens in string values
 * Supports:
 * - form:fieldName - References form field value
 * - store:key - References application store (future)
 * - response:path - References API response data
 */
export function resolveToken(
  value: string,
  formState: FormState,
  responseData?: Record<string, any>,
  storeData?: Record<string, any>
): any {
  if (typeof value !== 'string') {
    return value
  }

  // Match tokens in format: prefix:path
  const tokenPattern = /^(form|store|response):(.+)$/
  const match = value.match(tokenPattern)

  if (!match) {
    return value
  }

  const [, prefix, path] = match

  if (!path) {
    return value
  }

  switch (prefix) {
    case 'form':
      return getNestedValue(formState.values, path)
    case 'store':
      return storeData ? getNestedValue(storeData, path) : undefined
    case 'response':
      return responseData ? getNestedValue(responseData, path) : undefined
    default:
      return value
  }
}

/**
 * Resolves all tokens in an object recursively
 */
export function resolveTokensInObject(
  obj: Record<string, any>,
  formState: FormState,
  responseData?: Record<string, any>,
  storeData?: Record<string, any>
): Record<string, any> {
  const resolved: Record<string, any> = {}

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      resolved[key] = resolveToken(value, formState, responseData, storeData)
    } else if (Array.isArray(value)) {
      resolved[key] = value.map(item =>
        typeof item === 'string'
          ? resolveToken(item, formState, responseData, storeData)
          : item
      )
    } else if (value && typeof value === 'object') {
      resolved[key] = resolveTokensInObject(value, formState, responseData, storeData)
    } else {
      resolved[key] = value
    }
  }

  return resolved
}

/**
 * Gets nested value from object using dot notation
 * Example: getNestedValue({ user: { name: 'John' } }, 'user.name') => 'John'
 */
function getNestedValue(obj: Record<string, any>, path: string): any {
  return path.split('.').reduce((current, key) => {
    return current?.[key]
  }, obj)
}
