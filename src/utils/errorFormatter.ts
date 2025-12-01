// Error Formatter - Formats Zod validation errors for display
// Based on specs/001-form-config-generator/data-model.md

import type { ZodIssue } from 'zod'

export interface FormattedError {
    field: string
    message: string
    path: string[]
}

/**
 * Formats a Zod error into a user-friendly message
 */
export function formatZodError(issue: ZodIssue): FormattedError {
    const path = issue.path.map(p => String(p))
    const field = path.join('.')

    let message = issue.message

    // Customize messages based on error type
    switch (issue.code) {
        case 'invalid_type':
            if (issue.received === 'undefined' || issue.received === 'null') {
                message = 'This field is required'
            } else {
                message = `Expected ${issue.expected}, but received ${issue.received}`
            }
            break

        case 'too_small':
            if (issue.type === 'string') {
                if (issue.minimum === 1) {
                    message = 'This field is required'
                } else {
                    message = `Must be at least ${issue.minimum} characters`
                }
            } else if (issue.type === 'number') {
                message = `Must be at least ${issue.minimum}`
            } else if (issue.type === 'array') {
                message = `Must have at least ${issue.minimum} items`
            }
            break

        case 'too_big':
            if (issue.type === 'string') {
                message = `Must be at most ${issue.maximum} characters`
            } else if (issue.type === 'number') {
                message = `Must be at most ${issue.maximum}`
            } else if (issue.type === 'array') {
                message = `Must have at most ${issue.maximum} items`
            }
            break

        case 'invalid_string':
            if (issue.validation === 'email') {
                message = 'Please enter a valid email address'
            } else if (issue.validation === 'url') {
                message = 'Please enter a valid URL'
            } else if (issue.validation === 'regex') {
                message = 'Invalid format'
            }
            break

        case 'custom':
            // Use custom message if provided
            message = issue.message || 'Validation failed'
            break
    }

    return {
        field,
        message,
        path,
    }
}

/**
 * Formats an array of Zod issues into a field-keyed error map
 */
export function formatZodErrors(issues: ZodIssue[]): Record<string, string[]> {
    const errorMap: Record<string, string[]> = {}

    issues.forEach(issue => {
        const formatted = formatZodError(issue)
        const fieldName = formatted.field || 'root'

        if (!errorMap[fieldName]) {
            errorMap[fieldName] = []
        }

        errorMap[fieldName].push(formatted.message)
    })

    return errorMap
}

/**
 * Gets the first error message for a field
 */
export function getFirstError(errors: Record<string, string[]>, field: string): string | undefined {
    return errors[field]?.[0]
}

/**
 * Checks if a field has any errors
 */
export function hasError(errors: Record<string, string[]>, field: string): boolean {
    return Boolean(errors[field] && errors[field].length > 0)
}

/**
 * Gets total error count
 */
export function getErrorCount(errors: Record<string, string[]>): number {
    return Object.values(errors).reduce((sum, fieldErrors) => sum + fieldErrors.length, 0)
}

/**
 * Gets all error messages as a flat array
 */
export function getAllErrors(errors: Record<string, string[]>): string[] {
    return Object.values(errors).flat()
}
