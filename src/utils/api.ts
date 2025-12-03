import axios from 'axios';
import type { DataSourceConfig } from '@/types/conditional';

/**
 * Fetches options from a given API endpoint based on the DataSourceConfig.
 */
export async function fetchOptions(config: DataSourceConfig): Promise<{ label: string; value: string }[]> {
    const { endpoint, method = 'GET', params, body, from, to, headers } = config;

    try {
        const response = await axios.request({
            url: endpoint,
            method,
            params,
            data: body,
            headers,
        });

        const data = getNestedValue(response.data, from);

        if (!Array.isArray(data)) {
            throw new Error('Invalid response format: Expected an array.');
        }

        return data.map(item => ({
            label: item[to.label],
            value: item[to.value],
        }));
    } catch (error) {
        console.error('Error fetching options:', error);
        throw error;
    }
}

/**
 * Gets a value from a nested object using dot notation.
 */
function getNestedValue(obj: Record<string, any>, path: string): any {
    const keys = path.split('.');
    let current = obj;

    for (const key of keys) {
        if (current === null || current === undefined) {
            return undefined;
        }
        current = current[key];
    }

    return current;
}
