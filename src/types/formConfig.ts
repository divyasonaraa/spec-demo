// FormConfig Type Definitions
// Based on specs/001-form-config-generator/data-model.md

export type { SubmitConfig, StateTransition } from './submission'

export interface FormConfig {
    /** Unique identifier for this form configuration */
    id: string;

    /** Form metadata (title, description, version) */
    metadata: FormMetadata;

    /** Array of form steps (single-step forms have one step) */
    steps: StepConfig[];

    /** Submission configuration (API endpoint, method, headers, success/error transitions) */
    submitConfig?: SubmitConfig;

    /** Global form-level validation rules (cross-field validation) */
    globalValidation?: GlobalValidationRule[];
}

export interface FormMetadata {
    /** Display title for the form */
    title: string;

    /** Optional description/instructions */
    description?: string;

    /** Schema version for backward compatibility */
    version: string; // e.g., "1.0.0"

    /** Tags for categorization */
    tags?: string[];
}

export interface StepConfig {
    /** Unique identifier for this step within the form */
    id: string;

    /** Display title for step (shown in step indicator) */
    title: string;

    /** Optional description/instructions for this step */
    description?: string;

    /** Fields to display in this step */
    fields: FieldDefinition[];

    /** Conditional visibility for entire step */
    showIf?: ConditionalRule;

    /** Custom validation for this step (runs before allowing Next) */
    stepValidation?: StepValidationRule;
}

export interface StepValidationRule {
    /** Custom validation function (async supported) */
    validator?: string;

    /** Error message to show if step validation fails */
    errorMessage: string;
}

export type FieldType =
    | 'text' | 'email' | 'password' | 'number' | 'tel' | 'url'
    | 'textarea' | 'select' | 'multi-select' | 'checkbox' | 'radio'
    | 'date' | 'time' | 'datetime' | 'toggle' | 'file';

export interface FieldDefinition {
    /** Unique field name (used as key in form values and payload) */
    name: string;

    /** Field type determines which component renders it */
    type: FieldType;

    /** Display label */
    label: string;

    /** Placeholder text */
    placeholder?: string;

    /** Help text displayed below field */
    helpText?: string;

    /** Default value */
    defaultValue?: any;

    /** Validation rules */
    validation?: ValidationRule;

    /** Conditional visibility based on other fields */
    showIf?: ConditionalRule;

    /** Data source configuration for select/radio options */
    dataSource?: DataSourceConfig;

    /** Field dependency configuration */
    dependency?: DependencyConfig;

    /** Custom properties passed to field component */
    props?: Record<string, any>;

    /** Mapping to different key in submission payload */
    submitField?: string; // Supports dot notation: "user.profile.name"

    /** Disable field (computed or static) */
    disabled?: boolean;

    /** CSS classes for custom styling */
    className?: string;
}

export interface GlobalValidationRule {
    /** Rule identifier */
    id: string;

    /** Fields involved in cross-field validation */
    fields: string[];

    /** Validation function */
    validator: string;

    /** Error message */
    errorMessage: string;
}

// Import types from other modules
import type { ValidationRule } from './validation'
import type { ConditionalRule, DependencyConfig, DataSourceConfig } from './conditional'
import type { SubmitConfig } from './submission'

/** Form state management interface for reactive form data */
export interface FormState {
    /** Current form field values (field name → value) */
    values: Record<string, any>;

    /** Validation errors per field (field name → error messages) */
    errors: Record<string, string[]>;

    /** Tracks which fields have been interacted with (field name → boolean) */
    touched: Record<string, boolean>;

    /** Current submission state */
    submitState: 'idle' | 'submitting' | 'success' | 'error';

    /** Current step index for multi-step forms (0-based) */
    currentStep?: number;

    /** Field visibility map for conditional fields (field name → boolean) */
    visibility?: Record<string, boolean>;

    /** Field loading state for async data sources (field name → boolean) */
    fieldLoading?: Record<string, boolean>;
}
