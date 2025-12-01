// Config Parser - Validates FormConfig structure
// Based on specs/001-form-config-generator/data-model.md

import type { FormConfig } from '@/types/formConfig'
import type { ConditionalRule } from '@/types/conditional'
import { FIELD_TYPES } from '@/config/constants'

export interface ConfigValidationError {
    field?: string
    path?: string
    message: string
    severity?: 'error' | 'warning'
    suggestion?: string
}

export interface ConfigValidationResult {
    valid: boolean
    errors: ConfigValidationError[]
    warnings?: ConfigValidationError[]
}

/**
 * Validates FormConfig structure and returns detailed errors
 */
export function validateConfig(config: any): ConfigValidationResult {
    const errors: ConfigValidationError[] = []
    const warnings: ConfigValidationError[] = []

    // Check if config exists
    if (!config) {
        errors.push({
            path: 'root',
            message: 'Config object is required',
            severity: 'error',
            suggestion: 'Provide a valid FormConfig object'
        })
        return { valid: false, errors, warnings }
    }

    // Validate required top-level properties
    if (!config.id || typeof config.id !== 'string') {
        errors.push({
            path: 'id',
            message: 'Config must have a unique id (string)',
            severity: 'error',
            suggestion: 'Add "id": "unique-form-id"'
        })
    }

    if (!config.metadata) {
        errors.push({
            path: 'metadata',
            message: 'Config must have metadata object',
            severity: 'error',
            suggestion: 'Add "metadata": { "title": "...", "version": "1.0.0" }'
        })
    } else {
        if (!config.metadata.title) {
            errors.push({
                path: 'metadata.title',
                message: 'Metadata must have a title',
                severity: 'error',
                suggestion: 'Add "title" field to metadata'
            })
        }
        if (!config.metadata.version) {
            errors.push({
                path: 'metadata.version',
                message: 'Metadata must have a version',
                severity: 'error',
                suggestion: 'Add "version": "1.0.0" to metadata'
            })
        }
    }

    if (!config.steps || !Array.isArray(config.steps)) {
        errors.push({
            path: 'steps',
            message: 'Config must have steps array',
            severity: 'error',
            suggestion: 'Add "steps": [{ "id": "step1", "title": "...", "fields": [...] }]'
        })
    } else if (config.steps.length === 0) {
        errors.push({
            path: 'steps',
            message: 'Config must have at least one step',
            severity: 'error',
            suggestion: 'Add at least one step with fields'
        })
    } else {
        // Collect all field names for dependency validation
        const allFieldNames = new Set<string>()
        config.steps.forEach((step: any) => {
            step.fields?.forEach((field: any) => {
                if (field.name) allFieldNames.add(field.name)
            })
        })

        // Validate each step
        config.steps.forEach((step: any, stepIndex: number) => {
            if (!step.id) {
                errors.push({
                    path: `steps[${stepIndex}].id`,
                    message: 'Step must have an id',
                    severity: 'error',
                    suggestion: 'Add unique step id like "step-1"'
                })
            }

            if (!step.title && config.steps.length > 1) {
                errors.push({
                    path: `steps[${stepIndex}].title`,
                    message: 'Multi-step forms must have titles for each step',
                    severity: 'error',
                    suggestion: 'Add descriptive title for this step'
                })
            }

            if (!step.fields || !Array.isArray(step.fields)) {
                errors.push({
                    path: `steps[${stepIndex}].fields`,
                    message: 'Step must have fields array',
                    severity: 'error',
                    suggestion: 'Add "fields": [...]'
                })
            } else if (step.fields.length === 0) {
                warnings.push({
                    path: `steps[${stepIndex}].fields`,
                    message: 'Step has no fields',
                    severity: 'warning',
                    suggestion: 'Add at least one field to this step'
                })
            } else {
                // Validate each field
                step.fields.forEach((field: any, fieldIndex: number) => {
                    validateField(field, `steps[${stepIndex}].fields[${fieldIndex}]`, errors, warnings, allFieldNames)
                })
            }
        })

        // Check for duplicate field names across all steps
        const fieldNames = new Set<string>()
        const duplicates = new Set<string>()

        config.steps.forEach((step: any) => {
            step.fields?.forEach((field: any) => {
                if (field.name) {
                    if (fieldNames.has(field.name)) {
                        duplicates.add(field.name)
                    }
                    fieldNames.add(field.name)
                }
            })
        })

        duplicates.forEach(name => {
            errors.push({
                path: 'fields',
                message: `Duplicate field name: "${name}"`,
                severity: 'error',
                suggestion: 'Ensure all field names are unique across the form'
            })
        })

        // Check for circular dependencies
        const circularDeps = detectCircularDependencies(config)
        circularDeps.forEach(cycle => {
            errors.push({
                path: 'dependencies',
                message: `Circular dependency detected: ${cycle.join(' → ')}`,
                severity: 'error',
                suggestion: 'Remove circular references between field dependencies'
            })
        })
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
    }
}

/**
 * Validates a single field definition
 */
function validateField(
    field: any,
    path: string,
    errors: ConfigValidationError[],
    warnings: ConfigValidationError[],
    allFieldNames: Set<string>
): void {
    if (!field.name || typeof field.name !== 'string') {
        errors.push({
            path: `${path}.name`,
            message: 'Field must have a name (string)',
            severity: 'error',
            suggestion: 'Add unique field name like "email"'
        })
    }

    if (!field.type) {
        errors.push({
            path: `${path}.type`,
            message: 'Field must have a type',
            severity: 'error',
            suggestion: `Choose from: ${FIELD_TYPES.join(', ')}`
        })
    } else if (!FIELD_TYPES.includes(field.type)) {
        errors.push({
            path: `${path}.type`,
            message: `Unsupported field type "${field.type}"`,
            severity: 'error',
            suggestion: `Supported types: ${FIELD_TYPES.join(', ')}`
        })
    }

    if (!field.label) {
        warnings.push({
            path: `${path}.label`,
            message: 'Field should have a label for accessibility',
            severity: 'warning',
            suggestion: 'Add descriptive label for this field'
        })
    }

    // Validate submitField if present (dot notation check)
    if (field.submitField && typeof field.submitField === 'string') {
        if (!isValidDotNotation(field.submitField)) {
            errors.push({
                path: `${path}.submitField`,
                message: `Invalid submitField path: "${field.submitField}"`,
                severity: 'error',
                suggestion: 'Use valid dot notation like "user.profile.name"'
            })
        }
    }

    // Validate showIf references
    if (field.showIf) {
        validateConditionalRule(field.showIf, path, errors, allFieldNames)
    }

    // Validate dependency references
    if (field.dependency) {
        if (!field.dependency.parent) {
            errors.push({
                path: `${path}.dependency.parent`,
                message: 'Dependency must specify parent field',
                severity: 'error',
                suggestion: 'Add "parent": "fieldName"'
            })
        } else if (!allFieldNames.has(field.dependency.parent)) {
            errors.push({
                path: `${path}.dependency.parent`,
                message: `Parent field "${field.dependency.parent}" does not exist`,
                severity: 'error',
                suggestion: 'Reference an existing field name'
            })
        }
    }

    // Validate dataSource compatibility
    if (field.dataSource) {
        const validDataSourceTypes = ['select', 'multi-select', 'radio']
        if (!validDataSourceTypes.includes(field.type)) {
            errors.push({
                path: `${path}.dataSource`,
                message: `dataSource only supported for ${validDataSourceTypes.join(', ')} fields`,
                severity: 'error',
                suggestion: 'Remove dataSource or change field type'
            })
        }

        if (!field.dataSource.endpoint) {
            errors.push({
                path: `${path}.dataSource.endpoint`,
                message: 'dataSource must have an endpoint',
                severity: 'error',
                suggestion: 'Add "endpoint": "https://api.example.com/data"'
            })
        }

        if (!field.dataSource.from) {
            errors.push({
                path: `${path}.dataSource.from`,
                message: 'dataSource must have "from" path',
                severity: 'error',
                suggestion: 'Add "from": "data.items" to specify response path'
            })
        }

        if (!field.dataSource.to || !field.dataSource.to.label || !field.dataSource.to.value) {
            errors.push({
                path: `${path}.dataSource.to`,
                message: 'dataSource must have "to" mapping with label and value',
                severity: 'error',
                suggestion: 'Add "to": { "label": "name", "value": "id" }'
            })
        }
    }

    // Validate props for select/radio fields
    if (['select', 'radio'].includes(field.type)) {
        if (!field.dataSource && (!field.props?.options || !Array.isArray(field.props.options))) {
            warnings.push({
                path: `${path}.props.options`,
                message: `${field.type} field should have options array or dataSource`,
                severity: 'warning',
                suggestion: 'Add "props": { "options": [{ "value": "...", "label": "..." }] }'
            })
        }
    }
}

/**
 * Validates dot notation path (e.g., "user.profile.name")
 */
function isValidDotNotation(path: string): boolean {
    if (!path || typeof path !== 'string') return false

    // Split by dots and check each segment is a valid identifier
    const segments = path.split('.')
    const identifierPattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/

    return segments.every(segment => identifierPattern.test(segment))
}

/**
 * Validates conditional rule references
 */
function validateConditionalRule(
    rule: ConditionalRule,
    fieldPath: string,
    errors: ConfigValidationError[],
    allFieldNames: Set<string>
): void {
    if (rule.field && !allFieldNames.has(rule.field)) {
        errors.push({
            path: `${fieldPath}.showIf.field`,
            message: `Conditional field "${rule.field}" does not exist`,
            severity: 'error',
            suggestion: 'Reference an existing field name'
        })
    }

    // Recursively validate nested conditions
    if (rule.and) {
        rule.and.forEach(subRule => {
            validateConditionalRule(subRule, fieldPath, errors, allFieldNames)
        })
    }

    if (rule.or) {
        rule.or.forEach(subRule => {
            validateConditionalRule(subRule, fieldPath, errors, allFieldNames)
        })
    }
}

/**
 * Detects circular dependencies in field relationships
 */
function detectCircularDependencies(config: any): string[][] {
    const cycles: string[][] = []

    // Build dependency graph
    const dependencyGraph = new Map<string, string[]>()

    config.steps?.forEach((step: any) => {
        step.fields?.forEach((field: any) => {
            if (!field.name) return

            const dependencies: string[] = []

            // Add parent dependency
            if (field.dependency?.parent) {
                dependencies.push(field.dependency.parent)
            }

            // Add showIf dependencies
            if (field.showIf) {
                extractConditionalDependencies(field.showIf, dependencies)
            }

            if (dependencies.length > 0) {
                dependencyGraph.set(field.name, dependencies)
            }
        })
    })

    // Detect cycles using DFS
    const visited = new Set<string>()
    const recursionStack = new Set<string>()
    const currentPath: string[] = []

    function dfs(node: string): boolean {
        if (recursionStack.has(node)) {
            // Found a cycle - extract the cycle from currentPath
            const cycleStart = currentPath.indexOf(node)
            const cycle = [...currentPath.slice(cycleStart), node]
            cycles.push(cycle)
            return true
        }

        if (visited.has(node)) {
            return false
        }

        visited.add(node)
        recursionStack.add(node)
        currentPath.push(node)

        const dependencies = dependencyGraph.get(node) || []
        for (const dep of dependencies) {
            dfs(dep)
        }

        recursionStack.delete(node)
        currentPath.pop()
        return false
    }

    // Check all nodes
    for (const node of dependencyGraph.keys()) {
        if (!visited.has(node)) {
            dfs(node)
        }
    }

    return cycles
}

/**
 * Extracts field dependencies from conditional rules
 */
function extractConditionalDependencies(rule: ConditionalRule, dependencies: string[]): void {
    if (rule.field && !dependencies.includes(rule.field)) {
        dependencies.push(rule.field)
    }

    rule.and?.forEach(subRule => extractConditionalDependencies(subRule, dependencies))
    rule.or?.forEach(subRule => extractConditionalDependencies(subRule, dependencies))
}

/**
 * Type guard to check if object is a valid FormConfig
 */
export function isFormConfig(obj: any): obj is FormConfig {
    const result = validateConfig(obj)
    return result.valid
}
