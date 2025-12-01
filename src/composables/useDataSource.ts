// Data Source Composable
// Fetches select options from APIs with caching and error handling
// Based on specs/001-form-config-generator/data-model.md

import { ref, type Ref } from 'vue'
import type { DataSourceConfig } from '@/types/conditional'
import type { SelectOption } from '@/types/components'
import type { FormState } from '@/types/formConfig'
import { apiClient } from '@/services/api.service'
import { resolveTokensInObject } from '@/services/token.service'

interface DataSourceCache {
    data: SelectOption[]
    timestamp: number
}

// Simple in-memory cache
const cache = new Map<string, DataSourceCache>()

export function useDataSource(formState: Ref<FormState>) {
    const loading = ref<Record<string, boolean>>({})
    const errors = ref<Record<string, string>>({})
    const options = ref<Record<string, SelectOption[]>>({})

    /**
     * Fetches options from a data source
     */
    async function fetchOptions(
        fieldName: string,
        config: DataSourceConfig
    ): Promise<SelectOption[]> {
        // Check cache first
        if (config.cache?.enabled) {
            const cached = getCachedData(config.endpoint, config.cache.ttl || 300)
            if (cached) {
                options.value[fieldName] = cached
                return cached
            }
        }

        // Set loading state
        loading.value[fieldName] = true
        errors.value[fieldName] = ''

        try {
            // Resolve tokens in params and body
            const resolvedParams = config.params
                ? resolveTokensInObject(config.params, formState.value)
                : undefined

            const resolvedBody = config.body
                ? resolveTokensInObject(config.body, formState.value)
                : undefined

            // Make API request
            const response = await apiClient.request({
                url: config.endpoint,
                method: config.method || 'GET',
                params: resolvedParams,
                data: resolvedBody,
                headers: config.headers,
            })

            // Extract options from response using 'from' path
            const data = getNestedValue(response.data, config.from)

            if (!Array.isArray(data)) {
                throw new Error(`Expected array at path "${config.from}", got ${typeof data}`)
            }

            // Map data to SelectOption format
            const mappedOptions: SelectOption[] = data.map((item: any) => ({
                value: String(item[config.to.value]),
                label: String(item[config.to.label]),
            }))

            // Update state
            options.value[fieldName] = mappedOptions

            // Cache the result
            if (config.cache?.enabled) {
                setCachedData(config.endpoint, mappedOptions)
            }

            return mappedOptions
        } catch (error: any) {
            const errorMessage =
                error.response?.data?.message ||
                error.message ||
                'Failed to load options'

            errors.value[fieldName] = errorMessage
            console.error(`Data source error for ${fieldName}:`, error)

            return []
        } finally {
            loading.value[fieldName] = false
        }
    }

    /**
     * Retries fetching options after an error
     */
    async function retryFetch(fieldName: string, config: DataSourceConfig) {
        errors.value[fieldName] = ''
        return await fetchOptions(fieldName, config)
    }

    /**
     * Clears options for a field
     */
    function clearOptions(fieldName: string) {
        options.value[fieldName] = []
        errors.value[fieldName] = ''
        loading.value[fieldName] = false
    }

    /**
     * Gets cached data if still valid
     */
    function getCachedData(key: string, ttl: number): SelectOption[] | null {
        const cached = cache.get(key)
        if (!cached) return null

        const isExpired = Date.now() - cached.timestamp > ttl * 1000
        if (isExpired) {
            cache.delete(key)
            return null
        }

        return cached.data
    }

    /**
     * Stores data in cache
     */
    function setCachedData(key: string, data: SelectOption[]) {
        cache.set(key, {
            data,
            timestamp: Date.now(),
        })
    }

    /**
     * Gets nested value from object using dot notation
     */
    function getNestedValue(obj: any, path: string): any {
        return path.split('.').reduce((current, key) => {
            return current?.[key]
        }, obj)
    }

    return {
        loading,
        errors,
        options,
        fetchOptions,
        retryFetch,
        clearOptions,
    }
}
