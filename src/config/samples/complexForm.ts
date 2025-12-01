// Complex Form Configuration - Showcases all features
// Combines multi-step, conditional logic, dependencies, and data sources

import type { FormConfig } from '@/types/formConfig'

export const complexForm: FormConfig = {
    id: 'complex-form',
    metadata: {
        title: 'Product Order Form',
        description: 'Comprehensive order form demonstrating all dynamic form features',
        version: '1.0.0',
    },
    steps: [
        {
            id: 'customer-info',
            title: 'Customer Information',
            description: 'Tell us about yourself',
            fields: [
                {
                    name: 'customerType',
                    label: 'Customer Type',
                    type: 'radio',
                    submitField: 'customer.type',
                    defaultValue: 'individual',
                    props: {
                        options: [
                            { value: 'individual', label: 'Individual' },
                            { value: 'business', label: 'Business' },
                        ],
                    },
                    validation: {
                        required: true,
                    },
                },
                {
                    name: 'firstName',
                    label: 'First Name',
                    type: 'text',
                    submitField: 'customer.firstName',
                    placeholder: 'John',
                    validation: {
                        required: true,
                        minLength: 2,
                    },
                },
                {
                    name: 'lastName',
                    label: 'Last Name',
                    type: 'text',
                    submitField: 'customer.lastName',
                    placeholder: 'Doe',
                    validation: {
                        required: true,
                        minLength: 2,
                    },
                },
                {
                    name: 'companyName',
                    label: 'Company Name',
                    type: 'text',
                    submitField: 'customer.company.name',
                    placeholder: 'Acme Corp',
                    showIf: {
                        field: 'customerType',
                        operator: 'equals',
                        value: 'business',
                    },
                    validation: {
                        required: true,
                        minLength: 2,
                    },
                },
                {
                    name: 'taxId',
                    label: 'Tax ID / VAT Number',
                    type: 'text',
                    submitField: 'customer.company.taxId',
                    placeholder: 'XX-1234567',
                    showIf: {
                        field: 'customerType',
                        operator: 'equals',
                        value: 'business',
                    },
                    validation: {
                        required: true,
                        pattern: '^[A-Z]{2}-\\d{7}$',
                        patternMessage: 'Format must be XX-0000000',
                    },
                },
                {
                    name: 'email',
                    label: 'Email Address',
                    type: 'email',
                    submitField: 'customer.email',
                    placeholder: 'john@example.com',
                    validation: {
                        required: true,
                        email: true,
                    },
                },
                {
                    name: 'phone',
                    label: 'Phone Number',
                    type: 'tel',
                    submitField: 'customer.phone',
                    placeholder: '+1 (555) 123-4567',
                    validation: {
                        required: true,
                        pattern: '^\\+?[1-9]\\d{1,14}$',
                        patternMessage: 'Enter a valid phone number',
                    },
                },
            ],
        },
        {
            id: 'product-selection',
            title: 'Product Selection',
            description: 'Choose your products',
            fields: [
                {
                    name: 'productCategory',
                    label: 'Product Category',
                    type: 'select',
                    submitField: 'order.category',
                    props: {
                        options: [
                            { value: 'electronics', label: 'Electronics' },
                            { value: 'clothing', label: 'Clothing' },
                            { value: 'furniture', label: 'Furniture' },
                            { value: 'books', label: 'Books' },
                        ],
                    },
                    validation: {
                        required: true,
                    },
                },
                {
                    name: 'productName',
                    label: 'Product Name',
                    type: 'text',
                    submitField: 'order.productName',
                    placeholder: 'Enter product name',
                    validation: {
                        required: true,
                        minLength: 3,
                    },
                },
                {
                    name: 'quantity',
                    label: 'Quantity',
                    type: 'number',
                    submitField: 'order.quantity',
                    defaultValue: 1,
                    props: {
                        min: 1,
                        max: 100,
                    },
                    validation: {
                        required: true,
                    },
                },
                {
                    name: 'bulkOrder',
                    label: 'This is a bulk order (10+ items)',
                    type: 'checkbox',
                    submitField: 'order.isBulk',
                    defaultValue: false,
                    showIf: {
                        field: 'quantity',
                        operator: 'greaterThanOrEqual',
                        value: 10,
                    },
                },
                {
                    name: 'bulkDiscount',
                    label: 'Bulk Discount Code',
                    type: 'text',
                    submitField: 'order.discountCode',
                    placeholder: 'Enter discount code',
                    showIf: {
                        field: 'bulkOrder',
                        operator: 'equals',
                        value: true,
                    },
                    validation: {
                        pattern: '^BULK[A-Z0-9]{6}$',
                        patternMessage: 'Format must be BULKXXXXXX',
                    },
                },
                {
                    name: 'giftWrap',
                    label: 'Add gift wrapping?',
                    type: 'checkbox',
                    submitField: 'order.giftWrap',
                    defaultValue: false,
                },
                {
                    name: 'giftMessage',
                    label: 'Gift Message',
                    type: 'textarea',
                    submitField: 'order.giftMessage',
                    placeholder: 'Enter your gift message (max 200 characters)',
                    showIf: {
                        field: 'giftWrap',
                        operator: 'equals',
                        value: true,
                    },
                    validation: {
                        maxLength: 200,
                    },
                },
            ],
        },
        {
            id: 'shipping-info',
            title: 'Shipping Information',
            description: 'Where should we send your order?',
            fields: [
                {
                    name: 'shippingAddress',
                    label: 'Street Address',
                    type: 'text',
                    submitField: 'shipping.address',
                    placeholder: '123 Main St',
                    validation: {
                        required: true,
                        minLength: 5,
                    },
                },
                {
                    name: 'shippingCity',
                    label: 'City',
                    type: 'text',
                    submitField: 'shipping.city',
                    placeholder: 'New York',
                    validation: {
                        required: true,
                        minLength: 2,
                    },
                },
                {
                    name: 'shippingCountry',
                    label: 'Country',
                    type: 'select',
                    submitField: 'shipping.country',
                    props: {
                        options: [
                            { value: 'US', label: 'United States' },
                            { value: 'CA', label: 'Canada' },
                            { value: 'UK', label: 'United Kingdom' },
                            { value: 'AU', label: 'Australia' },
                        ],
                    },
                    validation: {
                        required: true,
                    },
                },
                {
                    name: 'shippingState',
                    label: 'State/Province',
                    type: 'select',
                    submitField: 'shipping.state',
                    dependency: {
                        parent: 'shippingCountry',
                        resetOnChange: true,
                        disableUntilParent: true,
                    },
                    props: {
                        options: [
                            { value: 'NY', label: 'New York' },
                            { value: 'CA', label: 'California' },
                            { value: 'TX', label: 'Texas' },
                        ],
                    },
                    validation: {
                        required: true,
                    },
                },
                {
                    name: 'shippingZip',
                    label: 'ZIP/Postal Code',
                    type: 'text',
                    submitField: 'shipping.zipCode',
                    placeholder: '10001',
                    validation: {
                        required: true,
                        pattern: '^\\d{5}(-\\d{4})?$',
                        patternMessage: 'Enter a valid ZIP code (12345 or 12345-6789)',
                    },
                },
                {
                    name: 'shippingMethod',
                    label: 'Shipping Method',
                    type: 'radio',
                    submitField: 'shipping.method',
                    defaultValue: 'standard',
                    props: {
                        options: [
                            { value: 'standard', label: 'Standard (5-7 business days) - Free' },
                            { value: 'express', label: 'Express (2-3 business days) - $15' },
                            { value: 'overnight', label: 'Overnight - $35' },
                        ],
                    },
                    validation: {
                        required: true,
                    },
                },
                {
                    name: 'trackingUpdates',
                    label: 'Send me tracking updates via email',
                    type: 'checkbox',
                    submitField: 'shipping.trackingUpdates',
                    defaultValue: true,
                },
            ],
        },
        {
            id: 'payment-info',
            title: 'Payment Information',
            description: 'How would you like to pay?',
            fields: [
                {
                    name: 'paymentMethod',
                    label: 'Payment Method',
                    type: 'radio',
                    submitField: 'payment.method',
                    defaultValue: 'credit-card',
                    props: {
                        options: [
                            { value: 'credit-card', label: 'Credit Card' },
                            { value: 'paypal', label: 'PayPal' },
                            { value: 'bank-transfer', label: 'Bank Transfer' },
                        ],
                    },
                    validation: {
                        required: true,
                    },
                },
                {
                    name: 'cardNumber',
                    label: 'Card Number',
                    type: 'text',
                    submitField: 'payment.card.number',
                    placeholder: '1234 5678 9012 3456',
                    showIf: {
                        field: 'paymentMethod',
                        operator: 'equals',
                        value: 'credit-card',
                    },
                    validation: {
                        required: true,
                        pattern: '^\\d{13,19}$',
                        patternMessage: 'Enter a valid card number',
                    },
                },
                {
                    name: 'cardExpiry',
                    label: 'Expiry Date (MM/YY)',
                    type: 'text',
                    submitField: 'payment.card.expiry',
                    placeholder: '12/25',
                    showIf: {
                        field: 'paymentMethod',
                        operator: 'equals',
                        value: 'credit-card',
                    },
                    validation: {
                        required: true,
                        pattern: '^(0[1-9]|1[0-2])\\/\\d{2}$',
                        patternMessage: 'Format must be MM/YY',
                    },
                },
                {
                    name: 'cardCvv',
                    label: 'CVV',
                    type: 'text',
                    submitField: 'payment.card.cvv',
                    placeholder: '123',
                    showIf: {
                        field: 'paymentMethod',
                        operator: 'equals',
                        value: 'credit-card',
                    },
                    validation: {
                        required: true,
                        pattern: '^\\d{3,4}$',
                        patternMessage: 'Enter a valid CVV (3-4 digits)',
                    },
                },
                {
                    name: 'paypalEmail',
                    label: 'PayPal Email',
                    type: 'email',
                    submitField: 'payment.paypal.email',
                    placeholder: 'your-paypal@example.com',
                    showIf: {
                        field: 'paymentMethod',
                        operator: 'equals',
                        value: 'paypal',
                    },
                    validation: {
                        required: true,
                        email: true,
                    },
                },
                {
                    name: 'bankAccount',
                    label: 'Bank Account Number',
                    type: 'text',
                    submitField: 'payment.bank.accountNumber',
                    placeholder: 'Enter account number',
                    showIf: {
                        field: 'paymentMethod',
                        operator: 'equals',
                        value: 'bank-transfer',
                    },
                    validation: {
                        required: true,
                        pattern: '^\\d{10,12}$',
                        patternMessage: 'Enter a valid account number (10-12 digits)',
                    },
                },
                {
                    name: 'bankRouting',
                    label: 'Routing Number',
                    type: 'text',
                    submitField: 'payment.bank.routingNumber',
                    placeholder: 'Enter routing number',
                    showIf: {
                        field: 'paymentMethod',
                        operator: 'equals',
                        value: 'bank-transfer',
                    },
                    validation: {
                        required: true,
                        pattern: '^\\d{9}$',
                        patternMessage: 'Routing number must be 9 digits',
                    },
                },
                {
                    name: 'billingAddressSame',
                    label: 'Billing address same as shipping',
                    type: 'checkbox',
                    submitField: 'payment.billingSameAsShipping',
                    defaultValue: true,
                },
                {
                    name: 'agreeTerms',
                    label: 'I agree to the Terms of Service and Privacy Policy',
                    type: 'checkbox',
                    submitField: 'payment.agreeTerms',
                    defaultValue: false,
                    validation: {
                        required: true,
                        requiredMessage: 'You must agree to continue',
                    },
                },
            ],
        },
    ],
    submitButton: {
        text: 'Complete Order',
        loadingText: 'Processing...',
    },
    submitEndpoint: {
        url: 'https://jsonplaceholder.typicode.com/posts',
        method: 'POST',
    },
    onSuccess: {
        message: 'Order placed successfully! Check your email for confirmation.',
        redirect: '/',
    },
}
