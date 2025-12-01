// Field Dependency Composable
// Manages parent-child field dependencies with resetOnChange behavior
// Based on specs/001-form-config-generator/data-model.md

import { watch, type Ref } from 'vue'
import type { FieldDefinition, FormState } from '@/types/formConfig'

export function useFieldDependency(
    fields: Ref<FieldDefinition[]>,
    formState: Ref<FormState>
) {
    /**
     * Sets up watchers for all field dependencies
     */
    function setupDependencies() {
        fields.value.forEach((field) => {
            if (field.dependency?.parent) {
                setupDependencyWatcher(field)
            }
        })
    }

    /**
     * Sets up a watcher for a single field's dependency
     */
    function setupDependencyWatcher(field: FieldDefinition) {
        const dependency = field.dependency
        if (!dependency) return

        const parentFieldName = dependency.parent
        const resetOnChange = dependency.resetOnChange !== false // Default true

        // Watch parent field value
        watch(
            () => formState.value.values[parentFieldName],
            (newValue, oldValue) => {
                // Only react if value actually changed
                if (newValue === oldValue) return

                // Reset child field value if configured
                if (resetOnChange) {
                    resetFieldValue(field)
                }

                // Update field loading state if it has dataSource
                if (field.dataSource && dependency.reloadOnParentChange !== false) {
                    formState.value.fieldLoading = formState.value.fieldLoading || {}
                    formState.value.fieldLoading[field.name] = true
                }

                // Disabled state is handled by isFieldDisabled function
            }
        )
    }

    /**
     * Resets a field's value to its default or undefined
     */
    function resetFieldValue(field: FieldDefinition) {
        if (field.defaultValue !== undefined) {
            formState.value.values[field.name] = field.defaultValue
        } else {
            // Reset to appropriate empty value based on field type
            switch (field.type) {
                case 'checkbox':
                    formState.value.values[field.name] = false
                    break
                case 'multi-select':
                    formState.value.values[field.name] = []
                    break
                case 'number':
                    formState.value.values[field.name] = undefined
                    break
                default:
                    formState.value.values[field.name] = ''
            }
        }

        // Clear errors for this field
        if (formState.value.errors[field.name]) {
            delete formState.value.errors[field.name]
        }

        // Mark as untouched
        formState.value.touched[field.name] = false
    }

    /**
     * Checks if a field should be disabled based on its parent
     */
    function isFieldDisabled(field: FieldDefinition): boolean {
        if (!field.dependency?.parent) {
            return field.disabled || false
        }

        const dependency = field.dependency
        const disableUntilParent = dependency.disableUntilParent !== false

        if (!disableUntilParent) {
            return field.disabled || false
        }

        const parentValue = formState.value.values[dependency.parent]
        const hasParentValue =
            parentValue !== undefined && parentValue !== null && parentValue !== ''

        return !hasParentValue || field.disabled || false
    }

    return {
        setupDependencies,
        resetFieldValue,
        isFieldDisabled,
    }
}
