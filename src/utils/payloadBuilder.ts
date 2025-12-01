// Payload Builder - Transforms form values to submission payload
// Based on specs/001-form-config-generator/data-model.md

import type { FieldDefinition } from '@/types/formConfig'

/**
 * Builds submission payload from form values according to field submitField mappings
 * Supports dot notation for nested objects: "user.profile.name" → { user: { profile: { name: value } } }
 */
export function buildPayload(
    values: Record<string, any>,
    fields: FieldDefinition[],
    visibleFields?: Set<string>
): Record<string, any> {
    const payload: Record<string, any> = {}

    fields.forEach(field => {
        // Skip fields that are not visible (conditional fields)
        if (visibleFields && !visibleFields.has(field.name)) {
            return
        }

        // Skip undefined values
        const value = values[field.name]
        if (value === undefined) {
            return
        }

        // Use submitField mapping if specified, otherwise use field name
        const targetPath = field.submitField || field.name

        // Set value in payload using dot notation
        setNestedValue(payload, targetPath, value)
    })

    return payload
}

/**
 * Sets a value in a nested object using dot notation
 * Example: setNestedValue(obj, "user.profile.name", "John") → { user: { profile: { name: "John" } } }
 */
function setNestedValue(obj: Record<string, any>, path: string, value: any): void {
    const keys = path.split('.')
    let current = obj

    // Navigate/create nested structure
    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i]!
        if (!current[key] || typeof current[key] !== 'object') {
            current[key] = {}
        }
        current = current[key]
    }

    // Set the final value
    const lastKey = keys[keys.length - 1]!
    current[lastKey] = value
}

/**
 * Gets a value from a nested object using dot notation
 * Example: getNestedValue({ user: { profile: { name: "John" } } }, "user.profile.name") → "John"
 */
export function getNestedValue(obj: Record<string, any>, path: string): any {
    const keys = path.split('.')
    let current = obj

    for (const key of keys) {
        if (current === null || current === undefined) {
            return undefined
        }
        current = current[key]
    }

    return current
}

/**
 * Flattens nested object to dot notation keys
 * Example: { user: { name: "John" } } → { "user.name": "John" }
 */
export function flattenObject(obj: Record<string, any>, prefix = ''): Record<string, any> {
    const result: Record<string, any> = {}

    for (const [key, value] of Object.entries(obj)) {
        const newKey = prefix ? `${prefix}.${key}` : key

        if (value && typeof value === 'object' && !Array.isArray(value)) {
            Object.assign(result, flattenObject(value, newKey))
        } else {
            result[newKey] = value
        }
    }

    return result
}
