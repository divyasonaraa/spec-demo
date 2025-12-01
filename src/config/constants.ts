// Constants for form configuration
// Based on specs/001-form-config-generator/data-model.md

import type { FieldType } from '@/types/formConfig'

// Field types enum
export const FIELD_TYPES: FieldType[] = [
    'text',
    'email',
    'password',
    'number',
    'tel',
    'url',
    'textarea',
    'select',
    'multi-select',
    'checkbox',
    'radio',
    'date',
    'time',
    'datetime',
    'toggle',
    'file',
]

// Validation patterns
export const VALIDATION_PATTERNS = {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    url: /^https?:\/\/.+/,
    phone: /^\+?[\d\s\-()]+$/,
    alphanumeric: /^[a-zA-Z0-9]+$/,
    numeric: /^\d+$/,
    alpha: /^[a-zA-Z]+$/,
}

// Default validation messages
export const DEFAULT_MESSAGES = {
    required: 'This field is required',
    email: 'Please enter a valid email address',
    url: 'Please enter a valid URL',
    minLength: 'Must be at least {min} characters',
    maxLength: 'Must be at most {max} characters',
    min: 'Must be at least {min}',
    max: 'Must be at most {max}',
    pattern: 'Invalid format',
    custom: 'Validation failed',
}

// HTTP methods
export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const

// State transition actions
export const STATE_ACTIONS = ['navigate', 'nextStep', 'showMessage', 'callApi'] as const

// Conditional operators
export const CONDITIONAL_OPERATORS = [
    'equals',
    'notEquals',
    'contains',
    'notContains',
    'greaterThan',
    'lessThan',
    'greaterThanOrEqual',
    'lessThanOrEqual',
    'isEmpty',
    'isNotEmpty',
    'in',
    'notIn',
] as const
