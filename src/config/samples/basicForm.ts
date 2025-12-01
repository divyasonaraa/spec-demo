// Basic Form Sample Configuration
// Demonstrates simple single-step form with text, email, number, select, and checkbox fields

import type { FormConfig } from '@/types/formConfig'

export const basicFormConfig: FormConfig = {
    id: 'basic-form-001',
    metadata: {
        title: 'Contact Information Form',
        description: 'A simple form to collect basic contact details',
        version: '1.0.0',
        tags: ['contact', 'basic', 'demo'],
    },
    steps: [
        {
            id: 'step-1',
            title: 'Contact Details',
            description: 'Please provide your contact information',
            fields: [
                {
                    name: 'fullName',
                    type: 'text',
                    label: 'Full Name',
                    placeholder: 'Enter your full name',
                    helpText: 'Please enter your first and last name',
                    validation: {
                        required: true,
                        minLength: 2,
                        maxLength: 100,
                        requiredMessage: 'Name is required',
                        minLengthMessage: 'Name must be at least 2 characters',
                    },
                },
                {
                    name: 'email',
                    type: 'email',
                    label: 'Email Address',
                    placeholder: 'name@example.com',
                    helpText: 'We will never share your email',
                    validation: {
                        required: true,
                        email: true,
                        requiredMessage: 'Email is required',
                    },
                },
                {
                    name: 'age',
                    type: 'number',
                    label: 'Age',
                    placeholder: 'Enter your age',
                    validation: {
                        required: true,
                        min: 18,
                        max: 120,
                        requiredMessage: 'Age is required',
                        minMessage: 'You must be at least 18 years old',
                        maxMessage: 'Please enter a valid age',
                    },
                },
                {
                    name: 'country',
                    type: 'select',
                    label: 'Country',
                    placeholder: 'Select your country',
                    props: {
                        options: [
                            { label: 'United States', value: 'us' },
                            { label: 'Canada', value: 'ca' },
                            { label: 'United Kingdom', value: 'uk' },
                            { label: 'Australia', value: 'au' },
                            { label: 'Germany', value: 'de' },
                            { label: 'France', value: 'fr' },
                            { label: 'India', value: 'in' },
                            { label: 'Japan', value: 'jp' },
                        ],
                    },
                    validation: {
                        required: true,
                        requiredMessage: 'Please select a country',
                    },
                },
                {
                    name: 'newsletter',
                    type: 'checkbox',
                    label: 'Subscribe to newsletter',
                    helpText: 'Receive updates and promotions',
                    defaultValue: false,
                },
                {
                    name: 'comments',
                    type: 'textarea',
                    label: 'Additional Comments',
                    placeholder: 'Any additional information...',
                    helpText: 'Optional feedback or questions',
                    validation: {
                        maxLength: 500,
                        maxLengthMessage: 'Comments must be less than 500 characters',
                    },
                },
            ],
        },
    ],
    submitConfig: {
        endpoint: 'https://jsonplaceholder.typicode.com/posts',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        stateTransitions: [
            {
                action: 'showMessage',
                message: 'Form submitted successfully!',
                delay: 500,
            },
        ],
    },
}
