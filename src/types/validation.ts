// Validation Type Definitions
// Based on specs/001-form-config-generator/data-model.md

import type { ConditionalRule } from './conditional'

export interface ValidationRule {
    /** Field is required */
    required?: boolean;
    requiredMessage?: string;

    /** Minimum length (for strings) */
    minLength?: number;
    minLengthMessage?: string;

    /** Maximum length (for strings) */
    maxLength?: number;
    maxLengthMessage?: string;

    /** Minimum value (for numbers) */
    min?: number;
    minMessage?: string;

    /** Maximum value (for numbers) */
    max?: number;
    maxMessage?: string;

    /** Regex pattern */
    pattern?: string | RegExp;
    patternMessage?: string;

    /** Email validation */
    email?: boolean;
    emailMessage?: string;

    /** URL validation */
    url?: boolean;
    urlMessage?: string;

    /** Custom validator function */
    custom?: {
        validator: string; // Function name or code
        message: string;
        async?: boolean;
    };

    /** Conditional validation (only validate if condition met) */
    validateIf?: ConditionalRule;
}

// Re-export Zod's ZodIssue type for error handling
export type { ZodIssue } from 'zod'
