// Validation Service - Builds Zod schemas from FormConfig validation rules
// Based on specs/001-form-config-generator/data-model.md

import { z, type ZodSchema, type ZodTypeAny } from 'zod'
import type { FieldDefinition } from '@/types/formConfig'
import type { ValidationRule } from '@/types/validation'
import { DEFAULT_MESSAGES } from '@/config/constants'

/**
 * Builds a Zod schema from field definitions
 */
export function buildZodSchema(fields: FieldDefinition[]): ZodSchema {
    const shape: Record<string, ZodTypeAny> = {}

    fields.forEach(field => {
        let fieldSchema: ZodTypeAny

        // Base schema based on field type
        switch (field.type) {
            case 'number':
                fieldSchema = z.number()
                break
            case 'email':
                fieldSchema = z.string().email(DEFAULT_MESSAGES.email)
                break
            case 'url':
                fieldSchema = z.string().url(DEFAULT_MESSAGES.url)
                break
            case 'checkbox':
                fieldSchema = z.boolean()
                break
            case 'multi-select':
                fieldSchema = z.array(z.string())
                break
            default:
                fieldSchema = z.string()
        }

        // Apply validation rules
        if (field.validation) {
            fieldSchema = applyValidationRules(fieldSchema, field.validation, field.type)
        }

        // Make field optional if not required
        if (!field.validation?.required) {
            fieldSchema = fieldSchema.optional()
        }

        shape[field.name] = fieldSchema
    })

    return z.object(shape)
}

/**
 * Applies validation rules to a Zod schema
 */
function applyValidationRules(
    schema: ZodTypeAny,
    validation: ValidationRule,
    fieldType: string
): ZodTypeAny {
    let result = schema

    // Required validation
    if (validation.required) {
        if (fieldType === 'checkbox') {
            result = result.refine((val: boolean) => val === true, {
                message: validation.requiredMessage || DEFAULT_MESSAGES.required,
            })
        } else if (fieldType === 'text' || schema instanceof z.ZodString) {
            result = (result as z.ZodString).min(1, validation.requiredMessage || DEFAULT_MESSAGES.required)
        }
    }

    // String-specific validations
    if (schema instanceof z.ZodString || fieldType !== 'number') {
        if (validation.minLength) {
            result = (result as z.ZodString).min(
                validation.minLength,
                validation.minLengthMessage || DEFAULT_MESSAGES.minLength.replace('{min}', String(validation.minLength))
            )
        }

        if (validation.maxLength) {
            result = (result as z.ZodString).max(
                validation.maxLength,
                validation.maxLengthMessage || DEFAULT_MESSAGES.maxLength.replace('{max}', String(validation.maxLength))
            )
        }

        if (validation.pattern) {
            const regex = new RegExp(validation.pattern)
            result = (result as z.ZodString).regex(regex, validation.patternMessage || DEFAULT_MESSAGES.pattern)
        }
    }

    // Number-specific validations
    if (schema instanceof z.ZodNumber || fieldType === 'number') {
        if (validation.min !== undefined) {
            result = (result as z.ZodNumber).min(
                validation.min,
                validation.minMessage || DEFAULT_MESSAGES.min.replace('{min}', String(validation.min))
            )
        }

        if (validation.max !== undefined) {
            result = (result as z.ZodNumber).max(
                validation.max,
                validation.maxMessage || DEFAULT_MESSAGES.max.replace('{max}', String(validation.max))
            )
        }
    }

    // Custom validation
    if (validation.custom) {
        result = result.refine(
            (val: any) => {
                try {
                    // Execute custom validation function
                    const fn = new Function('value', validation.custom!)
                    return fn(val)
                } catch {
                    return false
                }
            },
            {
                message: validation.customMessage || DEFAULT_MESSAGES.custom,
            }
        )
    }

    return result
}

/**
 * Validates a single field value
 */
export function validateField(value: any, field: FieldDefinition): string[] {
    try {
        const schema = buildZodSchema([field])
        schema.parse({ [field.name]: value })
        return []
    } catch (error) {
        if (error instanceof z.ZodError) {
            return error.errors.map(err => err.message)
        }
        return ['Validation failed']
    }
}
