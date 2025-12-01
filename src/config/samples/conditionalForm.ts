import type { FormConfig } from '@/types/formConfig'

/**
 * Conditional Form Sample Configuration
 * Demonstrates conditional field visibility and dependencies with data sources
 * - Country selection triggers state/province loading
 * - Account type determines which additional fields appear
 * - Conditional business fields based on account type
 */
export const conditionalForm: FormConfig = {
  id: 'conditional-form-001',
  metadata: {
    title: 'Account Registration with Conditional Logic',
    description: 'Form with dynamic fields based on user selections',
    version: '1.0.0',
    tags: ['conditional', 'dependencies', 'data-source'],
  },
  steps: [
    {
      id: 'account-setup',
      title: 'Account Setup',
      description: 'Configure your account preferences',
      fields: [
        {
          name: 'accountType',
          label: 'Account Type',
          type: 'radio',
          props: {
            options: [
              { value: 'personal', label: 'Personal' },
              { value: 'business', label: 'Business' },
            ],
          },
          validation: {
            required: true,
            requiredMessage: 'Please select an account type',
          },
        },
        {
          name: 'fullName',
          label: 'Full Name',
          type: 'text',
          placeholder: 'Enter your full name',
          validation: {
            required: true,
            requiredMessage: 'Full name is required',
            minLength: 2,
            minLengthMessage: 'Name must be at least 2 characters',
          },
        },
        {
          name: 'email',
          label: 'Email Address',
          type: 'email',
          placeholder: 'you@example.com',
          validation: {
            required: true,
            requiredMessage: 'Email is required',
            email: true,
            emailMessage: 'Please enter a valid email address',
          },
        },
        {
          name: 'companyName',
          label: 'Company Name',
          type: 'text',
          placeholder: 'Enter your company name',
          showIf: {
            field: 'accountType',
            operator: 'equals',
            value: 'business',
          },
          validation: {
            required: true,
            requiredMessage: 'Company name is required for business accounts',
            minLength: 2,
            minLengthMessage: 'Company name must be at least 2 characters',
          },
        },
        {
          name: 'taxId',
          label: 'Tax ID / EIN',
          type: 'text',
          placeholder: 'XX-XXXXXXX',
          helpText: 'Your business tax identification number',
          showIf: {
            field: 'accountType',
            operator: 'equals',
            value: 'business',
          },
          validation: {
            pattern: '^\\d{2}-\\d{7}$',
            patternMessage: 'Tax ID must be in format XX-XXXXXXX',
          },
        },
        {
          name: 'country',
          label: 'Country',
          type: 'select',
          placeholder: 'Select your country',
          props: {
            options: [
              { value: 'us', label: 'United States' },
              { value: 'ca', label: 'Canada' },
              { value: 'gb', label: 'United Kingdom' },
              { value: 'au', label: 'Australia' },
            ],
          },
          validation: {
            required: true,
            requiredMessage: 'Please select your country',
          },
        },
        {
          name: 'state',
          label: 'State / Province',
          type: 'select',
          placeholder: 'Select your state',
          dependency: {
            parent: 'country',
            resetOnChange: true,
            disableUntilParent: true,
            reloadOnParentChange: true,
          },
          showIf: {
            field: 'country',
            operator: 'in',
            value: ['us', 'ca'],
          },
          dataSource: {
            endpoint: 'https://api.example.com/states',
            method: 'GET',
            params: {
              country: 'form:country',
            },
            from: 'data.states',
            to: {
              label: 'name',
              value: 'code',
            },
            cache: {
              enabled: true,
              ttl: 3600,
            },
          },
          validation: {
            required: true,
            requiredMessage: 'Please select your state',
          },
        },
        {
          name: 'city',
          label: 'City',
          type: 'text',
          placeholder: 'Enter your city',
          validation: {
            required: true,
            requiredMessage: 'City is required',
          },
        },
        {
          name: 'industry',
          label: 'Industry',
          type: 'select',
          placeholder: 'Select your industry',
          showIf: {
            field: 'accountType',
            operator: 'equals',
            value: 'business',
          },
          props: {
            options: [
              { value: 'tech', label: 'Technology' },
              { value: 'retail', label: 'Retail' },
              { value: 'healthcare', label: 'Healthcare' },
              { value: 'finance', label: 'Finance' },
              { value: 'manufacturing', label: 'Manufacturing' },
              { value: 'other', label: 'Other' },
            ],
          },
          validation: {
            required: true,
            requiredMessage: 'Please select your industry',
          },
        },
        {
          name: 'employeeCount',
          label: 'Number of Employees',
          type: 'select',
          placeholder: 'Select employee range',
          showIf: {
            field: 'accountType',
            operator: 'equals',
            value: 'business',
          },
          props: {
            options: [
              { value: '1-10', label: '1-10 employees' },
              { value: '11-50', label: '11-50 employees' },
              { value: '51-200', label: '51-200 employees' },
              { value: '201-500', label: '201-500 employees' },
              { value: '500+', label: '500+ employees' },
            ],
          },
        },
        {
          name: 'agreeToTerms',
          label: 'I agree to the Terms of Service and Privacy Policy',
          type: 'checkbox',
          defaultValue: false,
          validation: {
            required: true,
            requiredMessage: 'You must agree to the terms to continue',
          },
        },
        {
          name: 'newsletter',
          label: 'Subscribe to our newsletter for updates and tips',
          type: 'checkbox',
          defaultValue: false,
        },
      ],
    },
  ],
  submitConfig: {
    endpoint: 'https://api.example.com/register',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    stateTransitions: {
      onSuccess: {
        action: 'showMessage',
        message: 'Account created successfully! Welcome aboard.',
        target: '/dashboard',
      },
      onError: {
        action: 'showMessage',
        message: 'Registration failed. Please check your information and try again.',
      },
    },
  },
}
