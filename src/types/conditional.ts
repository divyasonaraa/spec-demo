// Conditional Logic Type Definitions
// Based on specs/001-form-config-generator/data-model.md

export type ConditionalOperator =
    | 'equals' | 'notEquals'
    | 'contains' | 'notContains'
    | 'greaterThan' | 'lessThan' | 'greaterThanOrEqual' | 'lessThanOrEqual'
    | 'isEmpty' | 'isNotEmpty'
    | 'in' | 'notIn';

export interface ConditionalRule {
    /** Field name to check */
    field: string;

    /** Comparison operator */
    operator: ConditionalOperator;

    /** Value to compare against (not needed for isEmpty/isNotEmpty) */
    value?: any;

    /** Multiple conditions with AND/OR logic */
    and?: ConditionalRule[];
    or?: ConditionalRule[];
}

export interface DependencyConfig {
    /** Parent field name that this field depends on */
    parent: string;

    /** Reset this field's value when parent changes */
    resetOnChange?: boolean; // Default: true

    /** Disable this field until parent has a value */
    disableUntilParent?: boolean; // Default: true

    /** Reload dataSource when parent changes */
    reloadOnParentChange?: boolean; // Default: true
}

export interface DataSourceConfig {
    /** API endpoint to fetch options from */
    endpoint: string;

    /** HTTP method */
    method?: 'GET' | 'POST';

    /** Query parameters (supports token resolution) */
    params?: Record<string, any>;

    /** Request body for POST requests */
    body?: Record<string, any>;

    /** Path to options array in response (dot notation) */
    from: string; // e.g., "data.states"

    /** Mapping from response objects to select options */
    to: {
        label: string; // Key for option label
        value: string; // Key for option value
    };

    /** Headers to include in request */
    headers?: Record<string, string>;

    /** Cache options (prevent redundant API calls) */
    cache?: {
        enabled: boolean;
        ttl?: number; // Time to live in seconds
    };
}
