// API Service - Axios instance with interceptors
// Based on specs/001-form-config-generator/plan.md

import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios'

/**
 * Create and configure Axios instance
 */
function createApiClient(): AxiosInstance {
    const client = axios.create({
        timeout: 10000,
        headers: {
            'Content-Type': 'application/json',
        },
    })

    // Request interceptor
    client.interceptors.request.use(
        (config) => {
            // Token resolution happens in submission composable
            return config
        },
        (error) => {
            return Promise.reject(error)
        }
    )

    // Response interceptor
    client.interceptors.response.use(
        (response) => {
            return response
        },
        (error) => {
            // Transform error for consistent handling
            const message = error.response?.data?.message || error.message || 'API request failed'
            return Promise.reject(new Error(message))
        }
    )

    return client
}

// Export singleton instance
export const apiClient = createApiClient()

/**
 * Generic GET request
 */
export async function get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await apiClient.get(url, config)
    return response.data
}

/**
 * Generic POST request
 */
export async function post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await apiClient.post(url, data, config)
    return response.data
}

/**
 * Generic PUT request
 */
export async function put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await apiClient.put(url, data, config)
    return response.data
}

/**
 * Generic PATCH request
 */
export async function patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await apiClient.patch(url, data, config)
    return response.data
}

/**
 * Generic DELETE request
 */
export async function del<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await apiClient.delete(url, config)
    return response.data
}
