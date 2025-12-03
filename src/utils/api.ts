import axios from 'axios';

/**
 * Fetches options for the country dropdown from the API.
 */
export async function fetchOptions(): Promise<{ label: string; value: string }[]> {
    const endpoint = '/api/countries'; // Replace with actual endpoint

    try {
        const response = await axios.get(endpoint);

        // Assuming the API response contains a `data` field with an array of countries
        return response.data.map((country: { name: string; code: string }) => ({
            label: country.name,
            value: country.code,
        }));
    } catch (error) {
        console.error('Error fetching options:', error);
        throw new Error('Failed to fetch options');
    }
}
